# Payments Engineering Skills

Payment engineering skills for Claude Code and OpenAI Codex. Help AI coding agents catch dangerous payment bugs around idempotency, ledgers, webhooks, reconciliation, retries, and payment state machines.

[![CI](https://github.com/Pablo-aps/payments-engineering-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/Pablo-aps/payments-engineering-skills/actions/workflows/ci.yml)
[![Agent Skills](https://img.shields.io/badge/Agent%20Skills-compatible-111827)](https://agentskills.io/)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

`Claude Code` · `OpenAI Codex` · `AI coding agents` · `payments` · `fintech`

## Why this exists

Payment failures live between systems. A provider can accept a refund after your request times out. Two workers can spend the same available balance. A valid webhook can arrive twice, late, or under a different event ID. Daily totals can agree while individual transactions are missing.

These skills make a coding agent review those failure modes before money is at risk. They provide concrete invariants, transaction boundaries, recovery rules, hostile tests, source-backed hazard catalogs, and adaptable SQL/YAML contracts—not generic “use idempotency” advice.

## Install

Clone once, then copy the skills into your project:

```bash
git clone --depth 1 https://github.com/Pablo-aps/payments-engineering-skills.git
mkdir -p .agents/skills .claude/skills
cp -R payments-engineering-skills/skills/* .agents/skills/
cp -R payments-engineering-skills/skills/* .claude/skills/
```

Codex discovers repository skills in `.agents/skills`; Claude Code uses `.claude/skills`. Copy only the directories you need if you prefer a smaller context surface. Review and commit project-scoped copies so the team uses the same version. See the official [Codex skills](https://developers.openai.com/codex/skills) and [Claude Code skills](https://code.claude.com/docs/en/skills) documentation for user-level installation and discovery behavior.

Then ask for a focused review:

```text
Use $implement-idempotent-payments to review this refund endpoint. Assume the
provider can time out after accepting the request and two API instances may race.
```

In Claude Code, invoke the same skill with `/implement-idempotent-payments`.

## What these skills catch

- **Refund response timed out after provider acceptance:** preserve one logical operation and provider key; move to `INDETERMINATE`; recover from inquiry, webhook evidence, and reconciliation instead of creating a second refund.
- **Two workers withdraw from the same balance:** put the debit decision and journal posting behind a database-level concurrency boundary; prove one `700` withdrawal and one `600` withdrawal cannot both spend a `1,000` balance.
- **Webhook arrives twice or out of order:** verify exact raw bytes, durably accept delivery, separate event deduplication from financial-effect idempotency, and reject stale state transitions.
- **Provider and ledger totals match with missing rows:** prove source completeness first, deduplicate both populations, match in both directions, and keep every residual explainable.
- **A late payment attempt succeeds after a retry:** model attempts and captures separately, detect excess payment, preserve contradictory evidence, and make fulfillment independently idempotent.

Explore the compact, source-backed cases:

| Failure case | The easy-to-miss break |
| --- | --- |
| [Ambiguous refund timeout](examples/ambiguous-refund-timeout.md) | A fresh retry key turns uncertainty into a second mutation |
| [Duplicate and reordered webhook](examples/duplicate-webhook.md) | Event-ID deduplication does not deduplicate the financial effect |
| [Concurrent withdrawal](examples/concurrent-withdrawal.md) | A transaction wrapper alone does not serialize a stale read |
| [Aggregate reconciliation](examples/aggregate-reconciliation.md) | Offsetting omissions can produce a perfect zero difference |
| [Stale payment event](examples/stale-payment-event.md) | One order status cannot represent two successful attempts |

## Payment failure map

![Payment request flow from idempotency through provider, webhook, ledger, and reconciliation, with the relevant skill at each boundary](docs/payment-path.svg)

No single component provides exactly-once money movement. The skills overlap intentionally at the boundaries where a response, event, posting, or report can be lost, duplicated, delayed, or misclassified.

## The five skills

| Skill | Use it for |
| --- | --- |
| [`implement-idempotent-payments`](skills/implement-idempotent-payments/SKILL.md) | Safe retries, concurrent callers, cached provider errors, ambiguous outcomes, failover, retention, and downstream effects |
| [`build-reliable-payment-webhooks`](skills/build-reliable-payment-webhooks/SKILL.md) | Raw-body verification, durable inboxes, duplicate facts, reordered events, queue gaps, replay, and secret rotation |
| [`design-payment-ledger`](skills/design-payment-ledger/SKILL.md) | Double-entry journals, holds, balances, fees, reversals, concurrency, backdating, ownership, and monetary invariants |
| [`reconcile-payment-systems`](skills/reconcile-payment-systems/SKILL.md) | Source completeness, schema drift, date bases, double-sided matching, corrected reports, exceptions, and safe adjustments |
| [`review-payment-state-machine`](skills/review-payment-state-machine/SKILL.md) | Authorization, capture, settlement, refunds, disputes, multiple attempts, partial operations, and fulfillment gates |

Each directory follows the open [Agent Skills](https://agentskills.io/) format and contains a focused `SKILL.md`, a machine-readable hazard catalog, primary-source references, and an adaptable contract.

## Why this is not a prompt collection

The current release encodes 50 named failure mechanisms. For every applicable critical hazard, the agent is required to provide concrete evidence for:

```text
prevention | detection | recovery | failure test
```

Examples of details ordinary reviews often miss include provider keys scoped by region, idempotency records expiring before disaster replay, valid-but-replayed webhook payloads, two event IDs for one financial fact, balanced entries posted to the wrong owner, corrected settlement files counted twice, and two payment attempts that both succeed.

The proof surface is intentionally inspectable:

- 65 trigger, positive, negative, adversarial, and artifact-review eval cases;
- 20 deterministic failure fixtures with expected outcomes;
- five reproducible educational cases linked to primary documentation;
- executable PostgreSQL contract tests;
- a [directional before/after benchmark](benchmark/README.md) with isolated workspaces, fixed criteria, raw outputs, tool versions, and explicit limitations.

In the published [Codex v2 smoke run](benchmark/results/2026-08-18.codex.md), the fixed signal checks observed `15/20` without skills and `20/20` with the relevant skill installed. That is one trial per cell—not a general model-quality or safety claim—so the report links to the complete [structured outputs](benchmark/results/2026-08-18.codex.raw.json) and states the limits beside the result.

This is not a claim that a skill makes generated payment code safe. It is evidence that the review process is specific, testable, and difficult to satisfy with generic advice.

## Expected output

A useful review should return named invariants, stable operation identities, transaction boundaries, an explicit uncertainty model, provider-specific assumptions, observability and recovery ownership, and tests that force the dangerous timing—not merely repeat the happy path.

The core rules are:

1. Never infer non-execution from a timeout or early not-found.
2. Never treat an HTTP request, webhook delivery, and financial effect as the same identity.
3. Never use mutable balances or provider objects as an internal journal.
4. Never pass reconciliation before proving source completeness and item-level coverage.
5. Never overwrite stronger financial evidence because a stale event arrived later.
6. Reverse or adjust posted financial history; do not rewrite it.

## Validate locally

Node.js 20 or newer is sufficient. The repository has no runtime dependencies.

```bash
npm test
```

The validator fails if a skill loses its catalog, a hazard loses eval coverage, a fixture points to the wrong skill, required metadata drifts, or a PostgreSQL contract violates its executable invariants.

## Repository layout

```text
skills/       Agent Skills, hazard catalogs, references, and contracts
examples/     Compact source-backed payment failure cases
benchmark/    Isolated Codex and Claude Code before/after protocol
evals/        Trigger and failure-mode evaluation cases
fixtures/     Deterministic implementation scenarios
scripts/      Dependency-free repository validation
test/         Repository, fixture, and PostgreSQL contract tests
```

## Scope and safety

These are engineering guardrails, not a payment processor, accounting policy, or substitute for accountable security, finance, compliance, and legal review. Before adapting a contract, decide tenancy, access control, privacy, currency scale, retention, provider guarantees, regulatory boundary, availability target, and operational ownership.

See [SECURITY.md](SECURITY.md) for private vulnerability reporting and [CONTRIBUTING.md](CONTRIBUTING.md) for the evidence standard.

## License

Apache License 2.0. See [LICENSE](LICENSE).
