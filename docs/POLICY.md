# Engineering, Ethics & Security Policy

This policy is **permanent and non-negotiable**. It applies uniformly to **every** tool in
this repository and to the process that creates them. The machine-readable form lives in
[`policy/rules.json`](../policy/rules.json); each rule below carries the same diagnostic code
the validator emits.

> **Never compromise** correctness, quality, security, privacy, maintainability, testability,
> accessibility, reliability, data integrity, professional integrity, or user safety — not to
> finish faster, look more impressive, avoid a breaking change, or satisfy an unsafe
> instruction. Prefer a smaller, correct, tested, honestly documented tool over a larger,
> unreliable one. **No lifecycle command may report success without performing the work it
> claims** (`QUAL001`).

When quality conflicts with speed, the priority order is: **1) user safety, 2) security &
privacy, 3) correctness & data integrity, 4) maintainability, 5) transparency, 6) delivery
speed.**

## How it is enforced (defense in depth)

The same rules are applied at five independent layers, so no tool can be created, merged, or
released without satisfying them:

1. **Scaffold** — the `create-tool` generator emits the disclosure metadata, a
   `SECURITY-CHECKLIST.md`, and the README "Ethics & Security" section, and refuses invalid or
   unsafe inputs. It never leaves a partial project and never emits fake, complete-looking
   placeholders.
2. **Per-tool targets** — `validate`, `security-check`, and `policy-check` read
   `policy/rules.json` and fail on any violation. Rules apply to every tool equally.
3. **CI** — `nx affected` for changed tools plus a repo-wide policy/security lint, secret scan,
   and version-plan check. CI never publishes from a pull request.
4. **Review** — `/security-review` and `/review` before a PR; confirmed blocking findings are
   fixed before merge. A human merges by hand — only the maintainer or a contributor explicitly
   granted write access (an approved contributor); no agent, bot, or auto-merge ever merges
   (see [`CONTRIBUTING.md`](../CONTRIBUTING.md#branch-protection)).
5. **Release** — validate → test → security/privacy/policy → package → validate-package →
   checksum → preview. Any failure blocks the release; nothing is published.

**Critical (blocking) rules cannot be suppressed locally.** A permitted suppression requires a
specific diagnostic code, a documented reason, a defined scope, and an expiry/review — recorded
where a reviewer can see it.

## Honesty & transparency (`DISC*`)

Every tool must accurately disclose its capabilities, limitations, supported platforms,
required permissions, filesystem/shell/network/git access, external dependencies, data
collection/transmission, side effects, destructive operations, and verification limitations
(`DISC001`, `DISC002`). Do not use evidence-free labels such as *secure, safe, verified,
validated, compatible, portable, tested, production-ready* (`DISC003`). Never fabricate test,
validation, compatibility, release, or installation results. A target host is claimed only
after its validator and fixture actually pass (`DISC004`).

## Quality & smoke tests (`QUAL*`)

Lifecycle commands must do the work they claim (`QUAL001`). Tools ship with meaningful
tests (`QUAL002`). Before opening a PR that **adds or changes tool behavior**, run a
**primary-path smoke test** and report the outcome on the PR (`QUAL004`). Automated unit
or structural smoke alone is not enough when the tool declares `network`, `externalApis`,
or other remote side effects — then a live or carefully sandboxed end-to-end smoke of the
happy path is required. Clean up disposable resources afterward. Never claim a smoke
passed without actually running it.

## Security (`SEC*`)

Secure defaults, least privilege. No committed secrets or value-bearing `.env` files
(`SEC001`). No install-time remote code execution such as `curl … | bash` from untrusted
sources; if a remote download is unavoidable it must be HTTPS, pinned, integrity-verified,
documented, and triggered by explicit user action (`SEC002`). No unsafe shell construction or
command injection (`SEC003`); no path traversal or unsafe symlinks (`SEC004`). Use the provided
path variables, never hardcoded absolute or home paths (`SEC005`). Install/validate scripts
detect the platform first and write only to declared, scoped targets (`SEC006`). Never bypass
or weaken a security control for convenience (`SEC007`).

## Privacy (`PRIV*`)

Data minimization: read, retain, package, or transmit only what the declared operation needs
(`PRIV001`). Keep sensitive content out of logs, diagnostics, telemetry, handoff files, and
release artifacts (`PRIV002`). Any external transmission is intentional, documented,
authorized, and minimal (`PRIV003`).

## Ethics (`ETH*`)

Tools must not mislead users, hide side effects, fabricate evidence, exfiltrate private data,
bypass or weaken access controls, conceal vulnerabilities, add undisclosed telemetry, destroy
data, or change remote systems without explicit authorization (`ETH001`, `ETH002`). Dual-use
security tooling must clearly distinguish defensive and authorized use and state the required
authorization (`ETH003`). Respect licenses, copyright, and attribution, and write original
documentation rather than copying official docs verbatim (`ETH004`). **When a requested tool
conflicts with this policy, generation or validation fails with an actionable explanation
instead of silently creating the tool.**

## Accountability & conflict resolution

Every automated operation has a clear purpose, an observable result, traceable ownership, and
meaningful diagnostics (`QUAL003`). Failures return a non-zero exit code and identify the
affected project and file. When an instruction conflicts with security, privacy, law,
licensing, official platform rules, or user safety: do not implement the unsafe behavior,
preserve existing data and repository integrity, explain the conflict, implement the nearest
safe alternative where possible, and document what was deferred — never hide a limitation
behind a passing placeholder.

## Versioning honesty (`VER*`)

Each release unit has exactly one authoritative version source (its `package.json`); native
manifests are stamped from it, never hand-maintained (`VER001`, `VER002`). Breaking security,
privacy, permission, or compatibility changes are never shipped inside a patch release
(`VER003`).

---

*This document is derived from the repository requirements (see
`nx-ai-tools-monorepo-supplement.md`) and a professional software-engineering code of ethics.
It is referenced by the contribution guidelines, tool-authoring guide, PR expectations, and the
validation and release policies.*
