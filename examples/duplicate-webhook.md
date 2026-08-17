# Duplicate and Reordered Webhook

## Scenario

The handler deduplicates only in process memory, applies provider status in arrival order, and marks an event processed after the financial effect.

## Unsafe implementation

```ts
const processed = new Set<string>();

export async function handleWebhook(event: ProviderEvent) {
  if (processed.has(event.id)) return;

  await payments.update(event.objectId, { status: event.object.status });

  if (event.type === "refund.succeeded") {
    await ledger.postRefund(event.objectId, event.object.amount);
  }

  processed.add(event.id);
}
```

## Failure mechanism

A restart erases the deduplication set. A crash after `postRefund` repeats the financial effect. An older failure can overwrite a newer success. Event-ID deduplication also misses the case where the provider emits two different events for the same object transition.

## Review with the skill

Codex:

```text
Use $build-reliable-payment-webhooks to review examples/duplicate-webhook.md.
```

Claude Code:

```text
/build-reliable-payment-webhooks Review examples/duplicate-webhook.md.
```

## Expected review signals

- Verify the signature against exact raw bytes before parsing.
- Durably accept the delivery before returning success.
- Namespace event identity by provider, environment, account, endpoint, and event ID.
- Give the financial effect its own stable semantic idempotency key.
- Guard state transitions with provider evidence or current-state inquiry, not arrival order.
- Test duplicate IDs, distinct IDs for the same refund, stale delivery, and a crash after the effect.

## Primary evidence

Stripe states that event order is not guaranteed, deliveries can repeat, and separate Event objects can describe the same object and event type: [Receive Stripe events](https://docs.stripe.com/webhooks#event-delivery-behaviors).

Relevant hazards: `WHK-002`, `WHK-004`, `WHK-006`, `WHK-008`.
