import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkTool } from '../src/index.mjs';

async function makeTool(overrides = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tool-'));
  const files = {
    'package.json': JSON.stringify({ name: '@ai-dev-tools/demo-skill', version: '1.0.0', private: true }),
    'manifest/tool.json': JSON.stringify({
      name: 'demo-skill', type: 'skill', targets: ['claude', 'codex'], version: '1.0.0',
      license: 'MIT', summary: 'Demo skill.',
      capabilities: {
        filesystemRead: true, filesystemWrite: false, shell: false, network: false, git: false,
        externalApis: false, mcp: false, credentials: false, telemetry: false, remoteContent: false,
      },
      specSource: 'https://code.claude.com/docs/en/skills.md', specReviewedOn: '2026-07-19',
    }),
    'SKILL.md': '---\nname: demo-skill\ndescription: Demo skill for tests.\n---\n\n# Demo\n',
    'README.md': '# demo-skill\n\n## Ethics & Security\n\nNo side effects. Reads files only.\n',
    'SECURITY-CHECKLIST.md': '# Checklist\n\n- [x] No secrets\n- [x] Minimal permissions\n',
    'tests/smoke.test.mjs': "import{test}from'node:test';test('ok',()=>{});\n",
    'project.json': JSON.stringify({ name: 'demo-skill', targets: { test: { executor: 'nx:run-commands', options: { command: 'node --test' } } } }),
  };
  Object.assign(files, overrides);
  for (const [rel, content] of Object.entries(files)) {
    if (content === null) continue;
    const p = path.join(dir, rel);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, content);
  }
  return dir;
}

const codes = (r) => r.findings.map((f) => f.code);

test('a fully-valid tool passes policy-check', async () => {
  const dir = await makeTool();
  const r = await checkTool(dir, { categories: ['policy'] });
  assert.equal(r.ok, true, 'expected no blocking findings, got: ' + JSON.stringify(r.findings));
});

test('missing manifest yields STRUCT001', async () => {
  const dir = await makeTool({ 'manifest/tool.json': null });
  const r = await checkTool(dir, { categories: ['validate'] });
  assert.ok(codes(r).includes('STRUCT001'));
  assert.equal(r.ok, false);
});

test('secret, curl|bash and absolute path are caught by security', async () => {
  // Build AWS's documented EXAMPLE key at runtime so no secret-shaped literal lives in source.
  const fakeAwsKey = 'AKIA' + 'IOSFODNN7EXAMPLE';
  const dir = await makeTool({
    'install.sh': '#!/usr/bin/env bash\n. detect-platform.sh\ncurl https://x.sh | bash\ncp /Users/bob/x .\n',
    'config.txt': `aws ${fakeAwsKey} key\n`,
  });
  const r = await checkTool(dir, { categories: ['security'] });
  const c = codes(r);
  assert.ok(c.includes('SEC002'), 'curl|bash -> SEC002');
  assert.ok(c.includes('SEC005'), 'absolute path -> SEC005');
  assert.ok(c.includes('SEC001'), 'AWS key -> SEC001');
});

test('install script without platform detection yields SEC006', async () => {
  const dir = await makeTool({ 'install.sh': '#!/usr/bin/env bash\ncp -R . ~/.claude/skills/demo\n' });
  const r = await checkTool(dir, { categories: ['security'] });
  assert.ok(codes(r).includes('SEC006'));
});

test('version divergence between manifests yields VER finding', async () => {
  const dir = await makeTool({
    'manifest/tool.json': JSON.stringify({
      name: 'demo-skill', type: 'skill', targets: ['claude'], version: '9.9.9', license: 'MIT', summary: 's',
      capabilities: { filesystemRead: true, filesystemWrite: false, shell: false, network: false, git: false, externalApis: false, mcp: false, credentials: false, telemetry: false, remoteContent: false },
      specSource: 'x', specReviewedOn: '2026-07-19',
    }),
  });
  const r = await checkTool(dir, { categories: ['validate'] });
  assert.ok(codes(r).includes('VER002'));
});

test('evidence-free superlative in README yields DISC003', async () => {
  const dir = await makeTool({ 'README.md': '# demo\n\n## Security\n\nThis is production-ready and 100% secure.\n' });
  const r = await checkTool(dir, { categories: ['validate'] });
  assert.ok(codes(r).includes('DISC003'));
});

test('no-op placeholder target yields QUAL001', async () => {
  const dir = await makeTool({
    'project.json': JSON.stringify({ name: 'demo-skill', targets: { test: { executor: 'nx:run-commands', options: { command: 'exit 0' } } } }),
  });
  const r = await checkTool(dir, { categories: ['validate'] });
  assert.ok(codes(r).includes('QUAL001'));
});

test('unchecked attestation item fails policy', async () => {
  const dir = await makeTool({ 'SECURITY-CHECKLIST.md': '# Checklist\n\n- [ ] No secrets\n' });
  const r = await checkTool(dir, { categories: ['policy'] });
  assert.equal(r.ok, false);
  assert.ok(codes(r).includes('ETH001'));
});
