#!/usr/bin/env bash
# CI-repair apply step: validate a provider-produced diff, and only if every gate
# passes, commit + push it and dispatch fresh CI/CodeQL runs.
#
# Used identically by both the claude-apply and cursor-apply jobs. The provider
# jobs run with a read-only checkout and no push credential; this script runs in a
# separate job that holds contents:write / actions:write. It never weakens a gate:
# it runs the SAME repo-wide + per-tool gate set that ci.yml's verify job runs, and
# pushes only on a clean pass.
#
# Trust boundary hardening (the diff comes from an LLM agent, so it is untrusted):
#   1. A control-plane DENYLIST rejects any diff that touches the gates themselves
#      or the automation — workflows, the ci-repair scripts, the secret scanner and
#      other repo scripts, the validation engine, the policy rules, lint/nx/ts/commit
#      config, and the dependency manifests. This prevents an agent-authored diff
#      from neutering the very checks that are about to validate it (e.g. turning
#      secret-scan into a no-op) or changing merge/branch config. Such changes are
#      deliberately left to a human.
#   2. The diff is committed BEFORE the gates run, so `nx affected` (which compares
#      committed refs) actually sees the change and the gates validate the committed
#      state — not a staged-but-invisible working tree.
#
# Inputs (environment variables; no secret VALUES are ever echoed):
#   CI_REPAIR_DIFF_FILE  path to the unified diff artifact produced by a provider
#   CI_REPAIR_PR_BRANCH  the trusted PR head branch to commit/push to
#   CI_REPAIR_PROVIDER   provider label for the commit message (claude|cursor)
#   CI_REPAIR_BASE_REF   base ref for `nx affected` / commitlint (default: origin/master)
#
# Exit codes (consumed by the workflow to decide auto-fallback):
#   0   fix validated, committed, pushed, and reruns dispatched
#   20  no changes to apply (non-actionable / flaky / low-confidence) -> no fallback
#   21  diff touched a protected path, failed to apply, OR a gate rejected it
#       -> eligible for fallback (attempt not consumed)
#   >21 unexpected/infra error

set -euo pipefail

DIFF_FILE="${CI_REPAIR_DIFF_FILE:-}"
PR_BRANCH="${CI_REPAIR_PR_BRANCH:-}"
PROVIDER="${CI_REPAIR_PROVIDER:-unknown}"
BASE_REF="${CI_REPAIR_BASE_REF:-origin/master}"

if [ -z "${PR_BRANCH}" ]; then
  echo "apply-fix: CI_REPAIR_PR_BRANCH is required" >&2
  exit 22
fi

# Operate from the repository root; never rely on a hardcoded absolute/home path.
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "${REPO_ROOT}"

# No diff, or an empty diff => the provider chose to make no changes.
if [ -z "${DIFF_FILE}" ] || [ ! -s "${DIFF_FILE}" ]; then
  echo "apply-fix: no changes to apply (non-actionable)"
  exit 20
fi

# A protected path is anything that can influence the checks, the automation, or
# what gets installed. Changes to these require a human, never an auto-push.
DENY_RE='^(\.github/|\.husky/|scripts/|packages/validation/|policy/|\.npmrc$|commitlint\.config\.js$|eslint\.config\.mjs$|nx\.json$|tsconfig[^/]*\.json$|package\.json$|package-lock\.json$)'

echo "apply-fix: applying provider diff"
if ! git apply --whitespace=nowarn "${DIFF_FILE}"; then
  echo "apply-fix: diff did not apply cleanly" >&2
  exit 21
fi

git add -A

# If applying produced no staged changes, treat as non-actionable.
if git diff --cached --quiet; then
  echo "apply-fix: diff applied but produced no changes (non-actionable)"
  exit 20
fi

