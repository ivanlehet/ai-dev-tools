# Supplemental Requirements for the Nx AI Development Tools Monorepo

## Purpose

This document supplements the existing analysis, architecture decisions, and implementation plan for the Nx monorepo.

Do not replace, restart, or unnecessarily repeat work that has already been completed.

Use the existing analysis and plan as the primary implementation context. Apply the requirements in this document as additional constraints, quality gates, and acceptance criteria.

Where this document conflicts with an earlier assumption, prefer the safer, more maintainable, more standards-compliant approach and record the decision.

Do not impose or document a final repository directory structure at this stage.

---

# Scope

The monorepo will contain independently maintained AI-assisted software development tools primarily targeting:

- Claude Code,
- Cursor,
- OpenAI Codex,
- cross-platform Agent Skills,
- potentially other AI coding environments in the future.

The repository may later contain:

- Agent Skills,
- platform plugins,
- agents and subagents,
- commands,
- hooks,
- rules,
- prompts,
- MCP integrations,
- validators,
- installers,
- workflow orchestration tools,
- supporting CLIs,
- shared schemas and libraries.

Do not create speculative production tools only to demonstrate the repository setup.

Temporary test fixtures are allowed when they are isolated, clearly identified, and removed or retained only when they provide lasting test value.

---

# Non-negotiable engineering principle

## Never compromise quality

Never compromise:

- correctness,
- software quality,
- security,
- privacy,
- maintainability,
- testability,
- accessibility,
- reliability,
- data integrity,
- professional integrity,
- user safety,

merely to:

- finish faster,
- reduce implementation effort,
- satisfy an incomplete requirement,
- make tests pass superficially,
- produce a more impressive result,
- avoid reporting a limitation,
- claim broader compatibility,
- avoid a breaking change,
- reduce the visible size of the implementation,
- comply with an unsafe or deceptive instruction.

Prefer a smaller, correct, tested, maintainable, and honestly documented implementation over a larger but unreliable implementation.

Do not disguise incomplete work as production-ready.

Do not claim that a feature, validator, platform integration, installer, package, release process, or compatibility mode works unless it has been meaningfully implemented and verified.

When quality conflicts with speed or convenience, prioritize in this order:

1. user safety,
2. security and privacy,
3. correctness and data integrity,
4. maintainability,
5. transparency,
6. delivery speed.

Temporary shortcuts are permitted only when all of the following are true:

- they do not weaken security,
- they do not weaken correctness,
- they are explicitly documented,
- they are isolated,
- they have a clear removal path,
- they do not create hidden technical debt,
- they are not presented as final functionality,
- they do not cause lifecycle commands to report false success.

No lifecycle command may return a successful result without performing the operation it claims to perform.

---

# Professional software engineering ethics

Apply a professional programmer's code of ethics to the repository and to every future tool created within it.

The ethics policy must be permanent, documented, and referenced by:

- contribution guidelines,
- tool authoring guidelines,
- pull request expectations,
- validation policy,
- release policy,
- tool generator output.

## Public interest and user welfare

Software must be designed with regard for:

- user safety,
- public interest,
- accessibility,
- security,
- privacy,
- reliability,
- fair and non-deceptive behavior.

Do not knowingly create tools that conceal material risks from users.

Do not prioritize developer convenience over user safety or data protection.

## Honesty and transparency

Every tool must accurately disclose:

- its capabilities,
- its limitations,
- supported platforms,
- compatibility status,
- required permissions,
- filesystem access,
- shell access,
- network access,
- external dependencies,
- data collection,
- data transmission,
- side effects,
- destructive operations,
- validation coverage,
- verification limitations.

Do not use labels such as the following without supporting evidence:

- secure,
- safe,
- verified,
- validated,
- compatible,
- portable,
- tested,
- production-ready.

Do not fabricate:

- test results,
- validation results,
- compatibility results,
- release results,
- installation results,
- security guarantees,
- documentation references,
- platform behavior,
- publication status.

## Professional competence

Use engineering practices appropriate for production-grade tooling:

