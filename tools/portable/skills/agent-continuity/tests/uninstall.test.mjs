import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const uninstaller = new URL('../uninstall.mjs', import.meta.url).pathname;

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
function run(args, env) {
  return spawnSync(process.execPath, [uninstaller, ...args, '--allow-non-lts'], { env: { ...process.env, ...env }, encoding: 'utf8', timeout: 60000 });
}

test('uninstall removes owned artifacts, restores the status line, and keeps foreign hooks', () => {
  const base = mkdtempSync(join(tmpdir(), 'ac-uninstall-'));
  try {
    const home = join(base, 'home');
    const runtime = join(home, '.agent-continuity');
    const skill = join(home, '.claude', 'skills', 'agent-continuity');
    const settingsPath = join(home, '.claude', 'settings.json');

    // Simulate a prior install.
    writeJson(join(runtime, 'config.json'), { original_claude_status_line: { type: 'command', command: '/custom/statusline', padding: 2 } });
    writeJson(join(runtime, 'install-manifest.json'), { providers: ['claude'], installations: { claude: skill } });
    mkdirSync(join(runtime, 'bin'), { recursive: true });
    writeFileSync(join(runtime, 'bin', 'agent-continuity.mjs'), 'x');
    mkdirSync(skill, { recursive: true });
    writeFileSync(join(skill, 'SKILL.md'), '---\nname: agent-continuity\n---\n');
    writeJson(settingsPath, {
      statusLine: { type: 'command', command: 'node /x/.agent-continuity/bin/agent-continuity.mjs statusline' },
      hooks: { SessionStart: [
        { hooks: [{ command: 'node', args: ['/x/agent-continuity.mjs', 'hook', '--provider', 'claude-code'] }] },
        { hooks: [{ command: '/custom/other-hook' }] },
      ] },
    });

    const env = { HOME: home, USERPROFILE: home };
    const result = run(['--providers', 'claude'], env);
    assert.equal(result.status, 0, result.stderr);

    assert.equal(existsSync(skill), false, 'installed skill copy is removed');
    assert.equal(existsSync(runtime), false, 'runtime directory is removed');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
    assert.deepEqual(settings.statusLine, { type: 'command', command: '/custom/statusline', padding: 2 }, 'original status line restored');
    assert.equal(settings.hooks.SessionStart.length, 1, 'foreign hook preserved');
    assert.equal(settings.hooks.SessionStart[0].hooks[0].command, '/custom/other-hook');
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('dry-run reports changes without removing anything', () => {
  const base = mkdtempSync(join(tmpdir(), 'ac-uninstall-dry-'));
  try {
    const home = join(base, 'home');
    const runtime = join(home, '.agent-continuity');
    const skill = join(home, '.cursor', 'skills', 'agent-continuity');
    writeJson(join(runtime, 'install-manifest.json'), { providers: ['cursor'], installations: { cursor: skill } });
    mkdirSync(skill, { recursive: true });
    writeFileSync(join(skill, 'SKILL.md'), 'x');

    const result = run(['--providers', 'cursor', '--dry-run'], { HOME: home, USERPROFILE: home });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /would remove/);
    assert.equal(existsSync(skill), true, 'dry-run leaves the skill copy in place');
    assert.equal(existsSync(runtime), true, 'dry-run leaves the runtime in place');
  } finally { rmSync(base, { recursive: true, force: true }); }
});
