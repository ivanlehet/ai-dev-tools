# Contributing

## Ground rules

- Every tool is an independent release unit and must pass the same gates — no exceptions.
  Read [`docs/POLICY.md`](docs/POLICY.md); it is enforced, not advisory.
- Never compromise correctness, security, privacy, or honesty for speed. No lifecycle command
  may report success without doing the work it claims.
- A human reviews and merges. Automation never self-merges to a protected branch, force-pushes,
  or rewrites history.

## Branching & workflow

Trunk-based, no long-lived integration branch. `master` is the single protected trunk;
`nx affected` isolates change impact and per-tool tags (`<tool>@x.y.z`) handle release
independence, so there is no `develop`/`integration` branch to batch through.

1. Branch short-lived off `master`: `git switch -c tool/<name>/<change>` (or `fix/…`, `chore/…`).
2. Work, keep the gates green, open a PR against `master`. Delete the branch after merge.
3. A human reviews and merges — never push directly to `master`, force-push, or self-merge.

Release happens after merge, per tool, run by a human: `nx release --projects=<tool>`
(never from CI on a PR). Version intent accumulates on `master` as Version Plans and is
consumed at release time.

## Add a tool

```bash
npm run create-tool -- --type <skill|plugin|hook|agent|rule|prompt|mcp> \
  --name <kebab-name> --targets <claude,cursor,codex> --reviewed <YYYY-MM-DD>
```

Then complete the disclosure in `manifest/tool.json` and honestly attest
`SECURITY-CHECKLIST.md`. See [`docs/creating-a-tool.md`](docs/creating-a-tool.md).

## Before a PR

1. `npm run verify` and `npm run secret-scan` are green.
2. Add a Version Plan for releasable changes: `npm run create-version-plan`.
3. Run `/security-review` and `/review`; fix confirmed blocking findings on the same branch;
   post the findings on the PR (every round).

## Commits

Conventional Commits are used for readable history and changelog categorization only. The
**authoritative** source of version intent is the Nx Version Plan, not the commit message.