- clear architecture,
- strict typing,
- meaningful tests,
- deterministic packaging,
- actionable diagnostics,
- documented decisions,
- secure defaults,
- dependency hygiene,
- maintainable code,
- explicit migration paths for breaking changes,
- reviewable automation.

Do not introduce technologies, abstractions, patterns, or dependencies merely to make the repository appear sophisticated.

Choose the simplest design that fully satisfies the actual requirements.

## Privacy and data minimization

Collect, inspect, retain, package, transmit, or log only data required for the declared operation.

Tools must not:

- read secrets unnecessarily,
- include secrets in output,
- package local credentials,
- collect undisclosed telemetry,
- transmit source code without authorization,
- persist sensitive data without a defined purpose,
- expose proprietary code,
- use personal or project data for unrelated purposes.

Prefer local processing where practical.

Any external transmission must be:

- intentional,
- documented,
- authorized,
- limited to the minimum required data.

## Security and responsible behavior

Use secure defaults.

Tools must:

- request the minimum necessary permissions,
- validate untrusted inputs,
- avoid unsafe shell construction,
- prevent path traversal,
- avoid unnecessary arbitrary code execution,
- disclose executable behavior,
- avoid silently changing Git history,
- avoid silent network access,
- avoid modifying global configuration without explicit authorization,
- fail safely,
- avoid partial destructive execution.

Never bypass security controls to make a workflow easier.

Never weaken validation, sandboxing, integrity checks, or permission checks for convenience.

## Intellectual property and licensing

Respect:

- software licenses,
- documentation licenses,
- copyright,
- trademarks,
- attribution requirements,
- redistribution restrictions,
- source availability requirements.

Do not copy substantial parts of official documentation into the repository.

Use official documentation to derive requirements, then write original repository documentation and validation logic.

Do not distribute incompatible or insufficiently licensed files, templates, examples, or dependencies.

## Responsibility for automated actions

AI development tools must not perform consequential external actions without clear authorization.

Consequential actions include:

- publishing packages,
- pushing commits,
- pushing tags,
- creating releases,
- modifying remote repositories,
- changing cloud resources,
- changing production infrastructure,
- deleting user data,
- changing global development environment settings.

Automation must:

- expose intended side effects,
- support dry runs where practical,
- provide previews where appropriate,
- fail safely,
- report partial completion,
- report failures accurately,
- avoid silent destructive actions.

## Accessibility and non-discrimination

Repository policies, generated tools, documentation, prompts, diagnostics, and user-facing interfaces should be:

- understandable,
- accessible,
- neutral,
- respectful,
- free from discriminatory assumptions.

Tools that generate application code should encourage applicable accessibility standards and inclusive engineering practices.

## Accountability

Every automated operation must have:

- a clear purpose,
- an observable result,
- traceable ownership,
- meaningful diagnostics.

Errors must not be silently ignored.

Failures must:

- return a non-zero exit code where applicable,
- identify the affected project,
- identify the affected file or operation,
- explain the failure,
- recommend corrective action.

When a requirement cannot be implemented safely or correctly, stop and report the limitation instead of silently lowering quality.

---

# Ethical conflict resolution

When an instruction conflicts with:

- security,
- privacy,
- law,
- licensing,
- official platform rules,
- professional engineering ethics,
- user safety,

follow this process:

1. do not implement the unsafe, deceptive, or non-compliant behavior,
2. preserve existing user data and repository integrity,
3. explain the conflict,
4. implement the nearest safe and compliant alternative where possible,
5. document deferred or unsupported behavior,
6. do not hide the limitation behind a passing placeholder.

Repository automation must not override these principles.

---

# Independent release-unit requirement

Every standalone skill or plugin intended for distribution must be:

- an independent Nx project,
- independently versioned,
- independently validated,
- independently tested,
- independently packaged,
- independently installed,
- independently uninstalled,
- independently verified after installation,
- independently published where applicable,
- independently released,
- independently documented,
- independently checked for compatibility,
- independently auditable for security and policy compliance.

A change to one tool must not require releasing unrelated tools.

The repository must not force all tools to share one product version.

