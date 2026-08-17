# Fulfillment and failure

Fulfillment policy is a business risk decision built on payment evidence. It should not be hidden inside a generic status mapping.

## Evidence ladder

Possible evidence becomes stronger at different points:

1. client returned from a payment page;
2. provider accepted a payment command;
3. provider authenticated or authorized the payer;
4. provider confirmed capture or debit;
5. processor balance activity is available;
6. settlement or payout report includes the item;
7. bank cash is reconciled;
8. dispute or reversal windows pass.

These are not universally ordered across every rail, and stronger evidence can still be reversed. Name the rail-specific evidence used by each fulfillment policy.

## Risk-based gates

Examples, subject to the actual business:

- Reversible inventory reservation may begin on authorization.
- Low-cost digital access may begin after authenticated provider confirmation.
- Physical shipment may require capture and fraud review.
- High-value or irreversible delivery may require stronger settlement evidence or manual approval.

Record the chosen policy version on the fulfillment decision so later review can explain it.

## Failure taxonomy

Separate:

- actionable payer state such as authentication required;
- definitive decline for one attempt;
- expired or voided authorization;
- retryable infrastructure error known to occur before execution;
- indeterminate network/provider outcome;
- late failure or reversal after prior success;
- internal processing failure despite confirmed external payment.

A failed attempt does not necessarily fail the commercial payment intent. An indeterminate attempt must block unsafe recreation until inquiry or reconciliation resolves it.

## Compensation

Design explicit actions for:

- authorization void;
- capture reversal;
- partial and full refund;
- fulfillment cancellation;
- inventory release;
- ledger adjustment;
- dispute debit and later dispute win.

Compensation is a new recorded action, not deletion of the original transition.

## Tests

Test decisions separately from transitions. Given the same payment state, a digital-product policy and a high-value-shipment policy may correctly choose different fulfillment outcomes. Also test that client redirects and unauthenticated callbacks can never satisfy a gate.
