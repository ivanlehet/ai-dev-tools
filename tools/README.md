# tools/

Each subdirectory holds independently-versioned **release units**, grouped first by
**target platform** and then by **type**.

```
tools/
  portable/   # works on 2+ AI hosts — one canonical source + per-host install adapters
    skills/ · mcp/ · prompts/
  claude/     # Claude Code only
    plugins/ · skills/ · hooks/ · agents/
  cursor/     # Cursor only
    rules/
  codex/      # OpenAI Codex only
    prompts/ · config/
```

## Where does a new tool go?

The `create-tool` generator applies this rule automatically from the tool's declared
target hosts:

- **exactly one** target host → `tools/<host>/<type>/<name>/`
- **two or more** target hosts → `tools/portable/<type>/<name>/`

Platform is expressed by the `targets` field in each tool's `manifest/tool.json`, not by
duplicating the tool per platform. Multi-host tools keep a single canonical source and ship
thin per-host adapters (install location + registration format).

See [`../docs/creating-a-tool.md`](../docs/creating-a-tool.md).
