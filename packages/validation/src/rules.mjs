// Load and index policy/rules.json.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJsonSafe } from './util.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
// packages/validation/src -> repo root
export const REPO_ROOT = path.resolve(here, '..', '..', '..');

export async function loadPolicyRules(repoRoot = REPO_ROOT) {
  const p = path.join(repoRoot, 'policy', 'rules.json');
  const res = await readJsonSafe(p);
  if (!res.ok) throw new Error(`cannot load policy/rules.json: ${res.error}`);
  const byCode = new Map(res.value.rules.map((r) => [r.code, r]));
  return { policy: res.value, byCode };
}
