# Public repo defaults (aligned with ai-dev-tools)

Apply only when `visibility=public`. Replace `OWNER`, `REPO`, and `OWNER_ID`.

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
