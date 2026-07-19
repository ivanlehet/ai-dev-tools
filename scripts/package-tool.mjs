#!/usr/bin/env node
// Deterministically assemble a tool's distributable artifact.
//
//   node scripts/package-tool.mjs <projectRoot> <outDir>
//
// - Copies only distributable files (excludes repo-only/build/test/secret files).
// - Stamps the single authoritative version (package.json) into the native manifests
//   (.claude-plugin/plugin.json, SKILL.md frontmatter, manifest/tool.json).
// - Emits CHECKSUMS.json (content-addressed, timestamp-independent) for integrity.
//
// It fails loudly (non-zero exit) rather than producing a half-built artifact.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));

const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', '.nx', 'dist', 'coverage', 'tmp', 'tests', 'fixtures',
]);
const EXCLUDE_FILES = new Set([
  'project.json', 'package.json', 'tsconfig.json', 'tsconfig.base.json',
  'CHECKSUMS.json', '.DS_Store',
]);
const EXCLUDE_PATTERNS = [/\.log$/, /^\.env(\..*)?$/, /\.spec\./, /\.test\./, /\.pem$/, /\.key$/];

function isExcludedFile(name) {
  if (EXCLUDE_FILES.has(name)) return true;
  return EXCLUDE_PATTERNS.some((re) => re.test(name));
}

async function walk(dir, base = dir, acc = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.isDirectory()) {
      if (EXCLUDE_DIRS.has(e.name)) continue;
      await walk(path.join(dir, e.name), base, acc);
    } else if (e.isFile()) {
      if (isExcludedFile(e.name)) continue;
      acc.push(path.relative(base, path.join(dir, e.name)));
    }
  }
  return acc;
}

async function readJson(p) {
  return JSON.parse(await fs.readFile(p, 'utf8'));
}

async function stampVersion(root, version) {
  // .claude-plugin/plugin.json
  const pluginJson = path.join(root, '.claude-plugin', 'plugin.json');
  if (await exists(pluginJson)) {
    const j = await readJson(pluginJson);
    j.version = version;
    await fs.writeFile(pluginJson, JSON.stringify(j, null, 2) + '\n');
  }
  // manifest/tool.json
  const toolJson = path.join(root, 'manifest', 'tool.json');
  if (await exists(toolJson)) {
    const j = await readJson(toolJson);
    j.version = version;
    await fs.writeFile(toolJson, JSON.stringify(j, null, 2) + '\n');
  }
  // SKILL.md frontmatter (top-level or skills/*/SKILL.md)
  for (const skill of await findSkillFiles(root)) {
    let md = await fs.readFile(skill, 'utf8');
    if (/^---\n/.test(md)) {
      md = md.replace(/^(---\n[\s\S]*?)\n---/, (m, fm) => {
        const body = /(^|\n)version:\s*.*/.test(fm)
          ? fm.replace(/(^|\n)version:\s*.*/, `$1version: ${version}`)
          : `${fm}\nversion: ${version}`;
        return `${body}\n---`;
      });
      await fs.writeFile(skill, md);
    }
  }
}

async function findSkillFiles(root) {
  const out = [];
  const top = path.join(root, 'SKILL.md');
  if (await exists(top)) out.push(top);
  const skillsDir = path.join(root, 'skills');
  if (await exists(skillsDir)) {
    for (const d of await fs.readdir(skillsDir)) {
      const p = path.join(skillsDir, d, 'SKILL.md');
      if (await exists(p)) out.push(p);
    }
  }
  return out;
}

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function main() {
  const [projectRoot, outDir] = process.argv.slice(2);
  if (!projectRoot || !outDir) {
    console.error('usage: package-tool.mjs <projectRoot> <outDir>');
    process.exit(2);
  }
  const pkg = await readJson(path.join(projectRoot, 'package.json'));
  const version = pkg.version;
  if (!/^\d+\.\d+\.\d+/.test(version || '')) {
    console.error(`package-tool: package.json version is not valid SemVer: ${version}`);
    process.exit(1);
  }

  // Clean out dir, copy included files.
  await fs.rm(outDir, { recursive: true, force: true });
  const files = await walk(projectRoot);
  if (files.length === 0) {
    console.error('package-tool: nothing to package (no included files).');
    process.exit(1);
  }
  for (const rel of files) {
    const dest = path.join(outDir, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(path.join(projectRoot, rel), dest);
  }

  await stampVersion(outDir, version);

  // Bundle the platform-detection helper so shipped install scripts are self-contained.
  const detectSrc = path.join(SCRIPTS_DIR, 'lib', 'detect-platform.sh');
  if (await exists(detectSrc)) {
    await fs.mkdir(path.join(outDir, 'lib'), { recursive: true });
    await fs.copyFile(detectSrc, path.join(outDir, 'lib', 'detect-platform.sh'));
  }

  // Deterministic checksums over the FINAL artifact.
  const outFiles = (await walk(outDir)).sort();
  const entries = [];
  for (const rel of outFiles) {
    if (rel === 'CHECKSUMS.json') continue;
    const buf = await fs.readFile(path.join(outDir, rel));
    entries.push({ path: rel.split(path.sep).join('/'), sha256: crypto.createHash('sha256').update(buf).digest('hex') });
  }
  entries.sort((a, b) => a.path.localeCompare(b.path));
  const digest = crypto.createHash('sha256')
    .update(JSON.stringify(entries)).digest('hex');
  await fs.writeFile(
    path.join(outDir, 'CHECKSUMS.json'),
    JSON.stringify({ tool: pkg.name, version, algorithm: 'sha256', digest, files: entries }, null, 2) + '\n',
  );

  console.log(`package-tool: ${pkg.name}@${version} → ${outDir} (${entries.length} files, digest ${digest.slice(0, 12)}…)`);
}

main().catch((err) => { console.error('package-tool:', err.message); process.exit(1); });
