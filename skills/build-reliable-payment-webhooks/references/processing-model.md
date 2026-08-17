# Webhook processing model

Separate reception from processing so the public endpoint stays small, deterministic, and recoverable.

## Ingress transaction

After signature verification:

1. Extract the minimum envelope fields.
2. Insert the raw event and digest into a durable inbox.
3. Let a unique key identify duplicate deliveries.
4. Mark the event ready for processing in the same transaction.
5. Acknowledge according to the provider's contract.

An internal queue can wake workers, but it should not be the sole durable evidence unless the queue itself provides the required retention and deduplication guarantees.

## Duplicate dimensions

Deduplicate at more than one layer:

- delivery: the same provider event ID is sent again;
- fact: different event IDs describe the same object transition;
- effect: a fulfillment, ledger posting, email, or transfer is attempted again.

An inbox unique constraint handles the first. Guarded domain transitions handle the second. Stable operation keys at each downstream boundary handle the third.

## Ordering

Do not infer lifecycle order from arrival time. Where a provider offers an object version or monotonic sequence, store and compare it. Otherwise retrieve the current provider object or apply explicit legal transitions. A stale fact should be recorded as ignored or exceptional, not deleted.

The provider-created timestamp alone is often insufficient: clocks, retries, and multiple related objects can make it ambiguous.

## Worker lifecycle

Useful internal states are `RECEIVED`, `PROCESSING`, `PROCESSED`, `RETRYABLE`, and `QUARANTINED`. Claims need a lease or database lock. A crashed worker must leave work recoverable.

Classify failures:

- transient dependency or lock failure: retry with capped exponential backoff and jitter;
- unsupported but valid event: record as ignored by explicit policy or quarantine;
- malformed authenticated event: quarantine for inspection;
- permanent domain conflict: create a reconciliation exception;
- unknown external outcome: mark the downstream operation indeterminate.

Retry limits should lead to a visible quarantine, not silent data loss.

## Observability

Measure acceptance latency, processing latency, duplicate rate, retry rate, oldest unprocessed age, quarantined count, invalid-signature count, and state-transition conflicts. Correlate the provider event, provider object, internal payment, ledger transaction, and downstream effects.

## Safe replay

Manual replay must reuse the original event identity and pass through the same idempotent worker. Record who requested it, why, when, and which code/rule version processed it. A replay tool must not bypass signature history, validation, or domain guards.
