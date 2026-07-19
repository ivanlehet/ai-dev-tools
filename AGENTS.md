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
