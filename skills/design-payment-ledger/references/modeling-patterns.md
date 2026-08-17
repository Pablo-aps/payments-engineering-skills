# Ledger modeling patterns

Choose patterns from the product's economic boundary. Account names below are illustrative, not accounting advice.

## Account taxonomy

Give every account an owner, asset, purpose, normal balance, and posting policy. Useful classes often include:

- customer or merchant liability;
- platform operating cash or processor receivable;
- payment clearing;
- authorization or withdrawal reserve;
- fee revenue and fee expense;
- refund, dispute, and loss clearing;
- FX position and rounding residual.

Do not put multiple assets in one account. Do not use a customer-visible balance row as the journal.

## Pending and posted layers

There are two common safe approaches:

1. Write pending and posted entries to distinct books or states with explicit promotion rules.
2. Post reservations and releases as ordinary balanced transactions in dedicated reserve accounts.

The first can simplify reporting. The second preserves every balance-affecting decision in an immutable journal. In either design, promotion must not mutate the monetary identity of an existing posted entry.

## Holds and authorizations

Model a hold as a reservation, not as cash settlement. Record its expiry and provider authorization reference. Capture consumes some or all of the reservation; void or expiry releases the remainder. Partial capture must state whether additional captures remain possible.

## Fees

Represent gross amount, fees, and net settlement explicitly. Avoid storing only a net amount because that makes fee reconciliation and revenue classification impossible. When the provider nets fees from settlement, the ledger can still preserve the gross economic components.

## Refunds, reversals, and disputes

- A reversal corrects or unwinds a prior ledger transaction and links to it.
- A refund is a new customer-facing money movement and can be partial or asynchronous.
- A dispute is a separate lifecycle that can withdraw funds, return funds, or create fees long after settlement.

Do not collapse these into a generic negative payment.

## Foreign exchange

An FX conversion contains at least two asset legs plus an explicit rate and rate source. Because balances must balance per asset, route each asset through position or clearing accounts. Record any fee and rounding amount explicitly. Never force different currencies into one arithmetic balance equation.

## Example transaction matrix

| Business event | Debit | Credit | Evidence before posting |
| --- | --- | --- | --- |
| Processor confirms captured receivable | Processor receivable | Merchant/customer liability | Provider object or authenticated event |
| Provider fee recognized | Fee expense or merchant liability | Processor receivable | Provider balance record |
| Customer refund funded | Merchant/customer liability | Refund clearing | Accepted refund operation |
| Provider settles cash | Bank cash | Processor receivable | Settlement report and later bank reconciliation |

The exact classification depends on whether the platform is merchant of record, agent, custodian, or software provider. Keep that decision outside reusable infrastructure and document it.

## Migration pattern

For a system that currently mutates balances:

1. Define the new journal boundary and stable operation keys.
2. Snapshot legacy balances at a named cutoff.
3. Create balanced opening transactions with source evidence.
4. Dual-write only if the failure and reconciliation plan is explicit.
5. Rebuild projections and compare them during a shadow period.
6. Cut reads over independently from writes when possible.
7. Preserve the legacy audit source after cutover.
