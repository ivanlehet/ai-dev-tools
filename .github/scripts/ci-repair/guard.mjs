#!/usr/bin/env node
// CI-repair guard: fail-closed trust / enablement / dedupe / attempt-limit logic.
//
// The decision logic (`evaluateGuard`, `providerPlan`) is pure and unit-tested
// (see guard.test.mjs). `main()` gathers the real inputs (workflow_run event, a
// live re-fetch of the PR, and the trusted state marker) and emits GitHub Action
// outputs. Any error or ambiguity results in a silent no-op (proceed=false) — the
// automation never acts unless every check passes.

import { execFileSync } from 'node:child_process';
import { readFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readState } from './state.mjs';

export const PROVIDERS = ['auto', 'claude', 'cursor'];
export const MAX_ATTEMPTS = 2;
export const CI_WORKFLOW_NAME = 'CI';
// Subject prefix that apply-fix.sh gives every automated fix commit. Because
// pushing to the PR branch requires write access, these commits are a tamper-
// resistant record of how many validated fixes have already been applied.
export const FIX_SUBJECT_PREFIX = 'fix(ci-repair): apply automated';

// Maps the configured provider mode to an ordered execution plan.
// `auto` tries Claude first and may fall back to Cursor; the single-provider
// modes never fall back. Returns null for an unrecognized mode (fail closed).
export function providerPlan(provider) {
  switch (provider) {
    case 'auto':
      return { first: 'claude', fallback: 'cursor' };
    case 'claude':
      return { first: 'claude', fallback: null };
    case 'cursor':
      return { first: 'cursor', fallback: null };
    default:
      return null;
  }
}

// Counts the automated fix commits in a PR's commit list. Pure so it can be unit
// tested; used to derive a durable attempt floor straight from git history.
export function countCommittedFixes(commits) {
  if (!Array.isArray(commits)) return 0;
  return commits.filter(
    (c) =>
      c &&
      typeof c.messageHeadline === 'string' &&
      c.messageHeadline.startsWith(FIX_SUBJECT_PREFIX),
  ).length;
}

// Pure decision function. Every branch is fail-closed: unless all checks pass it
// returns { proceed: false, reason }. `reason` is a stable, non-sensitive code.
export function evaluateGuard(input) {
  const {
    enabled,
    provider,
    workflowName,
    conclusion,
    runId,
    headSha,
    pullRequests,
    owner,
    pr,
    state,
    committedAttempts = 0,
    maxAttempts = MAX_ATTEMPTS,
  } = input;

  const deny = (reason) => ({ proceed: false, reason });

  // Enablement: the variable must be exactly the string 'true'. Missing or any
  // other value (e.g. 'TRUE', '1', '') keeps the automation paused.
  if (enabled !== 'true') return deny('disabled');

  const plan = providerPlan(provider);
  if (!plan) return deny('invalid-provider');

  // Only the CI workflow's own failures drive repair.
  if (workflowName !== CI_WORKFLOW_NAME) return deny('not-ci');
  if (conclusion !== 'failure') return deny('not-failure');

  // GitHub only populates pull_requests for same-repo branches, and exactly one
  // PR must own the head. Anything else (fork PR, fan-out) is excluded here.
  if (!Array.isArray(pullRequests) || pullRequests.length !== 1) {
    return deny('no-single-pr');
  }

  // Live re-fetch of the PR is mandatory; a null result means we could not
  // confirm trust, so we stop.
  if (!pr) return deny('pr-unavailable');
  if (pr.state !== 'OPEN') return deny('pr-not-open');
  if (pr.isCrossRepository) return deny('fork-pr');
  if (!owner || pr.authorLogin !== owner) return deny('non-owner');

  // The PR head must still be exactly the SHA that failed; otherwise the branch
  // moved on (superseded) or the mapping is ambiguous.
  if (!headSha || pr.headRefOid !== headSha) return deny('sha-mismatch');

  const processed =
    state && Array.isArray(state.processedRunIds) ? state.processedRunIds : [];
  if (processed.includes(runId)) return deny('duplicate-run');

  // The attempt count is the max of the state marker and the durable git-history
  // floor (count of already-applied fix commits). This keeps the shared limit
  // honest even if a previous run failed to persist the state comment: a pushed
  // fix is always counted because it lives in the branch history.
  const stateAttempts =
    state && Number.isInteger(state.attempts) ? state.attempts : 0;
  const historyAttempts = Number.isInteger(committedAttempts)
    ? committedAttempts
    : 0;
  const attempts = Math.max(stateAttempts, historyAttempts);
  if (attempts >= maxAttempts) return deny('attempts-exhausted');

  return {
    proceed: true,
    reason: 'ok',
    provider,
    firstProvider: plan.first,
    fallbackProvider: plan.fallback,
    attempts,
    processedRunIds: processed,
    prNumber: pr.number,
    prBranch: pr.headRefName,
    headSha,
    runId,
  };
}

// ---- I/O layer (not unit-tested; kept thin) --------------------------------

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8' });
}

// Pure selection: from a list of open PRs, pick the single one whose head commit
// is exactly `headSha`. Returns a one-entry `pull_requests`-shaped array or [].
export function selectPrByHead(list, headSha) {
  if (!Array.isArray(list) || !headSha) return [];
  const match = list.find((p) => p && p.headRefOid === headSha);
  return match ? [{ number: match.number }] : [];
}

