import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateGuard,
  providerPlan,
  selectPrByHead,
  countCommittedFixes,
  MAX_ATTEMPTS,
} from './guard.mjs';

// A fully-valid input that would proceed. Individual tests override single fields
// to exercise one fail-closed branch at a time.
function baseInput(overrides = {}) {
  return {
    enabled: 'true',
    provider: 'auto',
    workflowName: 'CI',
    conclusion: 'failure',
    runId: 555,
    headSha: 'abc123',
    pullRequests: [{ number: 7 }],
    owner: 'ivanlehet',
    pr: {
      number: 7,
      state: 'OPEN',
      isCrossRepository: false,
      authorLogin: 'ivanlehet',
      headRefOid: 'abc123',
    },
    state: null,
    ...overrides,
  };
}

test('happy path proceeds with the resolved provider plan', () => {
  const d = evaluateGuard(baseInput());
  assert.equal(d.proceed, true);
  assert.equal(d.reason, 'ok');
  assert.equal(d.firstProvider, 'claude');
  assert.equal(d.fallbackProvider, 'cursor');
  assert.equal(d.prNumber, 7);
  assert.equal(d.headSha, 'abc123');
  assert.equal(d.runId, 555);
  assert.equal(d.attempts, 0);
});

test('paused when CI_REPAIR_ENABLED is not exactly "true"', () => {
  assert.equal(evaluateGuard(baseInput({ enabled: 'false' })).reason, 'disabled');
});

test('paused when CI_REPAIR_ENABLED is missing', () => {
  assert.equal(evaluateGuard(baseInput({ enabled: undefined })).reason, 'disabled');
});

test('paused for truthy-looking but invalid enabled values', () => {
  for (const v of ['TRUE', 'True', '1', 'yes', '', ' true ']) {
    const d = evaluateGuard(baseInput({ enabled: v }));
    assert.equal(d.proceed, false, `enabled=${JSON.stringify(v)} must not proceed`);
    assert.equal(d.reason, 'disabled');
  }
});

test('invalid CI_REPAIR_PROVIDER fails closed', () => {
  for (const v of ['gpt', 'AUTO', 'both', '', undefined]) {
    const d = evaluateGuard(baseInput({ provider: v }));
    assert.equal(d.proceed, false);
    assert.equal(d.reason, 'invalid-provider');
  }
});

test('non-CI workflow is ignored', () => {
  assert.equal(evaluateGuard(baseInput({ workflowName: 'CodeQL' })).reason, 'not-ci');
});

test('non-failure conclusion is ignored', () => {
  assert.equal(evaluateGuard(baseInput({ conclusion: 'success' })).reason, 'not-failure');
});

test('requires exactly one associated pull request', () => {
  assert.equal(evaluateGuard(baseInput({ pullRequests: [] })).reason, 'no-single-pr');
  assert.equal(
    evaluateGuard(baseInput({ pullRequests: [{ number: 1 }, { number: 2 }] })).reason,
    'no-single-pr',
  );
});

test('fork PR is excluded', () => {
  const d = evaluateGuard(
    baseInput({ pr: { ...baseInput().pr, isCrossRepository: true } }),
  );
  assert.equal(d.reason, 'fork-pr');
});

test('empty pull_requests (typical fork case) is excluded before PR fetch', () => {
  assert.equal(evaluateGuard(baseInput({ pullRequests: [] })).reason, 'no-single-pr');
});

test('non-owner PR author is excluded', () => {
  const d = evaluateGuard(
    baseInput({ pr: { ...baseInput().pr, authorLogin: 'someone-else' } }),
  );
  assert.equal(d.reason, 'non-owner');
});

test('closed / merged PR is excluded', () => {
  assert.equal(
    evaluateGuard(baseInput({ pr: { ...baseInput().pr, state: 'CLOSED' } })).reason,
    'pr-not-open',
  );
});

test('unavailable live PR fetch fails closed', () => {
  assert.equal(evaluateGuard(baseInput({ pr: null })).reason, 'pr-unavailable');
});

test('superseded / ambiguous head SHA is excluded', () => {
  const d = evaluateGuard(
    baseInput({ pr: { ...baseInput().pr, headRefOid: 'deadbeef' } }),
  );
  assert.equal(d.reason, 'sha-mismatch');
});

test('missing head SHA fails closed', () => {
  assert.equal(evaluateGuard(baseInput({ headSha: undefined })).reason, 'sha-mismatch');
});

