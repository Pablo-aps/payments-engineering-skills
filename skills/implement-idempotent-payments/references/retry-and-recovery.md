# Retry and recovery

Classify failures by whether the mutation was definitely not attempted, definitely applied, or ambiguous.

## Decision matrix

| Observation | Interpretation | Safe next action |
| --- | --- | --- |
| Local validation rejected before claim | Not attempted | Fix input; new or same key per API contract |
| Provider explicitly declined before any effect | Definitive failure | Store final failure; a new business attempt needs a new key |
| Provider confirms success | Applied | Store and replay success |
| Connection failed before bytes were sent | Usually not attempted, but prove transport semantics | Retry same logical operation and downstream key |
| Timeout after request may have reached provider | Indeterminate | Query by provider key/reference; reconcile |
| Process crashed after provider response | Local result unknown | Query using persisted downstream correlation |
| Local commit failed after provider success | Applied externally, missing locally | Recover from provider inquiry/event; do not recreate |

Never turn an unknown into `FAILED_FINAL` to simplify the API.

## Recovery loop

1. Persist the local operation and stable downstream key.
2. Attempt the mutation once.
3. On ambiguity, move to `INDETERMINATE` with the last transport evidence.
4. Query the provider by idempotency key, request ID, or object reference.
5. Accept authenticated events as additional evidence, not as proof of report completeness.
6. Resolve to success or final failure only with authoritative evidence.
7. Age unresolved cases into an exception queue with owner and service-level objective.

Use exponential backoff with jitter for inquiry calls, cap the rate, and distinguish retryable infrastructure failures from permanent lookup errors.

## Response replay

Store only the response fields needed for deterministic client behavior. Avoid persisting secrets or volatile headers. A replay response should make the original resource identity clear and may expose a replay indicator without changing the business result.

## Observability

Track operation key scope, fingerprint version, attempt count, downstream key, provider request/object IDs, state transitions, age in indeterminate state, recovery source, and final resolution. Never put raw card or wallet credentials into the idempotency record.

## Provider caveat

Provider idempotency windows and error-caching behavior vary. Confirm the current contract for each operation. Local retention and recovery must remain correct even if the provider forgets a key earlier.
