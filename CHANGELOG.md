# Changelog

All notable changes to this project will be documented here. The project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.3.0] - 2026-08-18

### Added

- Five compact, source-backed payment failure cases covering ambiguous refunds, duplicate webhooks, concurrent withdrawals, aggregate reconciliation, and stale payment events.
- A hand-authored payment-path diagram and 1280×640 social preview mapping each skill to the boundary it protects.
- A blind, reproducible Codex and Claude Code before/after benchmark with isolated workspaces, fixed criteria, structured raw outputs, protocol fingerprints, and explicit limitations.

### Changed

- Rebuilt the README first screen around installation, concrete failure mechanisms, and inspectable evidence.
- Extended repository validation to enforce benchmark answer isolation, one case per skill, fixed rubric structure, example completeness, output schema constraints, and README link integrity.

## [0.2.0] - 2026-08-17

### Added

- Fifty machine-readable, source-backed payment hazard records with prevention, detection, recovery, and test guidance.
- Twenty-five artifact and adversarial eval cases, bringing the suite to 65 and covering every cataloged hazard.
- Twenty deterministic failure fixtures spanning regional idempotency, webhook identity, ledger races, incomplete settlement sources, and conflicting payment outcomes.
- Executable PostgreSQL contract tests for posting, immutability, provider-key scope, and webhook identity.

### Changed

- Reworked every skill around an evidence-based hazard pass with a required review matrix.
- Deepened the PostgreSQL and YAML contracts for tenant and asset boundaries, fencing, durable delivery, source manifests, amount invariants, and evidence precedence.
- Strengthened repository validation to enforce catalog structure, hazard namespaces, eval coverage, and fixture ownership.

## [0.1.0] - 2026-08-17

### Added

- Five production-minded Agent Skills covering ledgers, idempotent mutations, webhooks, reconciliation, and payment state machines.
- Adaptable PostgreSQL and YAML contracts.
- Forty trigger and failure-mode evaluation cases.
- Deterministic cross-skill failure fixtures and dependency-free validation.
- Contribution, security, conduct, and CI configuration.

[Unreleased]: https://github.com/Pablo-aps/payments-engineering-skills/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/Pablo-aps/payments-engineering-skills/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Pablo-aps/payments-engineering-skills/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Pablo-aps/payments-engineering-skills/releases/tag/v0.1.0
