# Ledger invariants

Use these invariants as design constraints and executable test targets. A ledger is trustworthy only when the system can enforce or continuously verify them.

## Journal integrity

1. Every posted transaction has at least two entries.
2. Debits equal credits for each asset within a transaction.
3. Every entry references exactly one transaction and one account.
4. An entry's asset matches its account's asset.
5. Posted entries and their financial fields are immutable.
6. A correction creates a linked reversal or adjustment; it never rewrites history.
7. A transaction is visible as a whole or not at all.
8. A stable business operation or external event cannot post twice within its declared scope.

Do not claim that a row-level `CHECK` constraint proves a cross-row balance equation. Enforce balancing through a controlled posting function, a deferred constraint trigger, or an application transaction backed by an independent invariant query.

## Amount representation

- Use integer atomic units when the asset scale is fixed and centrally defined.
- Use exact decimals when the domain genuinely requires a declared scale.
- Store the asset beside every amount or make it unambiguous through the referenced account.
- Reject amounts with unsupported precision. Never round silently at the ledger boundary.
- Never use IEEE-754 floating point for authoritative monetary values.

Provider minor-unit rules are not universally identical to ISO currency exponents. Treat the provider or rail documentation as an input contract and version it.

## Balance integrity

Define each reported balance as a projection over journal entries and named eligibility rules. Common projections include posted, pending, reserved, available, and owed balances. Each must answer:

- Which accounts and entry states contribute?
- Which sign convention is used?
- At what consistency point is it computed?
- Can it be rebuilt from the journal?
- How is a projection drift detected and repaired?

If spending depends on an available-balance check, serialize competing debits with row locks, serializable isolation, an atomic conditional update, or a product-specific reservation primitive. Reading a balance and later writing entries without concurrency control is unsafe.

## Verification queries

Continuously check for:

- unbalanced posted transactions grouped by transaction and asset;
- entries whose asset differs from the account asset;
- duplicate external correlations inside their namespace;
- posted entries changed after their first journal version;
- projection balances that differ from a journal rebuild;
- orphaned reversal links or reversals whose amount/asset differs from the original;
- negative available balances where the account policy forbids them.

## External boundaries

Double-entry proves internal conservation under the chosen model. It does not prove that a processor settled, a bank received cash, a blockchain finalized, or a customer is legally owed a particular amount. Preserve source evidence and reconcile external systems separately.

## Primary references

- [Modern Treasury: Ledgers](https://www.moderntreasury.com/products/ledgers)
- [Modern Treasury: Accounting for Developers, Part I](https://www.moderntreasury.com/journal/accounting-for-developers-part-i)
- [PostgreSQL exact numeric types](https://www.postgresql.org/docs/current/datatype-numeric.html)
- [Adyen currency codes and minor units](https://docs.adyen.com/development-resources/currency-codes/)
