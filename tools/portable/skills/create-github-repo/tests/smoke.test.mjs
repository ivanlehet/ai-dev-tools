import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

test('create-github-repo: manifest is present and consistent', async () => {
  const tool = JSON.parse(await fs.readFile(path.join(root, 'manifest', 'tool.json'), 'utf8'));
  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  assert.equal(tool.name, 'create-github-repo');
  assert.equal(tool.version, pkg.version, 'tool.json version must match package.json');
  assert.ok(Array.isArray(tool.targets) && tool.targets.length > 0);
  assert.equal(tool.targets.sort().join(','), 'claude,codex,cursor');
  assert.ok(tool.permissions.length > 0, 'permissions must be disclosed');
  assert.ok(tool.sideEffects.length > 0, 'sideEffects must be disclosed');
  assert.equal(tool.capabilities.network, true);
  assert.equal(tool.capabilities.externalApis, true);
  assert.equal(tool.capabilities.credentials, false);
});

test('create-github-repo: SKILL.md documents public vs private paths', async () => {
  const skill = await fs.readFile(path.join(root, 'SKILL.md'), 'utf8');
  assert.match(skill, /^---\nname: create-github-repo\n/m);
  assert.match(skill, /visibility/i);
  assert.match(skill, /private/i);
  assert.match(skill, /public/i);
  assert.match(skill, /protect-master/);
  assert.match(skill, /protect-release-tags/);
  assert.match(skill, /references\/public-defaults\.md/);
  assert.match(skill, /if gh api "repos\/\$\{OWNER\}\/\$\{REPO\}"/);
});

test('create-github-repo: templates and public-defaults reference exist', async () => {
  for (const rel of [
    'references/public-defaults.md',
    'templates/SECURITY.md',
    'templates/pull_request_template.md',
    'templates/CODEOWNERS',
  ]) {
    await fs.access(path.join(root, rel));
  }
  const defaults = await fs.readFile(path.join(root, 'references', 'public-defaults.md'), 'utf8');
  assert.match(defaults, /allow_auto_merge=false/);
  assert.match(defaults, /required_status_checks/);
  assert.match(defaults, /Explicitly out of scope/);
  assert.doesNotMatch(defaults, /"type": "required_status_checks"/);
});

test('create-github-repo: host fixtures declared for each target', async () => {
  for (const host of ['claude', 'cursor', 'codex']) {
    const marker = path.join(root, 'fixtures', host, '.gitkeep');
    await fs.access(marker);
  }
});
