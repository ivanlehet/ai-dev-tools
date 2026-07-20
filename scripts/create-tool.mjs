#!/usr/bin/env node
// Scaffold a new tool as an independent Nx release unit.
//
//   node scripts/create-tool.mjs --type <t> --name <n> --targets <a,b> [options]
//
// Options:
//   --type       skill|plugin|hook|agent|rule|prompt|mcp        (required)
//   --name       kebab-case unique name                          (required)
//   --targets    comma-separated hosts: claude,cursor,codex      (required)
//   --summary    one-line description
//   --license    SPDX id (default: MIT)
//   --version    initial SemVer (default: 0.1.0)
//   --cap        comma-separated capabilities set to true (e.g. shell,network)
//   --spec       official spec URL used for validation
//   --reviewed   ISO date the spec was reviewed (default: today via --reviewed)
//   --force      overwrite an existing tool directory (default: refuse)
//   --quiet      suppress the summary
//
// It validates every input, refuses unsupported type/host combinations and undeclared
// capabilities, writes atomically (temp dir -> rename), and never leaves a partial project.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  TYPE_RULES, toolJson, readme, securityChecklist, smokeTest, changelog, nativeFiles,
} from './lib/tool-templates.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
// Output root; overridable for isolated tests so fixtures never pollute tools/.
const REPO_ROOT = process.env.AI_DEV_TOOLS_ROOT
  ? path.resolve(process.env.AI_DEV_TOOLS_ROOT)
  : path.resolve(here, '..');
const CAP_KEYS = ['filesystemRead', 'filesystemWrite', 'shell', 'network', 'git', 'externalApis', 'mcp', 'credentials', 'telemetry', 'remoteContent'];

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (key === 'force' || key === 'quiet') o[key] = true;
      else { o[key] = argv[++i]; }
    }
  }
  return o;
}

function fail(msg) { console.error(`create-tool: ${msg}`); process.exit(1); }

