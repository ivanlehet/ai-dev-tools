# Contributing

## Ground rules

- Every tool is an independent release unit and must pass the same gates — no exceptions.
  Read [`docs/POLICY.md`](docs/POLICY.md); it is enforced, not advisory.
- Never compromise correctness, security, privacy, or honesty for speed. No lifecycle command
  may report success without doing the work it claims.
- A human reviews and merges. Automation never self-merges to a protected branch, force-pushes,
  or rewrites history.

## Branching & workflow

Trunk-based, no long-lived integration branch. `master` is the single protected production
trunk; `nx affected` isolates change impact and per-tool tags (`<tool>@x.y.z`) handle release
independence, so there is no `develop`/`integration` branch to batch through.

`master` is protected by a branch ruleset: no direct pushes, no force-pushes, no deletion,
linear history, and every change must arrive through a pull request that passes the **full CI
pipeline** and a **code review** (see [Branch protection](#branch-protection)).

**Contributors work from a fork** (nobody but the maintainer has write access):

1. Fork the repository and clone your fork.
2. Create a short-lived topic branch: `git switch -c tool/<name>/<change>` (or `fix/…`,
   `chore/…`).
3. Work, keep the gates green (`npm run verify`, `npm run secret-scan`), and push to your fork.
4. Open a pull request against `ivanlehet/ai-dev-tools:master`.
5. CI must be green and the review approved before merge. The maintainer merges with
   **squash & merge**; the branch is deleted automatically after merge.

Never attempt to push directly to `master`, force-push, or self-merge — the ruleset rejects it.

Release happens after merge, per tool, run by the maintainer: `nx release --projects=<tool>`
(never from CI on a PR). Version intent accumulates on `master` as Version Plans and is
consumed at release time.

### Branch protection

`master` is enforced by a GitHub ruleset (commercial-standard hardening). It requires:

- Pull request before merging, with **1 approving review** and **code-owner review**
  (see [`.github/CODEOWNERS`](.github/CODEOWNERS)); stale approvals are dismissed on new pushes.
- **All required status checks green**: the aggregate `ci-success` gate (validate, tests,
  security/privacy/policy checks, commitlint, cross-platform lifecycle e2e) and `CodeQL`
  code scanning. Branches must be up to date before merging.
- **Squash merge only**, linear history, conversation resolution.
- No force-pushes and no branch deletion.

Only the maintainer (repository admin) may merge, and only through a pull request — direct
pushes are blocked for everyone, including the maintainer.

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
