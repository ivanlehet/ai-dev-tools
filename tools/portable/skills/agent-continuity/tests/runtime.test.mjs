import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

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
    const handoff = [
      '# Handoff: portable-task', '',
      '## Objective', '', 'Preserve provider-neutral task state across a handoff.', '',
      '## Acceptance criteria', '', '- Bundle contains no session IDs.', '',
      '## Current status', '', 'in_progress', '',
      '## Completed', '', '- Recorded portable task state.', '',
      '## In progress', '', '- Verifying the exported bundle.', '',
      '## Exact next action', '', 'Assert the exported manifest omits provider session IDs.', '',
      '## Files changed or relevant', '', '- state.json', '',
      '## Decisions and rationale', '', '- Keep the bundle provider-neutral.', '',
      '## Findings and failed approaches', '', '- None recorded.', '',
      '## Tests and validation', '', '- Runtime tests pass.', '',
      '## Known blockers or risks', '', '- None.', '',
      '## Branch, worktree, HEAD, and base', '', '- Branch: `main`', `- Worktree: \`${repo}\``, '- HEAD: `abc123`', '- Base: `main`', '',
    ].join('\n');
    writeFileSync(join(repo, '.git', 'agent-continuity', 'portable', 'tasks', 'portable-task', 'HANDOFF.md'), handoff);
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

