# Ambiguous Refund Timeout

## Scenario

A refund request times out after the provider may have accepted it. The retry path creates a new provider idempotency key because the first response was never stored.

## Unsafe implementation

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

## Failure mechanism

The missing response does not prove that execution failed. A fresh key describes a second provider operation, so both refunds can succeed. A provider can also cache a server error while later evidence confirms that a side effect occurred.

## Review with the skill

Codex:

```text
Use $implement-idempotent-payments to review examples/ambiguous-refund-timeout.md.
```

Claude Code:

```text
/implement-idempotent-payments Review examples/ambiguous-refund-timeout.md.
```

## Expected review signals

- Persist one logical refund operation and its provider key before the network call.
- Treat a timeout or provider `500` as `INDETERMINATE`, not final failure.
- Reuse the same provider key while resolving the same intent; never switch keys until non-execution is proven.
- Recover through provider inquiry, later webhook evidence, and reconciliation.
- Test a lost response followed by late provider success and prove the provider refund count remains one.

## Primary evidence

Stripe documents that network failures leave the client uncertain, recommends retrying with the same key, and says a `500` must be treated as indeterminate because user-visible side effects can still occur: [Advanced error handling](https://docs.stripe.com/error-low-level).

Relevant hazards: `IDM-002`, `IDM-003`, `IDM-010`.