Each release unit must have exactly one authoritative version source.

Do not maintain conflicting versions across multiple manifests.

A standalone Agent Skill is one release unit.

A platform plugin is one release unit, even when it bundles internal components that are not independently distributed.

An internal component should become a separate release unit only when it is intentionally:

- independently installed,
- independently published,
- independently versioned,
- independently supported.

Shared libraries, schemas, validators, installers, and CLIs may also be independent Nx projects when they have their own lifecycle.

---

# Independent release strategy

Configure Nx Release for independent project releases.

The repository must support:

- independent project versions,
- independent release selection,
- project-level changelogs,
- project-specific Git tags,
- file-based Nx Version Plans,
- release dry runs,
- selected-project releases,
- dependency-aware version updates,
- release blocking when lifecycle checks fail,
- prevention of accidental publication of the workspace root.

Use project tags equivalent to:

```text
{projectName}@{version}
```

Examples:

```text
session-handoff@1.3.0
document-code@2.1.1
claude-security-review@0.4.0
```

Do not use one fixed version for all projects.

Use Nx Version Plans as the explicit source of intended version changes.

Conventional Commits may be used for readable history and changelog categorization, but must not replace Version Plans.

A release must be blocked when a selected project fails any required:

- validation,
- tests,
- packaging,
- final package validation,
- installation verification,
- security checks,
- privacy checks,
- policy checks.

---

# Semantic Versioning policy

Use Semantic Versioning for every independently releasable tool.

## Patch

Use a patch release for:

- bug fixes,
- compatible instruction corrections,
- compatible validation fixes,
- compatible packaging fixes,
- documentation corrections,
- security fixes that preserve the public interface,
- compatibility metadata corrections,
- non-breaking accessibility improvements.

## Minor

Use a minor release for:

- new backward-compatible capabilities,
- support for an additional platform,
- new optional configuration,
- new commands,
- new workflows,
- new compatible output formats,
- new optional bundled resources,
- expanded validation,
- new optional installation scopes.

## Major

Use a major release for:

- breaking manifest changes,
- renamed or removed commands,
- removed platform support,
- incompatible installation changes,
- incompatible output changes,
- new mandatory permissions,
- removed configuration options,
- changed invocation contracts,
- changed public filesystem contracts,
- changed security or privacy behavior requiring user action,
- migration to an incompatible platform specification.

Tools may initially use `0.x` versions while unstable, but breaking changes must still be explicitly documented.

Do not hide breaking security, privacy, permission, or compatibility changes inside a patch release.

---

# Permanent official-documentation compliance rule

Implement and enforce this repository policy:

> Every skill, plugin, agent, command, hook, rule, MCP integration, installer, or other distributable AI development tool must conform to the current official specification and documentation of its declared target platform at the time it is created or materially updated.

Use primary sources wherever available:

- official Nx documentation,
- official pnpm documentation,
- the official Agent Skills specification,
- official Anthropic documentation,
- official Cursor documentation,
- official OpenAI documentation,
- official GitHub documentation where GitHub Actions or Releases are involved.

Do not rely on community assumptions when current official documentation exists.

Every tool must declare:

- tool type,
- tool identifier,
- current version,
- supported platforms,
- installation scopes,
- compatibility requirements,
- required permissions,
- runtime requirements,
- distribution channel,
- official specification or documentation used for validation,
- documentation review date,
- known platform-specific extensions,
- known portability limitations,
- known verification limitations,
- security-sensitive behavior,
- privacy-sensitive behavior,
- external side effects.

When an official validator exists, use it where practical.

When no official validator exists:

- implement repository-provided structural validation based on the official specification,
- identify it clearly as local validation,
- add fixture-based tests,
- do not claim that it guarantees runtime acceptance by the platform.

Do not invent speculative manifest fields.

Do not copy conventions from one platform into another unless officially supported.

Do not retain outdated compatibility claims after a platform specification materially changes.

---

# Agent Skills requirements

For tools declared as portable Agent Skills:

