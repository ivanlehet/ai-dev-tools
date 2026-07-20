# create-github-repo

Create a GitHub repository from a **name** and **visibility**.

- **Type:** skill
- **Targets:** claude, cursor, codex
- **Version:** 0.1.0

## Behavior

| Visibility | What happens |
|------------|----------------|
| `private` | Bare `gh repo create --private` only |
| `public` | Create with default branch `master`, apply squash-only / no auto-merge settings, Actions read defaults, vulnerability alerts + private reporting, seed `SECURITY.md` + PR template + CODEOWNERS, add `protect-master` and `protect-release-tags` rulesets (**without** required CI checks) |

CI/CodeQL workflows from ai-dev-tools are **not** copied.

## Install

```bash
bash install.sh --host claude   # or cursor / codex
```

## Ethics & Security

This tool follows the repository engineering, ethics & security policy (see `docs/POLICY.md`
in the source repository).

- Declared capabilities are listed in `manifest/tool.json`.
- Side effects: creates GitHub repositories; for public repos also mutates settings/rulesets and pushes a seed commit. Does not merge PRs, force-push, or enable auto-merge.
- Requires an already-authenticated `gh` CLI; does not store tokens.
- Verification limitations: live GitHub API calls are not exercised in unit smoke tests (structural checks only).

Do not add capabilities without declaring them here and in `manifest/tool.json`.
