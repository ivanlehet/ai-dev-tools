#!/usr/bin/env node
// CI-repair state: read/verify and write the hidden state marker embedded in a
// single PR status comment.
//
// The marker looks like:
//   <!-- ci-repair-state:{"attempts":1,"processedRunIds":[123],"lastProvider":"claude"} -->
// followed by a human-readable status. The marker is ONLY trusted when the
// carrying comment was authored by `github-actions[bot]`; a public comment that
// merely looks like the marker is never trusted.
//
// Parsing/serialization (`parseStateMarker`, `buildComment`) is pure. The gh I/O
// helpers find-or-create exactly one status comment and edit it in place.

import { execFileSync } from 'node:child_process';

export const TRUSTED_AUTHOR = 'github-actions[bot]';
const MARKER_RE = /<!--\s*ci-repair-state:([\s\S]*?)-->/;

// Extracts and parses the state object from a comment body. Returns null when the
// marker is absent or the payload is not a valid JSON object.
export function parseStateMarker(body) {
  if (typeof body !== 'string') return null;
  const m = MARKER_RE.exec(body);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[1].trim());
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    return obj;
  } catch {
    return null;
  }
}

// Builds the full comment body: hidden marker followed by human-readable status.
export function buildComment(state, humanReadable) {
  const marker = `<!-- ci-repair-state:${JSON.stringify(state)} -->`;
  const text = typeof humanReadable === 'string' ? humanReadable : '';
  return `${marker}\n\n${text}`.trimEnd() + '\n';
}

// ---- gh I/O layer -----------------------------------------------------------

function repoSlug() {
  const slug = process.env.GITHUB_REPOSITORY;
  if (!slug) throw new Error('GITHUB_REPOSITORY is not set');
  return slug;
}

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8' });
}

// Returns the first trusted status comment ({ id, state }) or null.
function findTrustedComment(prNumber) {
  const path = `repos/${repoSlug()}/issues/${prNumber}/comments`;
  let comments;
  try {
    comments = JSON.parse(gh(['api', '--paginate', path]));
  } catch {
    return null;
  }
  if (!Array.isArray(comments)) return null;
  for (const c of comments) {
    if (c?.user?.login !== TRUSTED_AUTHOR) continue;
    const state = parseStateMarker(c.body);
    if (state) return { id: c.id, state };
  }
  return null;
}

// Reads the trusted state marker for a PR, or null when none exists / is trusted.
export async function readState(prNumber) {
  return findTrustedComment(prNumber)?.state ?? null;
}

// Writes the singleton status comment: edits the existing trusted comment in place
// or creates it once. Never produces a duplicate.
export async function writeState(prNumber, state, humanReadable) {
  const body = buildComment(state, humanReadable);
  const existing = findTrustedComment(prNumber);
  const slug = repoSlug();
  if (existing) {
    gh([
      'api',
      '--method',
      'PATCH',
      `repos/${slug}/issues/comments/${existing.id}`,
      '-f',
      `body=${body}`,
    ]);
    return { id: existing.id, created: false };
  }
  const out = gh([
    'api',
    '--method',
    'POST',
    `repos/${slug}/issues/${prNumber}/comments`,
    '-f',
    `body=${body}`,
  ]);
  let id;
  try {
    id = JSON.parse(out).id;
  } catch {
    id = undefined;
  }
  return { id, created: true };
}
