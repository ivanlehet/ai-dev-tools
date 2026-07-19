# CLAUDE.md

Nx monorepo that hosts and independently versions AI dev tools for Claude Code, Cursor, and
OpenAI Codex.

**Read [`AGENTS.md`](AGENTS.md) before creating or changing a tool** — it is the canonical,
cross-agent guide (shared with Cursor and Codex, kept in one place on purpose).

The essentials:

- To create a tool, run `npm run create-tool` — **never hand-scaffold**. It handles placement,
  the full lifecycle, and input validation.
- After generating, complete `manifest/tool.json` disclosure and **honestly** attest
  `SECURITY-CHECKLIST.md`.
- Before a PR: `npm run verify` and `npm run secret-scan` must be green; then `/security-review`
  and `/review`.
- Enforced policy in [`docs/POLICY.md`](docs/POLICY.md): no command fakes success, no secrets,
  no `curl | bash`, a human merges.
- `master` is a protected trunk: **no direct push / force-push / deletion**, contributors work
  from a **fork**, and every change lands via a PR that passes the full CI (`ci-success` +
  `CodeQL`) and a code review, then **squash-merges** and auto-deletes the branch. See
  [`AGENTS.md`](AGENTS.md) and [`CONTRIBUTING.md`](CONTRIBUTING.md#branch-protection).