function validateInputs(o) {
  const errors = [];
  if (!o.type || !TYPE_RULES[o.type]) errors.push(`--type must be one of: ${Object.keys(TYPE_RULES).join(', ')}`);
  if (!o.name || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(o.name)) errors.push('--name must be kebab-case (a-z, 0-9, hyphens)');
  const targets = (o.targets || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (targets.length === 0) errors.push('--targets is required (comma-separated hosts)');

  if (o.type && TYPE_RULES[o.type]) {
    const rule = TYPE_RULES[o.type];
    for (const t of targets) if (!rule.hosts.includes(t)) errors.push(`type "${o.type}" does not support target "${t}" (allowed: ${rule.hosts.join(', ')})`);
    if (targets.length > 1 && !rule.multi) errors.push(`type "${o.type}" is single-host only, cannot target multiple hosts`);
  }
  const version = o.version || '0.1.0';
  if (!/^\d+\.\d+\.\d+([-+].*)?$/.test(version)) errors.push(`--version "${version}" is not valid SemVer`);

  const caps = {};
  if (o.cap) {
    for (const c of o.cap.split(',').map((s) => s.trim()).filter(Boolean)) {
      if (!CAP_KEYS.includes(c)) errors.push(`unknown capability "${c}" (allowed: ${CAP_KEYS.join(', ')})`);
      else caps[c] = true;
    }
  }
  if (errors.length) fail('invalid input:\n  - ' + errors.join('\n  - '));
  return { targets, version, caps };
}

function lifecycleProjectJson({ name, type, targets, toolPath }) {
  const host = targets.length === 1 ? targets[0] : 'portable';
  const dist = `dist/tools/${name}`;
  const v = `packages/validation/src/cli.mjs`;
  return JSON.stringify({
    name,
    // Resolve both operands under REPO_ROOT so the result is always a REPO_ROOT-relative
    // path. Passing the repo-relative toolPath directly would resolve it against process.cwd()
    // and, when the repo and REPO_ROOT sit on different drives (e.g. Windows temp vs workspace),
    // path.relative would emit an absolute path — breaking the schema link and tripping SEC005.
    $schema: path.relative(path.join(REPO_ROOT, toolPath), path.join(REPO_ROOT, 'node_modules/nx/schemas/project-schema.json')).split(path.sep).join('/'),
    projectType: 'library',
    sourceRoot: toolPath,
    tags: [`ai:${host}`, `type:${type}`],
    targets: {
      validate: { executor: 'nx:run-commands', options: { command: `node ${v} validate ${toolPath}` } },
      'security-check': { executor: 'nx:run-commands', options: { command: `node ${v} security ${toolPath}` } },
      'privacy-check': { executor: 'nx:run-commands', options: { command: `node ${v} privacy ${toolPath}` } },
      'policy-check': { executor: 'nx:run-commands', options: { command: `node ${v} policy ${toolPath}` } },
      test: { executor: 'nx:run-commands', options: { command: 'node --test', cwd: toolPath } },
      package: { executor: 'nx:run-commands', outputs: [`{workspaceRoot}/${dist}`], options: { command: `node scripts/package-tool.mjs ${toolPath} ${dist}` } },
      'validate-package': { executor: 'nx:run-commands', dependsOn: ['package'], options: { command: `node scripts/validate-package.mjs ${dist}` } },
      install: { executor: 'nx:run-commands', options: { command: `bash ${toolPath}/install.sh --host ${targets[0]}` } },
      uninstall: { executor: 'nx:run-commands', options: { command: `bash ${toolPath}/uninstall.sh --host ${targets[0]}` } },
      'verify-install': { executor: 'nx:run-commands', options: { command: `bash ${toolPath}/validate.sh --verify-install --host ${targets[0]}` } },
    },
  }, null, 2) + '\n';
}

// ---- shell scripts (self-contained, bundled with the artifact) --------------
const SOURCE_DETECT = `SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/lib/detect-platform.sh" ]; then . "$SCRIPT_DIR/lib/detect-platform.sh"
elif [ -f "$SCRIPT_DIR/../../../../scripts/lib/detect-platform.sh" ]; then . "$SCRIPT_DIR/../../../../scripts/lib/detect-platform.sh"
else echo "detect-platform.sh not found" >&2; exit 1; fi`;

const RESOLVE_TARGET = `resolve_target() {
  case "$AI_HOST:$TOOL_TYPE" in
    claude:skill)  TARGET="$CLAUDE_HOME/skills/$TOOL_NAME" ;;
    codex:skill)   TARGET="$CODEX_HOME/skills/$TOOL_NAME" ;;
    claude:agent)  TARGET="$CLAUDE_HOME/agents/$TOOL_NAME" ;;
    claude:hook)   TARGET="$CLAUDE_HOME/hooks/$TOOL_NAME" ;;
    claude:plugin) TARGET="$CLAUDE_HOME/plugins/local/$TOOL_NAME" ;;
    cursor:rule)   TARGET="\${DEST:-$PWD}/.cursor/rules/$TOOL_NAME" ;;
    codex:prompt)  TARGET="\${DEST:-$PWD}/.agents/$TOOL_NAME" ;;
    cursor:prompt) TARGET="\${DEST:-$PWD}/.agents/$TOOL_NAME" ;;
    claude:mcp|cursor:mcp|codex:mcp) TARGET="\${DEST:-$PWD}/.mcp-servers/$TOOL_NAME" ;;
    *) echo "install: unsupported combination $AI_HOST:$TOOL_TYPE" >&2; return 1 ;;
  esac
}`;

function installSh({ name, type, targets }) {
  return `#!/usr/bin/env bash
# Install ${name} for a selected host. Detects the OS, scopes writes, backs up, is reversible.
set -euo pipefail
${SOURCE_DETECT}

TOOL_NAME="${name}"
TOOL_TYPE="${type}"
parse_common_args "$@"
require_host "$AI_HOST" "${targets.join(' ')}"
detect_platform
${RESOLVE_TARGET}
resolve_target

RECEIPT="$SCRIPT_DIR/.install-receipt"
if [ "$DRY_RUN" = "1" ]; then echo "[dry-run] would install ${name} -> $TARGET"; exit 0; fi

if [ -e "$TARGET" ]; then
  BACKUP="$TARGET.bak.$$"
  echo "install: existing target found, backing up to $BACKUP"
  mv "$TARGET" "$BACKUP"
fi
safe_install_dir "$SCRIPT_DIR" "$TARGET"
# Remove repo-only / installer files from the installed copy.
rm -f "$TARGET/install.sh" "$TARGET/uninstall.sh" "$TARGET/validate.sh" "$TARGET/project.json" "$TARGET/package.json" 2>/dev/null || true
rm -rf "$TARGET/lib" "$TARGET/tests" "$TARGET/fixtures" 2>/dev/null || true
printf '%s\\n' "$TARGET" > "$RECEIPT"
echo "install: ${name} installed to $TARGET (host: $AI_HOST, os: $OS_PLATFORM)"
case "$TOOL_TYPE" in
  plugin) echo "  next: claude plugin marketplace add . && claude plugin install ${name}@ai-dev-tools" ;;
  prompt) echo "  note: to activate, merge $TARGET/AGENTS.md into your project's AGENTS.md" ;;
  mcp)    echo "  note: register $TARGET/server.json with your host (e.g. codex mcp add / .mcp.json)" ;;
esac
`;
}

function uninstallSh({ name, type, targets }) {
  return `#!/usr/bin/env bash
# Uninstall ${name}: removes only the directory this tool owns. Supports --dry-run.
set -euo pipefail
${SOURCE_DETECT}

TOOL_NAME="${name}"
TOOL_TYPE="${type}"
parse_common_args "$@"
require_host "$AI_HOST" "${targets.join(' ')}"
detect_platform
${RESOLVE_TARGET}
resolve_target

RECEIPT="$SCRIPT_DIR/.install-receipt"
if [ -f "$RECEIPT" ]; then TARGET="$(cat "$RECEIPT")"; fi
if [ ! -e "$TARGET" ]; then echo "uninstall: nothing installed at $TARGET"; exit 0; fi
case "$TARGET" in *"/$TOOL_NAME") : ;; *) echo "uninstall: refusing to remove non-owned path $TARGET" >&2; exit 1 ;; esac
if [ "$DRY_RUN" = "1" ]; then echo "[dry-run] would remove $TARGET"; exit 0; fi
rm -rf "$TARGET"
rm -f "$RECEIPT"
echo "uninstall: removed $TARGET"
`;
}

function validateSh({ name, type, targets }) {
  return `#!/usr/bin/env bash
# Validate ${name}. Default: structural self-check. With --verify-install: confirm the install.
set -euo pipefail
${SOURCE_DETECT}

TOOL_NAME="${name}"
TOOL_TYPE="${type}"
MODE="selfcheck"
case " $* " in *" --verify-install "*) MODE="verify-install" ;; esac
parse_common_args "$@"
detect_platform

if [ "$MODE" = "verify-install" ]; then
  require_host "$AI_HOST" "${targets.join(' ')}"
  ${RESOLVE_TARGET}
  resolve_target
  RECEIPT="$SCRIPT_DIR/.install-receipt"
  if [ -f "$RECEIPT" ]; then TARGET="$(cat "$RECEIPT")"; fi
  [ -d "$TARGET" ] || { echo "verify-install: not installed at $TARGET" >&2; exit 1; }
  echo "verify-install: ${name} present at $TARGET"
  exit 0
fi

# Structural self-check (no Nx needed): manifest present & parseable.
[ -f "$SCRIPT_DIR/manifest/tool.json" ] || { echo "validate: missing manifest/tool.json" >&2; exit 1; }
node -e "JSON.parse(require('fs').readFileSync('$SCRIPT_DIR/manifest/tool.json','utf8'))" || { echo "validate: invalid tool.json" >&2; exit 1; }
echo "validate: ${name} structural self-check OK (os: $OS_PLATFORM)"
`;
}

async function writeTree(root, files) {
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(root, rel);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, content);
  }
}

