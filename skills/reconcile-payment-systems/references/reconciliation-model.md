# Reconciliation model

Reconciliation is a control over defined populations, not a query that happens to return zero. State what is being proved, for which period, from which complete sources, and at which level of the money flow.

## Control layers

| Layer | Typical question | Typical evidence |
| --- | --- | --- |
| Request to provider | Did every accepted internal operation produce the intended provider object exactly once? | Internal operations, provider API export |
| Provider to subledger | Is every provider financial movement represented correctly in the internal journal? | Provider balance transactions, ledger entries |
| Settlement | Do gross, fee, FX, reserve, and net components explain each settlement batch? | Settlement reports, balance activity |
| Payout to cash | Did the expected net payout reach the bank? | Provider payout, bank statement |
| Subledger to GL | Do summarized controlled balances agree for the close period? | Subledger trial balance, GL journal/import |

Each layer has different identifiers, timing, and authority. Passing one does not prove another.

## Source contract

For every source, record:

- owner and retrieval method;
- immutable source identifier and schema/report version;
- event time, availability time, and timezone;
- amount units and currency semantics;
- pagination, checkpoint, or file-sequence rules;
- correction and replacement behavior;
- readiness signal and expected delivery schedule;
- retention and replay path.

A run cannot be complete merely because the API returned no more rows. Store page counts/checkpoints and compare them with source readiness or control totals where available.

## Run identity

A deterministic run is identified by reconciliation type, entity/merchant scope, period, source snapshots or checkpoints, normalization version, and matching-rule version. Re-running that identity should reproduce the result unless an explicit new source version is selected.

Preserve raw rows, normalized rows, matches, exceptions, and operator decisions. Close a run; do not edit history into agreement.

## Timing and close

Define a grace period for late records and a policy for events after cutoff. Classify an expected timing difference separately from an unexplained absence. A later run can clear the exception while preserving both observations.

## Metrics

Track value and count coverage, exception value/count by class and age, incomplete-source runs, auto-match confidence tier, manual-resolution volume, re-opened exceptions, and time to resolution. Aggregate zero can hide equal and opposite item-level errors.

## Primary references

- [Stripe reconciliation](https://docs.stripe.com/reconciliation)
- [Stripe balance transaction reconciliation](https://docs.stripe.com/reports/balance-transaction-types)
- [Adyen settlement details reports](https://docs.adyen.com/reporting/settlement-reconciliation/settlement-details-report/)
