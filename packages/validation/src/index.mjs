// Orchestrates the tool checks and enriches findings with severity/blocking from policy.
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { walkFiles, readJsonSafe, exists, readText } from './util.mjs';
import { loadPolicyRules } from './rules.mjs';
import {
  structureChecks, versionChecks, disclosureChecks, securityChecks,
  privacyChecks, complianceChecks, qualityChecks,
} from './checks.mjs';

const GROUPS = {
  validate: [structureChecks, versionChecks, disclosureChecks, complianceChecks, qualityChecks],
  security: [securityChecks],
  privacy: [privacyChecks],
  // policy-check is the umbrella: every automated check + attestation.
  policy: [structureChecks, versionChecks, disclosureChecks, complianceChecks, qualityChecks, securityChecks, privacyChecks],
};

export async function loadToolContext(root) {
  const files = await walkFiles(root);
  const pkgRes = await readJsonSafe(path.join(root, 'package.json'));
  const tjRes = await readJsonSafe(path.join(root, 'manifest', 'tool.json'));
  const abs = path.resolve(root);
  const segs = abs.split(path.sep);
  const tIdx = segs.lastIndexOf('tools');
  const hostSegment = tIdx >= 0 && segs[tIdx + 1] ? segs[tIdx + 1] : null;
  return {
    root,
    files,
    pkg: pkgRes.ok ? pkgRes.value : null,
    toolJson: tjRes.ok ? tjRes.value : null,
    hostSegment,
    type: tjRes.ok ? tjRes.value.type : null,
    targets: tjRes.ok ? tjRes.value.targets : null,
  };
}

async function attestationChecks(ctx) {
  // Confirms SECURITY-CHECKLIST.md exists and has no unchecked items.
  const f = [];
  const p = path.join(ctx.root, 'SECURITY-CHECKLIST.md');
  if (!(await exists(p))) { f.push({ code: 'ETH001', file: 'SECURITY-CHECKLIST.md', message: 'missing security/ethics checklist attestation' }); return f; }
  const txt = await readText(p);
  const unchecked = (txt.match(/^\s*[-*]\s*\[ \]/gm) || []).length;
  if (unchecked > 0) f.push({ code: 'ETH001', file: 'SECURITY-CHECKLIST.md', message: `${unchecked} unchecked attestation item(s)` });
  return f;
}

/**
 * Run checks for the given categories (default: all).
 * Returns { ok, errorCount, warningCount, findings: [{code, severity, blocking, file, message}] }.
 */
export async function checkTool(root, { categories = ['policy'], repoRoot } = {}) {
  const { byCode } = await loadPolicyRules(repoRoot);
  const ctx = await loadToolContext(root);

  const fns = new Set();
  for (const c of categories) (GROUPS[c] || []).forEach((fn) => fns.add(fn));
  // Attestation (SECURITY-CHECKLIST) is required for the umbrella policy gate only,
  // so a freshly scaffolded tool passes structural `validate` but must be consciously
  // attested before `policy-check` goes green.
  if (categories.includes('policy')) fns.add(attestationChecks);

  const raw = [];
  for (const fn of fns) raw.push(...(await fn(ctx)));

  // De-dupe identical (code,file,message) findings from overlapping groups.
  const seen = new Set();
  const findings = [];
  for (const r of raw) {
    const key = `${r.code}|${r.file}|${r.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const rule = byCode.get(r.code);
    findings.push({
      code: r.code,
      severity: rule?.severity ?? 'error',
      blocking: rule?.blocking ?? true,
      category: rule?.category ?? 'unknown',
      file: r.file,
      message: r.message,
    });
  }
  findings.sort((a, b) => (a.blocking === b.blocking ? a.code.localeCompare(b.code) : a.blocking ? -1 : 1));

  const errorCount = findings.filter((f) => f.severity === 'error').length;
  const warningCount = findings.filter((f) => f.severity === 'warning').length;
  return { tool: ctx.pkg?.name ?? path.basename(root), root, ok: errorCount === 0, errorCount, warningCount, findings };
}

export { GROUPS };
