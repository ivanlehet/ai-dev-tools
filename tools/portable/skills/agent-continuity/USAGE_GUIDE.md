# Agent Continuity — Complete Usage Guide

This guide covers validation, installation, startup quota detection, normal task operation, multi-session coordination, provider switching, reverse handoffs, and recovery.

## 1. Requirements

Use a supported Node.js LTS release:

```text
Node.js LTS 22 or newer
Recommended: latest Node.js LTS, currently Node.js 24
```

Verify the active runtime:

```bash
node -p 'process.version'
node -p 'process.release.lts || "non-LTS"'
```

Agent Continuity rejects a non-LTS Node release by default, even when its major version is newer.

Other requirements:

- Git on `PATH`;
- Bash 3.2+ for `.sh` entrypoints;
- Claude Code, Codex, or Cursor for their respective integrations.

No `npm install` and no Python installation are required.

## 2. Validate the package

macOS, Linux, WSL, or Git Bash:

```bash
./validate.sh
```

Windows PowerShell:

```powershell
node .\validate.mjs
```

Use a specific Node LTS binary:

```bash
AGENT_CONTINUITY_NODE=/absolute/path/to/node ./validate.sh
```

Useful validator options:

```bash
./validate.sh --package-only
./validate.sh --skip-tests
./validate.sh --skip-claude
./validate.sh --json
```

The development-only `--allow-non-lts` option bypasses the LTS check. Do not use it for a normal installation.

## 3. Install

### Claude Code plugin installation

From the package directory:

```bash
./install.sh --global-only --providers claude
```

Restart Claude Code after installation. Claude discovers the package from `~/.claude/skills/agent-continuity/` and lists it as `agent-continuity@skills-dir`.

### macOS, Linux, WSL, or Git Bash

```bash
./install.sh /absolute/path/to/repository
```

### Windows PowerShell

```powershell
node .\install.mjs C:\absolute\path\to\repository
```

The installer detects the operating system, architecture, WSL/native Windows state, home directory, exact Node executable, path rules, and safe deployment mode.

### Installation variants

```bash
./install.sh --global-only
./install.sh /path/to/repository --project-only
./install.sh /path/to/repository --providers claude,codex
./install.sh /path/to/repository --link-mode copy
./install.sh /path/to/repository --dry-run
```

## 4. Verify installation

macOS, Linux, or WSL:

```bash
~/.agent-continuity/bin/agent-continuity doctor --cwd /path/to/repository
```

Windows:

```powershell
& "$HOME\.agent-continuity\bin\agent-continuity.cmd" doctor --cwd C:\path\to\repository
```

Read the installation manifest:

```text
~/.agent-continuity/install-manifest.json
```

Confirm that it contains:

- `host.node_executable`;
- an LTS codename in `host.node_lts`;
- selected providers;
- runtime and launcher paths.

Reload or restart the AI clients after installation.

For Claude Code, confirm the installed entry:

```bash
claude plugin list
```

The plugin appears as `agent-continuity@skills-dir`.

## 5. What happens at session start

Every provider run is registered with a hashed provider-run reference. Raw provider IDs remain in the private local layer.

The startup hook records:

- provider;
- repository and shared Git directory;
- worktree;
- branch, HEAD, and upstream;
- staged, unstaged, and untracked state;
- active task binding;
- lifecycle event;
- provider quota state when available;
- same-worktree writer conflicts.

### Claude Code

At `SessionStart`, Claude may not yet provide fresh account quota data. The runtime uses:

1. a fresh exact account-wide cache when available;
2. otherwise a safe bootstrap cycle;
3. exact status-line data after the first response;
4. a Stop-hook continuation that resumes the original request automatically when safe.

During safe bootstrap, the agent should inspect continuity metadata but should not begin a large edit, build, full test suite, or subagent fan-out.

### Codex

At startup, the runtime:

1. registers the run;
2. acquires a provider-wide startup lock;
3. starts the local Codex app server;
4. requests account rate limits;
5. stores the exact windows and reset metadata;
6. shares the fresh result with other simultaneous Codex runs.

If the probe fails, it uses a fresh cache or conservative unknown mode.

### Cursor

At startup, the runtime:

1. registers the conversation;
2. reads documented usage fields from the hook payload when present;
3. otherwise invokes a configured trusted adapter;
4. otherwise uses a fresh cache;
5. otherwise enters conservative unknown mode.

