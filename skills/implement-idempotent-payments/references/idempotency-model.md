# Idempotency model

Idempotency maps many delivery attempts to one logical mutation and one stable outcome. It is a durable data model, not a request header or short-lived lock.

## Identity and scope

Use a composite namespace such as:

```text
(tenant_id, operation_type, idempotency_key)
```

The scope must prevent unrelated tenants or operations from colliding while ensuring the same logical mutation cannot escape deduplication through another endpoint or worker.

Prefer a caller-generated random key when the caller knows which retries belong together. A server-derived key is appropriate only when the business identity is stable and all legitimate repeated operations can still be distinguished.

## Request fingerprint

Canonicalize the semantic mutation fields and hash the encoded value. The canonical form must define:

- field inclusion and default values;
- object-key ordering;
- numeric representation and currency/asset;
- absent versus null behavior;
- destination and business object identity;
- version of the canonicalization algorithm.

Reject reuse of a key with another fingerprint. A weak hash of only amount and currency is insufficient for transfers or payouts because the destination can change.

## Durable states

| State | Meaning | Caller behavior |
| --- | --- | --- |
| `STARTED` | Claimed; outcome not yet known | Return in-progress or poll reference |
| `SUCCEEDED` | Intended effect confirmed | Replay stored result |
| `FAILED_FINAL` | Confirmed not applied | Replay stable failure or permit a new logical key |
| `INDETERMINATE` | Effect may have happened | Inquire/reconcile; do not blindly recreate |

Keep validation failures that occur before a durable claim separate from accepted mutations. Decide explicitly whether to cache them.

## Concurrency

Make the database unique constraint the final arbiter. An application mutex or distributed lock may reduce contention but cannot replace durable uniqueness.

Do not hold a database transaction open during an external provider request. Persist the claim, call the provider with a stable downstream idempotency key, then update the result using a guarded transition. If abandoned work can be taken over, use leases with a monotonic attempt or fencing token.

## Retention

Retain the idempotency record at least as long as every client, message queue, provider, replay tool, and disaster-recovery process can repeat the request. Expiry changes semantics: a late duplicate can become a new mutation. Document that boundary and archive high-risk operation keys if necessary.

## Primary reference

- [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests)
