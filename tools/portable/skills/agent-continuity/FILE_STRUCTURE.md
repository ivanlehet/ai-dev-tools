# Package File Structure

After extraction, the archive must contain exactly one top-level directory named `agent-continuity`.

```text
agent-continuity/
├── .claude-plugin/
│   └── plugin.json
├── hooks/
│   └── hooks.json
├── skills/
│   └── agent-continuity/
│       └── SKILL.md
├── providers/
│   └── openai.yaml
├── references/
│   ├── LIMITATIONS.md
│   └── SCHEMA.md
├── scripts/
│   ├── agent-continuity.mjs
│   └── lib/
│       └── platform.sh
├── templates/
│   ├── AGENTS_APPEND.md
│   ├── CLAUDE_APPEND.md
│   └── cursor-agent-continuity.mdc
├── tests/
│   ├── install.test.mjs
│   └── runtime.test.mjs
├── AGENT_CONTINUITY.md
├── CHANGELOG.md
├── CONTINUE_PROMPT.md
├── FILE_STRUCTURE.md
├── LICENSE
├── README.md
├── SKILL.md
├── USAGE_GUIDE.md
├── install.mjs
├── install.sh
├── uninstall.mjs
├── uninstall.sh
├── package.json
├── validate.mjs
└── validate.sh
```

On macOS Finder and some graphical file managers, `.claude-plugin` is hidden because its name starts with a dot. Verify it with:

```bash
ls -la agent-continuity
```

Validate the complete package from inside the directory:

```bash
cd agent-continuity
./validate.sh
```
