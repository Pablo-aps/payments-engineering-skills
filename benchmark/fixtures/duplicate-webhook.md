# Webhook handler change

Review this proposed production change.

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

The provider retries deliveries, does not guarantee delivery order, and can emit two different event IDs for the same object transition. Multiple handler instances run concurrently.
