---
name: agent-continuity
description: Preserve, checkpoint, transfer, and resume coding tasks across Claude Code, Codex, and Cursor. Use when starting or resuming substantial work, approaching usage or context limits, coordinating multiple sessions or worktrees, switching AI environments, or returning work to a previous environment.
---

# Agent Continuity

Use the portable continuity protocol for the requested operation: `$ARGUMENTS`.

## Required startup procedure

1. Read `${CLAUDE_PLUGIN_ROOT}/AGENT_CONTINUITY.md` when this variable is available. Otherwise locate `AGENT_CONTINUITY.md` next to this `SKILL.md` or at the repository root.
2. Read all applicable `CLAUDE.md`, `AGENTS.md`, and Cursor rule files.
3. Resolve the installed runtime command from `~/.agent-continuity/install-manifest.json`. Do not hardcode `node`, a version-manager shim, Unix paths, or Windows paths. Use the launcher recorded by the installer.
4. Register the current provider run and inspect the provider-specific startup quota result.
5. Load the active task's `state.json`, `HANDOFF.md`, `DECISIONS.md`, `FINDINGS.md`, `TESTS.md`, and `SESSION_HISTORY.md` before changing code.
6. Verify the actual Git repository, worktree, branch, HEAD, upstream, staged changes, unstaged changes, untracked files, and recent commits. Git and the filesystem are authoritative.
7. Detect same-worktree writer conflicts before editing.

## Mandatory behavior

- Maintain a stable provider-neutral `task_id` across Claude Code, Codex, and Cursor.
- Keep raw provider session IDs, conversation IDs, transcript paths, transcripts, credentials, tokens, cookies, `.env` values, private keys, and hidden reasoning out of portable files.
- Update continuity records after every material finding, decision, coherent edit batch, validation result, blocker, branch/worktree change, and before a substantive final response.
- Never permit two active writers in the same worktree. Isolate independent write tasks in separate worktrees or process them sequentially.
- Never reset, clean, stash, rebase, merge, discard changes, delete a worktree, or push merely to simplify recovery.
- Follow repository commit and push policies. When explicit push permission is absent, do not push.
- Never claim an exact quota when the provider did not expose one.
- When a handoff or critical threshold is pending, finish only the current atomic operation, capture validation state, update the semantic handoff, and export before starting another large operation.
- Preserve stable task IDs, branches, and worktrees during reverse transfer unless verified Git state requires reconciliation.

## Provider quota policy

### Claude Code

Use the account-wide cache populated by the installed status line. If no fresh exact sample exists at startup, enter safe bootstrap until the first native `rate_limits` and `context_window` sample arrives. Do not start a large edit, build, test suite, or subagent fan-out during safe bootstrap.

### Codex

Use the official local app-server rate-limit probe when available. Preserve the actual window duration, usage percentage, and reset time. Reuse a fresh shared sample when another simultaneous Codex session owns the probe lock.

### Cursor

Use quota information supplied through documented hooks when available, otherwise a configured trusted adapter or fresh cache. Do not scrape cookies, internal databases, credentials, or undocumented account endpoints. When exact quota is unavailable, use conservative batches and frequent checkpoints.

## Semantic checkpoint contents

Every checkpoint must preserve:

- task identity, objective, acceptance criteria, status, and exact next action;
- completed and partially completed work;
- changed files and the reason for each change;
- architectural and implementation decisions with rationale;
- findings, failed approaches, unresolved questions, blockers, risks, assumptions, and dependencies;
- tests, builds, linting, security checks, and their results;
- repository, worktree, branch, HEAD, upstream, staged/unstaged/untracked state;
- commits and push state;
- provider-neutral worker ownership and transfer history.

## Multi-session operations

For `checkpoint all`, `handoff all`, `resume all`, or equivalent requests:

1. Enumerate all active runs from the global registry.
2. Group runs by repository, stable task, and worktree.
3. Keep unrelated tasks separate even when they share a branch.
4. Detect and stop parallel writers in one worktree.
5. Snapshot all affected worktrees mechanically.
6. Request semantic checkpoints from every active run that can still respond.
7. Export one `RESUME_ALL.md` coordinator prompt plus per-task handoffs.
8. In the target environment, create separate native threads or subagents only for independent tasks with isolated worktrees. Otherwise continue sequentially.

## Transfer procedure

Before leaving the current environment:

1. Finish the current atomic operation where safe.
2. Update all semantic continuity files.
3. Capture a mechanical snapshot.
4. Verify branch, worktree, HEAD, dirty state, test state, commit state, and push state.
5. Export a repository or global bundle targeted to the next provider.
6. Report the generated `RESUME_ALL.md` path.

When taking over:

1. Read the supplied `RESUME_ALL.md` and all repository instructions.
2. Verify real Git and filesystem state.
3. Reconcile discrepancies explicitly without discarding work.
4. Preserve stable task IDs and worktree ownership.
5. Continue from each verified exact next action without repeating completed work.
6. Continue implementation after recovery; do not stop after only summarizing unless all tasks are blocked or ready for review.

## Runtime command resolution

Read `~/.agent-continuity/install-manifest.json` and select:

- `launchers.unix` on macOS, Linux, and WSL;
- `launchers.windows` on Windows.

Use that launcher for `doctor`, `usage probe`, `usage status`, `runs`, `conflicts`, `snapshot-active`, `export`, and `export-global`. If the manifest is missing, run the bundled cross-platform installer again rather than guessing an interpreter path.

## Additional resources

- Installation, upgrades, supported operating systems, and package layout: `${CLAUDE_PLUGIN_ROOT}/README.md`
- Complete operational examples and reverse-transfer workflows: `${CLAUDE_PLUGIN_ROOT}/USAGE_GUIDE.md`
- Portable protocol: `${CLAUDE_PLUGIN_ROOT}/AGENT_CONTINUITY.md`
- Known provider and platform limitations: `${CLAUDE_PLUGIN_ROOT}/references/LIMITATIONS.md`
- State and handoff schema: `${CLAUDE_PLUGIN_ROOT}/references/SCHEMA.md`
- Universal takeover prompt: `${CLAUDE_PLUGIN_ROOT}/CONTINUE_PROMPT.md`
