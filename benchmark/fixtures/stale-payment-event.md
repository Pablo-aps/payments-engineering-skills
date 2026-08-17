# Checkout retry and event change

Review this proposed production change.

```ts
export async function retryCheckout(order: Order) {
  return provider.paymentIntents.create({
    amount: order.amountAtomic,
    currency: order.currency,
  });
}

export async function applyPaymentEvent(event: PaymentEvent) {
  await orders.update(event.orderId, {
    paymentStatus: event.paymentStatus,
    providerIntentId: event.paymentIntentId,
  });

  if (event.paymentStatus === "succeeded") {
    await fulfillment.release(event.orderId);
  }
}
```

Attempt A times out but later succeeds. Attempt B is created and succeeds first. A stale failure for B arrives after A's late success. Events can be duplicated.