It does not inspect cookies, credentials, internal account databases, or undocumented endpoints.

## 6. Start a task

In Claude Code:

```text
/agent-continuity start task implement-session-handoff
```

The initial task record should include:

- stable `task_id`;
- objective;
- acceptance criteria;
- current status;
- worktree and branch;
- exact next action;
- provider-run ownership.

The skill may also activate automatically for substantial work because it remains model-invocable.

## 7. Resume a task

```text
/agent-continuity resume task <task-id>
```

The receiving agent must:

1. read `state.json` and all semantic handoff files;
2. verify actual Git state;
3. reconcile discrepancies explicitly;
4. preserve the stable task ID;
5. continue from the verified exact next action;
6. avoid repeating completed work.

## 8. Checkpoint the current task

```text
/agent-continuity checkpoint current
```

A complete checkpoint includes both:

- mechanical state: Git, worktree, branch, HEAD, upstream, dirty state, changed-file summary, recent commits;
- semantic state: objective, decisions, findings, partial work, failed approaches, tests, blockers, and exact next action.

## 9. Checkpoint all active sessions

```text
/agent-continuity checkpoint all
```

The coordinator should:

1. enumerate all active provider runs;
2. group them by repository, stable task, and worktree;
3. mechanically snapshot every active worktree;
4. request semantic checkpoints from responsive sessions;
5. report stale or unresponsive sessions without fabricating context;
6. detect same-worktree writer conflicts.

Mechanical fallback:

```bash
~/.agent-continuity/bin/agent-continuity snapshot-active --provider all
```

## 10. Inspect sessions and conflicts

Active runs:

```bash
~/.agent-continuity/bin/agent-continuity runs --json
```

Conflicts:

```bash
~/.agent-continuity/bin/agent-continuity conflicts
```

A conflict means multiple active runs are attached to the same worktree. Do not resolve it by resetting, cleaning, stashing, or discarding changes. Suspend one run, move an independent task to another worktree, or continue sequentially.

Suspend a stale run:

```bash
~/.agent-continuity/bin/agent-continuity suspend-run --provider-run-ref <hashed-ref>
```

## 11. Inspect provider usage

```bash
~/.agent-continuity/bin/agent-continuity usage status
```

Probe all providers:

```bash
~/.agent-continuity/bin/agent-continuity usage probe --provider all
```

Probe one provider:

```bash
~/.agent-continuity/bin/agent-continuity usage probe --provider claude-code
~/.agent-continuity/bin/agent-continuity usage probe --provider codex
~/.agent-continuity/bin/agent-continuity usage probe --provider cursor
```

Manual fallback for a provider whose UI exposes usage but whose hooks do not:

```bash
~/.agent-continuity/bin/agent-continuity usage set \
  --provider cursor \
  --five-hour 88 \
  --context 81 \
  --source cursor-ui-manual
```

## 12. Default thresholds

Configuration:

```text
~/.agent-continuity/config.json
```

Defaults:

| Stage | Primary/five-hour compatibility field | Secondary/seven-day compatibility field | Context | Required behavior |
|---|---:|---:|---:|---|
| warning | 70% | 85% | 72% | persist findings and decisions more frequently |
| checkpoint | 82% | 92% | 82% | complete semantic and mechanical checkpoint |
| handoff | 89% | 96% | 89% | validate and export a transferable handoff |
| critical | 95% | 99% | 95% | finish only the current atomic operation |

For Codex, the compatibility fields contain the highest primary and secondary window usage. Actual durations and reset times remain in provider details.

## 13. Claude to Codex

In Claude Code:

```text
/agent-continuity handoff current to codex
```

Or mechanically:

```bash
~/.agent-continuity/bin/agent-continuity export \
  --cwd /path/to/repository \
  --target codex \
  --scope current
```

Open the generated `RESUME_ALL.md` in Codex as the first prompt. Codex must verify the existing worktree and Git state before editing.

## 14. Claude to Cursor

```text
/agent-continuity handoff current to cursor
```

Open the existing worktree in Cursor and submit the generated prompt. Stop or suspend the Claude writer before Cursor writes to the same worktree.

## 15. Reverse transfer to Claude

Before leaving Codex or Cursor, request:

