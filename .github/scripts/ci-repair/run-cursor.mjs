#!/usr/bin/env node
// CI-repair Cursor provider: runs the shared repair task with `@cursor/sdk`.
//
// The read-only checkout has no push credential, so the agent can only edit files
// in `cwd`; the separate *-apply job validates and (if valid) commits/pushes the
// resulting diff. This script only runs the agent and reports outcome via exit
// code, following the SDK's own two-kinds-of-failure model:
//   - thrown CursorAgentError  -> run never started (auth/config/network) -> exit 1
//   - result.status === 'error' -> run started but failed mid-flight       -> exit 2
//   - result.status === 'finished' -> exit 0 (whether or not files changed)
//
// It never prints the API key, provider responses, or raw error objects.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Agent, CursorAgentError } from '@cursor/sdk';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Repo root is two levels up from .github/scripts/ci-repair.
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const INSTRUCTIONS_PATH = path.join(HERE, '..', '..', 'ci-repair', 'agent-instructions.md');

async function main() {
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) {
    // Missing credential is a startup failure, not a run failure.
    console.error('run-cursor: CURSOR_API_KEY is not set');
    process.exit(1);
  }

  const cwd = process.env.CI_REPAIR_CWD || REPO_ROOT;
  let instructions;
  try {
    instructions = readFileSync(INSTRUCTIONS_PATH, 'utf8');
  } catch {
    console.error('run-cursor: could not read shared agent instructions');
    process.exit(1);
  }

  try {
    const result = await Agent.prompt(instructions, {
      apiKey,
      model: { id: 'composer-2.5' },
      local: { cwd },
    });

    if (result.status === 'error') {
      // Run executed but failed mid-flight.
      console.error(`run-cursor: run failed (status=error, id=${result.id ?? 'unknown'})`);
      process.exit(2);
    }

    console.log(`run-cursor: run finished (status=${result.status})`);
    process.exit(0);
  } catch (err) {
    if (err instanceof CursorAgentError) {
      // Run never started: auth, config, or network.
      console.error(`run-cursor: startup failed (retryable=${err.isRetryable})`);
      process.exit(1);
    }
    // Unexpected error: treat as a startup failure (no run, no commit).
    console.error(`run-cursor: unexpected error (${err?.name ?? 'Error'})`);
    process.exit(1);
  }
}

main();
