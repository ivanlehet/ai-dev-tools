// End-to-end lifecycle verification on ISOLATED fixtures (temp dirs, never tools/).
// Exercises: generate -> validate/security -> attest -> package -> validate-package ->
// install -> verify-install -> uninstall, plus generator input validation and a
// negative security case. The bash install steps are skipped on win32 (covered by the
// cross-platform CI shell matrix instead).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkTool } from '../src/index.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const isWin = process.platform === 'win32';

function node(script, args, opts = {}) {
  return execFileSync(process.execPath, [path.join(REPO_ROOT, script), ...args], { cwd: REPO_ROOT, encoding: 'utf8', ...opts });
}
async function mkTmp(prefix) { return fs.mkdtemp(path.join(os.tmpdir(), prefix)); }
const codes = (r) => r.findings.map((f) => f.code);

test('generator rejects unsupported type/host combination', () => {
  assert.throws(() => node('scripts/create-tool.mjs', ['--type', 'rule', '--name', 'x', '--targets', 'claude', '--reviewed', '2026-07-19', '--quiet'],
    { env: { ...process.env, AI_DEV_TOOLS_ROOT: os.tmpdir() } }));
});

test('generator rejects a non-kebab name', () => {
  assert.throws(() => node('scripts/create-tool.mjs', ['--type', 'skill', '--name', 'Bad_Name', '--targets', 'claude', '--reviewed', '2026-07-19', '--quiet'],
    { env: { ...process.env, AI_DEV_TOOLS_ROOT: os.tmpdir() } }));
});

test('full lifecycle for a portable skill', async (t) => {
  const root = await mkTmp('e2e-root-');
  node('scripts/create-tool.mjs',
    ['--type', 'skill', '--name', 'life-skill', '--targets', 'claude,codex', '--summary', 'Lifecycle skill.', '--reviewed', '2026-07-19', '--cap', 'filesystemRead', '--quiet'],
    { env: { ...process.env, AI_DEV_TOOLS_ROOT: root } });
  const tool = path.join(root, 'tools/portable/skills/life-skill');

  // structural + security clean, policy blocked until attested
  assert.equal((await checkTool(tool, { categories: ['validate'] })).ok, true);
  assert.equal((await checkTool(tool, { categories: ['security'] })).ok, true);
  const before = await checkTool(tool, { categories: ['policy'] });
  assert.equal(before.ok, false);
  assert.ok(codes(before).includes('ETH001'));

  // attest the checklist -> policy passes
  const cl = path.join(tool, 'SECURITY-CHECKLIST.md');
  await fs.writeFile(cl, (await fs.readFile(cl, 'utf8')).replaceAll('- [ ]', '- [x]'));
  assert.equal((await checkTool(tool, { categories: ['policy'] })).ok, true);

  // package -> validate-package (deterministic + integrity)
  const art = path.join(await mkTmp('e2e-art-'), 'art');
  node('scripts/package-tool.mjs', [tool, art]);
  node('scripts/validate-package.mjs', [art]);
  const ck = JSON.parse(await fs.readFile(path.join(art, 'CHECKSUMS.json'), 'utf8'));
  assert.equal(ck.version, '0.1.0');
  assert.ok(ck.files.some((f) => f.path === 'SKILL.md'));

  await t.test('install / verify-install / uninstall in a sandbox', { skip: isWin }, async () => {
    const sandbox = await mkTmp('e2e-home-');
    const env = { ...process.env, CLAUDE_CONFIG_DIR: path.join(sandbox, '.claude'), CODEX_HOME: path.join(sandbox, '.codex') };
    const bash = (script, args) => execFileSync('bash', [path.join(art, script), ...args], { encoding: 'utf8', env });
    bash('install.sh', ['--host', 'claude']);
    const installed = path.join(sandbox, '.claude', 'skills', 'life-skill');
    assert.ok((await fs.stat(installed)).isDirectory());
    // installer scripts must not be left in the installed copy
    assert.equal(await exists(path.join(installed, 'install.sh')), false);
    bash('validate.sh', ['--verify-install', '--host', 'claude']);
    bash('uninstall.sh', ['--host', 'claude']);
    assert.equal(await exists(installed), false);
  });
});

test('negative: an injected secret fails security-check', async () => {
  const root = await mkTmp('e2e-neg-');
  node('scripts/create-tool.mjs',
    ['--type', 'skill', '--name', 'leaky', '--targets', 'claude', '--reviewed', '2026-07-19', '--quiet'],
    { env: { ...process.env, AI_DEV_TOOLS_ROOT: root } });
  const tool = path.join(root, 'tools/claude/skills/leaky');
  // Build AWS's documented EXAMPLE key at runtime; no secret-shaped literal in source.
  const fakeAwsKey = 'AKIA' + 'IOSFODNN7EXAMPLE';
  await fs.writeFile(path.join(tool, 'scripts.sh'), `#!/usr/bin/env bash\nexport AWS=${fakeAwsKey}\n`);
  const r = await checkTool(tool, { categories: ['security'] });
  assert.equal(r.ok, false);
  assert.ok(codes(r).includes('SEC001'));
});

async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }
