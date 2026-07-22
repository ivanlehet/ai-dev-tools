import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const toolRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const uninstall = join(toolRoot, 'uninstall.sh');
const validate = join(toolRoot, 'validate.sh');

function run(script, args, env) {
  return spawnSync('bash', [script, ...args], {
    cwd: toolRoot,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: 30000,
  });
}

test('uninstall refuses a nested receipt path that only ends with create-github-repo', () => {
  const base = mkdtempSync(join(tmpdir(), 'cgr-uninstall-'));
  const receipt = join(toolRoot, '.install-receipt');
  try {
    const home = join(base, 'home');
    const skills = join(home, '.claude', 'skills');
    const expected = join(skills, 'create-github-repo');
    const nested = join(skills, 'other', 'create-github-repo');
    mkdirSync(expected, { recursive: true });
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(nested, 'marker.txt'), 'keep-me\n');
    writeFileSync(receipt, `${nested}\n`);

    const result = run(uninstall, ['--host', 'claude'], {
      HOME: home,
      USERPROFILE: home,
      CLAUDE_CONFIG_DIR: join(home, '.claude'),
    });
    assert.notEqual(result.status, 0, `expected refuse, got: ${result.stdout}\n${result.stderr}`);
    assert.match(`${result.stderr}\n${result.stdout}`, /refusing|exact expected/i);
    assert.equal(existsSync(join(nested, 'marker.txt')), true, 'nested decoy must not be removed');
    assert.equal(existsSync(expected), true, 'expected install path must remain');
  } finally {
    rmSync(receipt, { force: true });
    rmSync(base, { recursive: true, force: true });
  }
});

test('verify-install refuses a nested receipt path that only ends with create-github-repo', () => {
  const base = mkdtempSync(join(tmpdir(), 'cgr-verify-'));
  const receipt = join(toolRoot, '.install-receipt');
  try {
    const home = join(base, 'home');
    const skills = join(home, '.claude', 'skills');
    const expected = join(skills, 'create-github-repo');
    const nested = join(skills, 'other', 'create-github-repo');
    mkdirSync(expected, { recursive: true });
    mkdirSync(nested, { recursive: true });
    writeFileSync(receipt, `${nested}\n`);

    const result = run(validate, ['--verify-install', '--host', 'claude'], {
      HOME: home,
      USERPROFILE: home,
      CLAUDE_CONFIG_DIR: join(home, '.claude'),
    });
    assert.notEqual(result.status, 0, `expected refuse, got: ${result.stdout}\n${result.stderr}`);
    assert.match(`${result.stderr}\n${result.stdout}`, /refusing|exact expected|not the exact/i);
  } finally {
    rmSync(receipt, { force: true });
    rmSync(base, { recursive: true, force: true });
  }
});

test('uninstall removes only the exact expected install path from the receipt', () => {
  const base = mkdtempSync(join(tmpdir(), 'cgr-uninstall-ok-'));
  const receipt = join(toolRoot, '.install-receipt');
  try {
    const home = join(base, 'home');
    const expected = join(home, '.claude', 'skills', 'create-github-repo');
    mkdirSync(expected, { recursive: true });
    writeFileSync(join(expected, 'SKILL.md'), '---\nname: create-github-repo\n---\n');
    writeFileSync(receipt, `${expected}\n`);

    const result = run(uninstall, ['--host', 'claude'], {
      HOME: home,
      USERPROFILE: home,
      CLAUDE_CONFIG_DIR: join(home, '.claude'),
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(expected), false, 'exact install path is removed');
    assert.equal(existsSync(receipt), false, 'receipt is cleared');
  } finally {
    rmSync(receipt, { force: true });
    rmSync(base, { recursive: true, force: true });
  }
});