```text
Use the agent-continuity skill to checkpoint and hand off all active tasks to Claude. Preserve stable task IDs, existing worktrees, branches, findings, decisions, tests, blockers, and exact next actions.
```

Then in Claude Code:

```text
/agent-continuity resume all
```

The provider change does not create a new task. A new provider run is attached to the existing stable task ID.

## 16. Transfer all active tasks

```text
/agent-continuity handoff all to codex
```

Mechanical global export:

```bash
~/.agent-continuity/bin/agent-continuity export-global \
  --provider all \
  --target codex
```

The global bundle contains:

```text
~/.agent-continuity/handoffs/<timestamp>/
├── manifest.json
├── RESUME_ALL.md
└── repositories/<repository-hash>/tasks/<task-id>/
```

One prompt can coordinate all tasks. Separate workers should be used only for independent tasks in isolated worktrees.

## 17. Three existing Claude sessions

For three already open Claude sessions in one repository:

1. Run discovery from one worktree:

```bash
~/.agent-continuity/bin/agent-continuity discover --cwd /path/to/repository --days 30
```

2. Inspect the resulting hashed runs:

```bash
~/.agent-continuity/bin/agent-continuity runs --provider claude-code --json
```

3. Rebind provisional runs to stable task IDs when semantic reconciliation proves they belong to existing tasks:

```bash
~/.agent-continuity/bin/agent-continuity rebind \
  --cwd /path/to/repository \
  --provider-run-ref <hashed-ref> \
  --task <stable-task-id>
```

4. Ask each responsive session to update its semantic handoff.
5. Run `checkpoint all` or export globally.

The runtime never assumes that two sessions over the same branch are the same task.

## 18. Worktree rules

One active writer per worktree.

Allowed:

```text
Task A → worktree A → Claude
Task B → worktree B → Codex
Task C → worktree C → Cursor
```

Unsafe:

```text
Task A → one worktree → Claude + Codex writing concurrently
```

The continuity system reports the conflict but does not automatically move, reset, stash, or delete user work.

## 19. Semantic handoff quality

A handoff is incomplete while placeholders remain. Each task should contain:

```text
state.json
HANDOFF.md
DECISIONS.md
FINDINGS.md
TESTS.md
SESSION_HISTORY.md
```

`HANDOFF.md` must include:

- objective;
- acceptance criteria;
- current status;
- completed work;
- in-progress work;
- exact next action;
- changed/relevant files;
- decisions and rationale;
- findings and failed approaches;
- tests and validation;
- blockers and risks;
- branch, worktree, HEAD, base, commit, and push state.

## 20. Security

Never place these values in portable files:

- raw Claude, Codex, or Cursor session IDs;
- transcript paths or raw transcripts;
- API keys, OAuth tokens, cookies, credentials;
- `.env` values;
- private keys;
- hidden reasoning.

The runtime hashes provider IDs for portable references and keeps raw mappings in the private local layer.

## 21. Configure a Cursor adapter

Edit:

```text
~/.agent-continuity/config.json
```

Example:

```json
{
  "startup_usage": {
    "providers": {
      "cursor": {
        "mode": "hook-or-trusted-adapter",
        "adapter_command": "/absolute/path/to/trusted-cursor-usage-adapter"
      }
    }
  }
}
```

The command must emit JSON containing recognizable rate-limit or percentage fields. The adapter is explicitly trusted by the user and runs locally.

## 22. Migrate from a legacy Python-based installation

Run:

```bash
./validate.sh
./install.sh /path/to/repository
```

The installer removes legacy Agent Continuity hook entries and installs Node-based hooks using the exact active LTS Node executable.

Verify:

```bash
~/.agent-continuity/bin/agent-continuity doctor --cwd /path/to/repository
```

After successful verification, Agent Continuity no longer requires Python.

## 23. Uninstall considerations

The package does not automatically delete continuity state because it may contain unfinished task metadata.

Before manual removal:

1. export required handoffs;
2. inspect `~/.agent-continuity/state`;
3. inspect each repository's `<git-common-dir>/agent-continuity`;
4. remove only the installed hook entries and skill links/copies;
5. preserve task bundles you still need.

## 24. Operational principle

Quota monitoring is an early-warning mechanism, not the only protection. Semantic state must be updated continuously because one large request can consume quota or context abruptly.


## License

Copyright (c) 2026 Ivan Lehet. Distributed under the [MIT License](LICENSE).
