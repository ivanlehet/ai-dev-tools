# Changelog

## 1.0.8

- Treat `in_review` (and `review`) as an alias for `ready_for_review` so real tasks are no longer dropped from `export`, `list`, and `snapshot-all` (#20).
- Refuse `export` / `export-global` when only provisional `run-*` placeholders remain or no task has a complete semantic handoff, instead of writing a success-looking bundle. Incomplete tasks (provisional or not) are excluded; empty global bundles are refused.
- Preserve a task's recorded worktree/branch ownership instead of overwriting it from the current hook's checkout (including `rebind`); a divergent checkout is recorded as `observed_worktree_mismatch` (#20).
- Persist canonical status aliases into `state.json` (e.g. `in_review` → `ready_for_review`).
- Always refresh `.agent-continuity-location.json` and verify the `.agent-continuity` symlink so `continuity_root` never drifts from the git-common-dir base; `doctor` now checks locator ↔ base consistency (#20).
- Added runtime and smoke regression tests covering the export/handoff behavior.

## 1.0.7

- Added the standard nested Claude Code skill entrypoint while retaining the root skill for cross-provider compatibility.

## 1.0.6

- Store managed skills-directory backups outside provider skills directories so Claude never loads a stale duplicate plugin.

## 1.0.5

- Explicitly declare the plugin-root skill so it is available as `/agent-continuity` in a skills-directory installation.

## 1.0.4

- Removed the marketplace catalog; Agent Continuity is distributed only as a Claude Code skills-directory plugin.
- Avoid duplicate Claude hook registrations when the skills-directory plugin is installed.

## 1.0.3

- Automatically configure Claude Code's status line from the skills-directory plugin so exact 5-hour and 7-day subscription usage is available after the first API response.
- Preserve and chain any pre-existing Claude status line configuration.
- Activate the existing account-wide checkpoint and continuation flow when either usage window crosses its configured threshold.

## 1.0.2

- Use Claude Code's official `session_title` hook field as the stable task name.
- Preserve session titles explicitly set with `--name` or `/rename` instead of overwriting them.
- Rename a provisional task from the first submitted prompt and set the matching Claude session title when no title exists yet.

## 1.0.1

- Added a Claude Code marketplace catalog so the package can be registered and installed through the official plugin workflow.
- Added a human-readable plugin display name and post-install verification instructions.
- Extended validation to cover both the plugin manifest and marketplace entry.

## 1.0.0

Initial monorepo release.

- Added bidirectional task handoffs across Claude Code, Codex, and Cursor.
- Added provider-neutral task IDs with private provider-session mappings.
- Added multi-session and multi-worktree coordination with writer-conflict detection.
- Added quota-aware startup probes, threshold fan-out, proactive checkpoints, and emergency snapshots.
- Added portable handoff bundles without raw provider session IDs or raw transcripts.
- Added reverse handoffs so work can return to Claude Code or move to another supported provider.
- Added a dependency-free Node.js LTS runtime, installer, validator, and test suite.
- Added macOS, Linux, WSL, Git Bash, and Windows support.
- Added a canonical archive layout with one top-level `agent-continuity/` directory.
- Added Ivan Lehet as the package author and licensed the project under the MIT License.
