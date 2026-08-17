# Stale Event and Two Successful Attempts

## Scenario

Every checkout retry creates a new provider intent. Incoming events overwrite the order's single status in receipt order.

## Unsafe implementation

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

Attempt A times out but later succeeds. Attempt B is created and succeeds first. A stale failure for B arrives after A's late success.

## Failure mechanism

The order can collect twice, fulfill twice, or finish as `failed` after money was captured. One status cannot represent commercial intent, attempts, captures, fulfillment, and contradictory provider evidence.

## Review with the skill

Codex:

```text
Use $review-payment-state-machine to review examples/stale-payment-event.md.
```

Claude Code:

```text
/review-payment-state-machine Review examples/stale-payment-event.md.
```

## Expected review signals

- Separate payment intent, attempt, capture, and fulfillment entities with stable cardinalities.
- Reuse one provider PaymentIntent for one cart where the provider model supports it, and make creation idempotent.
- Detect two successful attempts and move the commercial intent to an excess-paid or compensation state.
- Preserve stale or contradictory facts without allowing them to downgrade stronger capture evidence.
- Make fulfillment independently idempotent and test both late success and reversed delivery order.

## Primary evidence

Stripe recommends correlating one PaymentIntent with one cart or session, reusing it when checkout resumes, and applying an idempotency key to prevent duplicate PaymentIntents: [Payment Intents](https://docs.stripe.com/payments/payment-intents#best-practices).

Relevant hazards: `STM-001`, `STM-002`, `STM-004`, `STM-005`.