test('duplicate run id is not processed twice', () => {
  const d = evaluateGuard(
    baseInput({ state: { attempts: 1, processedRunIds: [555], lastProvider: 'claude' } }),
  );
  assert.equal(d.reason, 'duplicate-run');
});

test('a different run id with attempts remaining proceeds', () => {
  const d = evaluateGuard(
    baseInput({ state: { attempts: 1, processedRunIds: [111], lastProvider: 'claude' } }),
  );
  assert.equal(d.proceed, true);
  assert.equal(d.attempts, 1);
});

test('attempt exhaustion at the shared limit stops', () => {
  const d = evaluateGuard(
    baseInput({
      runId: 999,
      state: { attempts: MAX_ATTEMPTS, processedRunIds: [111], lastProvider: 'cursor' },
    }),
  );
  assert.equal(d.reason, 'attempts-exhausted');
});

test('attempts beyond the limit also stops', () => {
  const d = evaluateGuard(
    baseInput({ runId: 999, state: { attempts: 5, processedRunIds: [], lastProvider: 'cursor' } }),
  );
  assert.equal(d.reason, 'attempts-exhausted');
});

test('provider-mode selection: auto -> claude then cursor', () => {
  assert.deepEqual(providerPlan('auto'), { first: 'claude', fallback: 'cursor' });
});

test('provider-mode selection: claude -> claude only', () => {
  assert.deepEqual(providerPlan('claude'), { first: 'claude', fallback: null });
  const d = evaluateGuard(baseInput({ provider: 'claude' }));
  assert.equal(d.firstProvider, 'claude');
  assert.equal(d.fallbackProvider, null);
});

test('provider-mode selection: cursor -> cursor only', () => {
  assert.deepEqual(providerPlan('cursor'), { first: 'cursor', fallback: null });
  const d = evaluateGuard(baseInput({ provider: 'cursor' }));
  assert.equal(d.firstProvider, 'cursor');
  assert.equal(d.fallbackProvider, null);
});

test('provider-mode selection: unknown -> null plan', () => {
  assert.equal(providerPlan('nope'), null);
});

// selectPrByHead recovers the PR for a re-triggered (workflow_dispatch) CI run,
// where GitHub leaves workflow_run.pull_requests empty. It must return exactly
// the PR whose head commit matches, and nothing on any ambiguity/miss.
test('selectPrByHead: matches the PR at the exact head SHA', () => {
  const list = [
    { number: 3, headRefOid: 'deadbeef' },
    { number: 7, headRefOid: 'abc123' },
  ];
  assert.deepEqual(selectPrByHead(list, 'abc123'), [{ number: 7 }]);
});

test('selectPrByHead: no match returns empty (fail closed)', () => {
  assert.deepEqual(selectPrByHead([{ number: 7, headRefOid: 'abc123' }], 'zzz'), []);
});

test('selectPrByHead: missing sha or non-array returns empty', () => {
  assert.deepEqual(selectPrByHead([{ number: 7, headRefOid: 'abc123' }], ''), []);
  assert.deepEqual(selectPrByHead(null, 'abc123'), []);
});

// countCommittedFixes derives a durable attempt floor from git history.
test('countCommittedFixes: counts only automated fix commits', () => {
  const commits = [
    { messageHeadline: 'feat: something the author did' },
    { messageHeadline: 'fix(ci-repair): apply automated claude fix for failing CI' },
    { messageHeadline: 'fix(ci-repair): apply automated cursor fix for failing CI' },
    { messageHeadline: 'chore: unrelated' },
  ];
  assert.equal(countCommittedFixes(commits), 2);
});

test('countCommittedFixes: non-array or empty returns 0', () => {
  assert.equal(countCommittedFixes(null), 0);
  assert.equal(countCommittedFixes([]), 0);
});

// A lost state comment must not reset the limit: history alone can exhaust it.
test('committed fix history exhausts the shared limit even without state', () => {
  const d = evaluateGuard(
    baseInput({ runId: 4242, state: null, committedAttempts: MAX_ATTEMPTS }),
  );
  assert.equal(d.reason, 'attempts-exhausted');
});

test('effective attempts is the max of state and committed history', () => {
  const d = evaluateGuard(
    baseInput({
      runId: 4243,
      state: { attempts: 0, processedRunIds: [], lastProvider: null },
      committedAttempts: 1,
    }),
  );
  assert.equal(d.proceed, true);
  assert.equal(d.attempts, 1);
});
