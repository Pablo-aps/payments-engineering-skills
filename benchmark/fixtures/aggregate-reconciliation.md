# Daily reconciliation change

Review this proposed production change.

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

The provider export is paginated. In one incident, the extracted population omitted one `+1,000` row and one `-1,000` row while the reported difference remained zero.
