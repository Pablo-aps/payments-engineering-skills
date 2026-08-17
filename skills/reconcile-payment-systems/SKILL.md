---
name: reconcile-payment-systems
description: Design, implement, operate, debug, or review payment reconciliation across internal records, ledgers, provider APIs, balance transactions, multi-file settlement reports, payouts, and bank statements. Use for source manifests, pagination/file completeness, schema drift, date and timezone cutoffs, double-sided matching, duplicates, grouped fees/reserves/FX, corrected reports, late arrivals, exception aging, or idempotent manual adjustments.
---

# Reconcile Payment Systems

Build reconciliation as a repeatable control that proves which records agree, exposes which do not, and preserves enough evidence to explain every decision and adjustment.

## Run the hazard pass first

Read [references/hazard-catalog.json](references/hazard-catalog.json). Build a matrix with:

```text
hazard_id | applicable | concrete evidence | prevention | detection | recovery | test
```

Mark a hazard not applicable only with source- and control-specific evidence. Do not let a run pass while an applicable critical hazard lacks a preventive control, detection signal, recovery owner, and deterministic fixture.

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

Build an immutable source manifest before matching: report identity/version, expected and received file sequences, page cursors, file hashes, headers/schema fingerprint, row count, control totals, retrieval time, and supersession relationship. Treat missing or changed evidence as `INCOMPLETE_SOURCE`, not as unmatched records.

### 3. Normalize without destroying evidence

Preserve raw source records. Create normalized records with:

- source and source-record ID;
- payment, capture, refund, dispute, payout, and bank references;
- gross, fee, net, currency, and precision;
- provider event and settlement dates;
- ingestion and run timestamps;
- normalization version.

Store transformations explicitly. Never overwrite the raw amount to force a match.

Validate the exact header/schema before positional parsing. Provider-configurable report columns and new journal types must fail visibly. Preserve created, captured, available, settled, payout, and bank-booking time separately; do not collapse them into one date.

### 4. Match deterministically

Apply a documented hierarchy from strongest to weakest evidence. Prefer stable unique identifiers, then constrained composite matches. Use amount or time tolerances only when the business process justifies them.

Read [references/matching-and-exceptions.md](references/matching-and-exceptions.md). Use [assets/reconciliation-contract.yaml](assets/reconciliation-contract.yaml) as a machine-readable starting contract.

Classify one-to-one, one-to-many, many-to-one, ambiguous, and unmatched results separately.

Deduplicate each source population before matching. Run both A-to-B and B-to-A passes; every in-scope record on both sides must be matched, explicitly excluded, or exceptional. Verify grouped gross, fee, reserve, FX, tax, and net equations by asset.

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

Derive a stable adjustment key from the exception and resolution version. A rerun must rediscover the existing adjustment, not post another one. Model corrected/regenerated provider reports as new source versions that supersede old versions; never add both populations together.

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
- missing page or truncated settlement file;
- a zero aggregate difference with the middle report file missing;
- schema columns reordered or a new journal type added;
- both sides containing same-amount/date collisions;
- major-unit report values compared with atomic-unit API values;
- corrected report version replacing the prior population;
- concurrent reruns applying one approved adjustment;
- DST, month-close, and settlement-date boundary cases.

## Required output

Return the control objective, immutable source manifest, completeness and schema checks, date-basis map, normalized model, deduplication and double-sided matching hierarchy, grouped equations, exception taxonomy, run state, idempotent manual-resolution workflow, metrics, completed hazard matrix, and deterministic fixtures with expected output.

## Review rules

Reject or flag designs that:

- compare only aggregate totals;
- ignore data completeness and report readiness;
- use amount plus date as an unconditional unique match;
- mutate raw source rows;
- delete cleared exceptions;
- let manual actions bypass audit and approval;
- post balancing adjustments automatically without classification and review;
- treat a provider webhook stream as a substitute for settlement reconciliation;
- start matching before the source manifest is complete;
- parse configurable reports by column position without header validation;
- run matching in only one direction;
- ingest a corrected report as extra activity instead of a replacement version;
- allow a rerun to create a second adjustment for one resolution.
