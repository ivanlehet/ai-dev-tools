# Contributing

## Ground rules

- Every tool is an independent release unit and must pass the same gates — no exceptions.
  Read [`docs/POLICY.md`](docs/POLICY.md); it is enforced, not advisory.
- Never compromise correctness, security, privacy, or honesty for speed. No lifecycle command
  may report success without doing the work it claims.
- A human reviews and merges. Automation (including AI agents acting on the maintainer's
  credentials) never merges to a protected branch, force-pushes, or rewrites history — it
  prepares the PR and stops there. Merging into `master` is always a manual action the maintainer
  takes in the GitHub UI, never a CLI/API call run on the maintainer's behalf, and never GitHub's
  native auto-merge (disabled repo-wide; see [Branch protection](#branch-protection)).

## Branching & workflow

Trunk-based, no long-lived integration branch. `master` is the single protected production
trunk; `nx affected` isolates change impact and per-tool tags (`<tool>@x.y.z`) handle release
independence, so there is no `develop`/`integration` branch to batch through.

`master` is protected by a branch ruleset: no direct pushes, no force-pushes, no deletion,
linear history, and every change must arrive through a pull request that passes the **full CI
pipeline** before the maintainer merges it (see [Branch protection](#branch-protection)).

**Contributors work from a fork** (nobody but the maintainer and any contributor the maintainer
has explicitly granted write access to — an **approved contributor** — has write access):

1. Fork the repository and clone your fork.
2. Create a short-lived topic branch: `git switch -c tool/<name>/<change>` (or `fix/…`,
   `chore/…`).
3. Work, keep the gates green (`npm run verify`, `npm run secret-scan`), and push to your fork.
4. Open a pull request against `ivanlehet/ai-dev-tools:master`.
5. CI must be green before merge. The maintainer, or an approved contributor, merges by hand with
   **squash & merge**; the branch is deleted automatically after merge.

Never attempt to push directly to `master`, force-push, or delete it — the ruleset rejects it for
everyone.

Release happens after merge, per tool, run by the maintainer: `nx release --projects=<tool>`
(never from CI on a PR). Version intent accumulates on `master` as Version Plans and is
consumed at release time.

### Branch protection

`master` is enforced by a GitHub ruleset (commercial-standard hardening). It requires:

- A **pull request before merging** — direct pushes to `master` are blocked for everyone,
  including the maintainer.
- **All required status checks green**: the aggregate `ci-success` gate (validate, tests,
  security/privacy/policy checks, commitlint, cross-platform lifecycle e2e) and `CodeQL`
  code scanning. Branches must be up to date before merging.
- **Squash merge only**, linear history.
- No force-pushes and no branch deletion.

**Only the maintainer or an approved contributor can merge, and only by hand.** Merging requires
write access to this repository. Today the maintainer is the only collaborator; if the maintainer
later grants write access to a specific, trusted contributor, that person can merge too — under
the exact same rules. Everyone else works from a fork and cannot merge, regardless of CI status.
No agent, bot, or other automation is ever granted write access or permitted to merge on anyone's
behalf. A separate approving review is *not* required: GitHub does not let a solo author approve
their own PR, so the enforced controls are the green CI gate plus write-access-gated merge rights.
(`.github/CODEOWNERS` still auto-requests the maintainer as reviewer as a courtesy, but review is
not a merge gate.)

Merging is never automatic, even once every check is green: the repository's **"Allow
auto-merge"** setting is turned off, so GitHub's native auto-merge cannot be queued on any PR, and
no automation (including AI coding agents) is ever permitted to run the merge itself — only the
maintainer or an approved contributor, clicking merge by hand in the GitHub UI. This is a
deliberate, human-in-the-loop gate, not an oversight.

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
