# ai-dev-tools

An Nx monorepo that hosts and **independently versions** AI development tools for
**Claude Code, Cursor, OpenAI Codex**, and cross-platform **Agent Skills**.

Each tool is an independent release unit: separately versioned, validated, tested,
packaged, installed, and released. A change to one tool never forces a release of any
other, and a broken tool never breaks the others or the CI pipeline (`nx affected`).

## Repository layout

Tools are grouped **by target platform** plus a `portable/` bucket for cross-tool tools;
inside each, **by type**.

```
tools/
  portable/   # works on 2+ hosts (skills, mcp, prompts/AGENTS.md) — one canonical source + per-host adapters
  claude/     # Claude Code only (plugins, skills, hooks, agents)
  cursor/     # Cursor only (rules/*.mdc)
  codex/      # OpenAI Codex only (prompts/AGENTS.md, config)
packages/     # shared, non-user-facing infra (validation, cli, schemas)
```

**Placement rule** (the generator applies it automatically):
one target host → `tools/<host>/<type>/<name>/`; two or more → `tools/portable/<type>/<name>/`.

## Creating a tool

```bash
npm run create-tool
```

See [`docs/creating-a-tool.md`](docs/creating-a-tool.md).

## Quality, ethics & security — non-negotiable

Every tool must pass the same enforced gates (validate / security-check / policy-check),
at scaffold time, per-tool, in CI, at review, and at release. No tool may weaken a
repository-wide standard, and no lifecycle command may report success without doing the
work it claims. See [`docs/POLICY.md`](docs/POLICY.md).

## Common commands

| Command | Purpose |
|---|---|
| `npm run verify` | validate + test + security + policy across all tools |
| `npm run affected` | run all gates on changed tools only |
| `npm run create-tool` | scaffold a new tool |
| `npm run create-version-plan` | record a version bump intent (Nx Version Plan) |
| `npm run release:dry-run` | preview versions, tags, changelogs (no publish) |

## License

[MIT](LICENSE) © Ivan Lehet
