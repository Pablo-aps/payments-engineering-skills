# Payment Engineering Skills

Failure-mode-driven skills for AI coding agents working on payment systems.

[![CI](https://github.com/Pablo-aps/payments-engineering-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/Pablo-aps/payments-engineering-skills/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

Most payment bugs do not live in the happy path. They appear when a response is lost after money moved, two workers race for the same operation, a webhook arrives twice or out of order, or two systems disagree at close.

This repository gives coding agents concrete workflows, hazard catalogs, failure tests, review rules, and adaptable contracts for those cases. The skills are vendor-aware but vendor-neutral by design. They do not replace an accountable engineering, accounting, security, or legal review.

## Why this is different

Each skill starts with a source-backed hazard pass. The agent must classify every hazard and provide code- or design-specific evidence for prevention, detection, recovery, and testing. Critical risks cannot disappear behind a generic recommendation.

The current catalogs cover 50 failure mechanisms, including cases that are easy to miss in ordinary reviews:

- provider idempotency that is scoped by region, expires before a disaster replay, caches a server error, or exposes a stored response across credentials;
- a valid webhook replay, the same event ID with changed bytes, two event IDs for one financial fact, and an inbox commit followed by queue loss;
- a balanced journal entry posted to the wrong owner, backdated effective time, double reversal, hot-account contention, and stale projections used for spend decisions;
- settlement reports that are numerically balanced but incomplete, corrected source versions, schema drift, ambiguous matches, and duplicate adjustments on rerun;
- two payment attempts that both succeed, reauthorization under a new ID, capture races, late success after cancellation, and refund/dispute double reimbursement.

## Skills

| Skill | Use it for |
| --- | --- |
| [`design-payment-ledger`](skills/design-payment-ledger/SKILL.md) | Double-entry journals, account taxonomy, balances, holds, fees, reversals, and monetary invariants |
| [`implement-idempotent-payments`](skills/implement-idempotent-payments/SKILL.md) | Safe retries, duplicate financial mutations, concurrency, timeouts, and indeterminate outcomes |
| [`build-reliable-payment-webhooks`](skills/build-reliable-payment-webhooks/SKILL.md) | Signature verification, durable inboxes, duplicate/out-of-order events, retries, and replay |
| [`reconcile-payment-systems`](skills/reconcile-payment-systems/SKILL.md) | Provider, ledger, settlement, payout, and bank matching with explainable exceptions |
| [`review-payment-state-machine`](skills/review-payment-state-machine/SKILL.md) | Authorization, capture, settlement, refunds, disputes, partial operations, and fulfillment gates |

Each directory follows the open [Agent Skills](https://agentskills.io/) format and includes:

- a focused `SKILL.md` with trigger metadata and an engineering workflow;
- a machine-readable catalog of source-backed hazards;
- primary-source references and explicit failure modes;
- an adaptable SQL or YAML contract;
- interface metadata for compatible agents.

## Install

Clone the repository, then copy or link only the skills you need into the skills directory used by your agent.

```bash
git clone https://github.com/Pablo-aps/payments-engineering-skills.git
```

For a project-scoped Codex setup:

```bash
mkdir -p .agents/skills
cp -R payments-engineering-skills/skills/* .agents/skills/
```

For a project-scoped Claude Code setup:

```bash
mkdir -p .claude/skills
cp -R payments-engineering-skills/skills/* .claude/skills/
```

Skills remain ordinary files: review them before installation and commit project-scoped copies when you want the team to share the same version.

## Example prompts

```text
Use $implement-idempotent-payments to review this refund endpoint. Assume the
provider can time out after accepting the request and two API instances may race.
```

```text
Use $reconcile-payment-systems to design daily reconciliation from processor
balance transactions to our ledger and from payouts to our bank statement.
```

```text
Use $design-payment-ledger to model authorization holds, partial capture,
processor fees, partial refunds, and reversals for a multi-currency marketplace.
```

## What good output should contain

The skills push an agent to return reviewable artifacts instead of generic advice:

- named invariants and transaction boundaries;
- stable operation identities and uniqueness constraints;
- explicit `indeterminate` states rather than unsafe retry guesses;
- raw-body webhook verification and durable acceptance;
- source completeness checks before reconciliation can pass;
- separated authorization, capture, settlement, refund, dispute, and fulfillment state;
- concurrency and failure tests, including duplicate and reordered delivery.

The [`evals`](evals/cases.json) directory contains 65 positive, negative, adversarial, and artifact-review prompts with expected signals. Every cataloged hazard is mapped to at least one eval. The [`fixtures`](fixtures/failure-scenarios.json) directory adds 20 deterministic implementation scenarios. CI fails if a skill loses its catalog, a hazard loses eval coverage, a fixture points to the wrong skill, required metadata drifts, or a PostgreSQL contract violates its executable invariants.

## Repository layout

```text
skills/       Agent Skills and their supporting resources
evals/        Trigger and failure-mode evaluation cases
fixtures/     Deterministic payment-system scenarios
scripts/      Dependency-free repository validation
test/         Repository, fixture, and PostgreSQL contract tests
```

## Design principles

1. Money movement is a distributed-systems problem with accounting consequences.
2. Exactly-once delivery is not assumed across independent systems.
3. A timeout or early not-found is not proof that a payment failed.
4. A provider object is not an internal ledger.
5. Webhooks are authenticated observations, not ordered commands.
6. Aggregate equality is not item-level reconciliation.
7. Corrections preserve history through reversals and adjustments.
8. Fulfillment uses explicit, rail-specific evidence.
9. Every critical hazard needs prevention, detection, recovery, and a failure test.

## Validate locally

Node.js 20 or newer is sufficient; the validation suite has no runtime dependencies.

```bash
npm test
```

## Scope and safety

The included schemas are starting contracts, not drop-in production databases. Before using them, decide tenancy, retention, access control, privacy, currency scale, accounting policy, provider guarantees, regulatory boundary, availability target, and operational ownership.

See [SECURITY.md](SECURITY.md) for private vulnerability reporting and [CONTRIBUTING.md](CONTRIBUTING.md) for the evidence standard used in this repository.

## License

Apache License 2.0. See [LICENSE](LICENSE).
