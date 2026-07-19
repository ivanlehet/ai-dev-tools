// Shared utilities for the validators. No external dependencies.
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const SKIP_DIRS = new Set(['node_modules', '.git', '.nx', 'dist', 'coverage', 'tmp']);

export async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

export async function readText(p) {
  return fs.readFile(p, 'utf8');
}

export async function readJsonSafe(p) {
  try { return { ok: true, value: JSON.parse(await fs.readFile(p, 'utf8')) }; }
  catch (err) { return { ok: false, error: err.message }; }
}

/** Recursively list files (relative to root), skipping SKIP_DIRS. */
export async function walkFiles(root, acc = [], base = root) {
  let entries;
  try { entries = await fs.readdir(root, { withFileTypes: true }); }
  catch { return acc; }
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(root, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      await walkFiles(full, acc, base);
    } else if (e.isFile()) {
      acc.push(path.relative(base, full));
    }
  }
  return acc;
}

/** Minimal YAML frontmatter parser: returns { data, body, hasFrontmatter }. */
export function parseFrontmatter(md) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(md);
  if (!m) return { data: {}, body: md, hasFrontmatter: false };
  const data = {};
  for (const line of m[1].split('\n')) {
    const mm = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (mm) {
      let v = mm[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      data[mm[1]] = v;
    }
  }
  return { data, body: md.slice(m[0].length), hasFrontmatter: true };
}

export function isKebabCase(name) {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name);
}

// High-precision secret patterns (avoid noisy generic entropy checks).
export const SECRET_PATTERNS = [
  { id: 'private-key', re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { id: 'aws-access-key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: 'github-token', re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { id: 'slack-token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { id: 'google-api-key', re: /\bAIza[0-9A-Za-z_\-]{35}\b/ },
  { id: 'generic-assignment', re: /\b(?:api[_-]?key|secret|password|passwd|token)\b\s*[:=]\s*['"][^'"\s]{8,}['"]/i },
];

// Text file extensions we scan for secrets / unsafe content.
export const TEXT_EXT = new Set([
  '.md', '.mdc', '.json', '.sh', '.bash', '.zsh', '.mjs', '.cjs', '.js', '.ts',
  '.py', '.toml', '.yaml', '.yml', '.txt', '.env', '.example',
]);

export function isTextFile(rel) {
  const ext = path.extname(rel).toLowerCase();
  return TEXT_EXT.has(ext) || path.basename(rel).startsWith('.env');
}
