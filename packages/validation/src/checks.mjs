// Automated checks. Each function takes a tool context and returns findings.
// A finding: { code, file, message }. Severity/blocking come from policy/rules.json.
import path from 'node:path';
import {
  exists, readText, readJsonSafe, parseFrontmatter, isKebabCase,
  SECRET_PATTERNS, isTextFile,
} from './util.mjs';

const VALID_TYPES = new Set(['skill', 'plugin', 'hook', 'agent', 'rule', 'prompt', 'mcp']);
const VALID_HOSTS = new Set(['claude', 'cursor', 'codex']);
const CAPABILITY_KEYS = [
  'filesystemRead', 'filesystemWrite', 'shell', 'network', 'git',
  'externalApis', 'mcp', 'credentials', 'telemetry', 'remoteContent',
];

// ---- structure --------------------------------------------------------------
export async function structureChecks(ctx) {
  const f = [];
  const tj = ctx.toolJson;
  if (!tj) {
    f.push({ code: 'STRUCT001', file: 'manifest/tool.json', message: 'missing or invalid manifest/tool.json' });
    return f; // most other checks depend on it
  }
  for (const key of ['name', 'type', 'targets', 'version', 'license']) {
    if (tj[key] === undefined) f.push({ code: 'STRUCT001', file: 'manifest/tool.json', message: `missing required field "${key}"` });
  }
  if (tj.name && !isKebabCase(tj.name)) f.push({ code: 'STRUCT002', file: 'manifest/tool.json', message: `name "${tj.name}" is not kebab-case` });
  if (tj.type && !VALID_TYPES.has(tj.type)) f.push({ code: 'STRUCT001', file: 'manifest/tool.json', message: `unknown type "${tj.type}"` });
  if (tj.targets && (!Array.isArray(tj.targets) || tj.targets.length === 0)) f.push({ code: 'STRUCT001', file: 'manifest/tool.json', message: 'targets must be a non-empty array' });
  if (Array.isArray(tj.targets)) {
    for (const t of tj.targets) if (!VALID_HOSTS.has(t)) f.push({ code: 'STRUCT001', file: 'manifest/tool.json', message: `unknown target host "${t}"` });
  }

  // STRUCT006 — placement matches targets
  if (Array.isArray(tj.targets) && tj.targets.length) {
    const expectedHost = tj.targets.length === 1 ? tj.targets[0] : 'portable';
    if (ctx.hostSegment && ctx.hostSegment !== expectedHost) {
      f.push({ code: 'STRUCT006', file: '.', message: `tool is under tools/${ctx.hostSegment}/ but targets ${JSON.stringify(tj.targets)} imply tools/${expectedHost}/` });
    }
  }

  // Type-specific manifest presence
  if (tj.type === 'plugin') {
    const pj = path.join(ctx.root, '.claude-plugin', 'plugin.json');
    if (!(await exists(pj))) f.push({ code: 'STRUCT003', file: '.claude-plugin/plugin.json', message: 'Claude plugin missing .claude-plugin/plugin.json' });
    else {
      const r = await readJsonSafe(pj);
      if (!r.ok) f.push({ code: 'STRUCT003', file: '.claude-plugin/plugin.json', message: `invalid JSON: ${r.error}` });
      else if (!r.value.name || !isKebabCase(r.value.name)) f.push({ code: 'STRUCT003', file: '.claude-plugin/plugin.json', message: 'plugin.json name missing or not kebab-case' });
    }
    // components must not live inside .claude-plugin/ (only plugin.json there)
    for (const rel of ctx.files) {
      if (rel.startsWith('.claude-plugin' + path.sep) && path.basename(rel) !== 'plugin.json') {
        f.push({ code: 'STRUCT003', file: rel, message: 'only plugin.json may live in .claude-plugin/' });
      }
    }
  }
  if (tj.type === 'skill') {
    const skills = await findSkillFiles(ctx);
    if (skills.length === 0) f.push({ code: 'STRUCT004', file: 'SKILL.md', message: 'skill has no SKILL.md' });
    for (const s of skills) {
      const { data, hasFrontmatter } = parseFrontmatter(await readText(path.join(ctx.root, s)));
      if (!hasFrontmatter || !data.description) f.push({ code: 'STRUCT004', file: s, message: 'SKILL.md needs frontmatter with a description' });
    }
  }
  if (tj.type === 'rule') {
    const mdc = ctx.files.filter((r) => r.endsWith('.mdc'));
    if (mdc.length === 0) f.push({ code: 'STRUCT005', file: '*.mdc', message: 'Cursor rule has no .mdc file' });
    for (const r of mdc) {
      const { hasFrontmatter } = parseFrontmatter(await readText(path.join(ctx.root, r)));
      if (!hasFrontmatter) f.push({ code: 'STRUCT005', file: r, message: '.mdc rule needs frontmatter (description/globs/alwaysApply)' });
    }
  }

  // STRUCT008 — plugin self-containment: no ../ escape in runtime references.
  // Scanned in code/config only; markdown prose links are not runtime references.
  if (tj.type === 'plugin') {
    const repoOnly = (rel) => /^(project\.json|package\.json)$/.test(rel) || /^(tests|fixtures)[\\/]/.test(rel);
    for (const rel of ctx.files) {
      if (!isTextFile(rel) || /\.(md|mdc)$/.test(rel) || repoOnly(rel)) continue;
      const txt = await readText(path.join(ctx.root, rel));
      if (/(^|[\s"'(=])\.\.\/[A-Za-z0-9_.-]/.test(txt) && /\.\.\/(shared|packages|tools|\.\.)/.test(txt)) {
        f.push({ code: 'STRUCT008', file: rel, message: 'reference escapes the plugin root (../) — plugins must be self-contained' });
      }
    }
  }

  return f;
}

async function findSkillFiles(ctx) {
  const out = [];
  if (await exists(path.join(ctx.root, 'SKILL.md'))) out.push('SKILL.md');
  const skillsDir = path.join(ctx.root, 'skills');
  if (await exists(skillsDir)) {
    for (const rel of ctx.files) if (/^skills[\\/][^\\/]+[\\/]SKILL\.md$/.test(rel)) out.push(rel);
  }
  return out;
}

// ---- version ----------------------------------------------------------------
export async function versionChecks(ctx) {
  const f = [];
  const pkgV = ctx.pkg?.version;
  const semver = /^\d+\.\d+\.\d+([-+].*)?$/;
  if (!pkgV || !semver.test(pkgV)) f.push({ code: 'VER002', file: 'package.json', message: `version "${pkgV}" is not valid SemVer` });
  // Native manifests must not diverge from package.json (single source of truth).
  const pj = path.join(ctx.root, '.claude-plugin', 'plugin.json');
  if (await exists(pj)) {
    const r = await readJsonSafe(pj);
    if (r.ok && r.value.version !== undefined && r.value.version !== pkgV) {
      f.push({ code: 'VER001', file: '.claude-plugin/plugin.json', message: `version ${r.value.version} diverges from package.json ${pkgV} (stamp from single source, do not hand-edit)` });
    }
  }
  if (ctx.toolJson && ctx.toolJson.version !== undefined && ctx.toolJson.version !== pkgV) {
    f.push({ code: 'VER002', file: 'manifest/tool.json', message: `version ${ctx.toolJson.version} != package.json ${pkgV}` });
  }
  return f;
}

// ---- disclosure -------------------------------------------------------------
export async function disclosureChecks(ctx) {
  const f = [];
  const tj = ctx.toolJson || {};
  const caps = tj.capabilities;
  if (!caps || typeof caps !== 'object') {
    f.push({ code: 'DISC001', file: 'manifest/tool.json', message: 'missing capabilities disclosure block' });
  } else {
    for (const k of CAPABILITY_KEYS) if (typeof caps[k] !== 'boolean') f.push({ code: 'DISC001', file: 'manifest/tool.json', message: `capabilities.${k} must be declared (true/false)` });
  }
  const readme = path.join(ctx.root, 'README.md');
  if (!(await exists(readme))) {
    f.push({ code: 'DISC002', file: 'README.md', message: 'missing README.md' });
  } else {
    const txt = (await readText(readme)).toLowerCase();
    if (!txt.includes('ethics') && !txt.includes('security')) f.push({ code: 'DISC002', file: 'README.md', message: 'README must include an "Ethics & Security" section' });
    // DISC003 — high-precision evidence-free superlatives
    const raw = await readText(readme);
    const banned = /\b(production[- ]ready|fully (?:tested|secure|verified)|100%\s*(?:secure|tested)|guaranteed[- ]secure|completely safe)\b/i;
    const m = banned.exec(raw);
    if (m) f.push({ code: 'DISC003', file: 'README.md', message: `evidence-free claim "${m[0]}" — remove or substantiate` });
  }
  return f;
}

// ---- security ---------------------------------------------------------------
export async function securityChecks(ctx) {
  const f = [];
  const isCodeFile = (rel) => /\.(sh|bash|zsh|mjs|cjs|js|ts|py)$/.test(rel);
  const isMeta = (rel) => /(^|[\\/])(SECURITY-CHECKLIST|CHANGELOG)\.md$/.test(rel);
  for (const rel of ctx.files) {
    if (!isTextFile(rel)) continue;
    const abs = path.join(ctx.root, rel);
    const txt = await readText(abs);

    // SEC001 — secrets. .env.example is allowed to have empty placeholders only.
    const isEnvExample = /(^|[\\/])\.env\.example$/.test(rel);
    for (const { id, re } of SECRET_PATTERNS) {
      const m = re.exec(txt);
      if (m) {
        if (isEnvExample && /=\s*$/.test(m[0])) continue;
        f.push({ code: 'SEC001', file: rel, message: `possible secret (${id})` });
        break;
      }
    }
    if (/(^|[\\/])\.env$/.test(rel) && /\S=\S/.test(txt)) f.push({ code: 'SEC001', file: rel, message: '.env with values must not be committed' });

    // SEC002/SEC003 — RCE and eval are code constructs; scan executable/script files only
    // (documentation/meta files may legitimately *describe* these patterns as prohibitions).
    if (isCodeFile(rel)) {
      if (/\bcurl\b[^\n|]*\|\s*(?:sudo\s+)?(?:ba)?sh\b/.test(txt) || /\bwget\b[^\n|]*\|\s*(?:sudo\s+)?(?:ba)?sh\b/.test(txt)) {
        f.push({ code: 'SEC002', file: rel, message: 'install-time remote code execution (curl|bash)' });
      }
      if (/\.(sh|bash|zsh)$/.test(rel) && /\beval\s+["'$]/.test(txt)) f.push({ code: 'SEC003', file: rel, message: 'unsafe shell eval' });
      if (/\.(mjs|cjs|js|ts)$/.test(rel) && /\beval\s*\(/.test(txt)) f.push({ code: 'SEC003', file: rel, message: 'unsafe eval()' });
    }

    // SEC005 — hardcoded absolute / home paths (env vars are fine); skip meta docs.
    if (!isMeta(rel) && (/(^|[\s"'(=:])\/(?:Users|home)\/[A-Za-z0-9._-]+/.test(txt) || /\b[A-Za-z]:\\Users\\/.test(txt))) {
      f.push({ code: 'SEC005', file: rel, message: 'hardcoded absolute/home path — use ${CLAUDE_PLUGIN_ROOT}/host variables' });
    }
  }

  // SEC006 — install/validate/uninstall scripts must detect platform
  for (const script of ['install.sh', 'validate.sh', 'uninstall.sh']) {
    const p = path.join(ctx.root, script);
    if (await exists(p)) {
      const txt = await readText(p);
      if (!/detect-platform\.sh|detect_platform/.test(txt)) {
        f.push({ code: 'SEC006', file: script, message: 'script must source scripts/lib/detect-platform.sh and detect the platform first' });
      }
    }
  }
  return f;
}

// ---- privacy ----------------------------------------------------------------
export async function privacyChecks(ctx) {
  const f = [];
  // PRIV002 — obvious sensitive content echoed to logs in scripts
  for (const rel of ctx.files) {
    if (!/\.(sh|bash|zsh|mjs|cjs|js|ts|py)$/.test(rel)) continue;
    const txt = await readText(path.join(ctx.root, rel));
    if (/(echo|console\.log|print)\s*.{0,40}\$?\{?(?:[A-Z_]*(?:SECRET|TOKEN|PASSWORD|API_KEY)[A-Z_]*)\}?/i.test(txt)) {
      f.push({ code: 'PRIV002', file: rel, message: 'possible logging of a secret/token value' });
    }
  }
  return f;
}

// ---- compliance -------------------------------------------------------------
export async function complianceChecks(ctx) {
  const f = [];
  const tj = ctx.toolJson || {};
  if (!tj.specSource) f.push({ code: 'COMP001', file: 'manifest/tool.json', message: 'missing specSource (official spec used for validation)' });
  if (!tj.specReviewedOn) f.push({ code: 'COMP001', file: 'manifest/tool.json', message: 'missing specReviewedOn (documentation review date)' });
  return f;
}

// ---- quality ----------------------------------------------------------------
export async function qualityChecks(ctx) {
  const f = [];
  // QUAL001 — no placeholder lifecycle targets that fake success
  const pj = await readJsonSafe(path.join(ctx.root, 'project.json'));
  if (pj.ok && pj.value.targets) {
    for (const [name, target] of Object.entries(pj.value.targets)) {
      const cmds = collectCommands(target);
      for (const c of cmds) {
        if (/^\s*(true|:|exit\s+0)\s*$/.test(c) || /^\s*echo\b[^&|]*$/.test(c) && !/\|\||&&|node|bash|sh\b/.test(c) && name !== 'echo') {
          if (/^\s*(true|:|exit\s+0)\s*$/.test(c)) f.push({ code: 'QUAL001', file: 'project.json', message: `target "${name}" is a no-op placeholder ("${c.trim()}")` });
        }
      }
    }
  }
  // QUAL002 — meaningful tests exist
  const hasTests = ctx.files.some((r) => /(^|[\\/])tests[\\/]/.test(r) || /\.(test|spec)\./.test(r));
  if (!hasTests) f.push({ code: 'QUAL002', file: 'tests/', message: 'no tests found for this tool' });
  return f;
}

function collectCommands(target) {
  const out = [];
  const o = target.options || {};
  if (typeof o.command === 'string') out.push(o.command);
  if (Array.isArray(o.commands)) for (const c of o.commands) out.push(typeof c === 'string' ? c : c.command || '');
  return out;
}