// Resolve the owning PR from the run's head when GitHub does not populate
// `workflow_run.pull_requests`. That array is only filled for `pull_request` /
// `push` events, so a run we re-triggered ourselves via `workflow_dispatch`
// (how the automation asks for a fresh check after a validated push) arrives with
// an empty array. Without this, a second failure on the repaired commit could
// never start attempt #2 even with attempts remaining. All trust checks
// (owner / not-a-fork / open / exact-SHA) are still enforced by the live
// re-fetch afterwards, so this only recovers the PR number, it does not relax
// any guarantee. Returns a single-entry array or [] (fail closed).
function resolvePullRequests(headBranch, headSha) {
  if (!headBranch || !headSha) return [];
  try {
    const out = gh([
      'pr',
      'list',
      '--state',
      'open',
      '--head',
      headBranch,
      '--json',
      'number,headRefOid',
    ]);
    return selectPrByHead(JSON.parse(out), headSha);
  } catch {
    return [];
  }
}

// Live re-fetch of the PR. Returns null on any failure so the guard fails closed.
function fetchPr(number) {
  try {
    const out = gh([
      'pr',
      'view',
      String(number),
      '--json',
      'number,state,isCrossRepository,author,headRefOid,headRefName',
    ]);
    const j = JSON.parse(out);
    return {
      number: j.number,
      state: j.state,
      isCrossRepository: j.isCrossRepository,
      authorLogin: j.author?.login,
      headRefOid: j.headRefOid,
      headRefName: j.headRefName,
    };
  } catch {
    return null;
  }
}

// Durable attempt floor: how many automated fix commits already exist on the PR.
// Read from the API (no checkout needed) so a lost state comment cannot hide a
// prior applied fix. Uses the paginated commits endpoint (not `gh pr view`, which
// only returns the first 100 commits — the tip fix commits would be dropped on a
// long PR and undercount the limit). Returns null when the count could not be
// determined, so the caller can fail closed instead of assuming zero.
function fetchCommittedAttempts(number) {
  try {
    const slug = process.env.GITHUB_REPOSITORY;
    if (!slug) return null;
    const out = gh(['api', '--paginate', `repos/${slug}/pulls/${number}/commits`]);
    const raw = JSON.parse(out);
    if (!Array.isArray(raw)) return null;
    const commits = raw.map((c) => ({
      messageHeadline: String(c?.commit?.message ?? '').split('\n', 1)[0],
    }));
    return countCommittedFixes(commits);
  } catch {
    return null;
  }
}

function writeOutputs(decision) {
  const outFile = process.env.GITHUB_OUTPUT;
  const lines = [
    `proceed=${decision.proceed ? 'true' : 'false'}`,
    `reason=${decision.reason}`,
    `provider=${decision.provider ?? ''}`,
    `first_provider=${decision.firstProvider ?? ''}`,
    `fallback_provider=${decision.fallbackProvider ?? ''}`,
    `pr_number=${decision.prNumber ?? ''}`,
    `pr_branch=${decision.prBranch ?? ''}`,
    `head_sha=${decision.headSha ?? ''}`,
    `run_id=${decision.runId ?? ''}`,
    `attempts=${decision.attempts ?? 0}`,
    `processed_run_ids=${JSON.stringify(decision.processedRunIds ?? [])}`,
  ];
  if (outFile) appendFileSync(outFile, lines.join('\n') + '\n');
  // Non-sensitive summary for the job log.
  console.log(`ci-repair guard: proceed=${decision.proceed} reason=${decision.reason}`);
}

async function main() {
  let decision;
  try {
    const eventPath = process.env.GITHUB_EVENT_PATH;
    const event = JSON.parse(readFileSync(eventPath, 'utf8'));
    const wr = event.workflow_run ?? {};
    // For a re-triggered (workflow_dispatch) CI run the event carries no
    // associated PR, so recover it from the head (owner/fork/SHA still verified
    // by the live re-fetch and evaluateGuard below).
    let pullRequests = wr.pull_requests ?? [];
    if (pullRequests.length === 0) {
      pullRequests = resolvePullRequests(wr.head_branch, wr.head_sha);
    }
    const prNumber = pullRequests[0]?.number;

    const pr = prNumber != null ? fetchPr(prNumber) : null;
    const state = prNumber != null ? await readState(prNumber) : null;
    const committed = prNumber != null ? fetchCommittedAttempts(prNumber) : 0;

    // The git-history fix count is the authoritative, tamper-resistant record of
    // how many fixes were already applied. If it cannot be read we fail closed
    // (attempts-unknown) rather than fall back to the state marker, which may be
    // stale (e.g. a prior run pushed a fix but failed to persist the comment).
    // A missed cycle is safe — a later CI failure re-triggers the guard.
    if (committed === null && prNumber != null) {
      writeOutputs({ proceed: false, reason: 'attempts-unknown' });
      return;
    }
    const committedAttempts = committed ?? 0;

    decision = evaluateGuard({
      enabled: process.env.CI_REPAIR_ENABLED,
      provider: process.env.CI_REPAIR_PROVIDER,
      workflowName: wr.name,
      conclusion: wr.conclusion,
      runId: wr.id,
      headSha: wr.head_sha,
      pullRequests,
      owner: process.env.GITHUB_REPOSITORY_OWNER,
      pr,
      state,
      committedAttempts,
    });
  } catch (err) {
    // Fail closed; never surface raw error detail as an actionable signal.
    console.log(`ci-repair guard: internal error (${err.name}); no-op`);
    decision = { proceed: false, reason: 'error' };
  }
  writeOutputs(decision);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
