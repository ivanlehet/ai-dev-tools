#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { homedir, platform, release, arch } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const VERSION = '1.0.7';
export const BEGIN = '<!-- BEGIN AGENT CONTINUITY -->';
const ROOT = dirname(fileURLToPath(import.meta.url));
export const BLOCK_RE = /<!-- BEGIN AGENT CONTINUITY(?: V\d+)? -->[\s\S]*?<!-- END AGENT CONTINUITY(?: V\d+)? -->\r?\n?/g;
const CONTINUITY_MARKERS = ['agent_continuity.py', 'agent-continuity.mjs', 'agent-continuity', '.agent-continuity'];

function now() { return new Date().toISOString(); }
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function readText(path) { return readFileSync(path, 'utf8'); }
function ensureDir(path) { mkdirSync(path, { recursive: true }); }
function debug(scope, error) { if (process.env.AGENT_CONTINUITY_DEBUG) process.stderr.write(`agent-continuity: ${scope}: ${error?.message ?? error}\n`); }
function safeChmod(path, mode) { if (process.platform !== 'win32') { try { chmodSync(path, mode); } catch (error) { debug('chmod', error); } } }
function pathExists(path) { try { lstatSync(path); return true; } catch { return false; } }

export function assertSupportedNode({ allowNonLts = false } = {}) {
  const major = Number(process.versions.node.split('.')[0]);
  const lts = process.release?.lts;
  if (major < 22) throw new Error(`Node.js LTS 22 or newer is required; detected ${process.version}.`);
  if (!lts && !allowNonLts) throw new Error(`An LTS Node.js release is required; detected ${process.version} (non-LTS). Use the latest LTS release, currently Node.js 24.`);
}

export function detectPlatform(overrides = {}) {
  const system = overrides.system ?? platform();
  const systemRelease = overrides.release ?? release();
  const machine = overrides.machine ?? arch();
  const env = overrides.env ?? process.env;
  const isWindows = overrides.isWindows ?? system === 'win32';
  const isMacos = overrides.isMacos ?? system === 'darwin';
  const isLinux = overrides.isLinux ?? system === 'linux';
  const isWsl = overrides.isWsl ?? (isLinux && Boolean(env.WSL_INTEROP || env.WSL_DISTRO_NAME || /microsoft/i.test(systemRelease)));
  const family = isWindows ? 'windows' : isMacos ? 'macos' : isLinux ? 'linux' : 'other';
  const rawNodeExecutable = overrides.nodeExecutable ?? process.execPath;
  const rawHome = overrides.home ?? homedir();
  return {
    family,
    system,
    release: systemRelease,
    machine,
    node_executable: isWindows ? String(rawNodeExecutable) : resolve(String(rawNodeExecutable)),
    node_version: overrides.nodeVersion ?? process.version,
    node_lts: overrides.nodeLts ?? (process.release?.lts || null),
    home: isWindows ? String(rawHome) : resolve(String(rawHome)),
    is_windows: isWindows,
    is_macos: isMacos,
    is_linux: isLinux,
    is_wsl: isWsl,
  };
}

