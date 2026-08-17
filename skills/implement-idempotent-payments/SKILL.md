---
name: implement-idempotent-payments
description: Design, implement, or review idempotency for payment creation, authorization, capture, refund, payout, transfer, and other financial mutations. Use when requests can be retried, responses can be lost, providers can time out, duplicate operations occur, or concurrent callers might submit the same logical payment action.
---

# Implement Idempotent Payments

Make one logical financial mutation produce at most one intended effect under client retries, concurrent requests, worker redelivery, process crashes, and ambiguous provider outcomes.

## Workflow

### 1. Define the logical operation

Identify the business operation that must be deduplicated. Do not equate an HTTP attempt with a payment intent.

Define:

- operation type;
- tenant, merchant, wallet, or account scope;
- caller-supplied or server-derived idempotency key;
- canonical request fields that define intent;
- retention period based on the longest retry and redelivery window;
- whether the same business object may have multiple legitimate attempts.

Read [references/idempotency-model.md](references/idempotency-model.md) before choosing states and uniqueness constraints.

### 2. Canonicalize and fingerprint intent

Build a deterministic fingerprint from the semantic mutation fields. Exclude transport noise such as trace IDs and timestamps unless they change the financial intent. Include amount, asset, destination, operation, and business object where applicable.

If a key is reused with a different fingerprint, reject it as a conflict. Never replay the old success for a different amount or recipient.

### 3. Claim the operation atomically

Use a unique database constraint over the full idempotency scope. Claim the key and record the fingerprint before starting the external mutation. Handle uniqueness conflicts by reading the existing record and applying the explicit replay policy.

Use [assets/postgres-idempotency.sql](assets/postgres-idempotency.sql) as an adaptable schema pattern.

### 4. Model outcomes explicitly

Distinguish:

- `started`: this process or another process owns an in-flight attempt;
- `succeeded`: the result is safe to replay;
- `failed_final`: the operation definitively did not happen and the failure is safe to replay;
- `indeterminate`: the provider may have applied the mutation, so inquiry or reconciliation is required.

Do not convert a timeout into a definitive failure. Do not retry an indeterminate mutation with a new key merely to get a cleaner response.

Read [references/retry-and-recovery.md](references/retry-and-recovery.md) for the retry decision matrix.

### 5. Align local and downstream idempotency

Persist the downstream provider request ID, provider idempotency key, and returned object ID. Reuse the same downstream key while resolving the same logical operation. Local idempotency remains necessary even if a provider supports idempotency because local side effects and scope may differ.

### 6. Return deterministic responses

Define how callers observe:

- a completed replay;
- a key conflict;
- an operation still in progress;
- an indeterminate outcome;
- a retryable pre-execution validation or infrastructure failure.

Avoid holding database locks during long network calls. Prefer a durable claim, external call, then a guarded state transition. Use a lease only if takeover semantics are explicit and safe.

### 7. Test the races

Test at least:

- two concurrent requests with the same key and fingerprint;
- the same key with a different amount;
- crash immediately after the provider accepts the request;
- provider timeout with later success;
- crash after local success is stored but before the response is sent;
- redelivery after retention expiry;
- provider retry with the same downstream key;
- worker and API caller racing on the same business operation.

## Required output

Return the scope, state machine, schema, transaction boundaries, retry matrix, API behavior, observability fields, and concurrency tests. Identify every point where the result can become indeterminate.

## Review rules

Reject or flag designs that:

- use only an in-memory cache or distributed lock;
- check for an existing row before inserting without a uniqueness constraint;
- reuse a key while allowing request parameters to change;
- mark network timeouts as failed;
- create a new provider key on every retry of the same logical operation;
- cache all failures without distinguishing pre-execution failures;
- keep records for less time than callers or queues can retry;
- promise exactly-once execution across systems.
