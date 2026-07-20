# Portable Agent Continuity Protocol

This protocol defines durable, provider-neutral coding-task state shared by Claude Code, Codex, and Cursor.

## 1. Purpose

Preserve enough observable state to continue work safely after:

- provider quota pressure or exhaustion;
- context compaction;
- application restart or crash;
- a move to another coding provider;
- a return to an earlier provider;
- several simultaneous sessions, branches, worktrees, or repositories.

The protocol does not transfer provider credentials, raw session IDs, raw transcripts, or hidden reasoning.

## 2. Source of truth

The actual Git repository and filesystem are authoritative.

Continuity records are durable coordination metadata. When they conflict with real state:

1. inspect the discrepancy;
2. preserve existing user work;
3. update the continuity record;
4. do not reset, clean, stash, discard, rebase, merge, or delete work merely to make metadata match.

## 3. Stable task identity

Each substantive unit of work has a stable `task_id` that survives provider changes.

Provider runs are historical/active execution records attached to that task. A raw provider session ID is never the portable task identity.

Do not merge tasks solely because they share:

- a repository;
- a branch;
- a worktree;
- similar timestamps;
- the same provider.

Use objective, acceptance criteria, changed files, findings, and explicit user intent to reconcile task identity.

## 4. Startup sequence

At every supported session start:

1. register the provider run privately;
2. resolve repository, shared Git directory, worktree, branch, HEAD, and upstream;
3. capture staged, unstaged, untracked, and recent-commit state;
4. discover the stable task or create a provisional task;
5. detect same-worktree active-writer conflicts;
6. perform the provider-specific automatic startup quota check;
7. read the existing semantic handoff;
8. apply the current usage stage before substantive work.

### Claude Code

Use a fresh exact provider-wide cache when available. Otherwise use an automatic safe-bootstrap first response, then native status-line data and Stop-hook continuation.

### Codex

Use the official local app-server rate-limit request when available. Preserve actual window duration and reset metadata.

### Cursor

Use hook-provided usage, an explicitly configured trusted adapter, or a fresh cache. When none is available, enter conservative safe mode without claiming an exact quota.

## 5. Required task files

```text
portable/tasks/<task-id>/
├── state.json
├── HANDOFF.md
├── DECISIONS.md
├── FINDINGS.md
├── TESTS.md
└── SESSION_HISTORY.md
```

### `state.json`

Must contain machine-readable task identity and current mechanical state, including:

- `task_id`;
- status;
- objective;
- acceptance criteria;
- exact next action;
- repository, worktree, branch, HEAD, upstream;
- dirty state and changed-file summary;
- provider-run references;
- current owner/run where applicable;
- timestamps.

### `HANDOFF.md`

Must contain a concise operational continuation state:

- objective and acceptance criteria;
- completed work;
- current in-progress state;
- exact next action;
- changed files and purposes;
- decisions and findings relevant to continuation;
- validation status;
- blockers and risks;
- commit/push state;
- worktree and branch ownership.

### `DECISIONS.md`

Record durable decisions, alternatives considered, and concise rationale. Do not include private chain-of-thought.

### `FINDINGS.md`

Record verified facts, failed approaches, important codebase discoveries, unresolved questions, and assumptions requiring verification.

### `TESTS.md`

Record commands executed, outcomes, failures, skipped validation, and required follow-up tests.

### `SESSION_HISTORY.md`

Record provider-neutral handoff events and hashed provider-run references. Never include raw provider IDs or transcript paths.

## 6. Checkpoint policy

Update semantic continuity after:

- a material finding;
- a durable decision;
- a coherent code-change batch;
- a test/build/lint/security result;
- a blocker or risk discovery;
- a branch/worktree change;
- a commit;
- a provider threshold request;
- pre-compaction;
- before ending substantial work;
- before switching providers.

Mechanical snapshots may occur more frequently and do not replace semantic checkpoints.

## 7. Usage stages

Default stage behavior:

- `green`: normal work with routine checkpoints;
- `warning`: increase checkpoint frequency and persist findings/decisions promptly;
- `checkpoint`: create a complete semantic and mechanical checkpoint before another large phase;
- `handoff`: finish only the current safe atomic step, validate, and create a transferable handoff;
- `critical`: do not start another large operation; secure continuity and transfer or wait;
- `unknown`: use conservative incremental work and frequent checkpoints; never claim exact quota.

Usage is provider-wide. A threshold from one provider fans out only to active runs of that provider.

## 8. Worktree ownership

One active writer per worktree.

When multiple active writers are detected:

- do not write;
- identify the owning task/run;
- suspend one run, work sequentially, or create separate worktrees;
- never auto-resolve by destructive Git operations.

## 9. Transfer

A transfer bundle is portable and provider-neutral.

Before export:

1. update all semantic task files;
2. capture current mechanical state;
3. verify worktree/branch/HEAD;
4. record validation and blockers;
5. sanitize secrets and provider-private data;
6. generate `manifest.json` and `RESUME_ALL.md`.

The target provider must verify real state before editing and continue from the exact next action.

## 10. Reverse transfer

Reverse transfer follows the same protocol. Do not create a new task merely because the provider changed.

Example:

```text
Claude task T
  → Codex run attached to T
  → Cursor run attached to T
  → Claude run attached to T
```

Each provider appends a provider-run history record while preserving stable task T, its worktree, branch, findings, decisions, validation, blockers, and next action.

## 11. Security boundary

Portable files must never contain:

- raw provider session/conversation/thread IDs;
- transcript paths or raw transcripts;
- API keys, OAuth tokens, cookies, credentials, or `.env` values;
- private keys;
- secrets copied from command output;
- hidden reasoning or chain-of-thought.

Private mappings remain local under the repository-private or machine-global continuity state with restrictive permissions.

## 12. Final report

After takeover or handoff, report each task with:

- stable task ID;
- provider/worker assignment;
- worktree;
- branch and HEAD;
- status;
- tests/validation;
- commit and push state;
- blockers;
- exact next action.
