# Refund retry change

Review this proposed production change.

```ts
export async function refundPayment(paymentId: string, amount: number) {
  try {
    return await provider.refunds.create(
      { paymentId, amount },
      { idempotencyKey: crypto.randomUUID() },
    );
  } catch (error) {
    if (isTimeout(error) || isServerError(error)) {
      return provider.refunds.create(
        { paymentId, amount },
        { idempotencyKey: crypto.randomUUID() },
      );
    }
    throw error;
  }
}
```

The provider request can finish after the client deadline. Provider `500` responses can also be returned after request processing has started. The service currently has no durable refund-operation record.
