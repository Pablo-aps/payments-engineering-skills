---
name: design-payment-ledger
description: Design or review production payment ledgers, wallet balances, internal transfers, holds, fees, refunds, reversals, and accounting projections. Use when creating ledger schemas or services, mapping a money-movement product to double-entry records, diagnosing balance drift, reviewing mutable balance logic, or specifying monetary invariants and concurrency controls.
---

# Design Payment Ledger

Design the ledger as the financial system of record, not as a collection of cached balances. Produce explicit accounts, balanced entries, lifecycle rules, and tests that remain correct under retries, concurrency, reversals, and delayed settlement.

## Workflow

### 1. Establish the accounting boundary

Identify:

- the legal or operational entity whose books this ledger represents;
- each asset or currency and its precision source;
- whether balances represent customer funds, platform funds, receivables, payables, reserves, fees, or operational cash;
- which external systems remain authoritative for authorization, settlement, custody, or bank cash;
- which lifecycle moments create pending versus posted entries.

State assumptions instead of silently inventing account ownership or regulatory treatment.

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

Use [assets/postgres-ledger.sql](assets/postgres-ledger.sql) as a starting point, then adapt it to the product boundary. Do not copy it without reviewing currency scale, tenancy, partitioning, and consistency requirements.

### 4. Separate financial and operational state

Keep the payment provider's status, internal payment state, ledger transaction status, and order fulfillment state separate. Link them with stable identifiers. A provider payment becoming `succeeded` does not imply that every downstream settlement or accounting process is complete.

### 5. Produce reviewable artifacts

Return:

- an account taxonomy with normal balance and ownership;
- a transaction matrix for core flows and failure paths;
- schema or model changes;
- constraints and isolation/locking strategy;
- example entries for one success, one reversal, and one partial operation;
- invariants expressed as tests or executable queries;
- migration and reconciliation considerations;
- explicit unresolved business or accounting questions.

### 6. Test failure paths

Include tests for:

- concurrent debits against the same available balance;
- duplicate event or request delivery;
- crash between business-state and ledger writes;
- partial capture and partial refund;
- same amount in different currencies;
- reversal of a posted transaction;
- projection rebuild from the entry journal;
- a transaction whose numeric debits and credits match but whose assets do not.

## Review rules

Reject or flag designs that:

- update a balance without a durable journal entry;
- edit or delete posted entries;
- use one account row as both journal and balance;
- treat provider objects as the internal ledger;
- mix assets in a balancing equation;
- rely on a read-then-write available-balance check without concurrency control;
- use timestamps or human-readable references as the only deduplication key;
- claim that double-entry alone proves external settlement.

Keep accounting classification questions visible. If the correct debit/credit treatment depends on the business's legal role or accounting policy, present the alternatives and request an accountable decision instead of guessing.
