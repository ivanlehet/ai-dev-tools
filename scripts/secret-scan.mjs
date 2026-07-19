#!/usr/bin/env node
// Repo-wide secret scan (self-contained; no external service). Scans git-tracked text
// files with the same high-precision patterns the per-tool security-check uses.
// Exits non-zero if any candidate secret is found.
import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SECRET_PATTERNS, isTextFile } from '../packages/validation/src/util.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function trackedFiles() {
  try {
    return execFileSync('git', ['ls-files'], { cwd: REPO_ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

async function main() {
  const findings = [];
  for (const rel of trackedFiles()) {
    if (!isTextFile(rel)) continue;
    // Meta/attestation docs legitimately mention secret-related words; skip prose docs.
    if (/(^|\/)(SECURITY-CHECKLIST|CHANGELOG|POLICY)\.md$/.test(rel)) continue;
    let txt;
    try { txt = await fs.readFile(path.join(REPO_ROOT, rel), 'utf8'); } catch { continue; }
    const isEnvExample = /(^|\/)\.env\.example$/.test(rel);
    for (const { id, re } of SECRET_PATTERNS) {
      const m = re.exec(txt);
      if (m && !(isEnvExample && /=\s*$/.test(m[0]))) {
        findings.push({ file: rel, id });
        break;
      }
    }
  }
  if (findings.length) {
    console.error(`secret-scan: ${findings.length} candidate secret(s) found:`);
    for (const f of findings) console.error(`  ✗ ${f.file} (${f.id})`);
    process.exit(1);
  }
  console.log('secret-scan: clean');
}

main().catch((err) => { console.error('secret-scan:', err.message); process.exit(2); });
