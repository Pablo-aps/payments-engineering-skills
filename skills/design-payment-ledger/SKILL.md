---
name: design-payment-ledger
description: Design, debug, or review production payment ledgers, wallet balances, internal transfers, holds, fees, refunds, reversals, and accounting projections. Use for ledger schemas and posting services, double-entry mappings, balance drift, concurrent debit or partial-operation races, backdated entries, hot accounts, stale projections, cross-tenant or cross-asset posting risks, ledger migrations, and monetary invariant reviews.
---

# Design Payment Ledger

Design the ledger as the financial system of record, not as a collection of cached balances. Produce explicit accounts, balanced entries, lifecycle rules, and tests that remain correct under retries, concurrency, reversals, and delayed settlement.

## Run the hazard pass first

Read [references/hazard-catalog.json](references/hazard-catalog.json). Build a matrix with:

```text
hazard_id | applicable | concrete evidence | prevention | detection | recovery | test
```

Mark a hazard not applicable only with a product- or code-specific reason. For a code review, cite the schema, query, transaction boundary, or call site that supplies the evidence. Do not approve a design while an applicable critical hazard lacks a preventive control, detection signal, recovery owner, and failure test.

## Workflow

### 1. Establish the accounting boundary

Identify:

- the legal or operational entity whose books this ledger represents;
- each asset or currency and its precision source;
- whether balances represent customer funds, platform funds, receivables, payables, reserves, fees, or operational cash;
- which external systems remain authoritative for authorization, settlement, custody, or bank cash;
- which lifecycle moments create pending versus posted entries.

State assumptions instead of silently inventing account ownership or regulatory treatment.

Also name `recorded_at`, `effective_at`, and accounting-period semantics. A backdated entry changes a period view but must not move backward in write/version order or bypass a current balance constraint.

### 2. Map business events to transactions

For every money-moving event, define:

1. the trigger and stable external correlation ID;
2. the debited and credited accounts;
3. the amount and asset on every entry;
4. pending, posted, reversed, or archived behavior;
5. idempotency scope;
6. evidence required before posting;
7. reversal or adjustment behavior;
8. the resulting available and posted balances.

Read [references/ledger-invariants.md](references/ledger-invariants.md) before designing entries. Use [references/modeling-patterns.md](references/modeling-patterns.md) when selecting account structure, holds, fees, or FX representation.

### 3. Enforce the invariants in storage

Prefer database constraints and atomic transactions over application-only checks.

- Balance every transaction independently per asset.
- Commit all entries for a transaction atomically.
- Make posted financial fields immutable.
- Correct posted history with linked reversing or adjusting transactions.
- Derive balances from entries or maintain projections that can be rebuilt and verified.
- Prevent duplicate external events and logical operations with unique constraints.
- Lock or serialize writes that depend on an available-balance check.
- Store authoritative amounts as integers in explicit atomic units or exact fixed-scale decimals. Never use binary floating point.
- Enforce tenant, ledger, account, and asset membership at the trusted posting boundary; a globally valid account UUID is not sufficient authorization.
- Retry the complete database transaction after a serialization failure. Never continue with values read by an aborted transaction.
- Treat database sequences as unique allocators, not gapless proof of journal completeness.

Use [assets/postgres-ledger.sql](assets/postgres-ledger.sql) as a starting point, then adapt it to the product boundary. Do not copy it without reviewing currency scale, tenancy, partitioning, and consistency requirements.

### 4. Separate risk balances from reporting projections

Name the consistency and lag of every projection. Authorize spend against the journal or a synchronously guarded risk balance, never an eventually consistent display projection.

Identify hot omnibus, processor, settlement, and revenue accounts. Lock only accounts whose balance gates the decision. Unnecessary locking on a shared account can serialize otherwise independent customers and turn a correct design into an outage.

### 5. Separate financial and operational state

Keep the payment provider's status, internal payment state, ledger transaction status, and order fulfillment state separate. Link them with stable identifiers. A provider payment becoming `succeeded` does not imply that every downstream settlement or accounting process is complete.

### 6. Close dual-write gaps

Draw the atomic boundary across business state, journal posting, and outbound events. Prefer one database transaction with a transactional outbox. If that is impossible, specify the saga, stable operation keys, drift detector, and repair direction.

### 7. Produce reviewable artifacts

Return:

- an account taxonomy with normal balance and ownership;
- a transaction matrix for core flows and failure paths;
- schema or model changes;
- constraints and isolation/locking strategy;
- example entries for one success, one reversal, and one partial operation;
- invariants expressed as tests or executable queries;
- migration and reconciliation considerations;
- explicit unresolved business or accounting questions;
- the completed hazard matrix with evidence and recovery ownership.

### 8. Test failure paths

Include tests for:

- concurrent debits against the same available balance;
- duplicate event or request delivery;
- crash between business-state and ledger writes;
- partial capture and partial refund;
- same amount in different currencies;
- reversal of a posted transaction;
- projection rebuild from the entry journal;
- a transaction whose numeric debits and credits match but whose assets do not;
- a zero-sum posting that uses the wrong owner's liability account;
- a backdated entry after period close;
- duplicate full reversal and concurrent partial corrections;
- a stale projection attempting to authorize spend;
- failure after the journal commit but before event publication;
- contention through one hot omnibus account.

## Review rules

Reject or flag designs that:

- update a balance without a durable journal entry;
- edit or delete posted entries;
- use one account row as both journal and balance;
- treat provider objects as the internal ledger;
- mix assets in a balancing equation;
- rely on a read-then-write available-balance check without concurrency control;
- use timestamps or human-readable references as the only deduplication key;
- claim that double-entry alone proves external settlement;
- treat a balanced transaction as economically correct without validating the posting template;
- use `effective_at`, sequence numbers, or projection timestamps as a substitute for write/version order;
- lock a shared hot account without proving that its balance gates the decision.

Keep accounting classification questions visible. If the correct debit/credit treatment depends on the business's legal role or accounting policy, present the alternatives and request an accountable decision instead of guessing.
