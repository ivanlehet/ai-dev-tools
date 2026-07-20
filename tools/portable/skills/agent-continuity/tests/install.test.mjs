import test from 'node:test';
import assert from 'node:assert/strict';
import { claudeHookConfig, commandString, detectPlatform, mergeNestedHooks, removeContinuityHookEntries } from '../install.mjs';

test('detects Windows and generates quoted Node hook commands', () => {
  const host = detectPlatform({
    system: 'win32', release: 'test', machine: 'x64', home: 'C:\\Users\\Test User',
    nodeExecutable: 'C:\\Program Files\\nodejs\\node.exe', nodeVersion: 'v24.0.0', nodeLts: 'Krypton',
    isWindows: true, isMacos: false, isLinux: false, isWsl: false,
  });
  assert.equal(host.family, 'windows');
  const command = commandString([host.node_executable, 'C:\\Users\\Test User\\agent-continuity.mjs', 'hook'], host);
  assert.match(command, /"C:\\Program Files\\nodejs\\node\.exe"/);
  assert.match(command, /"C:\\Users\\Test User\\agent-continuity\.mjs"/);
});

test('Claude hook config uses exec form and absolute Node executable', () => {
  const config = claudeHookConfig('/opt/node/bin/node', '/opt/me/.agent-continuity/bin/agent-continuity.mjs');
  const handlers = Object.values(config.hooks).flatMap(groups => groups.flatMap(group => group.hooks));
  assert.ok(handlers.length >= 8);
  for (const handler of handlers) {
    assert.equal(handler.command, '/opt/node/bin/node');
    assert.deepEqual(handler.args.slice(-3), ['hook', '--provider', 'claude-code']);
  }
});

test('old Python and Node continuity hooks are removed before merge', () => {
  const existing = { hooks: { SessionStart: [
    { hooks: [{ command: 'python3', args: ['/x/agent_continuity.py'] }] },
    { hooks: [{ command: '/custom/other-hook' }] },
  ] } };
  const cleaned = removeContinuityHookEntries(existing);
  assert.equal(cleaned.hooks.SessionStart.length, 1);
  const merged = mergeNestedHooks(existing, claudeHookConfig('/node', '/ac.mjs'));
  assert.equal(merged.hooks.SessionStart.length, 2);
});
