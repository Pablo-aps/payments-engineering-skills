-- Adapt before production use. This template demonstrates boundaries and
-- constraints; the posting function is the only supported path to POSTED.

create type ledger_transaction_status as enum ('PENDING', 'POSTED');
create type ledger_entry_direction as enum ('DEBIT', 'CREDIT');

create table ledger_accounts (
  id uuid primary key,
  tenant_id uuid not null,
  code text not null,
  asset text not null,
  owner_type text not null,
  owner_id text,
  created_at timestamptz not null default now(),
  unique (tenant_id, code, asset)
);

create table ledger_transactions (
  id uuid primary key,
  tenant_id uuid not null,
  operation_type text not null,
  operation_key text not null,
  status ledger_transaction_status not null default 'PENDING',
  reverses_transaction_id uuid references ledger_transactions (id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  posted_at timestamptz,
  unique (tenant_id, operation_type, operation_key),
  check ((status = 'POSTED') = (posted_at is not null))
);

create table ledger_entries (
  id uuid primary key,
  transaction_id uuid not null references ledger_transactions (id),
  account_id uuid not null references ledger_accounts (id),
  asset text not null,
  direction ledger_entry_direction not null,
  amount_atomic numeric(38, 0) not null check (amount_atomic > 0),
  created_at timestamptz not null default now()
);

create index ledger_entries_transaction_idx on ledger_entries (transaction_id);
create index ledger_entries_account_idx on ledger_entries (account_id, created_at, id);

-- Cross-row invariants cannot be enforced with an ordinary CHECK constraint.
-- A production posting function or deferred constraint trigger must, in one
-- database transaction:
--   1. lock the ledger_transactions row;
--   2. reject any transaction not in PENDING;
--   3. verify every entry asset equals its account asset and tenant;
--   4. verify SUM(debits) = SUM(credits), grouped by asset;
--   5. verify at least two entries exist;
--   6. set status = POSTED and posted_at = now();
--   7. make posted financial rows immutable through permissions or triggers.
-- A reversal is another POSTED transaction linked through
-- reverses_transaction_id. The original transaction remains POSTED.

-- Example independent invariant query. A healthy result set is empty.
select
  e.transaction_id,
  e.asset,
  sum(case e.direction when 'DEBIT' then e.amount_atomic else -e.amount_atomic end) as imbalance
from ledger_entries e
join ledger_transactions t on t.id = e.transaction_id
where t.status = 'POSTED'
group by e.transaction_id, e.asset
having sum(case e.direction when 'DEBIT' then e.amount_atomic else -e.amount_atomic end) <> 0;