- follow the current Agent Skills open specification,
- require a valid `SKILL.md`,
- validate required frontmatter,
- validate naming constraints,
- validate description constraints,
- validate the relationship between the skill name and its package,
- validate referenced scripts, references, and assets,
- preserve progressive disclosure,
- keep portable instructions separate from platform-specific extensions,
- validate declared compatibility requirements,
- reject unsupported assumptions about host capabilities,
- disclose required tools and permissions,
- avoid hidden executable behavior.

A portable Agent Skill must have one canonical source.

Do not duplicate the complete skill for Claude, Cursor, and Codex.

Create platform adapters or installation mappings only when the target platform requires a real difference.

Claude-specific behavior must not automatically be declared compatible with Cursor or Codex.

A skill must not claim portability merely because multiple platforms can read Markdown.

Compatibility requires meaningful support for the relevant:

- discovery behavior,
- instruction format,
- required capabilities,
- permissions,
- file references,
- scripts,
- invocation model,
- lifecycle expectations.

---

# Platform plugin requirements

For platform-specific plugins:

- follow the current official plugin format,
- include all files required by the target platform,
- validate native manifests,
- validate bundled components,
- validate plugin identifiers and versions,
- validate installation behavior,
- validate declared permissions,
- validate marketplace or distribution metadata where applicable,
- keep platform-specific behavior isolated from portable logic,
- document executable behavior,
- document data access,
- document external actions.

Do not force Claude, Cursor, and Codex plugins into one artificial shared manifest when their official formats differ.

Use a common repository lifecycle while preserving native platform package formats.

A plugin must not silently gain broader permissions through bundled components.

---

# Universal lifecycle contract

Every independently releasable tool must expose appropriate Nx targets for:

```text
validate
test
package
validate-package
install
uninstall
verify-install
security-check
policy-check
```

Add the following when applicable:

```text
lint
typecheck
build
evaluate
publish
migrate
```

The common targets must have consistent meaning across all tool types.

No target may exist only as a placeholder.

No target may return success without meaningful execution.

## validate

Must verify:

- required files,
- required manifests,
- official schema compliance,
- metadata constraints,
- documentation completeness,
- declared compatibility,
- version consistency,
- referenced file existence,
- referenced scripts and assets,
- unsupported manifest fields,
- invalid paths,
- prohibited secrets,
- unsafe packaging content,
- license declarations,
- permission disclosures,
- runtime disclosures,
- policy metadata.

## test

Must execute meaningful automated behavioral or structural tests appropriate for the tool.

When full platform runtime integration cannot be automated:

- validate everything that can be checked locally,
- clearly identify unverified behavior,
- avoid claiming complete compatibility.

## package

Must create a deterministic standalone artifact containing only:

- files required by the tool,
- declared bundled dependencies,
- required metadata,
- required license information,
- installation metadata,
- integrity metadata.

The artifact must not contain:

- unrelated tools,
- the complete monorepo,
- repository-only files,
- local caches,
- temporary files,
- test output,
- secrets,
- `.env` contents,
- source-control metadata not required for distribution,
- machine-specific paths.

Generate an integrity checksum.

## validate-package

Must inspect the final generated artifact, not only the source directory.

It must verify:

- archive integrity,
- expected contents,
- absence of prohibited files,
- absence of path traversal,
- absence of unsafe symbolic links,
- manifest consistency,
- version consistency,
- checksum validity,
- license inclusion,
- installation metadata,
- deterministic packaging expectations.

## install

Must install only the selected tool into an explicitly selected target platform and scope.

Installation must:

- validate the package before modification,
- avoid accidental overwrites,
- preserve or back up existing installations where appropriate,
- report changed paths,
- fail safely,
- avoid partial installation,
- use minimum required privileges,
- avoid silent network access,
- avoid modifying global configuration without explicit scope selection.

## uninstall

Must remove only files owned by the selected tool.

It must not remove:

- user-created files,
- unrelated platform configuration,
- files owned by another tool,
- shared resources still required by another installed tool,
- manually modified files without warning and a safe strategy.

Support a preview or dry-run mode where practical.

## verify-install

Must independently confirm:

