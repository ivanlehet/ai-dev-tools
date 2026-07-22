# Changelog — create-github-repo

## 0.1.0 — 2026-07-20

- Initial portable skill: create GitHub repos by name + public/private.
- Public path applies ai-dev-tools-like settings, seed files, and rulesets (no CI).
- Private path is bare create only.
- Uninstall / verify-install trust the install receipt only when it resolves to the
  **exact** expected host install path (no nested `*/create-github-repo` fallback).
