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
- [ ] Primary-path smoke test was run for behavior under change (`QUAL004`); live/sandboxed
      E2E when remote side effects are declared; disposable resources cleaned up.
      > Not yet honestly attestable: structural unit smoke (`tests/smoke.test.mjs`) exists and
      > passes, but this tool declares `network` + `externalApis` (it drives `gh api` against
      > GitHub), so QUAL004 requires a live/sandboxed end-to-end smoke of the happy path
      > (create a throwaway repo, apply defaults, then delete it) before this box may be checked.
      > That live E2E has not been run, so this stays unchecked.
- [x] The official spec (https://code.claude.com/docs/en/skills.md) was reviewed on 2026-07-20.
