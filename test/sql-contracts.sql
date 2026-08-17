\set ON_ERROR_STOP on

insert into ledger_accounts (id, tenant_id, ledger_id, code, asset, owner_type)
values
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'cash', 'USD', 'PLATFORM'),
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'payable', 'USD', 'MERCHANT');

insert into ledger_transactions (
  id,
  tenant_id,
  ledger_id,
  operation_type,
  operation_key,
  posting_template,
  posting_template_version,
  effective_at
) values
  (
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'SETTLEMENT',
    'settlement-balanced',
    'settlement-v1',
    1,
    now()
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'SETTLEMENT',
    'settlement-unbalanced',
    'settlement-v1',
    1,
    now()
  );

insert into ledger_entries (
  id,
  tenant_id,
  ledger_id,
  transaction_id,
  account_id,
  asset,
  direction,
  amount_atomic
) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'USD', 'DEBIT', 1000),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'USD', 'CREDIT', 1000),
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'USD', 'DEBIT', 1000),
  ('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'USD', 'CREDIT', 900);

select post_ledger_transaction(
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001'
);

do $contract_test$
begin
  begin
    perform post_ledger_transaction(
      '30000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001'
    );
    raise exception 'unbalanced transaction unexpectedly posted';
  exception
    when raise_exception then
      if sqlerrm <> 'ledger transaction is not balanced per asset' then
        raise;
      end if;
  end;

  begin
    update ledger_entries
       set amount_atomic = 999
     where id = '40000000-0000-0000-0000-000000000001';
    raise exception 'posted entry unexpectedly mutated';
  exception
    when raise_exception then
      if sqlerrm <> 'posted ledger entries are immutable' then
        raise;
      end if;
  end;

  begin
    insert into payment_operations (
      tenant_id,
      principal_id,
      operation_type,
      idempotency_key,
      request_fingerprint,
      fingerprint_version,
      provider_idempotency_key,
      expires_at,
      tombstone_until
    ) values (
      '10000000-0000-0000-0000-000000000001',
      'merchant-a',
      'REFUND',
      'refund-without-provider-scope',
      'sha256:abc',
      1,
      'provider-key-without-scope',
      now() + interval '1 day',
      now() + interval '30 days'
    );
    raise exception 'provider key without scope unexpectedly stored';
  exception
    when check_violation then null;
  end;
end
$contract_test$;

insert into webhook_inbox (
  provider,
  environment,
  provider_account_id,
  endpoint_id,
  event_id,
  event_type,
  raw_payload,
  parsed_payload,
  payload_digest,
  signature_key_version
) values
  ('provider', 'test', 'acct-a', 'endpoint-1', 'evt-same', 'capture.succeeded', '{}'::bytea, '{}', 'sha256:a', 'key-1'),
  ('provider', 'live', 'acct-a', 'endpoint-1', 'evt-same', 'capture.succeeded', '{}'::bytea, '{}', 'sha256:a', 'key-1'),
  ('provider', 'live', 'acct-b', 'endpoint-1', 'evt-same', 'capture.succeeded', '{}'::bytea, '{}', 'sha256:a', 'key-1');

do $contract_assertions$
begin
  if (select count(*) from ledger_transactions where status = 'POSTED') <> 1 then
    raise exception 'expected exactly one posted transaction';
  end if;
  if (select status from ledger_transactions where operation_key = 'settlement-unbalanced') <> 'PENDING' then
    raise exception 'unbalanced transaction did not remain pending';
  end if;
  if (select count(*) from payment_operations) <> 0 then
    raise exception 'invalid provider operation was retained';
  end if;
  if (select count(*) from webhook_inbox where event_id = 'evt-same') <> 3 then
    raise exception 'webhook identity was not namespaced by environment and account';
  end if;
end
$contract_assertions$;
