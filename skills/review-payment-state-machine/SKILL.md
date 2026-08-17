---
name: review-payment-state-machine
description: Design, debug, or review payment lifecycle models and transition logic for authorizations, captures, asynchronous methods, settlement, refunds, reversals, disputes, and fulfillment. Use for conflated statuses, multiple or late-success attempts, cumulative amount races, partial/final captures, authorization expiry or reauthorization, incremental authorization, stale facts, pending-refund/dispute races, refund failure, or evidence-based fulfillment.
---

# Review Payment State Machine

Model payment behavior as related state machines with explicit evidence and transition guards. Prevent a single overloaded `payment_status` from deciding accounting, settlement, and fulfillment.

## Run the hazard pass first

Read [references/hazard-catalog.json](references/hazard-catalog.json). Build a matrix with:

```text
hazard_id | applicable | concrete evidence | prevention | detection | recovery | test
```

Mark a hazard not applicable only with rail- and product-specific evidence. Do not approve a lifecycle while an applicable critical hazard lacks a preventive control, detection signal, compensation/recovery owner, and transition test.

## Workflow

### 1. Separate the entities

Model independently where applicable:

- order or commercial intent;
- payment intent;
- payment attempt;
- authentication;
- authorization;
- capture;
- provider settlement and payout;
- refund;
- reversal;
- dispute or chargeback;
- ledger transaction;
- fulfillment.

Link the entities with stable IDs and cardinalities. Support multiple attempts, captures, and refunds instead of assuming one row each.

Read [references/state-modeling.md](references/state-modeling.md) before creating a transition diagram.

### 2. Define states by evidence

For each state, specify:

- entry evidence;
- allowed prior states;
- whether the state is intermediate or terminal for this entity;
- allowed commands;
- timeout or expiry behavior;
- emitted events and ledger effects;
- fulfillment consequence;
- recovery or inquiry path.

Do not define states only as renamed provider strings. Map provider states into internal semantics.

Define amount dimensions independently from status: intended, authorized, capturable, captured, refundable, refunded, disputed, settled, and paid out. A legal state transition is still invalid when cumulative child amounts violate the parent cap.

### 3. Build a guarded transition table

Use [assets/payment-state-machine.yaml](assets/payment-state-machine.yaml) as a starting contract. Include idempotency key, source event, observed time, effective provider time, prior state, next state, and transition reason.

Make transitions monotonic where the domain allows. Define explicit compensating transitions for void, reversal, refund, and chargeback. Route invalid or stale transitions to an audit/reconciliation path instead of silently overwriting state.

Use optimistic versioning or locks for state-plus-amount changes. Model a late success for a canceled, expired, or losing attempt as new evidence requiring compensation; never discard it because the local summary looked terminal.

Treat reauthorization as a new authorization identity linked to the old one. Track amount and expiry separately: an incremental authorization does not imply that the capture deadline moved.

### 4. Define fulfillment gates

Read [references/fulfillment-and-failure.md](references/fulfillment-and-failure.md). Decide which evidence permits delivery for digital goods, physical goods, services, or reversible reservations. Distinguish authorization from captured funds and capture from settlement. Account for asynchronous methods that remain pending for minutes or days.

### 5. Reconcile commands and facts

Treat API commands as requests and provider events/inquiries as observations. A successful HTTP response, a webhook, and a settlement record may describe different lifecycle moments. Persist their correlation without assuming they are interchangeable.

### 6. Test transition hazards

Cover:

- authentication required after initial creation;
- authorization approved but capture declined;
- partial authorization and split tender;
- multiple partial captures;
- capture succeeds after the client times out;
- refund pending, failed, partially completed, and completed;
- dispute after settlement and fulfillment;
- stale failure arriving after newer success;
- duplicate event and command delivery;
- expiration or void of an uncaptured authorization;
- new attempt after a definitive decline;
- indeterminate provider outcome;
- two provider attempts succeeding for one commercial intent;
- concurrent partial captures or refunds that exceed the cumulative cap;
- late capture after local cancellation or a losing-attempt decision;
- reauthorization followed by capture against the old authorization ID;
- incremental authorization without expiry extension;
- a dispute opening while a refund is pending;
- refund moving from pending to failed after customer notification.

## Required output

Return entity boundaries and cardinalities, state definitions, amount-conservation equations, a guarded transition table, command identities, evidence precedence, fulfillment policy version, ledger-event mapping, compensation behavior, completed hazard matrix, and tests for happy, partial, concurrent, delayed, duplicated, and reversed flows.

## Review rules

Reject or flag designs that:

- store all lifecycle dimensions in one status;
- treat authorization as cash settlement;
- fulfill from a client-side redirect alone;
- model `failed` as permanently terminal when the provider can confirm late;
- overwrite newer state with stale delivery;
- exclude partial captures, refunds, or multiple attempts;
- mutate state without recording source and prior value;
- retry indeterminate mutations blindly;
- claim universal finality without naming the rail and evidence;
- enforce state guards without cumulative amount guards;
- assume one successful attempt per order without detecting excess captured totals;
- overwrite an old authorization when reauthorization returns a new identity;
- assume an amount increment extends authorization expiry;
- treat refund request acceptance as final customer reimbursement.
