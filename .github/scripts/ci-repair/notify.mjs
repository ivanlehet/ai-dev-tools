#!/usr/bin/env node
// CI-repair notifications and state persistence.
//
// Two GitHub-only surfaces, both idempotent (never duplicated):
//   1. The single PR status comment (via state.mjs) — always updated so the PR
//      carries the current human-readable status and the trusted state marker.
//   2. The repo-wide singleton Issue "[CI repair] Provider status" (label
//      `ci-repair-alert`, assigned to / mentioning the repo owner) — appended to
//      ONLY on the observable transitions we can actually detect.
//
// It never publishes raw errors, secrets, provider responses, or variable values.
// All messages are fixed, generic strings selected by a transition code.

import { execFileSync } from 'node:child_process';
import { writeState } from './state.mjs';

export const ISSUE_TITLE = '[CI repair] Provider status';
export const ISSUE_LABEL = 'ci-repair-alert';

// Observable transitions -> fixed, non-sensitive messages. Anything not in this
// map produces no Issue entry (we only notify on real, detectable events).
export const TRANSITIONS = {
  'switch-to-cursor':
    'Claude was unavailable or did not produce a valid fix; falling back to Cursor.',
  'both-unavailable':
    'Both Claude and Cursor were unavailable for this run; no automated fix was applied.',
  'provider-recovered':
    'A provider that was previously unavailable is working again.',
  'attempt-limit':
    'The shared 2-attempt limit for this PR has been reached; no further automated repair will run.',
};

export function transitionMessage(event) {
  return Object.prototype.hasOwnProperty.call(TRANSITIONS, event)
    ? TRANSITIONS[event]
    : null;
}

// ---- gh I/O -----------------------------------------------------------------

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8' });
}

function owner() {
  return process.env.GITHUB_REPOSITORY_OWNER || '';
}

// Best-effort label creation; ignore "already exists" and permission errors so a
// notification is never blocked by label bookkeeping.
function ensureLabel() {
  try {
    gh(['label', 'create', ISSUE_LABEL, '-c', 'FBCA04', '-d', 'CI repair provider status alerts']);
  } catch {
    /* label already exists or cannot be created here; proceed */
  }
}

// Returns the existing singleton issue ({ number, state }) or null. Uses a
// title-scoped search (not a first-100 listing) so the singleton is still found
// once the repo has many issues, keeping the issue truly de-duplicated.
function findIssue() {
  try {
    const out = gh([
      'issue',
      'list',
      '--state',
      'all',
      '--search',
      `in:title "${ISSUE_TITLE}"`,
      '--limit',
      '100',
      '--json',
      'number,title,state',
    ]);
    const issues = JSON.parse(out);
    const match = Array.isArray(issues)
      ? issues.find((i) => i.title === ISSUE_TITLE)
      : null;
    return match ? { number: match.number, state: match.state } : null;
  } catch {
    return null;
  }
}

function issueEntry(message, prNumber) {
  const stamp = new Date().toISOString();
  const ref = prNumber ? ` (PR #${prNumber})` : '';
  return `- ${stamp}${ref}: ${message}`;
}

function appendIssueEntry(message, prNumber) {
  const existing = findIssue();
  if (existing) {
    if (existing.state && existing.state.toUpperCase() === 'CLOSED') {
      try {
        gh(['issue', 'reopen', String(existing.number)]);
      } catch {
        /* non-fatal */
      }
    }
    gh(['issue', 'comment', String(existing.number), '-b', issueEntry(message, prNumber)]);
    return existing.number;
  }

  ensureLabel();
  const body = [
    `Automated status log for the CI-repair automation. cc @${owner()}`,
    '',
    issueEntry(message, prNumber),
  ].join('\n');
  const args = ['issue', 'create', '--title', ISSUE_TITLE, '--body', body];
  if (owner()) args.push('--assignee', owner());
  args.push('--label', ISSUE_LABEL);
  try {
    gh(args);
  } catch {
    // Retry without the label if it could not be attached (e.g. label missing).
    const noLabel = ['issue', 'create', '--title', ISSUE_TITLE, '--body', body];
    if (owner()) noLabel.push('--assignee', owner());
    gh(noLabel);
  }
  return null;
}

function parseState() {
  const attempts = Number.parseInt(process.env.CI_REPAIR_ATTEMPTS ?? '0', 10);
  let processedRunIds = [];
  try {
    const parsed = JSON.parse(process.env.CI_REPAIR_PROCESSED_RUN_IDS ?? '[]');
    if (Array.isArray(parsed)) processedRunIds = parsed;
  } catch {
    processedRunIds = [];
  }
  return {
    attempts: Number.isInteger(attempts) ? attempts : 0,
    processedRunIds,
    lastProvider: process.env.CI_REPAIR_LAST_PROVIDER || null,
  };
}

async function main() {
  const prNumber = process.env.CI_REPAIR_PR_NUMBER;
  const statusText = process.env.CI_REPAIR_STATUS_TEXT || 'CI-repair automation ran.';
  const event = process.env.CI_REPAIR_EVENT || '';

  // 1. Persist the trusted state marker (attempts + processed run ids) in the
  //    single PR status comment. This is the ONLY store of the shared attempt
  //    limit and dedupe set, so a silent failure here would let the next run
  //    reset attempts to zero and exceed the documented 2-attempt limit. Retry,
  //    and if it still fails, fail the job loudly rather than swallowing it.
  if (prNumber) {
    let persisted = false;
    for (let attempt = 1; attempt <= 3 && !persisted; attempt++) {
      try {
        await writeState(Number(prNumber), parseState(), statusText);
        persisted = true;
      } catch {
        console.log(`notify: state persist attempt ${attempt} failed`);
      }
    }
    if (!persisted) {
      console.error(
        'notify: could not persist ci-repair state; failing so the attempt limit is not silently reset',
      );
      process.exitCode = 1;
      return;
    }
  }

  // 2. Append to the singleton Issue only on a recognized transition.
  const message = transitionMessage(event);
  if (message) {
    try {
      appendIssueEntry(message, prNumber);
      console.log(`notify: recorded transition "${event}"`);
    } catch {
      console.log('notify: could not update status issue');
    }
  } else if (event) {
    console.log(`notify: ignoring unrecognized transition "${event}"`);
  }
}

main();
