import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const runtime = new URL('../scripts/agent-continuity.mjs', import.meta.url).pathname;
function run(args, { cwd, env, input } = {}) {
  return spawnSync(process.execPath, [runtime, ...args], { cwd, env: { ...process.env, ...env }, input, encoding: 'utf8', timeout: 60000 });
}
function initRepo(base) {
  const repo = join(base, 'repo');
  spawnSync('git', ['init', repo], { encoding: 'utf8' });
  spawnSync('git', ['-C', repo, 'config', 'user.email', 'test@example.com']);
  spawnSync('git', ['-C', repo, 'config', 'user.name', 'Test']);
  return repo;
}

test('snapshot and export preserve provider-neutral task state', () => {
  const base = mkdtempSync(join(tmpdir(), 'ac-runtime-'));
  try {
    const home = join(base, 'home');
    const repo = initRepo(base);
    const env = { HOME: home, USERPROFILE: home, AGENT_CONTINUITY_TASK_ID: 'portable-task' };
    const snapshot = run(['snapshot', '--cwd', repo, '--provider', 'manual', '--event', 'test'], { env });
    assert.equal(snapshot.status, 0, snapshot.stderr);
    const parsed = JSON.parse(snapshot.stdout);
    assert.equal(parsed.task_id, 'portable-task');
    const exported = run(['export', '--cwd', repo, '--target', 'codex'], { env });
    assert.equal(exported.status, 0, exported.stderr);
    const bundle = JSON.parse(exported.stdout);
    assert.equal(bundle.manifest.contains_provider_session_ids, false);
    assert.equal(bundle.manifest.contains_raw_transcripts, false);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('hook stores hashed provider run reference and does not expose raw session ID', () => {
  const base = mkdtempSync(join(tmpdir(), 'ac-hook-'));
  try {
    const home = join(base, 'home');
    const repo = initRepo(base);
    const env = { HOME: home, USERPROFILE: home };
    const payload = JSON.stringify({ hook_event_name: 'SessionStart', cwd: repo, session_id: 'RAW-SECRET-SESSION-ID' });
    const result = run(['hook', '--provider', 'claude-code'], { env, input: payload });
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /RAW-SECRET-SESSION-ID/);
    const output = JSON.parse(result.stdout);
    assert.match(output.hookSpecificOutput.additionalContext, /Provider-neutral task/);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('Claude SessionStart configures usage statusline and preserves an existing statusline', () => {
  const base = mkdtempSync(join(tmpdir(), 'ac-statusline-bootstrap-'));
  try {
    const home = join(base, 'home');
    const repo = initRepo(base);
    const claudeDir = join(home, '.claude');
    mkdirSync(claudeDir, { recursive: true });
    const original = { type: 'command', command: '/custom/statusline', padding: 2 };
    writeFileSync(join(claudeDir, 'settings.json'), `${JSON.stringify({ statusLine: original })}\n`);
    const env = { HOME: home, USERPROFILE: home };
    const payload = JSON.stringify({ hook_event_name: 'SessionStart', cwd: repo, session_id: 'statusline-bootstrap-1' });
    const result = run(['hook', '--provider', 'claude-code'], { env, input: payload });
    assert.equal(result.status, 0, result.stderr);
    const settings = JSON.parse(readFileSync(join(claudeDir, 'settings.json'), 'utf8'));
    assert.match(settings.statusLine.command, /agent-continuity\.mjs.*statusline/);
    assert.equal(settings.statusLine.refreshInterval, 15);
    const cfg = JSON.parse(readFileSync(join(home, '.agent-continuity', 'config.json'), 'utf8'));
    assert.deepEqual(cfg.original_claude_status_line, original);
    const second = run(['hook', '--provider', 'claude-code'], { env, input: payload });
    assert.equal(second.status, 0, second.stderr);
    assert.deepEqual(JSON.parse(readFileSync(join(home, '.agent-continuity', 'config.json'), 'utf8')).original_claude_status_line, original);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('Claude session title becomes the task ID without being overwritten', () => {
  const base = mkdtempSync(join(tmpdir(), 'ac-session-title-'));
  try {
    const home = join(base, 'home');
    const repo = initRepo(base);
    const env = { HOME: home, USERPROFILE: home };
    const payload = JSON.stringify({ hook_event_name: 'SessionStart', cwd: repo, session_id: 'session-title-1', session_title: 'Fix Login Redirect' });
    const result = run(['hook', '--provider', 'claude-code'], { env, input: payload });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.match(output.hookSpecificOutput.additionalContext, /Provider-neutral task: Fix-Login-Redirect/);
    assert.equal(output.hookSpecificOutput.sessionTitle, undefined);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('first prompt renames a provisional task and the Claude session', () => {
  const base = mkdtempSync(join(tmpdir(), 'ac-prompt-title-'));
  try {
    const home = join(base, 'home');
    const repo = initRepo(base);
    const env = { HOME: home, USERPROFILE: home };
    const sessionId = 'prompt-session-1';
    const start = run(['hook', '--provider', 'claude-code'], { env, input: JSON.stringify({ hook_event_name: 'SessionStart', cwd: repo, session_id: sessionId }) });
    assert.equal(start.status, 0, start.stderr);
    assert.match(JSON.parse(start.stdout).hookSpecificOutput.additionalContext, /Provider-neutral task: run-/);
    const prompt = run(['hook', '--provider', 'claude-code'], { env, input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', cwd: repo, session_id: sessionId, prompt: 'Fix login redirect bug in the dashboard' }) });
    assert.equal(prompt.status, 0, prompt.stderr);
    const output = JSON.parse(prompt.stdout);
    assert.equal(output.hookSpecificOutput.sessionTitle, 'Fix login redirect bug in the dashboard');
    const registry = JSON.parse(readFileSync(join(repo, '.git', 'agent-continuity', 'portable', 'registry.json'), 'utf8'));
    const runRecord = Object.values(registry.provider_runs).find(item => item.provider === 'claude-code');
    assert.equal(runRecord.task_id, 'Fix-login-redirect-bug-in-the-dashboard');
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('statusline records exact Claude usage and returns compact display', () => {
  const base = mkdtempSync(join(tmpdir(), 'ac-status-'));
  try {
    const home = join(base, 'home');
    const repo = initRepo(base);
    const env = { HOME: home, USERPROFILE: home };
    const payload = JSON.stringify({ cwd: repo, session_id: 'session-1', rate_limits: { five_hour: { used_percentage: 84 }, seven_day: { used_percentage: 60 } }, context_window: { used_percentage: 40 } });
    const result = run(['statusline'], { env, input: payload });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /AC ↻ checkpoint/);
    assert.match(result.stdout, /5h 84%/);
  } finally { rmSync(base, { recursive: true, force: true }); }
});
