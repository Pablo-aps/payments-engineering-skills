create type payment_operation_state as enum (
  'STARTED',
  'SUCCEEDED',
  'FAILED_FINAL',
  'INDETERMINATE'
);

create table payment_operations (
  tenant_id uuid not null,
  operation_type text not null,
  idempotency_key text not null,
  request_fingerprint text not null,
  fingerprint_version integer not null,
  state payment_operation_state not null default 'STARTED',
  provider text,
  provider_idempotency_key text,
  provider_request_id text,
  provider_object_id text,
  response_status integer,
  response_body jsonb,
  final_error_code text,
  attempt integer not null default 1 check (attempt > 0),
  lease_token uuid,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (tenant_id, operation_type, idempotency_key),
  check (expires_at > created_at),
  check (
    state <> 'SUCCEEDED'
    or response_status is not null
  ),
  check (
    state <> 'FAILED_FINAL'
    or final_error_code is not null
  )
);

create index payment_operations_recovery_idx
  on payment_operations (state, updated_at)
  where state in ('STARTED', 'INDETERMINATE');

-- Claim with INSERT ... ON CONFLICT DO NOTHING, then read the existing row.
-- Compare request_fingerprint before replaying any stored outcome.
-- Never hold this database transaction open across the provider network call.
-- Guard every update with the expected prior state and, when leases are used,
-- the current lease_token or monotonically increasing attempt number.