# ---------------------------------------------------------------------------
# Control-plane denylist (authoritative): reject the change if it touches the
# gates themselves, the automation, gate configuration, or the dependency
# manifests. Checked against the ACTUAL staged paths (`--no-renames` expands a
# rename into its literal old+new paths) rather than the raw diff's numstat, so a
# rename/copy cannot smuggle a protected destination past the check. This runs
# before any gate executes, so a would-be-neutered scanner never runs.
# ---------------------------------------------------------------------------
while IFS= read -r p; do
  [ -z "$p" ] && continue
  if [[ "$p" =~ $DENY_RE ]]; then
    echo "apply-fix: diff touches a protected control-plane path (${p}); refusing to auto-apply" >&2
    exit 21
  fi
done < <(git diff --cached --no-renames --name-only)

# Commit BEFORE validating so `nx affected` (committed-ref comparison) sees the
# change. A fresh runner discards this commit if any gate below rejects it, so an
# unvalidated commit is never pushed.
echo "apply-fix: committing candidate for validation"
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
# --no-verify: never run the repo's local git hooks (husky/lint-staged) here. The
# hook content comes from the checked-out tree, and this job explicitly runs the
# full CI gate set below (a superset of the hook), so running the hook would only
# add a redundant failure mode — and, before the denylist also blocked .husky/,
# an attacker-authored hook would have executed in this privileged job.
git commit -q --no-verify -m "fix(ci-repair): apply automated ${PROVIDER} fix for failing CI"

# Ensure the base ref exists for affected/commitlint comparisons.
git fetch origin master:refs/remotes/origin/master >/dev/null 2>&1 || true

echo "apply-fix: running repo-wide secret scan"
if ! npm run secret-scan; then
  echo "apply-fix: secret scan rejected the change" >&2
  exit 21
fi

echo "apply-fix: running validation infra tests"
if ! npx nx test validation; then
  echo "apply-fix: validation infra tests rejected the change" >&2
  exit 21
fi

echo "apply-fix: running ci-repair guard unit tests"
if ! node --test .github/scripts/ci-repair/*.test.mjs; then
  echo "apply-fix: guard unit tests rejected the change" >&2
  exit 21
fi

echo "apply-fix: validating commit messages (Conventional Commits)"
if ! npx commitlint --from "${BASE_REF}" --to HEAD --verbose; then
  echo "apply-fix: commitlint rejected the PR commit range" >&2
  exit 21
fi

echo "apply-fix: version plan check"
npx nx release plan:check || echo "apply-fix: no releasable changes / no plan required"

echo "apply-fix: running per-tool affected gates (same as ci.yml verify)"
if ! npx nx affected -t lint typecheck validate test security-check privacy-check policy-check package validate-package --base="${BASE_REF}" --head=HEAD; then
  echo "apply-fix: affected gates rejected the change" >&2
  exit 21
fi

echo "apply-fix: gates passed; pushing to ${PR_BRANCH}"
# A non-fast-forward push is rejected (never forced): if the PR branch advanced
# past the SHA this fix was built on, the push safely fails instead of clobbering.
git push origin "HEAD:${PR_BRANCH}"

# A GITHUB_TOKEN push does not self-retrigger checks, so explicitly dispatch fresh
# runs at the new head via the additive workflow_dispatch triggers. The commit is
# already pushed and validated, so dispatch is best-effort (with retries) and
# never changes the committed outcome: failing here must not report "no commit"
# (which would wrongly trigger a fallback provider on top of an applied fix).
dispatch_workflow() {
  wf="$1"
  for attempt in 1 2 3; do
    if gh workflow run "${wf}" --ref "${PR_BRANCH}"; then
      return 0
    fi
    echo "apply-fix: dispatch of ${wf} attempt ${attempt} failed; retrying" >&2
    sleep 5
  done
  return 1
}

echo "apply-fix: dispatching fresh CI and CodeQL runs"
set +e
dispatch_workflow ci.yml
ci_disp=$?
dispatch_workflow codeql.yml
codeql_disp=$?
set -e
if [ "${ci_disp}" -ne 0 ] || [ "${codeql_disp}" -ne 0 ]; then
  echo "apply-fix: WARNING fix was pushed but a fresh check run could not be dispatched; required checks may need a manual re-run" >&2
fi

echo "apply-fix: done"
exit 0
