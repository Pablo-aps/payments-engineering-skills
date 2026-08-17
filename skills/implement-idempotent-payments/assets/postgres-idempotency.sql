create type payment_operation_state as enum (
  'STARTED',
  'SUCCEEDED',
  'FAILED_FINAL',
  'INDETERMINATE'
);

create table payment_operations (
  tenant_id uuid not null,
  principal_id text not null,
  operation_type text not null,
  idempotency_key text not null,
  request_fingerprint text not null,
  fingerprint_version integer not null,
  state payment_operation_state not null default 'STARTED',
  provider text,
  provider_account_id text,
  provider_region text,
  provider_api_generation text,
  provider_idempotency_key text,
  provider_request_id text,
  provider_object_id text,
  response_status integer,
  response_body_redacted jsonb,
  final_error_code text,
  attempt integer not null default 1 check (attempt > 0),
  fencing_token bigint not null default 1 check (fencing_token > 0),
  lease_token uuid,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  outcome_checked_at timestamptz,
  expires_at timestamptz not null,
  tombstone_until timestamptz not null,
  primary key (tenant_id, operation_type, idempotency_key),
  check (expires_at > created_at),
  check (tombstone_until >= expires_at),
  check (
    provider_idempotency_key is null
    or (
      provider is not null
      and provider_account_id is not null
      and provider_region is not null
      and provider_api_generation is not null
    )
  ),
  check (
    state <> 'SUCCEEDED'
    or response_status is not null
  ),
  check (
    state <> 'FAILED_FINAL'
    or final_error_code is not null
  )
);

create unique index payment_operations_provider_key_idx
  on payment_operations (
    provider,
    provider_account_id,
    provider_region,
    provider_api_generation,
    provider_idempotency_key
  )
  where provider_idempotency_key is not null;

create index payment_operations_recovery_idx
  on payment_operations (state, updated_at)
  where state in ('STARTED', 'INDETERMINATE');

create table payment_operation_transitions (
  tenant_id uuid not null,
  operation_type text not null,
  idempotency_key text not null,
  transition_sequence bigint not null,
  from_state payment_operation_state,
  to_state payment_operation_state not null,
  fencing_token bigint not null,
  evidence_type text not null,
  evidence_id text,
  occurred_at timestamptz not null default now(),
  primary key (tenant_id, operation_type, idempotency_key, transition_sequence),
  foreign key (tenant_id, operation_type, idempotency_key)
    references payment_operations (tenant_id, operation_type, idempotency_key)
);

create table payment_operation_outbox (
  event_id uuid primary key,
  tenant_id uuid not null,
  operation_type text not null,
  idempotency_key text not null,
  event_type text not null,
  payload_redacted jsonb not null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  foreign key (tenant_id, operation_type, idempotency_key)
    references payment_operations (tenant_id, operation_type, idempotency_key),
  unique (tenant_id, operation_type, idempotency_key, event_type)
);

create index payment_operation_outbox_unpublished_idx
  on payment_operation_outbox (created_at, event_id)
  where published_at is null;

-- Claim with INSERT ... ON CONFLICT DO NOTHING, then read the existing row.
-- Compare request_fingerprint before replaying any stored outcome.
-- Never hold this database transaction open across the provider network call.
-- Re-authorize principal_id before replaying response_body_redacted.
-- Guard every update and outbox insert with the expected prior state and the
-- current fencing_token. A lease_token without fencing does not stop a stale
-- worker from writing after takeover. Keep the operation or a non-replayable
-- tombstone until tombstone_until; provider key expiry does not erase intent.
