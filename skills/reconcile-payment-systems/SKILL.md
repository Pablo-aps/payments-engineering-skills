---
name: reconcile-payment-systems
description: Design, implement, operate, or review payment reconciliation across internal payment records, ledgers, provider APIs, balance transactions, settlement files, payouts, and bank statements. Use for matching rules, data completeness, late arrivals, fees, FX, partial operations, exception queues, period close, and auditable manual resolution.
---

# Reconcile Payment Systems

Build reconciliation as a repeatable control that proves which records agree, exposes which do not, and preserves enough evidence to explain every decision and adjustment.

## Workflow

### 1. Define layers and authority

Map each reconciliation layer:

1. internal request or payment attempt versus provider object;
2. internal financial journal versus provider balance activity;
3. provider balance activity versus settlement batch or payout;
4. provider payout versus bank cash;
5. subledger totals versus general ledger, when in scope.

For every compared field, name the authoritative source and its timing semantics. Do not treat the latest-arriving source as automatically authoritative.

Read [references/reconciliation-model.md](references/reconciliation-model.md) before defining datasets or run boundaries.

### 2. Establish completeness

Record extraction windows, source versions, pagination/checkpoints, expected files, report readiness, time zones, currency units, and late-arrival policy. A zero-difference result is not valid if the source data is incomplete.

### 3. Normalize without destroying evidence

Preserve raw source records. Create normalized records with:

- source and source-record ID;
- payment, capture, refund, dispute, payout, and bank references;
- gross, fee, net, currency, and precision;
- provider event and settlement dates;
- ingestion and run timestamps;
- normalization version.

Store transformations explicitly. Never overwrite the raw amount to force a match.

### 4. Match deterministically

Apply a documented hierarchy from strongest to weakest evidence. Prefer stable unique identifiers, then constrained composite matches. Use amount or time tolerances only when the business process justifies them.

Read [references/matching-and-exceptions.md](references/matching-and-exceptions.md). Use [assets/reconciliation-contract.yaml](assets/reconciliation-contract.yaml) as a machine-readable starting contract.

Classify one-to-one, one-to-many, many-to-one, ambiguous, and unmatched results separately.

### 5. Create explainable exceptions

Classify at least:

- missing internal or provider record;
- timing or late-arrival difference;
- amount, fee, FX, or currency mismatch;
- duplicate source record;
- unexpected lifecycle state;
- partial capture/refund mismatch;
- settlement-to-bank mismatch;
- ambiguous reference;
- incomplete source data.

Never silently mutate production records to clear an exception.

### 6. Resolve and re-run safely

Make reconciliation runs immutable and reproducible. Store the rule version, source snapshot/checkpoint, matches, exceptions, and operator decisions. Make re-runs idempotent. Post corrections through normal ledger adjustment flows with a link to the exception and approval evidence.

### 7. Test realistic drift

Cover:

- provider success missing internally;
- internal success absent from provider activity;
- late settlement after the close cutoff;
- multiple partial refunds;
- fee netting and FX conversion;
- one payout covering multiple settlement batches;
- duplicate report lines;
- reused merchant reference;
- chargeback after prior settlement;
- missing page or truncated settlement file.

## Required output

Return the control objective, source contract, completeness checks, normalized model, matching hierarchy, exception taxonomy, run state, manual-resolution workflow, metrics, and deterministic fixtures with expected output.

## Review rules

Reject or flag designs that:

- compare only aggregate totals;
- ignore data completeness and report readiness;
- use amount plus date as an unconditional unique match;
- mutate raw source rows;
- delete cleared exceptions;
- let manual actions bypass audit and approval;
- post balancing adjustments automatically without classification and review;
- treat a provider webhook stream as a substitute for settlement reconciliation.