function quoteUnix(value) { return `'${String(value).replace(/'/g, `'"'"'`)}'`; }
function quoteWindows(value) {
  const text = String(value);
  if (!/[\s"&|<>^]/.test(text)) return text;
  return `"${text.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1')}"`;
}
export function commandString(args, host) { return args.map(host.is_windows ? quoteWindows : quoteUnix).join(' '); }

function parseJson(path, fallback = {}) {
  if (!existsSync(path)) return structuredClone(fallback);
  const raw = readText(path).trim();
  if (!raw) return structuredClone(fallback);
  const value = JSON.parse(raw);
  if (!isObject(value)) throw new Error(`Expected a JSON object in ${path}`);
  return value;
}

function writeJson(path, value, { dryRun = false, mode } = {}) {
  if (dryRun) { console.log(`would update: ${path}`); return; }
  ensureDir(dirname(path));
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  renameSync(temp, path);
  if (mode) safeChmod(path, mode);
}

function uniqueBackupPath(path) {
  let candidate = `${path}.agent-continuity.bak`;
  let index = 1;
  while (pathExists(candidate)) candidate = `${path}.agent-continuity.bak.${index++}`;
  return candidate;
}

function backupPath(path, enabled = true) {
  if (!enabled || !pathExists(path)) return null;
  const target = uniqueBackupPath(path);
  const stat = lstatSync(path);
  if (stat.isDirectory() && !stat.isSymbolicLink()) cpSync(path, target, { recursive: true, dereference: false });
  else { ensureDir(dirname(target)); copyFileSync(path, target); }
  return target;
}

function backupManagedDirectory(path, backupRoot, enabled = true) {
  if (!enabled || !pathExists(path)) return null;
  ensureDir(backupRoot);
  let target = join(backupRoot, `${basename(path)}-${Date.now()}`);
  let index = 1;
  while (pathExists(target)) target = join(backupRoot, `${basename(path)}-${Date.now()}-${index++}`);
  const stat = lstatSync(path);
  if (stat.isDirectory() && !stat.isSymbolicLink()) cpSync(path, target, { recursive: true, dereference: false });
  else copyFileSync(path, target);
  return target;
}

function removePath(path) { if (pathExists(path)) rmSync(path, { recursive: true, force: true }); }

function copyFileIfChanged(source, destination, { backups = true, dryRun = false } = {}) {
  const same = existsSync(destination) && readFileSync(source).equals(readFileSync(destination));
  if (same) { console.log(`unchanged: ${destination}`); return; }
  if (dryRun) { console.log(`would install: ${destination}`); return; }
  backupPath(destination, backups);
  ensureDir(dirname(destination));
  copyFileSync(source, destination);
  console.log(`installed: ${destination}`);
}

function appendBlock(path, block, { backups = true, dryRun = false } = {}) {
  const current = existsSync(path) ? readText(path) : '';
  const normalized = `${block.trim()}\n`;
  let cleaned = current.replace(BLOCK_RE, '').trimEnd();
  const updated = `${cleaned ? `${cleaned}\n\n` : ''}${normalized}`;
  if (updated === current) { console.log(`unchanged: ${path}`); return; }
  if (dryRun) { console.log(`would update: ${path}`); return; }
  backupPath(path, backups);
  ensureDir(dirname(path));
  writeFileSync(path, updated, 'utf8');
  console.log(`updated: ${path}`);
}

function runGit(cwd, args) {
  const result = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Git command failed in ${cwd}: ${result.stderr?.trim() || args.join(' ')}`);
  return result.stdout.trim();
}

export function gitRoot(path) { return resolve(runGit(resolve(path), ['rev-parse', '--show-toplevel'])); }

function isContinuityCommand(value) {
  if (typeof value === 'string') return CONTINUITY_MARKERS.some(marker => value.toLowerCase().includes(marker));
  if (Array.isArray(value)) return value.some(isContinuityCommand);
  if (isObject(value)) return Object.values(value).some(isContinuityCommand);
  return false;
}

export function removeContinuityHookEntries(config) {
  const result = structuredClone(config ?? {});
  const hooks = isObject(result.hooks) ? { ...result.hooks } : {};
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) continue;
    const filtered = groups.filter(group => !isContinuityCommand(group));
    if (filtered.length) hooks[event] = filtered; else delete hooks[event];
  }
  if (Object.keys(hooks).length) result.hooks = hooks; else delete result.hooks;
  return result;
}

export function mergeNestedHooks(existing, incoming) {
  const result = removeContinuityHookEntries(existing);
  const hooks = isObject(result.hooks) ? { ...result.hooks } : {};
  for (const [event, entries] of Object.entries(incoming.hooks ?? {})) hooks[event] = [...(hooks[event] ?? []), ...entries];
  result.hooks = hooks;
  return result;
}

export function mergeCursorHooks(existing, incoming) {
  const result = structuredClone(existing ?? {});
  const oldVersion = Number(result.version || 1);
  const newVersion = Number(incoming.version || 1);
  result.version = Number.isFinite(oldVersion) ? Math.max(oldVersion, newVersion) : newVersion;
  const hooks = isObject(result.hooks) ? { ...result.hooks } : {};
  for (const [event, entries] of Object.entries(hooks)) if (Array.isArray(entries)) hooks[event] = entries.filter(entry => !isContinuityCommand(entry));
  for (const [event, entries] of Object.entries(incoming.hooks ?? {})) hooks[event] = [...(hooks[event] ?? []), ...entries];
  result.hooks = hooks;
  return result;
}

export function claudeHookConfig(nodeExecutable, script) {
  const handler = timeout => ({ type: 'command', command: nodeExecutable, args: [script, 'hook', '--provider', 'claude-code'], timeout });
  const events = { SessionStart: 15, UserPromptSubmit: 15, PostToolBatch: 15, Stop: 20, StopFailure: 15, PreCompact: 20, PostCompact: 15, SessionEnd: 15, CwdChanged: 15 };
  return { hooks: Object.fromEntries(Object.entries(events).map(([event, timeout]) => [event, [{ hooks: [handler(timeout)] }]])) };
}

export function codexHookConfig(command) {
  const handler = (timeout, statusMessage) => ({ type: 'command', command, timeout, ...(statusMessage ? { statusMessage } : {}) });
  return { description: 'Provider-neutral coding task continuity', hooks: {
    SessionStart: [{ matcher: 'startup|resume|clear|compact', hooks: [handler(15, 'Loading continuity state')] }],
    UserPromptSubmit: [{ hooks: [handler(15)] }],
    PostToolUse: [{ matcher: '*', hooks: [handler(15)] }],
    PreCompact: [{ hooks: [handler(20)] }],
    PostCompact: [{ hooks: [handler(15)] }],
    Stop: [{ hooks: [handler(20)] }],
  }};
}

export function cursorHookConfig(command) {
  return { version: 1, hooks: {
    sessionStart: [{ command }], beforeSubmitPrompt: [{ command }], postToolUse: [{ command }], stop: [{ command }], sessionEnd: [{ command }], preCompact: [{ command }],
  }};
}

function installDirectory(source, destination, { linkMode, host, backups, dryRun, backupRoot = null }) {
  let selected = linkMode === 'auto' ? (host.is_windows ? 'copy' : 'symlink') : linkMode;
  if (selected === 'symlink' && pathExists(destination)) {
    try { if (lstatSync(destination).isSymbolicLink() && resolve(dirname(destination), readlinkSync(destination)) === resolve(source)) { console.log(`unchanged: ${destination}`); return 'symlink'; } } catch (error) { debug('symlink-check', error); }
  }
  if (dryRun) { console.log(`would install (${selected}): ${destination} -> ${source}`); return selected; }
  ensureDir(dirname(destination));
  if (pathExists(destination)) {
    if (backupRoot) backupManagedDirectory(destination, backupRoot, backups);
    else backupPath(destination, backups);
    removePath(destination);
  }
  if (selected === 'symlink') {
    try { symlinkSync(source, destination, 'dir'); console.log(`linked: ${destination} -> ${source}`); return 'symlink'; }
    catch (error) { if (linkMode === 'symlink') throw new Error(`Unable to create symlink ${destination}: ${error.message}`, { cause: error }); console.log(`symlink unavailable; falling back to copy: ${destination}`); }
  }
  cpSync(source, destination, { recursive: true, filter: src => !/(^|[\\/])(?:\.git|node_modules)(?:[\\/]|$)|(?:\.zip|\.DS_Store)$/.test(src) });
  console.log(`copied: ${destination}`);
  return 'copy';
}

function writeLaunchers(binDir, nodeExecutable, script, { dryRun }) {
  const unix = join(binDir, 'agent-continuity');
  const windows = join(binDir, 'agent-continuity.cmd');
  const unixText = `#!/bin/sh\nexec ${quoteUnix(nodeExecutable)} ${quoteUnix(script)} "$@"\n`;
  const windowsText = `@echo off\r\n${quoteWindows(nodeExecutable)} ${quoteWindows(script)} %*\r\n`;
  if (dryRun) { console.log(`would create launcher: ${unix}`); console.log(`would create launcher: ${windows}`); }
  else { ensureDir(binDir); writeFileSync(unix, unixText); writeFileSync(windows, windowsText); safeChmod(unix, 0o755); }
  return { unix, windows };
}

function defaultConfig() {
  return { active_run_ttl_minutes: 480, startup_usage: { enabled: true, cache_max_age_seconds: 300, probe_timeout_seconds: 8, unknown_policy: 'safe-bootstrap', providers: {
    'claude-code': { mode: 'cache-then-statusline' }, codex: { mode: 'official-app-server' }, cursor: { mode: 'hook-or-trusted-adapter', adapter_command: null },
  }}, thresholds: {
    warning: { five_hour: 70, seven_day: 85, context: 72 }, checkpoint: { five_hour: 82, seven_day: 92, context: 82 }, handoff: { five_hour: 89, seven_day: 96, context: 89 }, critical: { five_hour: 95, seven_day: 99, context: 95 },
  }};
}

function deepDefaults(target, defaults) {
  for (const [key, value] of Object.entries(defaults)) {
    if (!(key in target)) target[key] = structuredClone(value);
    else if (isObject(value) && isObject(target[key])) deepDefaults(target[key], value);
  }
  return target;
}

function installProject(kit, repo, options) {
  for (const name of ['AGENT_CONTINUITY.md', 'CONTINUE_PROMPT.md']) copyFileIfChanged(join(kit, name), join(repo, name), options);
  appendBlock(join(repo, 'CLAUDE.md'), readText(join(kit, 'templates', 'CLAUDE_APPEND.md')), options);
  appendBlock(join(repo, 'AGENTS.md'), readText(join(kit, 'templates', 'AGENTS_APPEND.md')), options);
  copyFileIfChanged(join(kit, 'templates', 'cursor-agent-continuity.mdc'), join(repo, '.cursor', 'rules', 'agent-continuity.mdc'), options);
}

function installGlobal(kit, host, { providers, includeCursorHooks, linkMode, backups, dryRun }) {
  const home = host.home;
  const runtime = join(home, '.agent-continuity');
  const skillTarget = join(runtime, 'skill', 'agent-continuity');
  const binDir = join(runtime, 'bin');
  const scriptTarget = join(binDir, 'agent-continuity.mjs');

  if (dryRun) console.log(`would prepare runtime: ${runtime}`);
  else {
    ensureDir(runtime); removePath(skillTarget);
    cpSync(kit, skillTarget, { recursive: true, filter: src => !/(^|[\\/])(?:\.git|node_modules)(?:[\\/]|$)|(?:\.zip|\.DS_Store)$/.test(src) });
    ensureDir(binDir); copyFileSync(join(kit, 'scripts', 'agent-continuity.mjs'), scriptTarget); safeChmod(scriptTarget, 0o755);
  }
  const launchers = writeLaunchers(binDir, host.node_executable, scriptTarget, { dryRun });
  const installations = {};
  const targets = { claude: join(home, '.claude', 'skills', 'agent-continuity'), codex: join(home, '.agents', 'skills', 'agent-continuity'), cursor: join(home, '.cursor', 'skills', 'agent-continuity') };
  for (const [provider, destination] of Object.entries(targets)) if (providers.has(provider)) installations[provider] = installDirectory(skillTarget, destination, { linkMode, host, backups, dryRun, backupRoot: join(runtime, 'backups', 'skills', provider) });

  const configPath = join(runtime, 'config.json');
  const config = dryRun ? defaultConfig() : deepDefaults(parseJson(configPath, {}), defaultConfig());
  const hookBase = [host.node_executable, scriptTarget, 'hook'];

  if (providers.has('claude')) {
    const settingsPath = join(home, '.claude', 'settings.json');
    const existing = parseJson(settingsPath, {});
    const currentStatus = existing.statusLine;
    if (isObject(currentStatus) && !isContinuityCommand(currentStatus)) config.original_claude_status_line = currentStatus;
    else if (!config.original_claude_status_line) config.original_claude_status_line = { disabled: true };
    // Claude discovers hooks from the manifest-bearing skills-directory plugin.
    // Keep settings free of duplicate Agent Continuity hook registrations.
    const merged = removeContinuityHookEntries(existing);
    merged.statusLine = { type: 'command', command: commandString([host.node_executable, scriptTarget, 'statusline'], host), padding: 0, refreshInterval: 15 };
    if (!merged.cleanupPeriodDays) merged.cleanupPeriodDays = 365;
    if (!dryRun) backupPath(settingsPath, backups);
    writeJson(settingsPath, merged, { dryRun });
  }
  if (providers.has('codex')) {
    const path = join(home, '.codex', 'hooks.json');
    const merged = mergeNestedHooks(parseJson(path, {}), codexHookConfig(commandString([...hookBase, '--provider', 'codex'], host)));
    if (!merged.description) merged.description = 'Provider-neutral coding task continuity';
    if (!dryRun) backupPath(path, backups);
    writeJson(path, merged, { dryRun });
  }
  if (providers.has('cursor') && includeCursorHooks) {
    const path = join(home, '.cursor', 'hooks.json');
    const merged = mergeCursorHooks(parseJson(path, {}), cursorHookConfig(commandString([...hookBase, '--provider', 'cursor'], host)));
    if (!dryRun) backupPath(path, backups);
    writeJson(path, merged, { dryRun });
  }
  if (!dryRun) {
    writeJson(configPath, config);
    writeJson(join(runtime, 'install-manifest.json'), { schema_version: 2, agent_continuity_version: VERSION, installed_at: now(), host, providers: [...providers].sort(), link_mode_requested: linkMode, installations, runtime, script: scriptTarget, launchers, runtime_requirement: { node_lts: true, minimum_major: 22, recommended_major: 24 } });
  } else console.log(`would update: ${configPath}`);
  return { runtime, script: scriptTarget, launchers, installations };
}

function parseProviders(raw) {
  const aliases = { 'claude-code': 'claude', claude: 'claude', codex: 'codex', cursor: 'cursor', all: 'all' };
  const result = new Set();
  for (const item of String(raw).split(',')) {
    const key = item.trim().toLowerCase(); if (!key) continue;
    if (!(key in aliases)) throw new Error(`Unknown provider: ${item}`);
    if (aliases[key] === 'all') return new Set(['claude', 'codex', 'cursor']);
    result.add(aliases[key]);
  }
  return result.size ? result : new Set(['claude', 'codex', 'cursor']);
}

function usage() {
  console.log(`Usage: node install.mjs [repo] [options]\n\nOptions:\n  --project-only\n  --global-only\n  --providers claude,codex,cursor,all\n  --skip-cursor-hooks\n  --link-mode auto|copy|symlink\n  --no-backup\n  --skip-validation\n  --dry-run\n  --print-platform\n  --allow-non-lts (development only)\n  --help`);
}

function parseArgs(argv) {
  const options = { repo: '.', projectOnly: false, globalOnly: false, providers: new Set(['claude', 'codex', 'cursor']), skipCursorHooks: false, linkMode: 'auto', noBackup: false, skipValidation: false, dryRun: false, printPlatform: false, allowNonLts: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') { usage(); process.exit(0); }
    else if (arg === '--project-only') options.projectOnly = true;
    else if (arg === '--global-only') options.globalOnly = true;
    else if (arg === '--providers') options.providers = parseProviders(argv[++i]);
    else if (arg.startsWith('--providers=')) options.providers = parseProviders(arg.slice(12));
    else if (arg === '--skip-cursor-hooks') options.skipCursorHooks = true;
    else if (arg === '--link-mode') options.linkMode = argv[++i];
    else if (arg.startsWith('--link-mode=')) options.linkMode = arg.slice(12);
    else if (arg === '--no-backup') options.noBackup = true;
    else if (arg === '--skip-validation') options.skipValidation = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--print-platform') options.printPlatform = true;
    else if (arg === '--allow-non-lts') options.allowNonLts = true;
    else if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    else options.repo = arg;
  }
  if (options.projectOnly && options.globalOnly) throw new Error('--project-only and --global-only cannot be combined.');
  if (!['auto', 'copy', 'symlink'].includes(options.linkMode)) throw new Error(`Invalid --link-mode: ${options.linkMode}`);
  return options;
}

function runValidator(kit, allowNonLts) {
  const args = [join(kit, 'validate.mjs'), '--package-only', '--skip-tests'];
  if (allowNonLts) args.push('--allow-non-lts');
  const result = spawnSync(process.execPath, args, { cwd: kit, encoding: 'utf8' });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error('Package validation failed. Use --skip-validation only for development diagnostics.');
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  assertSupportedNode({ allowNonLts: args.allowNonLts });
  const host = detectPlatform();
  if (args.printPlatform) { console.log(JSON.stringify(host, null, 2)); return 0; }
  if (host.family === 'other') throw new Error(`Unsupported operating system: ${host.system}`);
  const gitCheck = spawnSync('git', ['--version'], { encoding: 'utf8' });
  if (gitCheck.status !== 0) throw new Error('Git is required and was not found on PATH.');
  if (!args.skipValidation) runValidator(ROOT, args.allowNonLts);
  console.log('Detected platform:'); console.log(JSON.stringify(host, null, 2));
  const commonOptions = { backups: !args.noBackup, dryRun: args.dryRun };
  if (!args.globalOnly) installProject(ROOT, gitRoot(args.repo), commonOptions);
  let result = null;
  if (!args.projectOnly) result = installGlobal(ROOT, host, { providers: args.providers, includeCursorHooks: !args.skipCursorHooks, linkMode: args.linkMode, backups: !args.noBackup, dryRun: args.dryRun });
  console.log(`\n${args.dryRun ? 'Planned' : 'Installed'} Agent Continuity ${VERSION}.`);
  if (result) {
    const launcher = host.is_windows ? result.launchers.windows : result.launchers.unix;
    console.log(`Runtime command: ${launcher}`);
    console.log(`Verify with: ${commandString([launcher, 'doctor', '--cwd', resolve(args.repo)], host)}`);
  }
  console.log('Reload Claude plugins/hooks or restart active clients after installation.');
  if (args.providers.has('claude')) {
    console.log('Claude plugin name: agent-continuity@skills-dir');
    console.log('After restarting Claude Code, verify with: claude plugin list');
  }
  if (args.providers.has('codex')) console.log('In Codex, review and trust newly installed hooks when the client requests approval.');
  return 0;
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  try { process.exitCode = main(); }
  catch (error) { console.error(`ERROR: ${error.message}`); process.exitCode = 1; }
}