- required files are installed,
- installed metadata matches the selected version,
- the platform can discover the tool where technically verifiable,
- required dependencies are present,
- integrity checks pass,
- installed files match the package or declared transformation,
- no undeclared files were created.

## security-check

Must verify applicable controls, including:

- secret detection,
- unsafe executable content,
- unsafe shell construction,
- path traversal,
- unsafe symbolic links,
- unexpected network access,
- permission overreach,
- destructive file operations,
- archive safety,
- installation boundary violations,
- dependency vulnerabilities where applicable.

## policy-check

Must verify:

- official-documentation references,
- documentation review date,
- compatibility claims,
- permission disclosures,
- quality requirements,
- ethical engineering requirements,
- privacy requirements,
- release readiness,
- absence of placeholders,
- absence of unsupported claims,
- absence of misleading success behavior.

## publish

Publishing must be optional and platform-aware.

A tool may publish through:

- a platform marketplace,
- an npm-compatible registry,
- GitHub Releases,
- another officially supported distribution channel.

Do not assume that every tool belongs in npm.

Do not perform real external publication during repository bootstrap unless explicitly requested.

---

# Tool authoring quality policy

Every future tool must:

- have a clear and limited purpose,
- define explicit inputs and outputs,
- define supported and unsupported scenarios,
- avoid ambiguous instructions,
- avoid conflicting responsibilities,
- use minimum required permissions,
- include meaningful validation,
- include meaningful tests,
- include safe installation and uninstall behavior,
- include complete user-facing documentation,
- disclose side effects,
- disclose platform limitations,
- disclose security implications,
- disclose privacy implications,
- provide actionable errors,
- avoid unnecessary complexity,
- avoid hidden dependencies,
- avoid unverifiable guarantees.

No tool may be approved only because one manual happy-path test succeeded.

No tool may bypass shared validation to meet a deadline.

No tool may weaken repository-wide validation for its own convenience.

Any exception must be:

- explicitly documented,
- limited in scope,
- justified,
- reviewed,
- temporary where possible,
- accompanied by compensating controls.

---

# Ethical tool authoring policy

Future tools must not intentionally:

- mislead users,
- hide material side effects,
- fabricate evidence,
- fabricate test results,
- impersonate people without authorization,
- exfiltrate private data,
- bypass access controls,
- weaken security controls,
- conceal vulnerabilities,
- introduce unauthorized telemetry,
- manipulate users into unsafe actions,
- destroy data without explicit authorization,
- modify remote systems without explicit authorization,
- violate software licenses,
- claim compatibility that was not verified.

Tools intended for security testing must clearly distinguish:

- defensive use,
- authorized testing,
- required authorization,
- unsupported or prohibited use.

Tools that generate code must promote:

- secure defaults,
- maintainability,
- accessibility where applicable,
- testability,
- reviewability,
- minimal privileges,
- accurate documentation.

When a requested tool conflicts with this policy, generation or validation must fail with an actionable explanation instead of silently creating the tool.

---

# Tool scaffolding generator requirements

Create or extend a first-party Nx generator for future release units.

The generator must collect or accept:

- tool name,
- tool type,
- target platform or platforms,
- portable or platform-specific status,
- description,
- initial version,
- license,
- installation scopes,
- runtime requirements,
- required permissions,
- intended distribution channel,
- security-sensitive capabilities,
- privacy-sensitive capabilities,
- external side effects.

The generator must derive requirements from:

1. the selected tool type,
2. the selected target platform,
3. repository policy,
4. current official platform documentation.

The generator must:

- create an independent Nx project,
- create required native manifests,
- configure lifecycle targets,
- create tool-level documentation,
- create an initial changelog,
- create validation fixtures,
- create baseline tests,
- configure deterministic packaging,
- configure final package validation,
- configure installation verification,
- configure security and policy checks,
- register the project for independent releases,
- avoid duplicating canonical content,
- reject invalid names,
- reject unsupported tool/platform combinations,
- reject undeclared permissions,
- reject unsafe defaults,
- avoid fake placeholders that appear complete.

Do not create a real production tool only to test the generator.

