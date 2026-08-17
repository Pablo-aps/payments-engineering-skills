create type webhook_processing_state as enum (
  'RECEIVED',
  'PROCESSING',
  'PROCESSED',
  'RETRYABLE',
  'QUARANTINED'
);

create table webhook_inbox (
  provider text not null,
  environment text not null,
  provider_account_id text not null,
  endpoint_id text not null,
  event_id text not null,
  object_id text,
  event_type text not null,
  semantic_key text,
  provider_created_at timestamptz,
  first_received_at timestamptz not null default now(),
  raw_payload bytea not null,
  parsed_payload jsonb not null,
  payload_digest text not null,
  signature_key_version text not null,
  event_api_version text,
  state webhook_processing_state not null default 'RECEIVED',
  attempt integer not null default 0 check (attempt >= 0),
  available_at timestamptz not null default now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  processed_at timestamptz,
  outcome text,
  last_error_code text,
  last_error_detail text,
  primary key (provider, environment, provider_account_id, endpoint_id, event_id),
  check ((state = 'PROCESSED') = (processed_at is not null))
);

create table webhook_deliveries (
  delivery_id uuid primary key,
  provider text not null,
  environment text not null,
  provider_account_id text not null,
  endpoint_id text not null,
  event_id text not null,
  received_at timestamptz not null default now(),
  signed_at timestamptz,
  payload_digest text not null,
  raw_payload bytea not null,
  signature_key_version text not null,
  transport_request_id text,
  source text not null check (source in ('AUTOMATIC', 'MANUAL_REPLAY', 'BACKFILL')),
  foreign key (provider, environment, provider_account_id, endpoint_id, event_id)
    references webhook_inbox (
      provider,
      environment,
      provider_account_id,
      endpoint_id,
      event_id
    )
);

create table webhook_effects (
  effect_scope text not null,
  effect_key text not null,
  provider text not null,
  environment text not null,
  provider_account_id text not null,
  endpoint_id text not null,
  event_id text not null,
  effect_type text not null,
  applied_at timestamptz not null default now(),
  primary key (effect_scope, effect_key),
  foreign key (provider, environment, provider_account_id, endpoint_id, event_id)
    references webhook_inbox (
      provider,
      environment,
      provider_account_id,
      endpoint_id,
      event_id
    )
);

create index webhook_inbox_ready_idx
  on webhook_inbox (available_at, first_received_at)
  where state in ('RECEIVED', 'RETRYABLE');

create index webhook_inbox_object_idx
  on webhook_inbox (
    provider,
    environment,
    provider_account_id,
    object_id,
    provider_created_at
  )
  where object_id is not null;

create index webhook_deliveries_event_idx
  on webhook_deliveries (
    provider,
    environment,
    provider_account_id,
    endpoint_id,
    event_id,
    received_at
  );

-- Verify the signature against raw bytes before parsing and inserting payload.
-- During an inbox key conflict, compare payload_digest atomically. Quarantine
-- rather than accept the event when the same identity has a different digest.
-- Insert one webhook_deliveries row for every verified delivery, including
-- duplicates and manual replay. Encrypt raw_payload and apply a bounded
-- retention policy. If retaining it is not permitted, keep the minimal
-- envelope, digest, and protected evidence pointer required by the product's
-- security and audit boundary.
-- Workers can claim ready rows with SELECT ... FOR UPDATE SKIP LOCKED, commit a
-- lease, then process outside the claim transaction. Every downstream effect
-- still needs its own stable idempotency key in webhook_effects. A periodic
-- inbox sweeper must recover rows whose queue wake-up was lost after commit.
