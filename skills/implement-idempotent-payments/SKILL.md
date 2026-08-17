---
name: implement-idempotent-payments
description: Design, implement, debug, or review idempotency for payment creation, authorization, capture, refund, payout, transfer, and other financial mutations. Use for client or queue retries, lost responses, cached provider errors, ambiguous timeouts, concurrent callers, lease takeover, retention expiry, regional failover, cross-credential replay risk, eventually consistent inquiry, or duplicate downstream effects.
---

# Implement Idempotent Payments

Make one logical financial mutation produce at most one intended effect under client retries, concurrent requests, worker redelivery, process crashes, and ambiguous provider outcomes.

## Run the hazard pass first

Read [references/hazard-catalog.json](references/hazard-catalog.json). Build a matrix with:

```text
hazard_id | applicable | concrete evidence | prevention | detection | recovery | test
```

Mark a hazard not applicable only with a provider-, operation-, or code-specific reason. Do not approve an implementation while an applicable critical hazard lacks a preventive control, detection signal, recovery owner, and failure test.

## Workflow

### 1. Define the logical operation

Identify the business operation that must be deduplicated. Do not equate an HTTP attempt with a payment intent.

Define:

- operation type;
- tenant, merchant, wallet, or account scope;
- caller-supplied or server-derived idempotency key;
- canonical request fields that define intent;
- retention period based on the longest retry and redelivery window;
- whether the same business object may have multiple legitimate attempts;
- authentication principal and authorization checks required when replaying a stored response;
- provider account, region, and API generation that determine downstream key scope.

Read [references/idempotency-model.md](references/idempotency-model.md) before choosing states and uniqueness constraints.

### 2. Canonicalize and fingerprint intent

Build a deterministic fingerprint from the semantic mutation fields. Exclude transport noise such as trace IDs and timestamps unless they change the financial intent. Include amount, asset, destination, operation, and business object where applicable.

If a key is reused with a different fingerprint, reject it as a conflict. Never replay the old success for a different amount or recipient.

Version the canonicalizer. Preserve the original fingerprint version so a deployment that changes defaults, decimal encoding, or optional fields cannot reinterpret an old key.

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

Model provider-specific replay semantics. Some providers cache server errors, some do not store concurrent conflicts, some return the latest resource state, and some scope keys regionally. Never generalize one provider's behavior.

Read [references/retry-and-recovery.md](references/retry-and-recovery.md) for the retry decision matrix.

### 5. Align local and downstream idempotency

Persist the downstream provider request ID, provider idempotency key, and returned object ID. Reuse the same downstream key while resolving the same logical operation. Local idempotency remains necessary even if a provider supports idempotency because local side effects and scope may differ.

Keep a business-operation tombstone after active response retention when any client, queue, disaster replay, or manual tool can still redeliver. Provider expiry is not permission to recreate an unresolved operation.

### 6. Return deterministic responses

Define how callers observe:

- a completed replay;
- a key conflict;
- an operation still in progress;
- an indeterminate outcome;
- a retryable pre-execution validation or infrastructure failure.

Avoid holding database locks during long network calls. Prefer a durable claim, external call, then a guarded state transition. Use a lease only if takeover semantics are explicit and safe.

Fence every lease takeover with a monotonic token. A worker that resumes after lease expiry must be unable to overwrite a newer result or repeat an effect.

Re-authorize the caller before replaying retained response data. Possession of a guessed or leaked key must not grant access to another credential's payment result.

### 7. Close result-publication gaps

Commit the terminal result and its outbox event atomically. Treat relays and consumers as at-least-once and idempotent. Reconcile terminal operations without outbox records and outbox records without downstream acknowledgement.

### 8. Test the races

Test at least:

- two concurrent requests with the same key and fingerprint;
- the same key with a different amount;
- crash immediately after the provider accepts the request;
- provider timeout with later success;
- crash after local success is stored but before the response is sent;
- redelivery after retention expiry;
- provider retry with the same downstream key;
- worker and API caller racing on the same business operation;
- provider replay of a cached `500` while an event later confirms success;
- expiry locally and downstream followed by a disaster replay;
- active-active or failover calls to provider regions with separate key scopes;
- a stale worker resuming after fenced takeover;
- a cross-credential replay attempt;
- early inquiry returning not found before the object becomes visible;
- crash at every result/outbox/publish boundary.

## Required output

Return the scope, state machine, schema, transaction boundaries, provider-contract matrix, retention/tombstone policy, retry matrix, API behavior, observability fields, completed hazard matrix, and concurrency tests. Identify every point where the result can become indeterminate.

## Review rules

Reject or flag designs that:

- use only an in-memory cache or distributed lock;
- check for an existing row before inserting without a uniqueness constraint;
- reuse a key while allowing request parameters to change;
- mark network timeouts as failed;
- create a new provider key on every retry of the same logical operation;
- cache all failures without distinguishing pre-execution failures;
- keep records for less time than callers or queues can retry;
- promise exactly-once execution across systems;
- assume idempotency scope crosses provider regions or API generations without documentation;
- let key expiry erase the business operation identity;
- replay sensitive stored responses without checking current authorization;
- use a lease without a fencing token;
- treat an immediate provider not-found as proof that execution never happened.
