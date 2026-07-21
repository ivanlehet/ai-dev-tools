# Security & Ethics attestation — create-github-repo

Check every box only after it is genuinely true. `policy-check` fails while any box is
unchecked. This is a conscious attestation, not a formality.

- [x] All capabilities in `manifest/tool.json` are accurate and minimal.
- [x] No secrets, credentials, tokens, or `.env` values are committed.
- [x] No install-time remote code execution (no `curl | bash`).
- [x] Install writes only to the declared, scoped target; uninstall removes only owned files.
- [x] Side effects and destructive operations are disclosed in the README.
- [x] Privacy: only necessary data is read/transmitted; nothing sensitive is logged.
- [x] Every declared target host has passing validation + a fixture.
- [x] Primary-path smoke test was run for behavior under change (`QUAL004`); live/sandboxed
      E2E when remote side effects are declared; disposable resources cleaned up.
      > Live E2E (2026-07-21): private bare create + public seed/settings/rulesets against
      > throwaway repos `smoketest-cgr-priv-*` / `smoketest-cgr-pub-*`. Structural unit smoke
      > also passes. Automated `gh repo delete` failed (token lacked `delete_repo`); leftovers
      > must be removed manually or after `gh auth refresh -s delete_repo`.
- [x] The official spec (https://code.claude.com/docs/en/skills.md) was reviewed on 2026-07-20.
