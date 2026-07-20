// Per-type file templates for the tool generator. Pure functions: no filesystem access.
// Each returns a map { relativePath: contents }. The generator writes them atomically.

export const TYPE_RULES = {
  skill: { dir: 'skills', hosts: ['claude', 'codex', 'cursor'], multi: true, spec: 'https://code.claude.com/docs/en/skills.md' },
  plugin: { dir: 'plugins', hosts: ['claude'], multi: false, spec: 'https://code.claude.com/docs/en/plugins-reference.md' },
  hook: { dir: 'hooks', hosts: ['claude'], multi: false, spec: 'https://code.claude.com/docs/en/hooks.md' },
  agent: { dir: 'agents', hosts: ['claude'], multi: false, spec: 'https://code.claude.com/docs/en/sub-agents.md' },
  rule: { dir: 'rules', hosts: ['cursor'], multi: false, spec: 'https://cursor.com/docs/context/rules' },
  prompt: { dir: 'prompts', hosts: ['codex', 'cursor'], multi: true, spec: 'https://agents.md' },
  mcp: { dir: 'mcp', hosts: ['claude', 'cursor', 'codex'], multi: true, spec: 'https://modelcontextprotocol.io' },
};

const CAP_KEYS = [
  'filesystemRead', 'filesystemWrite', 'shell', 'network', 'git',
  'externalApis', 'mcp', 'credentials', 'telemetry', 'remoteContent',
];

export function toolJson(o) {
  const capabilities = {};
  for (const k of CAP_KEYS) capabilities[k] = o.capabilities?.[k] === true;
  return JSON.stringify({
    name: o.name,
    type: o.type,
    targets: o.targets,
    version: o.version,
    license: o.license,
    summary: o.summary,
    capabilities,
    permissions: o.permissions ?? [],
    sideEffects: o.sideEffects ?? [],
    specSource: o.specSource,
    specReviewedOn: o.specReviewedOn,
  }, null, 2) + '\n';
}

export function readme(o) {
  return `# ${o.name}

${o.summary}

- **Type:** ${o.type}
- **Targets:** ${o.targets.join(', ')}
- **Version:** ${o.version}

## Install

\`\`\`bash
bash install.sh --host ${o.targets[0]}
\`\`\`

## Ethics & Security

This tool follows the repository engineering, ethics & security policy (see \`docs/POLICY.md\`
in the source repository).

- Declared capabilities are listed in \`manifest/tool.json\`.
- Side effects: ${(o.sideEffects && o.sideEffects.length) ? o.sideEffects.join(', ') : 'none declared'}.
- It requests the minimum permissions needed and writes only to its declared install target.
- Verification limitations, if any, are documented above.

Do not add capabilities without declaring them here and in \`manifest/tool.json\`.
`;
}

export function securityChecklist(o) {
  return `# Security & Ethics attestation — ${o.name}

Check every box only after it is genuinely true. \`policy-check\` fails while any box is
unchecked. This is a conscious attestation, not a formality.

- [ ] All capabilities in \`manifest/tool.json\` are accurate and minimal.
- [ ] No secrets, credentials, tokens, or \`.env\` values are committed.
- [ ] No install-time remote code execution (no \`curl | bash\`).
- [ ] Install writes only to the declared, scoped target; uninstall removes only owned files.
- [ ] Side effects and destructive operations are disclosed in the README.
- [ ] Privacy: only necessary data is read/transmitted; nothing sensitive is logged.
- [ ] Every declared target host has passing validation + a fixture.
- [ ] The official spec (${o.specSource}) was reviewed on ${o.specReviewedOn}.
`;
}

export function smokeTest(o) {
  return `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

test('${o.name}: manifest is present and consistent', async () => {
  const tool = JSON.parse(await fs.readFile(path.join(root, 'manifest', 'tool.json'), 'utf8'));
  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  assert.equal(tool.name, '${o.name}');
  assert.equal(tool.version, pkg.version, 'tool.json version must match package.json');
  assert.ok(Array.isArray(tool.targets) && tool.targets.length > 0);
});
`;
}

export function changelog(o) {
  return `# Changelog — ${o.name}

This file is maintained by \`nx release\`. Do not edit by hand.
`;
}

// ---- Native, type-specific files -------------------------------------------
export function nativeFiles(o) {
  switch (o.type) {
    case 'skill':
      return { 'SKILL.md': skillMd(o) };
    case 'plugin':
      return {
        '.claude-plugin/plugin.json': JSON.stringify({ name: o.name, description: o.summary, version: o.version }, null, 2) + '\n',
        [`skills/${o.name}/SKILL.md`]: skillMd(o),
      };
    case 'hook':
      return {
        'hooks/hooks.json': JSON.stringify({
          description: o.summary,
          hooks: { PreToolUse: [{ matcher: 'Write|Edit', hooks: [{ type: 'command', command: 'bash "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/check.sh"', timeout: 10 }] }] },
        }, null, 2) + '\n',
        'hooks/scripts/check.sh': '#!/usr/bin/env bash\n# Starter hook. Read event JSON from stdin; exit 0 to allow.\nset -euo pipefail\ncat >/dev/null\nexit 0\n',
      };
    case 'agent':
      return { [`agents/${o.name}.md`]: `---\ndescription: ${o.summary}\n---\n\nYou are the ${o.name} agent. Describe the agent's role and expertise here.\n` };
    case 'rule':
      return { [`${o.name}.mdc`]: `---\ndescription: ${o.summary}\nglobs:\nalwaysApply: false\n---\n\n# ${o.name}\n\nRule guidance goes here. Reference files with @path/to/file when helpful.\n` };
    case 'prompt':
      return { 'AGENTS.md': `# ${o.name}\n\n${o.summary}\n\n## Guidance\n\nWrite agent-facing instructions here (build/test commands, conventions, guardrails).\n` };
    case 'mcp':
      return {
        'server.json': JSON.stringify({ name: o.name, description: o.summary, transport: 'stdio', command: 'node', args: ['bin/server.mjs'], env: {} }, null, 2) + '\n',
        'bin/server.mjs': '#!/usr/bin/env node\n// Starter MCP server (stdio). Implement the MCP protocol here.\nprocess.stdin.resume();\n',
      };
    default:
      return {};
  }
}

function skillMd(o) {
  return `---
name: ${o.name}
description: ${o.summary}
version: ${o.version}
---

# ${o.name}

Describe when Claude should use this skill and what it does.
`;
}
