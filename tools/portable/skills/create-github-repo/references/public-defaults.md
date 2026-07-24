# Public repo defaults (aligned with ai-dev-tools)

Apply only when `visibility=public`. Replace `OWNER`, `REPO`, and `OWNER_ID`.

## Security posture — read before relying on these defaults

These are deliberately permissive **greenfield defaults for a brand-new, empty public repo
that has no CI yet and only the repo owner as a writer**. They are a safe starting point,
**not** strong branch protection. In particular:

- `allowed_actions=all` lets any GitHub Action run (SHA pinning is required, which mitigates
  but does not eliminate supply-chain risk). See the note in *Actions permissions* below for a
  stricter `local_only` alternative.
- `required_approving_review_count: 0` means a PR can be merged with **zero** reviews — the
  ruleset still forces the PR flow, linear history, and squash-only, but it does not require a
  second pair of eyes while the owner is the only writer.
- `require_code_owner_review: false` means CODEOWNERS is advisory, not enforced.

**Before inviting any additional writers, collaborators should tighten this**: raise
`required_approving_review_count` to at least `1`, set `require_code_owner_review: true`, add
`required_status_checks` once CI exists, and consider `allowed_actions=local_only` (or
`selected`). Leaving the permissive defaults in place on a multi-writer repo is a real risk,
not an oversight of this skill.

## Repo settings

```bash
gh api -X PATCH "repos/${OWNER}/${REPO}" \
  -f default_branch=master \
  -F allow_squash_merge=true \
  -F allow_merge_commit=false \
  -F allow_rebase_merge=false \
  -F allow_auto_merge=false \
  -F delete_branch_on_merge=true \
  -f squash_merge_commit_title=PR_TITLE \
  -f squash_merge_commit_message=PR_BODY \
  -F allow_update_branch=false \
  -F has_wiki=false \
  -F has_pages=false \
  -F has_discussions=false \
  -F has_issues=true \
  -F has_projects=true
```

## Actions permissions

```bash
gh api -X PUT "repos/${OWNER}/${REPO}/actions/permissions" \
  -F enabled=true \
  -f allowed_actions=all \
  -F sha_pinning_required=true

gh api -X PUT "repos/${OWNER}/${REPO}/actions/permissions/workflow" \
  -F default_workflow_permissions=read \
  -F can_approve_pull_request_reviews=false
```

If `sha_pinning_required` is rejected by the API/plan, continue without it and note that in the report.

> **Hardening note.** `allowed_actions=all` is intentional for an empty repo so the owner can
> immediately adopt any workflow, and SHA pinning is required to blunt supply-chain risk. It is
> **not** the most restrictive option. The seed flow below only pushes files (it runs no
> workflows), so switching to `allowed_actions=local_only` — actions defined in this repo only —
> would not break anything shipped by this skill; it only means the owner must loosen it when
> they later add a workflow that uses a marketplace action. Prefer `local_only` (or `selected`
> with an explicit allowlist) if you do not expect to use third-party actions soon. Changing the
> product default here would silently alter the owner-facing behavior, so it is documented rather
> than flipped by default — choose deliberately.

## Security alerts

```bash
gh api -X PUT "repos/${OWNER}/${REPO}/vulnerability-alerts"
gh api -X PUT "repos/${OWNER}/${REPO}/private-vulnerability-reporting" \
  -F enabled=true
```

Leave Dependabot security updates **off** (do not enable automated security PRs).

## Seed commit

Push these files to `master` (see `templates/`):

| Path | Source |
|------|--------|
| `SECURITY.md` | `templates/SECURITY.md` |
| `.github/pull_request_template.md` | `templates/pull_request_template.md` |
| `.github/CODEOWNERS` | `templates/CODEOWNERS` |

Replace `{{OWNER}}` and `{{REPO}}` before committing.

Suggested first commit message: `chore: seed public repo defaults`.

## Ruleset: protect-master

No bypass actors. **No** `required_status_checks` (CI is not seeded by this skill).

```bash
gh api -X POST "repos/${OWNER}/${REPO}/rulesets" --input - <<'EOF'
{
  "name": "protect-master",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] }
  },
  "bypass_actors": [],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "required_linear_history" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "required_reviewers": [],
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false,
        "allowed_merge_methods": ["squash"]
      }
    }
  ]
}
EOF
```

## Ruleset: protect-release-tags

Bypass: authenticated owner only (`OWNER_ID` from `gh api user --jq .id`).

This heredoc is **unquoted** so `${OWNER_ID}` is interpolated straight into JSON. `OWNER_ID`
must therefore be a bare integer — validate it before use so a malformed or hostile value
cannot break out of the JSON or inject additional fields:

```bash
OWNER_ID="$(gh api user --jq .id)"
[[ "$OWNER_ID" =~ ^[0-9]+$ ]] || { echo "OWNER_ID must be numeric, got: $OWNER_ID" >&2; exit 1; }
```

```bash
gh api -X POST "repos/${OWNER}/${REPO}/rulesets" --input - <<EOF
{
  "name": "protect-release-tags",
  "target": "tag",
  "enforcement": "active",
  "conditions": {
    "ref_name": { "include": ["~ALL"], "exclude": [] }
  },
  "bypass_actors": [
    { "actor_id": ${OWNER_ID}, "actor_type": "User", "bypass_mode": "always" }
  ],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "update" }
  ]
}
EOF
```

## Explicitly out of scope

- CI / CodeQL / release workflows
- Legacy branch protection API (use rulesets only)
- `dependabot.yml`
- Enabling GitHub auto-merge
- Agent-driven merges to the default branch