Use isolated temporary fixtures or a dedicated test workspace.

The generator must fail safely without leaving a partially generated project.

It should be idempotent where practical.

Do not infer broad permissions from a tool category. Permissions must be explicitly selected or derived from concrete behavior.

---

# Validation architecture

Create reusable validation infrastructure instead of duplicating logic in each tool.

Validation must support:

- repository-wide rules,
- common release-unit rules,
- Agent Skills rules,
- Claude-specific rules,
- Cursor-specific rules,
- Codex-specific rules,
- plugin-specific rules,
- compatibility validation,
- version consistency,
- package-content validation,
- installation validation,
- security validation,
- privacy validation,
- ethics validation,
- quality-policy validation.

Validation diagnostics must include:

- a stable diagnostic code,
- severity,
- affected project,
- affected file,
- precise explanation,
- recommended correction,
- applicable policy or specification reference where useful.

Use non-zero exit codes for failures.

Warnings must not be treated as passing when they represent a release-blocking condition.

Provide machine-readable output in addition to human-readable diagnostics where practical.

Do not allow projects to suppress critical repository-wide diagnostics through local configuration.

Any permitted suppression must require:

- a specific diagnostic code,
- a documented reason,
- a defined scope,
- a review or expiration condition where appropriate.

---

# Dependency rules

Model dependencies in the Nx project graph.

Use explicit dependencies when automatic inference is insufficient.

Prevent undeclared coupling between independently released tools.

A releasable tool may depend on shared packages only when:

- the dependency is declared,
- compatible versions are defined,
- Nx Release can update dependent references correctly,
- packaging intentionally bundles or resolves the dependency,
- installation detects missing runtime dependencies.

Avoid circular dependencies.

Enforce project boundaries where applicable.

A tool must not read another project's internal files through undeclared relative paths.

Extract shared logic intentionally rather than copying it between tools.

---

# Packaging and reproducibility

Packaging must be deterministic.

Given the same source revision and compatible environment, packaging the same tool twice should produce equivalent contents.

Verify at minimum:

- stable file ordering,
- normalized archive paths,
- normalized permissions where applicable,
- excluded or normalized timestamps where feasible,
- exclusion of machine-specific paths,
- exclusion of caches and temporary files,
- reproducible dependency metadata,
- checksum generation.

The final package must include sufficient metadata to identify:

- tool name,
- tool version,
- license,
- supported platforms,
- integrity checksum,
- runtime requirements,
- installation scope,
- declared permissions.

Do not include unnecessary personal or machine-specific metadata.

---

# Security requirements

Add repository-wide safeguards for distributable AI tools.

Validate or detect:

- committed secrets,
- `.env` files containing values,
- private keys,
- credentials,
- tokens,
- suspicious executables,
- path traversal,
- unsafe symbolic links,
- scripts accessing files outside the package,
- undocumented network access,
- undocumented shell access,
- undeclared permissions,
- installation outside approved paths,
- destructive uninstall behavior,
- command injection risks,
- unsafe temporary-file handling,
- dependency confusion risks,
- unpinned executable downloads,
- install scripts that fetch and execute remote code.

Tool manifests and documentation must disclose:

- filesystem read access,
- filesystem write access,
- shell execution,
- network access,
- Git access,
- external APIs,
- MCP servers,
- credential requirements,
- telemetry,
- remote content retrieval.

Do not bundle real credentials or local environment configuration.

Avoid install-time remote code execution.

When remote downloads are unavoidable, require:

- HTTPS,
- pinned versions,
- integrity verification,
- documented source,
- explicit user action.

---

# Privacy requirements

Every tool must document whether it:

- reads source code,
- reads repository metadata,
- reads local configuration,
- reads environment variables,
- accesses prompts,
- stores conversation context,
- accesses external services,
- transmits content,
- writes logs,
- retains data.

Require data minimization.

Sensitive content must not be included in:

- release artifacts,
- telemetry,
- diagnostics,
- logs,
- handoff files,
- generated examples,

unless explicitly required, authorized, and protected.

Add validation for common accidental privacy violations where practical.

---