async function registerPluginInMarketplace(name, toolPath) {
  const mpPath = path.join(REPO_ROOT, '.claude-plugin', 'marketplace.json');
  const mp = JSON.parse(await fs.readFile(mpPath, 'utf8'));
  mp.plugins = mp.plugins || [];
  if (mp.plugins.some((p) => p.name === name)) return false;
  mp.plugins.push({ name, source: `./${toolPath}`, description: `Plugin ${name}` });
  mp.plugins.sort((a, b) => a.name.localeCompare(b.name));
  await fs.writeFile(mpPath, JSON.stringify(mp, null, 2) + '\n');
  return true;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const { targets, version, caps } = validateInputs(o);
  const rule = TYPE_RULES[o.type];
  const host = targets.length === 1 ? targets[0] : 'portable';
  const toolPath = `tools/${host}/${rule.dir}/${o.name}`;
  const destAbs = path.join(REPO_ROOT, toolPath);

  if (await pathExists(destAbs)) {
    if (!o.force) fail(`${toolPath} already exists (use --force to overwrite)`);
    await fs.rm(destAbs, { recursive: true, force: true });
  }

  const meta = {
    name: o.name, type: o.type, targets, version,
    license: o.license || 'MIT',
    summary: o.summary || `${o.type} ${o.name}.`,
    capabilities: caps,
    permissions: [], sideEffects: [],
    specSource: o.spec || rule.spec,
    specReviewedOn: o.reviewed || '',
  };
  if (!meta.specReviewedOn) fail('missing --reviewed <ISO date the official spec was reviewed> (honesty: compliance date is required)');

  const files = {
    'package.json': JSON.stringify({ name: `@ai-dev-tools/${o.name}`, version, private: true, type: 'module', license: meta.license, description: meta.summary }, null, 2) + '\n',
    'project.json': lifecycleProjectJson({ name: o.name, type: o.type, targets, toolPath }),
    'manifest/tool.json': toolJson(meta),
    'README.md': readme(meta),
    'SECURITY-CHECKLIST.md': securityChecklist(meta),
    'CHANGELOG.md': changelog(meta),
    'tests/smoke.test.mjs': smokeTest(meta),
    'fixtures/.gitkeep': '',
    'install.sh': installSh({ name: o.name, type: o.type, targets }),
    'uninstall.sh': uninstallSh({ name: o.name, type: o.type, targets }),
    'validate.sh': validateSh({ name: o.name, type: o.type, targets }),
    ...nativeFiles(meta),
  };

  // Atomic: build in a temp dir, then move into place. No partial project on failure.
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'create-tool-'));
  try {
    await writeTree(tmp, files);
    for (const s of ['install.sh', 'uninstall.sh', 'validate.sh']) await fs.chmod(path.join(tmp, s), 0o755);
    await fs.mkdir(path.dirname(destAbs), { recursive: true });
    await fs.rename(tmp, destAbs);
  } catch (err) {
    await fs.rm(tmp, { recursive: true, force: true });
    fail(`generation failed (no partial project written): ${err.message}`);
  }

  let registered = false;
  if (o.type === 'plugin') registered = await registerPluginInMarketplace(o.name, toolPath);

  if (!o.quiet) {
    console.log(`✓ created ${o.name} (${o.type}) → ${toolPath}`);
    console.log(`  targets: ${targets.join(', ')} | version: ${version}${registered ? ' | registered in marketplace' : ''}`);
    console.log(`  next: complete manifest/tool.json disclosure + SECURITY-CHECKLIST.md, then \`nx validate ${o.name}\``);
  }
}

async function pathExists(p) { try { await fs.access(p); return true; } catch { return false; } }

main().catch((err) => { console.error('create-tool:', err.message); process.exit(1); });
