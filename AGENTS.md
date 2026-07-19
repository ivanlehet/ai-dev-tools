# Agent guide — ai-dev-tools

This repository hosts and independently versions AI dev tools for Claude Code, Cursor, and
OpenAI Codex. This file is the canonical instruction set for **any** agent (Claude, Cursor,
Codex, or a human) working here. It is intentionally short: the mechanics live in a
deterministic generator, not in prose.

## Creating or changing a tool

- **To create a tool, run the generator — never hand-scaffold:**

  ```bash
  npm run create-tool -- --type <skill|plugin|hook|agent|rule|prompt|mcp> \
    --name <kebab-name> --targets <claude,cursor,codex> --reviewed <YYYY-MM-DD>
  ```

  The generator places the tool correctly (1 target host → `tools/<host>/<type>/`,
  2+ hosts → `tools/portable/<type>/`), wires the full lifecycle, and refuses invalid
  input. Do not reproduce its output by hand; if it can't express what you need, extend the
  generator, don't work around it.

- **After generating:** complete the disclosure in `manifest/tool.json` (capabilities,
  side effects, permissions) accurately and minimally, and **honestly attest**
  `SECURITY-CHECKLIST.md` — tick a box only when it is genuinely true.

- **Multi-host tools** keep one canonical source under `tools/portable/`; the install
  script adapts per host. Only list a target in `targets` after its validation + a fixture
  actually pass. Never claim unverified compatibility.

## Non-negotiables (enforced, see `docs/POLICY.md`)

- No lifecycle command may report success without doing the work it claims.
- No secrets, no `.env` values, no install-time remote code execution (`curl | bash`).
- Never weaken a repository-wide gate for one tool. Leave incomplete work visibly incomplete.
- A human reviews and merges. Do not push to a protected branch, force-push, or self-merge.

## Branch protection & contribution flow

`master` is the protected production trunk, enforced by a GitHub ruleset:

- **No direct pushes, no force-pushes, no deletion** — for everyone, including the maintainer.
- Every change lands via a **pull request** that must pass the **full CI pipeline** (the
  aggregate `ci-success` gate + `CodeQL` code scanning) and a **code review** (1 approval +
  code owner). Branches must be up to date; conversations resolved.
- **Squash merge only**; the branch is auto-deleted after merge.

Contributors do not have write access — **work from a fork** and open a PR against
`master`. Never push directly, force-push, or self-merge. See
[`CONTRIBUTING.md`](CONTRIBUTING.md#branch-protection).

## Before opening a PR

```bash
npm run verify        # validate + test + security + policy on affected tools
npm run secret-scan   # repo-wide
npm run create-version-plan   # record version intent for releasable changes
```

Then run `/security-review` and `/review`, fix confirmed blocking findings, and post the
findings on the PR.

More detail: [`docs/creating-a-tool.md`](docs/creating-a-tool.md) ·
[`docs/POLICY.md`](docs/POLICY.md).
