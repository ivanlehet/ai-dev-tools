# Universal continuation prompt

Resume all unfinished work using the repository's Portable Agent Continuity Protocol.

Perform recovery and continuation autonomously:

1. Read all applicable instructions, including `AGENTS.md`, `CLAUDE.md`, Cursor rules, `AGENT_CONTINUITY.md`, and the installed `agent-continuity` skill.
2. Let the session-start continuity hook register this provider run, detect provider quota, capture Git/worktree state, and report any same-worktree writer conflict.
3. Resolve the repository root and shared Git directory with Git. Read `.agent-continuity/portable/registry.json` or `<git-common-dir>/agent-continuity/portable/registry.json`.
4. Identify every active task whose status is `planned`, `in_progress`, `blocked`, or `ready_for_review`. For each task, read `state.json`, `HANDOFF.md`, `DECISIONS.md`, `FINDINGS.md`, `TESTS.md`, `SESSION_HISTORY.md`, provider-neutral session records, and the latest mechanical snapshot.
5. Verify the real worktree path, branch, HEAD, upstream, staged changes, unstaged changes, untracked files, recent commits, and worktree ownership. Git and filesystem state are authoritative. Reconcile mismatches without discarding work.
6. Preserve stable task IDs across providers. Do not create a replacement task merely because this is Claude Code, Codex, or Cursor.
7. Do not recreate work that already exists. Continue every task from its verified exact next action.
8. When the current environment supports parallel agents, threads, subagents, or isolated worktrees, create one writer per independent task and retain one coordinator. Never allow two writers in one worktree. When separate visible chats cannot be created, use native subagents; when those are unavailable, process tasks sequentially in this chat.
9. Respect repository test, security, commit, branch, and push policies. When no explicit push permission exists, do not push.
10. Never reset, clean, discard, overwrite, auto-stash, merge, rebase, or delete worktrees merely to simplify recovery.
11. Keep provider session IDs, transcript paths, raw transcripts, credentials, tokens, cookies, `.env` values, private keys, and hidden reasoning out of portable files.
12. Update continuity files after every material finding, decision, coherent edit batch, validation result, blocker, branch/worktree change, and before every substantive final response.
13. Apply the detected usage stage. At `checkpoint`, `handoff`, or `critical`, secure the semantic handoff before beginning another large operation. At `unknown`, use conservative incremental batches and do not claim an exact quota.
14. Continue implementation immediately after recovery. Do not stop after only summarizing unless every active task is blocked or ready for review.
15. Finish with a concise coordinator report listing each task, assigned provider/worker, worktree, branch, HEAD, current status, tests, commits, push state, blockers, and exact next action.
