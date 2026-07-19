#!/usr/bin/env node
// Inspect a BUILT artifact (not the source) for policy compliance.
//
//   node scripts/validate-package.mjs <artifactDir>
//
// Checks (diagnostic codes map to policy/rules.json):
//   PKG001 — no prohibited files (secrets, node_modules, caches, repo-only, machine paths)
//   PKG002 — CHECKSUMS.json present and every recomputed hash matches (deterministic/integrity)
//   PKG003 — native manifest version matches CHECKSUMS.json version (consistency)
// Emits machine-readable JSON diagnostics on stderr summary and a non-zero exit on any error.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const PROHIBITED_DIRS = ['node_modules', '.git', '.nx', 'coverage', 'tmp'];
const PROHIBITED_FILE_PATTERNS = [
  /^\.env(\..*)?$/, /\.log$/, /\.pem$/, /\.key$/, /project\.json$/, /package\.json$/,
];
const findings = [];
function add(code, severity, file, message) { findings.push({ code, severity, file, message }); }

async function walk(dir, base = dir, acc = []) {
  for (const e of (await fs.readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, base, acc);
    else if (e.isFile()) acc.push(path.relative(base, full));
  }
  return acc;
}
const exists = async (p) => { try { await fs.access(p); return true; } catch { return false; } };

async function main() {
  const artifactDir = process.argv[2];
  if (!artifactDir) { console.error('usage: validate-package.mjs <artifactDir>'); process.exit(2); }
  if (!(await exists(artifactDir))) { console.error(`validate-package: not found: ${artifactDir}`); process.exit(1); }

  const files = await walk(artifactDir);

  // PKG001 — prohibited content
  for (const rel of files) {
    const parts = rel.split(path.sep);
    if (parts.some((p) => PROHIBITED_DIRS.includes(p))) add('PKG001', 'error', rel, 'prohibited directory in artifact');
    const name = parts[parts.length - 1];
    if (PROHIBITED_FILE_PATTERNS.some((re) => re.test(name))) add('PKG001', 'error', rel, 'prohibited/repo-only file in artifact');
    if (parts.includes('..')) add('PKG001', 'error', rel, 'path traversal in artifact');
  }

  // PKG002 — checksum present & valid
  const ckPath = path.join(artifactDir, 'CHECKSUMS.json');
  if (!(await exists(ckPath))) {
    add('PKG002', 'error', 'CHECKSUMS.json', 'missing integrity manifest');
  } else {
    const ck = JSON.parse(await fs.readFile(ckPath, 'utf8'));
    for (const entry of ck.files || []) {
      const p = path.join(artifactDir, entry.path);
      if (!(await exists(p))) { add('PKG002', 'error', entry.path, 'listed in CHECKSUMS.json but missing'); continue; }
      const actual = crypto.createHash('sha256').update(await fs.readFile(p)).digest('hex');
      if (actual !== entry.sha256) add('PKG002', 'error', entry.path, 'checksum mismatch (non-deterministic or tampered)');
    }
    const recomputedDigest = crypto.createHash('sha256').update(JSON.stringify(ck.files || [])).digest('hex');
    if (recomputedDigest !== ck.digest) add('PKG002', 'error', 'CHECKSUMS.json', 'top-level digest mismatch');

    // PKG003 — version consistency between manifest(s) and checksum record
    const pluginJson = path.join(artifactDir, '.claude-plugin', 'plugin.json');
    if (await exists(pluginJson)) {
      const v = JSON.parse(await fs.readFile(pluginJson, 'utf8')).version;
      if (v !== ck.version) add('PKG003', 'error', '.claude-plugin/plugin.json', `version ${v} != artifact version ${ck.version}`);
    }
    const toolJson = path.join(artifactDir, 'manifest', 'tool.json');
    if (await exists(toolJson)) {
      const v = JSON.parse(await fs.readFile(toolJson, 'utf8')).version;
      if (v !== ck.version) add('PKG003', 'error', 'manifest/tool.json', `version ${v} != artifact version ${ck.version}`);
    }
  }

  const errors = findings.filter((f) => f.severity === 'error');
  process.stdout.write(JSON.stringify({ artifact: artifactDir, ok: errors.length === 0, findings }, null, 2) + '\n');
  if (errors.length) {
    console.error(`validate-package: ${errors.length} blocking finding(s).`);
    process.exit(1);
  }
  console.error('validate-package: OK');
}

main().catch((err) => { console.error('validate-package:', err.message); process.exit(1); });
