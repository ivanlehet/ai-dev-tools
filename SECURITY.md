# Security Policy

## Reporting a vulnerability

**Do not open a public issue or pull request for a security vulnerability**, and never
include secrets, tokens, or `.env` values in a report.

Report privately through GitHub's
[private vulnerability reporting](https://github.com/ivanlehet/ai-dev-tools/security/advisories/new)
("Report a vulnerability" under the repository's **Security** tab). This creates a private
advisory visible only to the maintainer.

Please include:

- The affected tool(s) or infrastructure and version (`<tool>@x.y.z` where applicable).
- Reproduction steps or a proof of concept.
- Impact assessment (what an attacker could do).

You can expect an initial acknowledgement within a few days. Coordinated disclosure is
preferred: please give the maintainer a reasonable window to ship a fix before any public
disclosure.

## Scope

This repository hosts and independently versions AI dev tools for Claude Code, Cursor, and
OpenAI Codex. In-scope concerns include, but are not limited to:

- Secrets or credentials committed to the repository or emitted by any lifecycle command.
- Install-time remote code execution (for example `curl | bash`) or any undeclared
  capability in a tool's `manifest/tool.json`.
- A tool writing outside its declared, scoped install target, or an uninstall removing files
  it does not own.
- Supply-chain risks in CI (unpinned actions, excessive workflow permissions, secret exposure
  to fork pull requests).

See [`docs/POLICY.md`](docs/POLICY.md) for the enforced engineering, ethics, and security
policy, and [`CONTRIBUTING.md`](CONTRIBUTING.md) for the contribution workflow.

## Supported versions

Each tool is an independent release unit. Security fixes are shipped against the latest
released version of the affected tool. There is no long-term support for older tool versions.
