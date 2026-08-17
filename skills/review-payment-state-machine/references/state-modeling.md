# Payment state modeling

Use states to summarize observed evidence about one entity. Use events to preserve what happened and commands to express requested actions.

## Entity boundaries

A robust model often separates:

- `payment_intent`: the commercial amount and acceptable ways to pay;
- `payment_attempt`: one rail/provider attempt;
- `authorization`: permission to capture, with amount and expiry;
- `capture`: a distinct clearing instruction that may be partial;
- `refund`: a new reverse-direction operation with its own outcome;
- `dispute`: an external claim after payment;
- `settlement`: provider balance movement;
- `payout`: aggregation from provider balance to bank;
- `fulfillment`: delivery decision and evidence.

Cardinality matters: one intent can have many attempts, one authorization can have several captures, and one capture can have several refunds.

## State definition template

For each state, specify:

| Field | Question |
| --- | --- |
| Meaning | What evidence does this state summarize? |
| Entry | Which commands or facts can enter it? |
| Exit | Which transitions are legal? |
| Terminality | Terminal for which entity and under which rail? |
| Timeout | What happens when expected evidence never arrives? |
| Side effects | Which ledger or fulfillment action is permitted? |
| Recovery | Can inquiry or reconciliation change the conclusion? |

Avoid universal names such as `COMPLETE` unless their dimension is explicit. `CAPTURED`, `SETTLED`, `PAID_OUT`, and `FULFILLED` answer different questions.

## Transition guards

A transition record should contain prior and next state, source type and ID, observed time, provider-effective time, rule version, actor, and reason. Apply it with optimistic concurrency or a row lock so simultaneous facts cannot overwrite each other.

Make harmless duplicate facts no-ops with recorded evidence. Send illegal, contradictory, or stale facts to an exception path. Do not discard them because they can expose mapping errors or provider corrections.

## Provider mapping

Version the mapping from provider statuses/events into internal facts. Preserve the original provider value. When a provider adds an unknown state, fail visibly into an unsupported-event path rather than mapping it to failure or success by default.

## Primary references

- [Stripe PaymentIntent lifecycle](https://docs.stripe.com/payments/paymentintents/lifecycle)
- [PayPal authorization and capture](https://developer.paypal.com/docs/checkout/standard/customize/authorization/)
- [PayPal refunds](https://developer.paypal.com/docs/api/payments/v2/#captures_refund)