test('export includes a task with status in_review and a filled handoff (regression #20)', () => {
  const base = mkdtempSync(join(tmpdir(), 'ac-in-review-'));
  try {
    const home = join(base, 'home');
    const repo = initRepo(base);
    const env = { HOME: home, USERPROFILE: home, AGENT_CONTINUITY_TASK_ID: 'real-task' };
    const snap = run(['snapshot', '--cwd', repo, '--provider', 'manual', '--event', 'test'], { env });
    assert.equal(snap.status, 0, snap.stderr);
    const taskDir = join(repo, '.git', 'agent-continuity', 'portable', 'tasks', 'real-task');
    const filledHandoff = [
      '# Handoff: real-task', '',
      '## Objective', '', 'Ship the login redirect fix and verify it end to end.', '',
      '## Acceptance criteria', '', '- Redirect works for expired sessions.', '',
      '## Current status', '', 'in_review', '',
      '## Completed', '', '- Implemented the redirect guard.', '',
      '## In progress', '', '- Awaiting review.', '',
      '## Exact next action', '', 'Run the e2e suite, then open the PR for review.', '',
      '## Files changed or relevant', '', '- src/auth/redirect.ts', '',
      '## Decisions and rationale', '', '- Chose a server-side redirect.', '',
      '## Findings and failed approaches', '', '- A client-side guard flashed content.', '',
      '## Tests and validation', '', '- Unit tests pass.', '',
      '## Known blockers or risks', '', '- None.', '',
      '## Branch, worktree, HEAD, and base', '', '- Branch: `main`', `- Worktree: \`${repo}\``, '- HEAD: `abc123`', '- Base: `main`', '',
    ].join('\n');
    writeFileSync(join(taskDir, 'HANDOFF.md'), filledHandoff);
    const statePath = join(taskDir, 'state.json');
    const state = JSON.parse(readFileSync(statePath, 'utf8'));
    state.status = 'in_review';
    state.objective = 'Ship the login redirect fix.';
    writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
    const registryPath = join(repo, '.git', 'agent-continuity', 'portable', 'registry.json');
    const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
    registry.tasks['real-task'].status = 'in_review';
    registry.tasks['real-task'].objective = 'Ship the login redirect fix.';
    writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
    const exported = run(['export', '--cwd', repo, '--target', 'codex'], { env });
    assert.equal(exported.status, 0, exported.stderr);
    const bundle = JSON.parse(exported.stdout);
    const ids = bundle.manifest.tasks.map(t => t.task_id);
    assert.ok(ids.includes('real-task'), `manifest tasks: ${JSON.stringify(ids)}`);
    const exportedTask = bundle.manifest.tasks.find(t => t.task_id === 'real-task');
    assert.equal(exportedTask.semantic_handoff_complete, true);
    const resume = readFileSync(bundle.resume_prompt, 'utf8');
    assert.match(resume, /real-task/);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('export includes only complete tasks and drops incomplete non-provisional ones', () => {
  const base = mkdtempSync(join(tmpdir(), 'ac-complete-only-'));
  try {
    const home = join(base, 'home');
    const repo = initRepo(base);
    const env = { HOME: home, USERPROFILE: home };
    // A complete semantic task (stable id) fully filled in.
    const completeSnap = run(['snapshot', '--cwd', repo, '--provider', 'manual', '--event', 'test', '--task', 'complete-task'], { env });
    assert.equal(completeSnap.status, 0, completeSnap.stderr);
    const completeDir = join(repo, '.git', 'agent-continuity', 'portable', 'tasks', 'complete-task');
    const filledHandoff = [
      '# Handoff: complete-task', '',
      '## Objective', '', 'Ship the complete task and verify it.', '',
      '## Acceptance criteria', '', '- Bundle contains only complete tasks.', '',
      '## Current status', '', 'in_progress', '',
      '## Completed', '', '- Implemented the guard.', '',
      '## In progress', '', '- Verifying the export.', '',
      '## Exact next action', '', 'Assert only the complete task is exported.', '',
      '## Files changed or relevant', '', '- src/thing.ts', '',
      '## Decisions and rationale', '', '- Keep it provider-neutral.', '',
      '## Findings and failed approaches', '', '- None recorded.', '',
      '## Tests and validation', '', '- Unit tests pass.', '',
      '## Known blockers or risks', '', '- None.', '',
      '## Branch, worktree, HEAD, and base', '', '- Branch: `main`', `- Worktree: \`${repo}\``, '- HEAD: `abc123`', '- Base: `main`', '',
    ].join('\n');
    writeFileSync(join(completeDir, 'HANDOFF.md'), filledHandoff);
    // An incomplete non-provisional task (stable id, but placeholders still present).
    const incompleteSnap = run(['snapshot', '--cwd', repo, '--provider', 'manual', '--event', 'test', '--task', 'incomplete-task'], { env });
    assert.equal(incompleteSnap.status, 0, incompleteSnap.stderr);
    const incompleteDir = join(repo, '.git', 'agent-continuity', 'portable', 'tasks', 'incomplete-task');
    assert.match(readFileSync(join(incompleteDir, 'HANDOFF.md'), 'utf8'), /TO BE COMPLETED BY THE AGENT/);
    const exported = run(['export', '--cwd', repo, '--target', 'codex'], { env });
    assert.equal(exported.status, 0, exported.stderr);
    const bundle = JSON.parse(exported.stdout);
    const ids = bundle.manifest.tasks.map(t => t.task_id);
    assert.deepEqual(ids.sort(), ['complete-task'], `manifest tasks: ${JSON.stringify(ids)}`);
    assert.ok(existsSync(join(bundle.bundle, 'tasks', 'complete-task', 'HANDOFF.md')));
    assert.equal(existsSync(join(bundle.bundle, 'tasks', 'incomplete-task')), false, 'incomplete task must not be copied into the bundle');
    const resume = readFileSync(bundle.resume_prompt, 'utf8');
    assert.match(resume, /complete-task/);
    assert.doesNotMatch(resume, /incomplete-task/);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('export refuses placeholder-only provisional tasks (regression #20)', () => {
  const base = mkdtempSync(join(tmpdir(), 'ac-refuse-'));
  try {
    const home = join(base, 'home');
    const repo = initRepo(base);
    const env = { HOME: home, USERPROFILE: home };
    const start = run(['hook', '--provider', 'claude-code'], { env, input: JSON.stringify({ hook_event_name: 'SessionStart', cwd: repo, session_id: 'refuse-session-1' }) });
    assert.equal(start.status, 0, start.stderr);
    assert.match(JSON.parse(start.stdout).hookSpecificOutput.additionalContext, /Provider-neutral task: run-/);
    const exported = run(['export', '--cwd', repo, '--target', 'codex'], { env });
    assert.notEqual(exported.status, 0, `export should refuse but exited 0 with stdout: ${exported.stdout}`);
    assert.match(`${exported.stderr}\n${exported.stdout}`, /refus/i);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('snapshot from a git worktree records that worktree and is not overwritten by the main checkout (regression #20)', () => {
  const base = mkdtempSync(join(tmpdir(), 'ac-worktree-'));
  try {
    const home = join(base, 'home');
    const repo = initRepo(base);
    writeFileSync(join(repo, 'README.md'), '# test\n');
    assert.equal(spawnSync('git', ['-C', repo, 'add', 'README.md']).status, 0);
    assert.equal(spawnSync('git', ['-C', repo, 'commit', '-m', 'init'], { encoding: 'utf8' }).status, 0);
    const wt = join(base, 'wt-feature');
    const added = spawnSync('git', ['-C', repo, 'worktree', 'add', wt, '-b', 'feature-x'], { encoding: 'utf8' });
    assert.equal(added.status, 0, added.stderr);
    const env = { HOME: home, USERPROFILE: home };
    const snap = run(['snapshot', '--cwd', wt, '--provider', 'manual', '--event', 'test', '--task', 'real-task'], { env });
    assert.equal(snap.status, 0, snap.stderr);
    const statePath = join(repo, '.git', 'agent-continuity', 'portable', 'tasks', 'real-task', 'state.json');
    const before = JSON.parse(readFileSync(statePath, 'utf8'));
    assert.equal(realpathSync(before.worktree), realpathSync(wt));
    const mainHook = run(['hook', '--provider', 'claude-code'], { env, input: JSON.stringify({ hook_event_name: 'SessionStart', cwd: repo, session_id: 'main-session-1' }) });
    assert.equal(mainHook.status, 0, mainHook.stderr);
    // Force ensureTask(real-task) from the divergent main checkout (SessionStart alone
    // creates a separate provisional task and would not exercise ownership preservation).
    const steal = run(['snapshot', '--cwd', repo, '--provider', 'manual', '--event', 'test', '--task', 'real-task'], { env });
    assert.equal(steal.status, 0, steal.stderr);
    const after = JSON.parse(readFileSync(statePath, 'utf8'));
    assert.equal(realpathSync(after.worktree), realpathSync(wt), 'main checkout must not steal the real task worktree');
    assert.ok(after.observed_worktree_mismatch, 'divergent checkout must record observed_worktree_mismatch');
    assert.equal(realpathSync(after.observed_worktree_mismatch.worktree), realpathSync(repo));
    const registry = JSON.parse(readFileSync(join(repo, '.git', 'agent-continuity', 'portable', 'registry.json'), 'utf8'));
    assert.equal(realpathSync(registry.tasks['real-task'].worktree), realpathSync(wt));
    const provisional = Object.keys(registry.tasks).filter(id => /^run-[0-9a-f]{16}$/.test(id));
    assert.ok(provisional.length >= 1, 'main checkout session should create a separate provisional task');
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('locator continuity_root matches the git-common-dir base (regression #20)', () => {
  const base = mkdtempSync(join(tmpdir(), 'ac-locator-'));
  try {
    const home = join(base, 'home');
    const repo = initRepo(base);
    const env = { HOME: home, USERPROFILE: home, AGENT_CONTINUITY_TASK_ID: 'locator-task' };
    const snap = run(['snapshot', '--cwd', repo, '--provider', 'manual', '--event', 'test'], { env });
    assert.equal(snap.status, 0, snap.stderr);
    const commonDir = spawnSync('git', ['-C', repo, 'rev-parse', '--git-common-dir'], { encoding: 'utf8' }).stdout.trim();
    const expectedBase = join(resolve(repo, commonDir), 'agent-continuity');
    const pointer = JSON.parse(readFileSync(join(repo, '.agent-continuity-location.json'), 'utf8'));
    assert.equal(realpathSync(pointer.continuity_root), realpathSync(expectedBase));
    const symlink = join(repo, '.agent-continuity');
    if (existsSync(symlink)) assert.equal(realpathSync(symlink), realpathSync(expectedBase));
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('rebind preserves task worktree ownership from a divergent checkout', () => {
  const base = mkdtempSync(join(tmpdir(), 'ac-rebind-'));
  try {
    const home = join(base, 'home');
    const repo = initRepo(base);
    writeFileSync(join(repo, 'README.md'), '# test\n');
    assert.equal(spawnSync('git', ['-C', repo, 'add', 'README.md']).status, 0);
    assert.equal(spawnSync('git', ['-C', repo, 'commit', '-m', 'init'], { encoding: 'utf8' }).status, 0);
    const wt = join(base, 'wt-owned');
    const added = spawnSync('git', ['-C', repo, 'worktree', 'add', wt, '-b', 'owned-branch'], { encoding: 'utf8' });
    assert.equal(added.status, 0, added.stderr);
    const env = { HOME: home, USERPROFILE: home };
    const owned = run(['snapshot', '--cwd', wt, '--provider', 'manual', '--event', 'test', '--task', 'owned-task'], { env });
    assert.equal(owned.status, 0, owned.stderr);
    const start = run(['hook', '--provider', 'claude-code'], { env, input: JSON.stringify({ hook_event_name: 'SessionStart', cwd: repo, session_id: 'rebind-session-1' }) });
    assert.equal(start.status, 0, start.stderr);
    const registryPath = join(repo, '.git', 'agent-continuity', 'portable', 'registry.json');
    const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
    const runRef = Object.keys(registry.provider_runs).find(ref => registry.provider_runs[ref].provider === 'claude-code');
    assert.ok(runRef, 'expected a claude-code provider run');
    const rebound = run(['rebind', '--cwd', repo, '--provider-run-ref', runRef, '--task', 'owned-task'], { env });
    assert.equal(rebound.status, 0, rebound.stderr);
    const state = JSON.parse(readFileSync(join(repo, '.git', 'agent-continuity', 'portable', 'tasks', 'owned-task', 'state.json'), 'utf8'));
    const after = JSON.parse(readFileSync(registryPath, 'utf8'));
    assert.equal(realpathSync(state.worktree), realpathSync(wt));
    assert.equal(realpathSync(after.tasks['owned-task'].worktree), realpathSync(wt));
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('observed_worktree_mismatch is cleared when the owned worktree hooks again', () => {
  const base = mkdtempSync(join(tmpdir(), 'ac-mismatch-clear-'));
  try {
    const home = join(base, 'home');
    const repo = initRepo(base);
    writeFileSync(join(repo, 'README.md'), 'x\n');
    assert.equal(spawnSync('git', ['-C', repo, 'add', 'README.md']).status, 0);
    assert.equal(spawnSync('git', ['-C', repo, 'commit', '-m', 'init'], { encoding: 'utf8' }).status, 0);
    const wt = join(base, 'wt-owned');
    const added = spawnSync('git', ['-C', repo, 'worktree', 'add', wt, '-b', 'owned-branch'], { encoding: 'utf8' });
    assert.equal(added.status, 0, added.stderr);
    const env = { HOME: home, USERPROFILE: home };
    assert.equal(run(['snapshot', '--cwd', wt, '--provider', 'manual', '--event', 'test', '--task', 'owned-task'], { env }).status, 0);
    const diverge = run(['hook', '--provider', 'claude-code'], { env, input: JSON.stringify({ hook_event_name: 'SessionStart', cwd: repo, session_id: 'diverge-1' }) });
    assert.equal(diverge.status, 0, diverge.stderr);
    // Force the owned task to observe a mismatch via a snapshot from main (different worktree) while task id is forced.
    const statePath = join(repo, '.git', 'agent-continuity', 'portable', 'tasks', 'owned-task', 'state.json');
    const afterDivergeHook = run(['snapshot', '--cwd', repo, '--provider', 'manual', '--event', 'test', '--task', 'owned-task'], { env });
    assert.equal(afterDivergeHook.status, 0, afterDivergeHook.stderr);
    const mismatched = JSON.parse(readFileSync(statePath, 'utf8'));
    assert.ok(mismatched.observed_worktree_mismatch, 'expected a recorded mismatch from main checkout');
    assert.equal(realpathSync(mismatched.worktree), realpathSync(wt), 'ownership must stay on owned worktree');
    const realign = run(['snapshot', '--cwd', wt, '--provider', 'manual', '--event', 'test', '--task', 'owned-task'], { env });
    assert.equal(realign.status, 0, realign.stderr);
    const cleared = JSON.parse(readFileSync(statePath, 'utf8'));
    assert.equal(cleared.observed_worktree_mismatch, undefined, 'mismatch must clear when owned worktree hooks again');
    assert.equal(realpathSync(cleared.worktree), realpathSync(wt));
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('export-global refuses when no complete semantic handoff exists', () => {
  const base = mkdtempSync(join(tmpdir(), 'ac-export-global-'));
  try {
    const home = join(base, 'home');
    const repo = initRepo(base);
    const env = { HOME: home, USERPROFILE: home };
    const start = run(['hook', '--provider', 'claude-code'], { env, input: JSON.stringify({ hook_event_name: 'SessionStart', cwd: repo, session_id: 'global-refuse-1' }) });
    assert.equal(start.status, 0, start.stderr);
    const exported = run(['export-global', '--target', 'codex'], { env });
    assert.notEqual(exported.status, 0, `export-global should refuse but exited 0: ${exported.stdout}`);
    assert.match(`${exported.stderr}\n${exported.stdout}`, /refus/i);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('export-global surfaces underlying per-task failures instead of only blaming placeholders', () => {
  const base = mkdtempSync(join(tmpdir(), 'ac-export-global-fail-'));
  try {
    const home = join(base, 'home');
    mkdirSync(join(home, '.agent-continuity', 'state'), { recursive: true });
    const env = { HOME: home, USERPROFILE: home };
    const missingWt = join(base, 'missing-worktree');
    writeFileSync(join(home, '.agent-continuity', 'state', 'runs.json'), `${JSON.stringify({
      schema_version: 7,
      updated_at: new Date().toISOString(),
      runs: {
        'claude-code-deadbeefdeadbeef': {
          provider_run_ref: 'claude-code-deadbeefdeadbeef',
          provider: 'claude-code',
          task_id: 'broken-task',
          repository: missingWt,
          git_common_dir: join(missingWt, '.git'),
          worktree: missingWt,
          branch: 'main',
          head: 'abc',
          last_event: 'SessionStart',
          lifecycle: 'active',
          updated_at: new Date().toISOString(),
        },
      },
    }, null, 2)}\n`);
    const exported = run(['export-global', '--target', 'codex'], { env });
    assert.notEqual(exported.status, 0, `export-global should refuse but exited 0: ${exported.stdout}`);
    const text = `${exported.stderr}\n${exported.stdout}`;
    assert.match(text, /refus/i);
    assert.match(text, /failed to export|Not inside a Git repository|broken-task/i);
    assert.doesNotMatch(text, /placeholders remain/);
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