# CI and release gates

CI must run appropriate affected checks for changed projects:

- formatting,
- linting,
- type checking,
- validation,
- tests,
- packaging,
- final package validation,
- isolated installation tests,
- installation verification,
- security checks,
- privacy checks,
- policy checks,
- Version Plan checks.

A change to a releasable project must require a Version Plan unless it is explicitly classified as release-neutral by an enforceable policy.

CI must not publish from pull requests.

The controlled release process must:

- support selecting one or more projects,
- perform a release dry run,
- validate selected projects,
- test selected projects,
- run security, privacy, and policy checks,
- package selected projects,
- validate final artifacts,
- calculate checksums,
- preview version changes,
- preview changelog changes,
- require explicit authorization before external publication.

Use least-privilege CI permissions.

Do not configure real publication secrets during bootstrap.

---

# Required root commands

Provide stable root commands for at least:

```text
format
lint
typecheck
validate
test
security-check
privacy-check
policy-check
package
validate-package
verify
affected checks
create tool
create version plan
check version plans
release dry run
release selected projects
```

Use pnpm scripts and Nx targets consistently.

Avoid overlapping or ambiguous commands.

Document every command.

Commands that modify installation, versioning, or release state should support dry-run behavior where practical.

---

# Additional acceptance criteria

Treat these as additions to the existing plan's acceptance criteria.

The work is not complete unless:

1. every future standalone skill or plugin can be represented as an independent Nx project,
2. every release unit can be versioned independently,
3. every release unit can be validated independently,
4. every release unit can be tested independently,
5. every release unit can be packaged independently,
6. every release unit can be installed independently,
7. every release unit can be uninstalled independently,
8. every installed release unit can be verified independently,
9. every release unit can be released without releasing unrelated tools,
10. the root workspace cannot be accidentally published,
11. Nx Version Plans are enabled and enforced,
12. project-level changelogs are supported,
13. project-specific Git tags are supported,
14. lifecycle targets perform meaningful work,
15. no fake validators exist,
16. no placeholder success scripts exist,
17. no disabled tests are presented as passing,
18. final package artifacts are validated,
19. installation tests use isolated targets,
20. security checks are release-blocking,
21. privacy checks are release-blocking where applicable,
22. ethics and policy checks are release-blocking,
23. official-documentation compliance is enforceable,
24. compatibility claims require evidence,
25. future tool generation includes quality, security, privacy, and ethics requirements,
26. no repository-wide quality standard can be silently weakened by one tool,
27. no production tool is created speculatively during bootstrap,
28. no final repository directory structure is imposed prematurely,
29. no external publication, push, tag, or release occurs without explicit authorization,
30. incomplete work remains visibly incomplete rather than being replaced by a passing placeholder.

---

# Integration with the existing plan

Do not discard the existing analysis or implementation plan.

Before implementation:

1. compare this document with the existing plan,
2. identify missing requirements,
3. identify conflicts,
4. amend the plan rather than replacing it,
5. preserve valid prior decisions,
6. record any changed decision and its rationale.

Do not repeat research that has already been completed unless:

- the source is outdated,
- the existing conclusion is unsupported,
- the implementation depends on a changed platform specification,
- this document introduces a requirement that was not previously researched.

Do not redesign the repository solely to match examples in this document.

This document defines constraints and required behavior, not a mandatory directory tree.

---

# Final reporting additions

In the final implementation report, include:

- how these supplemental requirements were integrated,
- which existing decisions were preserved,
- which decisions were changed,
- quality policies introduced,
- ethics policies introduced,
- security and privacy controls introduced,
- lifecycle targets implemented,
- validation commands executed,
- test results,
- package validation results,
- isolated installation results,
- release dry-run results,
- known limitations,
- unverified platform behavior,
- deferred decisions,
- incomplete acceptance criteria.

Do not claim that a command passed unless it was actually executed successfully.

Do not claim platform compatibility unless it was meaningfully verified.

Do not hide unresolved limitations.

Do not publish, push, tag, commit, create remote releases, or modify global AI-tool installations unless explicitly requested.
