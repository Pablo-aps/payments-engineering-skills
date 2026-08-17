# Aggregate Equality Is Not Reconciliation

## Scenario

A daily control passes when provider and ledger totals match, without proving source completeness or matching individual records.

## Unsafe implementation

```ts
export function reconcile(providerRows: Row[], ledgerRows: Row[]) {
  const providerTotal = providerRows.reduce((sum, row) => sum + row.netAtomic, 0n);
  const ledgerTotal = ledgerRows.reduce((sum, row) => sum + row.netAtomic, 0n);

  return {
    status: providerTotal === ledgerTotal ? "PASSED" : "FAILED",
    differenceAtomic: providerTotal - ledgerTotal,
  };
}
```

The provider extract is missing one `+1,000` row and one `-1,000` row. The total difference remains zero.

## Failure mechanism

Opposing omissions, duplicate records, wrong matches, and incomplete files can cancel at aggregate level. A zero difference therefore does not prove that every in-scope financial record is represented once on both sides.

## Review with the skill

Codex:

```text
Use $reconcile-payment-systems to review examples/aggregate-reconciliation.md.
```

Claude Code:

```text
/reconcile-payment-systems Review examples/aggregate-reconciliation.md.
```

## Expected review signals

- Block matching until the source manifest proves every file, page, checksum, schema, and control total is complete.
- Deduplicate each source before matching.
- Run both provider-to-ledger and ledger-to-provider passes.
- Require every record to be matched, explicitly excluded, or exceptional.
- Test a missing offsetting pair and require `INCOMPLETE_SOURCE` or two item-level exceptions despite zero aggregate difference.

## Primary evidence

Stripe distinguishes balance reconciliation from payout reconciliation and uses different date bases and transaction populations for the reports: [Choose the right report](https://docs.stripe.com/reports/select-a-report). Report totals must therefore be interpreted within an explicit source and timing boundary.

Relevant hazards: `REC-001`, `REC-002`, `REC-004`.
