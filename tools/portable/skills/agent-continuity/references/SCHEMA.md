# Continuity Schema

## Repository portable registry

Path:

```text
<git-common-dir>/agent-continuity/portable/registry.json
```

Top-level structure:

```json
{
  "schema_version": 7,
  "updated_at": "ISO-8601 timestamp",
  "tasks": {},
  "provider_runs": {},
  "handoffs": []
}
```

The registry contains neutral tasks and hashed provider-run references. It must not contain raw provider session IDs or transcript paths.

## Task state

Each task lives under:

```text
portable/tasks/<task-id>/
```

`state.json` includes stable task identity, status, objective, acceptance criteria, exact next action, branch, worktree, HEAD, upstream, dirty state, provider-run references, latest snapshot, and timestamps.

### Task status

Allowed status values:

```text
planned | in_progress | blocked | ready_for_review | completed | abandoned | cancelled
```

The active statuses (included in `list`, `snapshot-all`, and `export`) are `planned`, `in_progress`, `blocked`, and `ready_for_review`. The terminal statuses `completed`, `abandoned`, and `cancelled` are not active.

`in_review` (and `review`) is accepted as an alias for `ready_for_review`. It is normalized to `ready_for_review` whenever status is persisted to the registry, so a task written as `in_review` by an agent still appears in exports and handoffs.

A task's recorded `worktree`/`branch` express ownership and are not overwritten by a hook running from a different checkout; a divergent observation is recorded under `observed_worktree_mismatch` instead. When a later hook runs again from the owned worktree, that mismatch field is cleared.

## Repository private provider map

```text
private/providers/<provider>/sessions.json
```

This maps raw local provider IDs to stable task IDs and hashed provider-run references.

Expected permissions:

```text
private/                               0700
private/providers/.../sessions.json   0600
```

The private map is never copied into a portable bundle.

## Machine-global run registry

```text
~/.agent-continuity/state/runs.json
```

Example record:

```json
{
  "provider_run_ref": "provider-hash",
  "provider": "claude-code|codex|cursor",
  "task_id": "stable-or-provisional-task-id",
  "repository": "/absolute/repository/path",
  "git_common_dir": "/absolute/git-common-dir",
  "worktree": "/absolute/worktree/path",
  "branch": "branch-name",
  "head": "commit-sha",
  "last_event": "hook-event",
  "lifecycle": "active|interrupted|ended|suspended|recent_unknown",
  "updated_at": "ISO-8601 timestamp"
}
```

Raw provider IDs are not stored in this global registry.

## Provider usage state

```text
~/.agent-continuity/state/usage/<provider>/latest.json
```

```json
{
  "schema_version": 7,
  "provider": "claude-code|codex|cursor",
  "updated_at": "ISO-8601 timestamp",
  "stage": "green|warning|checkpoint|handoff|critical|unknown",
  "source": "provider-specific source",
  "confidence": "exact|external-adapter|manual|best-effort|unavailable",
  "five_hour": 0,
  "seven_day": 0,
  "context": 0,
  "capabilities": {},
  "provider_details": {}
}
```

For Codex, `provider_details.windows` preserves each returned limit ID, name, slot, percentage, actual duration in minutes, and reset time. The compatibility fields `five_hour` and `seven_day` contain the highest primary-window and highest secondary-window percentages, which are not guaranteed to be literal five-hour and seven-day windows.

## Startup probe state

```text
~/.agent-continuity/state/startup/<provider-run-ref>.json
```

Example:

```json
{
  "schema_version": 7,
  "provider_run_ref": "provider-hash",
  "provider": "claude-code|codex|cursor",
  "phase": "ready-exact|ready-cached|ready-external|ready-hook-sample|awaiting-first-response|unknown|disabled",
  "source": "provider-specific source",
  "usage": {},
  "cache_age_seconds": 0,
  "probe_error": null,
  "continuation_issued": false,
  "created_at": "ISO-8601 timestamp",
  "updated_at": "ISO-8601 timestamp"
}
```

Claude may transition through:

```text
awaiting-first-response → ready-after-live-probe
```

The Stop hook marks `continuation_issued` when it automatically continues the original request.

## Global checkpoint requests

```text
~/.agent-continuity/state/requests/<provider-run-ref>.json
```

A request contains the affected hashed run, provider, task, repository, threshold stage, usage sample, source, confidence, request time, and acknowledgement time.

## Handoff bundles

Repository bundle:

```text
portable/handoffs/<timestamp>/
├── manifest.json
├── RESUME_ALL.md
└── tasks/<task-id>/...
```

Machine-global bundle:

```text
~/.agent-continuity/handoffs/<timestamp>/
├── manifest.json
├── RESUME_ALL.md
└── repositories/<repository-hash>/tasks/<task-id>/...
```

Both bundles are provider-neutral and support forward or reverse transfer.

## Provisional runs and rebinding

A session that cannot be safely mapped to an existing task receives a provisional `run-*` task. Semantic reconciliation may rebind it to a stable task. Raw provider IDs remain only in the private map.
