# Known limitations

## Claude Code startup quota timing

Claude Code may not expose a fresh subscription quota to `SessionStart` before the first API response. Agent Continuity can use a fresh account-wide cache immediately, but a cold start requires a low-cost bootstrap response before exact status-line data is available.

The runtime automatically stores the first exact sample and can use the Stop hook to continue the original request without requiring the user to repeat it. This still cannot guarantee that a provider will never stop a response abruptly.

## Cursor quota visibility

Cursor hooks may not expose exact account quota or context usage. Agent Continuity uses documented hook fields, a user-configured trusted adapter, or fresh cache. When none is available, it reports unknown/conservative mode instead of inventing a percentage.

## Codex account mode

The Codex app-server rate-limit probe is useful when Codex is operating with a ChatGPT-managed account that exposes account windows. Other authentication or billing modes may return no compatible windows. In that case, the runtime falls back to cache or unknown mode.

## Simultaneous inactive sessions

A local runtime can register active sessions and create pending checkpoint requests. It cannot force a provider session that is idle, disconnected, or waiting for input to generate a new semantic handoff immediately. Mechanical Git state is still captured, and the semantic request is delivered on the next supported hook event.

## Visible chat windows

A provider-neutral prompt cannot guarantee that an application will create several visible desktop chat windows. The receiving environment should use native threads or subagents when supported, otherwise process tasks sequentially.

## Semantic state requires model cooperation

Git and filesystem snapshots are mechanical. Objectives, findings, decisions, failed approaches, and exact next actions require the active agent to update the semantic handoff. The runtime detects placeholders but cannot reconstruct unavailable chat-only context without reading an available local transcript.

## Raw transcript handling

Raw transcripts and transcript paths are intentionally excluded from portable bundles. A local provider adapter may use a transcript privately for discovery or usage parsing, but the transfer boundary remains the sanitized handoff.

## One writer per worktree

The runtime reports same-worktree conflicts but does not forcibly terminate an AI client or move its work. The user or coordinator must suspend one writer, isolate independent work in another worktree, or continue sequentially.

## Node.js LTS requirement

Agent Continuity requires Node.js LTS 22 or newer. A non-LTS Current release is rejected by default. The installer does not download or modify Node.js; the user must select an installed LTS executable, optionally through `AGENT_CONTINUITY_NODE`.

Version-manager aliases and shell functions are not reliable in non-interactive hooks. The installer records `process.execPath`, so it must be run while the intended LTS version is active.

## Shell entrypoints on Windows

`install.sh` and `validate.sh` require Bash. On native Windows, use Git Bash, MSYS2, Cygwin, or WSL, or run the native Node entrypoints from PowerShell:

```powershell
node .\validate.mjs
node .\install.mjs C:\path\to\repository
```

## Provider hook formats

Claude Code, Codex, and Cursor evolve independently. The validator checks the local package structure and invokes the official Claude plugin validator when available, but provider updates may require hook-schema adjustments in future releases.

## No destructive Git automation

Agent Continuity deliberately does not reset, clean, stash, rebase, merge, delete worktrees, or push automatically merely to reconcile state. This may require manual coordination, but it avoids destroying or publishing unreviewed work.
