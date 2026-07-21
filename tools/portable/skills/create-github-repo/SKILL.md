---
name: create-github-repo
description: >-
  Create a GitHub repository from a name and visibility (public or private).
  Public repos get ai-dev-tools-like defaults (squash-only, master protection,
  tag protection, SECURITY.md, PR template, CODEOWNERS) without copying CI.
  Private repos are created bare. Use when the user asks to create a new GitHub
  repo, initialize a repository on GitHub, or apply public-repo defaults.
version: 0.1.0
---

# create-github-repo

## Inputs (required)

| Parameter | Values | Notes |
|-----------|--------|--------|
| `name` | kebab/repo slug, or `owner/name` | Default owner = authenticated `gh` user |
| `visibility` | `public` \| `private` | |

If either is missing, ask once, then proceed. Do not invent a name.

## Prerequisites

- `gh` CLI installed and authenticated (`gh auth status`).
- Token needs `repo` (and for rulesets / Actions settings, sufficient admin on the new repo — normal `repo` scope is enough for user-owned repos).

## Procedure

### 1. Resolve owner and name

```bash
OWNER="$(gh api user --jq .login)"
OWNER_ID="$(gh api user --jq .id)"
```

If `name` contains `/`, split into `OWNER` / `REPO`. Otherwise `REPO="$name"`.

Abort if the repo already exists (404 means OK to create — do not use bare `gh api`
under `set -e`, which would abort on 404):

```bash
if gh api "repos/${OWNER}/${REPO}" --silent 2>/dev/null; then
  echo "exists: ${OWNER}/${REPO}" >&2
  exit 1
fi
```

### 2. Private → bare create only

```bash
gh repo create "${OWNER}/${REPO}" --private
```

Stop. Do **not** apply rulesets, Actions settings, or template files for private repos.
Report the URL and exit.

### 3. Public → create + defaults

#### 3a. Seed locally, then create + push (`master`)

Work in a temp or empty directory (do not pollute unrelated repos):

```bash
mkdir "$REPO" && cd "$REPO"
git init -b master
```

1. Substitute `{{OWNER}}` / `{{REPO}}` in templates under `templates/`.
2. Write:
   - `SECURITY.md`
   - `.github/pull_request_template.md`
   - `.github/CODEOWNERS`
3. Commit (`chore: seed public repo defaults`), then:

```bash
gh repo create "${OWNER}/${REPO}" --public --source=. --remote=origin --push
```

Do **not** copy CI, CodeQL, release, or other workflows from ai-dev-tools.
Do **not** add `required_status_checks` to the branch ruleset (no workflows yet).

#### 3b. Repo settings (match ai-dev-tools)

Apply the PATCH and Actions / security calls in [references/public-defaults.md](references/public-defaults.md).

#### 3c. Rulesets

Create `protect-master` and `protect-release-tags` exactly as in [references/public-defaults.md](references/public-defaults.md).
Tag ruleset bypass = authenticated user (`OWNER_ID`).

### 4. Report

Return:

- Repo URL
- Visibility
- For public: confirmation that settings, seed files, and both rulesets were applied
- Note that required CI checks were intentionally omitted (add later when workflows exist)

## Guardrails

- Never force-push, never delete the new default branch, never enable auto-merge.
- Never merge PRs as an agent; leave merge to a human in the GitHub UI.
- Do not store or print tokens / `gh` auth material.
- Do not create the repo under a different account than the authenticated user unless `owner/name` was given and the user can admin that owner.
- If any step fails mid-way, report what succeeded and what remains; do not claim full success.

## Resources

- [references/public-defaults.md](references/public-defaults.md) — exact `gh api` payloads
- [templates/](templates/) — SECURITY.md, PR template, CODEOWNERS
