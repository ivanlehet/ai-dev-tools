#!/usr/bin/env node
// Scoped, reversible-safe uninstaller for Agent Continuity.
//
// Removes ONLY artifacts this tool owns:
//   - the ~/.agent-continuity runtime directory (config, launchers, state, skill copies);
//   - the per-provider skill copies it installed (paths that end in /agent-continuity);
//   - only Agent Continuity hook entries from provider config (other hooks are preserved),
//     restoring the Claude status line that existed before installation;
//   - with --repo <path>, the managed continuity block in that repo's CLAUDE.md / AGENTS.md,
//     the .cursor/rules/agent-continuity.mdc rule, and the AGENT_CONTINUITY.md / CONTINUE_PROMPT.md
//     files this tool wrote.
//
// It never touches unrelated user files, never removes another tool's resources, and supports
// --dry-run to preview every change.
import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertSupportedNode, detectPlatform, removeContinuityHookEntries, BLOCK_RE } from './install.mjs';

const RUNTIME_DIRNAME = '.agent-continuity';
const OWNED_LEAF = 'agent-continuity';

function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function pathExists(path) { try { lstatSync(path); return true; } catch { return false; } }
function readJson(path, fallback = {}) {
  if (!existsSync(path)) return structuredClone(fallback);
  const raw = readFileSync(path, 'utf8').trim();
  if (!raw) return structuredClone(fallback);
  const value = JSON.parse(raw);
  if (!isObject(value)) throw new Error(`Expected a JSON object in ${path}`);
  return value;
}
function writeJson(path, value, { dryRun }) {
  if (dryRun) { console.log(`would update: ${path}`); return; }
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  renameSync(temp, path);
  console.log(`updated: ${path}`);
}

// Only remove a path we own: it must exist and its final segment must be the tool's leaf name.
function removeOwnedPath(path, { dryRun }) {
  if (!pathExists(path)) return false;
  if (basename(path) !== OWNED_LEAF) {
    console.log(`skipped (not owned): ${path}`);
    return false;
  }
  if (dryRun) { console.log(`would remove: ${path}`); return true; }
  rmSync(path, { recursive: true, force: true });
  console.log(`removed: ${path}`);
  return true;
}

function removeRuntime(runtime, { dryRun }) {
  if (!pathExists(runtime)) return;
  if (basename(runtime) !== RUNTIME_DIRNAME) { console.log(`skipped (not owned): ${runtime}`); return; }
  if (dryRun) { console.log(`would remove: ${runtime}`); return; }
  rmSync(runtime, { recursive: true, force: true });
  console.log(`removed: ${runtime}`);
}

function cleanClaude(home, savedStatusLine, { dryRun }) {
  const path = join(home, '.claude', 'settings.json');
  if (!existsSync(path)) return;
  const settings = removeContinuityHookEntries(readJson(path, {}));
  // Restore the pre-install status line, or drop ours if none was recorded.
  if (isObject(savedStatusLine) && savedStatusLine.disabled === true) delete settings.statusLine;
  else if (isObject(savedStatusLine)) settings.statusLine = savedStatusLine;
  else delete settings.statusLine;
  writeJson(path, settings, { dryRun });
}

function cleanNestedHooks(path, { dryRun }) {
  if (!existsSync(path)) return;
  writeJson(path, removeContinuityHookEntries(readJson(path, {})), { dryRun });
}

function cleanRepo(repo, { dryRun }) {
  for (const name of ['CLAUDE.md', 'AGENTS.md']) {
    const path = join(repo, name);
    if (!existsSync(path)) continue;
    const current = readFileSync(path, 'utf8');
    const updated = current.replace(BLOCK_RE, '').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
    if (updated === current) { console.log(`unchanged: ${path}`); continue; }
    if (dryRun) { console.log(`would update: ${path}`); continue; }
    writeFileSync(path, updated, 'utf8');
    console.log(`updated: ${path}`);
  }
  for (const rel of ['.cursor/rules/agent-continuity.mdc', 'AGENT_CONTINUITY.md', 'CONTINUE_PROMPT.md']) {
    const path = join(repo, rel);
    if (!existsSync(path)) continue;
    if (dryRun) { console.log(`would remove: ${path}`); continue; }
    rmSync(path, { force: true });
    console.log(`removed: ${path}`);
  }
}

function parseArgs(argv) {
  const options = { providers: null, repo: null, dryRun: false, allowNonLts: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      console.log('Usage: node uninstall.mjs [--providers claude,codex,cursor] [--repo <path>] [--dry-run] [--allow-non-lts]');
      process.exit(0);
    } else if (arg === '--providers') options.providers = argv[++i];
    else if (arg.startsWith('--providers=')) options.providers = arg.slice(12);
    else if (arg === '--repo') options.repo = argv[++i];
    else if (arg.startsWith('--repo=')) options.repo = arg.slice(7);
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--allow-non-lts') options.allowNonLts = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  assertSupportedNode({ allowNonLts: args.allowNonLts });
  const host = detectPlatform();
  const home = host.home;
  const runtime = join(home, RUNTIME_DIRNAME);
  const opts = { dryRun: args.dryRun };

  // Read the recorded original status line before removing the runtime that stores it.
  const config = readJson(join(runtime, 'config.json'), {});
  const manifest = readJson(join(runtime, 'install-manifest.json'), {});

  const installedProviders = Array.isArray(manifest.providers) && manifest.providers.length
    ? manifest.providers
    : ['claude', 'codex', 'cursor'];
  const requested = args.providers
    ? args.providers.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    : installedProviders;
  const providers = new Set(requested.map((p) => (p === 'claude-code' ? 'claude' : p)));

  const skillTargets = {
    claude: join(home, '.claude', 'skills', OWNED_LEAF),
    codex: join(home, '.agents', 'skills', OWNED_LEAF),
    cursor: join(home, '.cursor', 'skills', OWNED_LEAF),
  };
  for (const provider of providers) {
    const recorded = manifest.installations?.[provider];
    removeOwnedPath(typeof recorded === 'string' ? recorded : skillTargets[provider], opts);
  }

  if (providers.has('claude')) cleanClaude(home, config.original_claude_status_line, opts);
  if (providers.has('codex')) cleanNestedHooks(join(home, '.codex', 'hooks.json'), opts);
  if (providers.has('cursor')) cleanNestedHooks(join(home, '.cursor', 'hooks.json'), opts);

  if (args.repo) cleanRepo(args.repo, opts);

  // Remove the runtime last: it holds the config/manifest read above.
  removeRuntime(runtime, opts);

  console.log(`\n${args.dryRun ? 'Planned uninstall of' : 'Uninstalled'} Agent Continuity for: ${[...providers].sort().join(', ')}.`);
  if (!args.repo) console.log('Repository continuity files were left in place. Re-run with --repo <path> to remove them.');
  return 0;
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  try { process.exitCode = main(); }
  catch (error) { console.error(`ERROR: ${error.message}`); process.exitCode = 1; }
}
