import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

test('agent-continuity: manifest is present and consistent', async () => {
  const tool = JSON.parse(await fs.readFile(path.join(root, 'manifest', 'tool.json'), 'utf8'));
  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  assert.equal(tool.name, 'agent-continuity');
  assert.equal(tool.version, pkg.version, 'tool.json version must match package.json');
  assert.ok(Array.isArray(tool.targets) && tool.targets.length > 0);
});

test('agent-continuity: runtime regression tests lock the export/handoff fix (#20)', async () => {
  const runtimeTests = await fs.readFile(path.join(root, 'tests', 'runtime.test.mjs'), 'utf8');
  for (const needle of [
    'status in_review and a filled handoff',
    'refuses placeholder-only provisional tasks',
    'not overwritten by the main checkout',
    'locator continuity_root matches',
    'surfaces underlying per-task failures',
  ]) {
    assert.ok(runtimeTests.includes(needle), `missing runtime regression test: ${needle}`);
  }
});
