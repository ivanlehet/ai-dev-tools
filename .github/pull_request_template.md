## What & why

<!-- What does this change do, and why? Which tool(s) or infra does it touch? -->

## Checklist

- [ ] `npm run verify` is green (validate + test + security + policy on affected tools).
- [ ] `npm run secret-scan` is clean.
- [ ] For a new/changed tool: `manifest/tool.json` disclosure is accurate and minimal, and
      `SECURITY-CHECKLIST.md` is fully and honestly attested.
- [ ] A **Version Plan** is included for any releasable change (`npm run create-version-plan`),
      or the change is genuinely release-neutral.
- [ ] Every claimed target host has passing validation + a fixture (no unverified compatibility).
- [ ] No secrets, no `.env` values, no install-time remote code execution.
- [ ] Breaking security/privacy/permission/compat changes use a minor/major bump and are documented.

## Review evidence

<!-- Per the repo policy, paste the /security-review and /review findings by severity,
     what was fixed (with commit), and anything deliberately deferred and why. -->

> By opening this PR you attest that no lifecycle command reports success without doing the
> work it claims, and that incomplete work is left visibly incomplete (see docs/POLICY.md).
