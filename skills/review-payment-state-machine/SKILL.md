---
name: review-payment-state-machine
description: Design or review payment lifecycle models and transition logic for authorizations, captures, asynchronous payments, settlement, refunds, reversals, disputes, and fulfillment. Use when payment statuses are conflated, provider callbacks arrive late or out of order, partial operations are possible, retries create multiple attempts, or order fulfillment depends on payment evidence.
---

# Review Payment State Machine

Model payment behavior as related state machines with explicit evidence and transition guards. Prevent a single overloaded `payment_status` from deciding accounting, settlement, and fulfillment.

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

### 3. Build a guarded transition table

Use [assets/payment-state-machine.yaml](assets/payment-state-machine.yaml) as a starting contract. Include idempotency key, source event, observed time, effective provider time, prior state, next state, and transition reason.

Make transitions monotonic where the domain allows. Define explicit compensating transitions for void, reversal, refund, and chargeback. Route invalid or stale transitions to an audit/reconciliation path instead of silently overwriting state.

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
- indeterminate provider outcome.

## Required output

Return entity boundaries, state definitions, a transition table, command guards, evidence requirements, fulfillment rules, ledger-event mapping, invalid-transition behavior, and tests for happy, partial, delayed, and reversed flows.

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
- claim universal finality without naming the rail and evidence.
