-- Adapt before production use. This template demonstrates boundaries and
-- constraints; the posting function is the only supported path to POSTED.

create type ledger_transaction_status as enum ('PENDING', 'POSTED');
create type ledger_entry_direction as enum ('DEBIT', 'CREDIT');

create table ledger_accounts (
  id uuid primary key,
  tenant_id uuid not null,
  ledger_id uuid not null,
  code text not null,
  asset text not null,
  owner_type text not null,
  owner_id text,
  created_at timestamptz not null default now(),
  unique (id, tenant_id, ledger_id, asset),
  unique (tenant_id, ledger_id, code, asset)
);

create table ledger_transactions (
  id uuid primary key,
  tenant_id uuid not null,
  ledger_id uuid not null,
  operation_type text not null,
  operation_key text not null,
  posting_template text not null,
  posting_template_version integer not null check (posting_template_version > 0),
  status ledger_transaction_status not null default 'PENDING',
  corrects_transaction_id uuid,
  correction_kind text check (correction_kind in ('FULL_REVERSAL', 'PARTIAL_REVERSAL', 'ADJUSTMENT')),
  correction_reason text,
  metadata jsonb not null default '{}'::jsonb,
  effective_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  posted_at timestamptz,
  unique (id, tenant_id, ledger_id),
  unique (tenant_id, ledger_id, operation_type, operation_key),
  foreign key (corrects_transaction_id, tenant_id, ledger_id)
    references ledger_transactions (id, tenant_id, ledger_id),
  check (corrects_transaction_id is null or corrects_transaction_id <> id),
  check (
    (corrects_transaction_id is null and correction_kind is null and correction_reason is null)
    or
    (corrects_transaction_id is not null and correction_kind is not null and correction_reason is not null)
  ),
  check ((status = 'POSTED') = (posted_at is not null))
);

create table ledger_entries (
  id uuid primary key,
  tenant_id uuid not null,
  ledger_id uuid not null,
  transaction_id uuid not null,
  account_id uuid not null,
  asset text not null,
  direction ledger_entry_direction not null,
  amount_atomic numeric(38, 0) not null check (amount_atomic > 0),
  recorded_at timestamptz not null default now(),
  foreign key (transaction_id, tenant_id, ledger_id)
    references ledger_transactions (id, tenant_id, ledger_id),
  foreign key (account_id, tenant_id, ledger_id, asset)
    references ledger_accounts (id, tenant_id, ledger_id, asset)
);

create index ledger_entries_transaction_idx on ledger_entries (transaction_id);
create index ledger_entries_account_idx on ledger_entries (account_id, recorded_at, id);

create or replace function post_ledger_transaction(
  p_transaction_id uuid,
  p_tenant_id uuid,
  p_ledger_id uuid
) returns void
language plpgsql
as $$
declare
  current_status ledger_transaction_status;
begin
  select status
    into current_status
    from ledger_transactions
   where id = p_transaction_id
     and tenant_id = p_tenant_id
     and ledger_id = p_ledger_id
   for update;

  if not found then
    raise exception 'ledger transaction not found';
  end if;

  if current_status <> 'PENDING' then
    raise exception 'ledger transaction is not pending';
  end if;

  if (select count(*) from ledger_entries where transaction_id = p_transaction_id) < 2 then
    raise exception 'ledger transaction requires at least two entries';
  end if;

  if exists (
    select 1
      from ledger_entries
     where transaction_id = p_transaction_id
     group by asset
    having sum(
      case direction
        when 'DEBIT' then amount_atomic
        else -amount_atomic
      end
    ) <> 0
  ) then
    raise exception 'ledger transaction is not balanced per asset';
  end if;

  update ledger_transactions
     set status = 'POSTED', posted_at = now()
   where id = p_transaction_id
     and tenant_id = p_tenant_id
     and ledger_id = p_ledger_id;
end;
$$;

create or replace function protect_posted_ledger_entries()
returns trigger
language plpgsql
as $$
declare
  target_transaction_id uuid;
  target_status ledger_transaction_status;
begin
  target_transaction_id := case when tg_op = 'DELETE' then old.transaction_id else new.transaction_id end;
  select status into target_status
    from ledger_transactions
   where id = target_transaction_id;

  if target_status = 'POSTED' then
    raise exception 'posted ledger entries are immutable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger ledger_entries_immutable_after_posting
before insert or update or delete on ledger_entries
for each row execute function protect_posted_ledger_entries();

create or replace function protect_posted_ledger_transaction()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and old.status = 'POSTED' then
    raise exception 'posted ledger transactions are immutable';
  end if;

  if tg_op = 'UPDATE' and old.status = 'POSTED' and (
    new.tenant_id,
    new.ledger_id,
    new.operation_type,
    new.operation_key,
    new.posting_template,
    new.posting_template_version,
    new.status,
    new.corrects_transaction_id,
    new.correction_kind,
    new.correction_reason,
    new.effective_at,
    new.posted_at
  ) is distinct from (
    old.tenant_id,
    old.ledger_id,
    old.operation_type,
    old.operation_key,
    old.posting_template,
    old.posting_template_version,
    old.status,
    old.corrects_transaction_id,
    old.correction_kind,
    old.correction_reason,
    old.effective_at,
    old.posted_at
  ) then
    raise exception 'posted ledger transaction financial fields are immutable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger ledger_transactions_immutable_after_posting
before update or delete on ledger_transactions
for each row execute function protect_posted_ledger_transaction();

-- Cross-row balancing cannot be enforced with an ordinary CHECK constraint.
-- Keep direct table writes away from application roles and expose a reviewed
-- create/post API. Adapt the posting function for posting-template account
-- policies, cumulative correction limits, balance locks, and authorization.
-- A reversal or adjustment is another POSTED transaction linked through
-- corrects_transaction_id. The original transaction remains POSTED.

-- Example independent invariant query. A healthy result set is empty.
select
  e.transaction_id,
  e.tenant_id,
  e.ledger_id,
  e.asset,
  sum(case e.direction when 'DEBIT' then e.amount_atomic else -e.amount_atomic end) as imbalance
from ledger_entries e
join ledger_transactions t on t.id = e.transaction_id
where t.status = 'POSTED'
group by e.transaction_id, e.tenant_id, e.ledger_id, e.asset
having sum(case e.direction when 'DEBIT' then e.amount_atomic else -e.amount_atomic end) <> 0;
