# Agent Continuity

Agent Continuity preserves coding-task state across Claude Code, Codex, and Cursor. It records the relationship between tasks, provider runs, repositories, branches, worktrees, Git state, findings, decisions, tests, blockers, and exact next actions. It supports forward and reverse handoffs without transferring raw provider session identifiers or raw chat transcripts.


## Package type

This package is both:

1. a Claude-compatible single-skill plugin bundle; and
2. a cross-provider local continuity runtime.

The package follows the Claude plugin convention with `.claude-plugin/plugin.json`, `hooks/hooks.json`, and a compact `SKILL.md` supported by reference files.

Official references:

- [Claude Code skills](https://code.claude.com/docs/en/skills)
- [Claude Code plugins](https://code.claude.com/docs/en/plugins)
- [Claude Code plugin reference](https://code.claude.com/docs/en/plugins-reference)
- [Claude Code hooks](https://code.claude.com/docs/en/hooks)
- [Node.js release status](https://nodejs.org/en/about/previous-releases)

## Package layout

```text
agent-continuity/
├── .claude-plugin/
│   └── plugin.json
├── hooks/
│   └── hooks.json
├── skills/
│   └── agent-continuity/
│       └── SKILL.md
├── SKILL.md
├── README.md
├── USAGE_GUIDE.md
├── AGENT_CONTINUITY.md
├── CONTINUE_PROMPT.md
├── CHANGELOG.md
├── package.json
├── install.sh
├── validate.sh
├── install.mjs
├── validate.mjs
├── scripts/
│   ├── agent-continuity.mjs
│   └── lib/
│       └── platform.sh
├── references/
│   ├── LIMITATIONS.md
│   └── SCHEMA.md
├── providers/
│   └── openai.yaml
├── templates/
│   ├── AGENTS_APPEND.md
│   ├── CLAUDE_APPEND.md
│   └── cursor-agent-continuity.mdc
└── tests/
    ├── install.test.mjs
    └── runtime.test.mjs
```

No Python interpreter and no npm dependency installation are required.

## Runtime requirement

Agent Continuity requires:

- Node.js LTS 22 or newer;
- Git on `PATH`;
- Bash 3.2 or newer only when using the `.sh` entrypoints.

The recommended runtime is the latest Node.js LTS release. At the time of this release, that is Node.js 24.

The installer validates both:

```text
process.release.lts is present
Node major version >= 22
```

A newer non-LTS Node release is rejected by default. This avoids treating a Current release as a production runtime merely because its version number is higher.

To select a specific LTS executable:

```bash
AGENT_CONTINUITY_NODE=/absolute/path/to/node ./validate.sh
AGENT_CONTINUITY_NODE=/absolute/path/to/node ./install.sh /path/to/repository
```

The installer records the exact Node executable path in installed hooks. This is important when Node is managed by `nvm`, `fnm`, Volta, Homebrew, or another version manager and may not be present in a non-interactive hook `PATH`.

## Supported platforms

| Environment | Primary command | Native fallback | Default skill deployment |
|---|---|---|---|
| macOS | `./install.sh` | `node install.mjs` | symlink |
| Linux | `./install.sh` | `node install.mjs` | symlink |
| WSL | `./install.sh` | `node install.mjs` | symlink inside WSL |
| Windows with Git Bash/MSYS2/Cygwin | `./install.sh` | `node install.mjs` | copy |
| Windows PowerShell | `node .\install.mjs` | same | copy |

The installer detects macOS, Linux, WSL, and native Windows automatically. On Windows, copies are used by default so Developer Mode or administrator privileges are not required for symlinks.

## Core guarantees

Agent Continuity is designed to provide:

- stable provider-neutral task IDs;
- bidirectional Claude Code ⇄ Codex ⇄ Cursor handoffs;
- multiple active sessions and repositories;
- explicit worktree and branch ownership;
- mechanical Git snapshots plus semantic handoffs;
- provider-specific quota monitoring where documented data is available;
- account-wide quota fan-out to active sessions of the affected provider;
- same-worktree writer conflict detection;
- no automatic reset, clean, stash, rebase, merge, push, or worktree deletion;
- portable records without raw session IDs, transcript paths, credentials, or hidden reasoning.

## Validate

### macOS, Linux, WSL, or Git Bash

```bash
./validate.sh
```

### Windows PowerShell

```powershell
node .\validate.mjs
```

The validator checks:

- Node is an LTS release and is version 22 or newer;
- required package files;
- Claude plugin layout;
- `SKILL.md` frontmatter and progressive disclosure;
- all JSON files;
- all JavaScript module syntax;
- Bash syntax;
- ShellCheck when installed;
- macOS, Linux, and Windows hook generation;
- absence of Python runtime files and stale Python documentation;
- Node unit tests;
- clean installation and runtime `doctor` smoke test;
- `claude plugin validate . --strict` when Claude CLI is available.

Options:

```text
--package-only   Skip temporary installation smoke test
--skip-tests     Skip Node unit tests
--skip-claude    Skip the official Claude CLI validator
--json           Emit machine-readable validation output
--allow-non-lts  Development-only override; not recommended for installation
```

Examples:

```bash
./validate.sh --package-only --skip-tests
./validate.sh --json
node validate.mjs --package-only
```

## Install

### Install as a Claude Code plugin

Use the cross-provider installer to place the manifest-bearing directory in Claude Code's skills directory:

```bash
./install.sh --global-only --providers claude
```

Restart Claude Code, then verify that it is enabled:

```bash
claude plugin list
claude plugin details agent-continuity@skills-dir
```

This package is not a marketplace. Claude Code discovers it from `~/.claude/skills/agent-continuity/` and loads it as `agent-continuity@skills-dir` after restart.

### Full installation

```bash
./install.sh /absolute/path/to/repository
```

PowerShell:

```powershell
node .\install.mjs C:\absolute\path\to\repository
```

This installs:

- the skill for Claude Code, Codex, and Cursor;
- the Node.js runtime and launchers;
- provider hooks;
- Claude status-line integration;
- repository continuity rules;
- portable continuity files and locators when the runtime first executes.

### Global only

```bash
./install.sh --global-only
```

### Project only

```bash
./install.sh /path/to/repository --project-only
```

### Selected providers

```bash
./install.sh /path/to/repository --providers claude,codex
```

Accepted provider values:

```text
claude
claude-code
codex
cursor
all
```

### Force copies

```bash
./install.sh /path/to/repository --link-mode copy
```

### Preview changes

```bash
./install.sh /path/to/repository --dry-run
```

### Disable backups

```bash
./install.sh /path/to/repository --no-backup
```

### Skip pre-install validation

```bash
./install.sh /path/to/repository --skip-validation
```

Use this only for development diagnostics.

## What the installer changes

### Runtime

```text
~/.agent-continuity/
├── bin/
│   ├── agent-continuity.mjs
│   ├── agent-continuity
│   └── agent-continuity.cmd
├── config.json
├── install-manifest.json
├── skill/
│   └── agent-continuity/
└── state/
```

The runtime launchers call the exact LTS Node executable used during installation.

### Skills

Depending on selected providers:

```text
~/.claude/skills/agent-continuity/
~/.agents/skills/agent-continuity/
~/.cursor/skills/agent-continuity/
```

### Provider configuration

The installer merges rather than replaces existing configuration:

```text
~/.claude/settings.json
~/.codex/hooks.json
~/.cursor/hooks.json
```

Before modifying existing files, it creates `.agent-continuity.bak` backups unless `--no-backup` is specified.

### Repository files

```text
AGENT_CONTINUITY.md
CONTINUE_PROMPT.md
CLAUDE.md                    appended/updated continuity block
AGENTS.md                    appended/updated continuity block
.cursor/rules/agent-continuity.mdc
```

Older Agent Continuity blocks and older Python-based hook entries are removed during upgrade before the Node-based entries are added.

## Verify installation

macOS, Linux, or WSL:

```bash
~/.agent-continuity/bin/agent-continuity doctor --cwd /path/to/repository
```

Windows PowerShell:

```powershell
& "$HOME\.agent-continuity\bin\agent-continuity.cmd" doctor --cwd C:\path\to\repository
```

Inspect the generated manifest:

```text
~/.agent-continuity/install-manifest.json
```

It records:

- detected OS and architecture;
- exact Node executable and LTS codename;
- installed providers;
- launcher paths;
- runtime path;
- requested deployment mode.

Reload Claude Code, Codex, and Cursor after installation. In Codex, review newly installed hooks when prompted.

## Startup quota detection

### Claude Code

Claude Code does not expose a fresh subscription quota to `SessionStart` before the first API response. Agent Continuity therefore:

1. uses a fresh account-wide status-line cache when available;
2. otherwise enters a low-cost safe bootstrap;
3. obtains exact `rate_limits` and `context_window` data from the status line after the first response;
4. lets the `Stop` hook continue the original task automatically when safe.

### Codex

Agent Continuity starts the local Codex app server and requests account rate limits. A lock prevents several simultaneously starting Codex sessions from issuing duplicate probes. Actual window durations and reset metadata are preserved.

### Cursor

Agent Continuity uses documented hook fields when present, a user-configured trusted adapter, or a fresh cache. It does not scrape cookies, credentials, internal databases, or undocumented endpoints. When exact usage is unavailable, it enters conservative mode and never claims an exact remaining quota.

## Multiple simultaneous sessions

Each session is registered using a hashed provider-run reference. The raw provider ID remains in the repository-private mapping and is not exported.

Provider usage is account-wide:

- a Claude threshold fans out to all active Claude runs;
- a Codex threshold fans out to all active Codex runs;
- a Cursor threshold fans out to all active Cursor runs;
- one provider does not automatically consume or modify another provider's quota state.

Multiple sessions can work concurrently only when they use separate worktrees for independent write tasks. Two active writers in one worktree are reported as a conflict.

## Main runtime commands

```bash
agent-continuity doctor --cwd /path/to/repository
agent-continuity runs --json
agent-continuity conflicts
agent-continuity usage status
agent-continuity usage probe --provider all
agent-continuity snapshot-active --provider all
agent-continuity export --cwd /path/to/repository --target codex
agent-continuity export-global --provider all --target claude
```

Use the launcher path from `install-manifest.json` rather than assuming it is on `PATH`.

## Handoff storage

Repository-specific state is stored under the shared Git directory:

```text
<git-common-dir>/agent-continuity/
├── portable/
│   ├── registry.json
│   ├── tasks/
│   ├── snapshots/
│   └── handoffs/
└── private/
    └── providers/
```

A `.agent-continuity` symlink, Windows junction, or pointer file is created in each worktree. The local Git exclude file is updated so this locator is not accidentally committed.

Machine-global coordination state is stored under:

```text
~/.agent-continuity/state/
├── runs.json
├── usage/
├── requests/
├── startup/
└── locks/
```

## Security boundary

Portable bundles do not include:

- raw provider session, thread, conversation, or chat IDs;
- transcript paths or raw transcripts;
- API keys, OAuth tokens, cookies, or credentials;
- `.env` values or private keys;
- hidden reasoning.

The portable boundary contains task state, Git/worktree metadata, decisions, findings, validation, blockers, and exact next actions.

## Migration from legacy Python-based installations

Run the new validator and installer over the same repository:

```bash
./validate.sh
./install.sh /path/to/repository
```

The installer:

1. backs up existing configuration;
2. removes older Agent Continuity hook entries, including Python-based entries;
3. replaces older `CLAUDE.md` and `AGENTS.md` continuity blocks;
4. installs the Node.js runtime;
5. preserves existing continuity state and task IDs.

After a successful upgrade, Python is no longer required by Agent Continuity. Old standalone Python files outside the managed runtime directory can be removed after verifying the current installation.

## Troubleshooting

### Node is reported as non-LTS

Check:

```bash
node -p 'process.version'
node -p 'process.release.lts || "non-LTS"'
```

Select an installed LTS binary:

```bash
AGENT_CONTINUITY_NODE="$HOME/.nvm/versions/node/v24.x.x/bin/node" ./install.sh /path/to/repository
```

Do not rely on shell aliases. Hooks need the real executable path.

### Node is available in a terminal but hooks cannot find it

Re-run the installer from the shell where the intended LTS Node version is active. The installer writes `process.execPath` into hook configuration.

### Windows cannot execute `install.sh`

Use Git Bash, WSL, or native PowerShell:

```powershell
node .\validate.mjs
node .\install.mjs C:\path\to\repository
```

### Existing provider hooks disappear

They should not. The installer removes only entries containing Agent Continuity markers and merges the new entries. Restore the generated backup and report the configuration shape if unrelated hooks were removed.

### Cursor quota is unknown

This is expected when Cursor does not expose quota information to hooks. Configure a trusted adapter in `~/.agent-continuity/config.json` or continue with conservative incremental checkpoints.

## Uninstall

Uninstall is scoped: it removes only artifacts this tool owns and leaves unrelated
configuration intact. Preview first with `--dry-run`.

### macOS, Linux, WSL, or Git Bash

```bash
./uninstall.sh --dry-run
./uninstall.sh --providers claude,codex,cursor
```

### Windows PowerShell

```powershell
node .\uninstall.mjs --dry-run
node .\uninstall.mjs --providers claude,codex,cursor
```

The uninstaller:

- removes the `~/.agent-continuity` runtime directory (config, launchers, state, skill copies);
- removes the per-provider skill copies it installed;
- removes only Agent Continuity entries from `~/.claude/settings.json`, `~/.codex/hooks.json`,
  and `~/.cursor/hooks.json`, preserving any other hooks, and restores the status line that
  existed before installation;
- with `--repo <path>`, removes the managed continuity block from that repository's `CLAUDE.md`
  and `AGENTS.md`, the `.cursor/rules/agent-continuity.mdc` rule, and the `AGENT_CONTINUITY.md`
  and `CONTINUE_PROMPT.md` files this tool wrote.

Repository continuity files are left in place unless `--repo` is given.

## Ethics & Security

This tool follows the repository engineering, ethics & security policy (see `docs/POLICY.md`
in the source repository). Its declared capabilities, permissions, and side effects are listed
in `manifest/tool.json`.

- **Capabilities:** reads/writes the filesystem, runs `git` and provider-local processes; it does
  not open external network connections, read credentials, or emit telemetry.
- **Side effects & destructive operations:** creates the `~/.agent-continuity` runtime and
  per-provider skill copies, and *merges* (never replaces) provider hook/status-line config after
  backing it up. It never runs `git reset`, `clean`, `stash`, `rebase`, `merge`, `push`, or a
  worktree deletion. Uninstall is scoped and supports `--dry-run` (see [Uninstall](#uninstall)).
- **Privacy:** portable records exclude raw provider session/thread/conversation IDs, transcript
  paths, transcripts, API keys, OAuth tokens, cookies, `.env` values, private keys, and hidden
  reasoning (see [Security boundary](#security-boundary)).

Do not add capabilities without declaring them here and in `manifest/tool.json`.

## Author and license

**Author:** Ivan Lehet  
**License:** [MIT](LICENSE)

## Additional documentation

- [Complete usage guide](USAGE_GUIDE.md)
- [Portable protocol](AGENT_CONTINUITY.md)
- [Known limitations](references/LIMITATIONS.md)
- [State schema](references/SCHEMA.md)
- [Universal continuation prompt](CONTINUE_PROMPT.md)
- [Changelog](CHANGELOG.md)
