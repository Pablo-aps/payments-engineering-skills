---
name: build-reliable-payment-webhooks
description: Design, implement, debug, or review secure and durable payment-provider webhook ingestion. Use for raw-body signature verification, replay and secret rotation, account/environment scoping, same-ID and semantic duplicates, out-of-order events, snapshot versus thin events, durable inbox and queue gaps, retry storms, poison events, schema versioning, or idempotent financial and fulfillment effects.
---

# Build Reliable Payment Webhooks

Treat webhooks as untrusted, at-least-once, potentially reordered facts delivered over an unreliable network. Authenticate, persist, acknowledge, and process them as separate stages.

## Run the hazard pass first

Read [references/hazard-catalog.json](references/hazard-catalog.json). Build a matrix with:

```text
hazard_id | applicable | concrete evidence | prevention | detection | recovery | test
```

Mark a hazard not applicable only with provider- and endpoint-specific evidence. Do not approve an endpoint while an applicable critical hazard lacks a preventive control, detection signal, recovery owner, and failure test.

## Workflow

### 1. Define the delivery contract

Record the provider's:

- signature algorithm and exact signed bytes;
- timestamp and replay-tolerance behavior;
- unique event and object identifiers;
- retry schedule and acknowledgement deadline;
- ordering guarantees or lack of them;
- API/event version behavior;
- redelivery and manual replay mechanisms;
- environment, app, provider account, connected-account, or organization context;
- whether events are point-in-time snapshots, thin notifications, or mutable resource pointers;
- whether separate event IDs can represent the same semantic transition.

Do not generalize one provider's guarantees to another.

### 2. Verify before parsing or side effects

Read and preserve the exact raw request bytes. Verify the signature, timestamp tolerance, and endpoint secret before parsing the payload or changing state. Keep secret rotation explicit and bounded.

Read [references/security-boundary.md](references/security-boundary.md) before implementing the HTTP route.

### 3. Persist an inbox record

Within a short database transaction:

1. validate the minimal envelope;
2. insert the immutable event into an inbox using a uniqueness constraint;
3. record verification metadata and payload digest;
4. enqueue or mark it ready for asynchronous processing;
5. return the provider's expected success response.

Use [assets/postgres-webhook-inbox.sql](assets/postgres-webhook-inbox.sql) as a starting point.

Namespace identity with provider, environment, account/context, endpoint, and event ID. When an existing identity arrives again, compare its raw payload digest. Quarantine a digest mismatch; it is not an ordinary duplicate.

Do not perform slow fulfillment, email, transfers, or broad domain workflows before acknowledgement.

### 4. Process idempotently

Make the worker claim events with explicit concurrency control. Apply provider facts to an internal state model through guarded transitions. Make each downstream effect independently idempotent.

Read [references/processing-model.md](references/processing-model.md) for duplicate, ordering, retry, and poison-event handling.

When order matters, compare provider sequence/version information or retrieve current provider state. Do not depend on arrival order. Ignore stale transitions only when the monotonic rule is explicit; otherwise send them to reconciliation.

Choose snapshot versus current-resource semantics per effect. Fetch current provider state for a current-state decision; preserve the immutable event/change data when the historical transition is the required evidence.

Treat queue publication as a wake-up, not the only record of work. Sweep durable ready rows so an inbox commit followed by a queue failure cannot strand an accepted event.

### 5. Preserve evidence

Store:

- provider and endpoint identity;
- event ID, object ID, type, and provider-created time;
- receipt time;
- payload digest and safely retained payload;
- signature verification result and key version;
- API/event version;
- processing attempts, outcome, and last error;
- correlation IDs to payment, order, ledger, and reconciliation records.

Redact secrets, cardholder data, tokens, and unnecessary personal data from logs and error reporting.

### 6. Test hostile delivery

Cover:

- invalid and expired signatures;
- parsed or mutated body before verification;
- simultaneous duplicate deliveries;
- distinct event IDs describing the same object transition;
- newest event arriving first;
- provider retry during a long handler;
- worker crash after the side effect but before marking success;
- permanently malformed or unsupported events;
- event schema version changes;
- manual replay after the original event was processed;
- the same event identity with a different validly signed payload;
- separate event IDs for one capture or refund;
- identical IDs under two provider accounts or test/live environments;
- object state changing between snapshot creation and worker execution;
- inbox commit followed by failed queue publication;
- overlapping automatic retry and manual replay of a poison event;
- secret rotation with deliveries signed by both active key versions.

## Required output

Return the HTTP boundary, signature logic, identity namespace, inbox and delivery-attempt schema, acknowledgement behavior, worker state machine, delivery and semantic deduplication strategies, ordering/snapshot policy, poison-event path, replay/backpressure controls, observability fields, completed hazard matrix, and executable failure tests.

## Review rules

Reject or flag designs that:

- verify a reconstructed JSON body instead of raw bytes;
- acknowledge before durable acceptance when loss is unacceptable;
- perform financial or fulfillment effects directly in the HTTP route;
- use cache-only deduplication;
- assume events arrive once or in order;
- use only object status without guarding stale updates;
- log webhook secrets or full sensitive payloads;
- retry every error forever without a quarantine path;
- deduplicate only by event ID when the provider can emit distinct events for one semantic fact;
- omit provider account/context or environment from identity and authorization;
- treat a conflicting payload digest as a harmless duplicate;
- rely on queue depth without monitoring durable inbox age;
- use snapshot data and latest resource state interchangeably.
