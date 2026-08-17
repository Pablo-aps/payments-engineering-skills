# Matching and exceptions

Apply matching rules in a documented hierarchy. Stop when a rule produces a unique, internally consistent match. Never hide ambiguity behind a confidence score.

## Matching hierarchy

1. Exact provider financial-record or balance-transaction ID.
2. Exact provider object ID plus transaction type/sequence.
3. Merchant operation ID explicitly carried by both systems.
4. Settlement or payout reference plus component identity.
5. Constrained composite evidence such as amount, asset, event type, account, and bounded time window.

Amount and date alone are weak evidence. They are common collisions in batch payment systems. If a composite produces more than one candidate, classify it as ambiguous.

## Cardinality

Preserve these outcomes separately:

- one-to-one: a direct atomic match;
- one-to-many: one internal record represented by several provider components;
- many-to-one: several items netted into one settlement/payout;
- many-to-many: often requires an intermediate batch identity;
- unmatched: one side has no eligible candidate;
- ambiguous: eligible candidates exist but evidence is insufficient.

Verify gross, fee, tax, FX, reserve, and net equations for grouped matches.

## Tolerances

Every tolerance needs a reason, unit, boundary, and rule version. Examples include a bank booking-date window or a documented FX/rounding residual. Never use a broad tolerance simply to increase the match rate.

## Exception record

Store:

- immutable run and source record IDs;
- exception code and severity;
- amount/asset exposure;
- candidate matches and failed rule checks;
- first/last observed time and aging bucket;
- owner and resolution service level;
- comments, evidence, approvals, and linked adjustment;
- resolution code and the run that verified closure.

Suggested codes include `MISSING_INTERNAL`, `MISSING_PROVIDER`, `INCOMPLETE_SOURCE`, `AMOUNT_MISMATCH`, `ASSET_MISMATCH`, `FEE_MISMATCH`, `FX_MISMATCH`, `DUPLICATE_SOURCE`, `AMBIGUOUS_REFERENCE`, `STATE_MISMATCH`, `LATE_ARRIVAL`, and `PAYOUT_CASH_MISMATCH`.

## Resolution controls

Manual linking, waivers, and adjustments require an actor, reason, evidence, and—above a product-specific risk threshold—independent approval. Corrections go through the normal ledger posting path with a stable operation key. Reconciliation must never update a balance directly.

## Deterministic fixtures

Include fixtures for exact match, partial refund grouping, fee netting, reused merchant reference, duplicate report line, late arrival, missing source page, and payout-to-bank timing. Each fixture should name the expected rule and exception code.
