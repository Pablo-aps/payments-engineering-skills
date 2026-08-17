# Concurrent Withdrawal

## Scenario

Two workers read the same wallet balance before either writes its debit.

## Unsafe implementation

```ts
export async function withdraw(walletId: string, amountAtomic: bigint) {
  return db.transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { id: walletId } });
    if (!wallet || wallet.availableAtomic < amountAtomic) {
      throw new Error("insufficient funds");
    }

    await tx.wallet.update({
      where: { id: walletId },
      data: { availableAtomic: wallet.availableAtomic - amountAtomic },
    });
    await tx.withdrawal.create({ data: { walletId, amountAtomic } });
  });
}
```

Starting balance: `1,000`. Concurrent withdrawals: `700` and `600`.

## Failure mechanism

Under ordinary read-committed behavior both transactions can approve against `1,000`. The final balance update can hide one debit while two withdrawals leave the system, or the balance can become negative depending on the write expression.

## Review with the skill

Codex:

```text
Use $design-payment-ledger to review examples/concurrent-withdrawal.md.
```

Claude Code:

```text
/design-payment-ledger Review examples/concurrent-withdrawal.md.
```

## Expected review signals

- Make the debit decision and journal posting one atomic operation.
- Use an explicit row lock, serializable transaction with whole-transaction retry, or an atomic conditional balance guard.
- Record a balanced, immutable journal entry rather than treating the mutable balance as financial history.
- Keep the logical withdrawal idempotent across transaction retries.
- Run both withdrawals concurrently and require exactly one post, one rejection, and an ending available balance of `300`.

## Primary evidence

PostgreSQL documents the anomalies permitted by weaker isolation and requires applications to retry the complete transaction after serialization failure: [Transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html).

Relevant hazards: `LED-002`, `LED-008`.
