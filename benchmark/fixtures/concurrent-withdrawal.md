# Withdrawal transaction change

Review this proposed production change.

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

The database uses PostgreSQL `READ COMMITTED`. A wallet starts with `1,000` available units and two workers concurrently request withdrawals of `700` and `600`.
