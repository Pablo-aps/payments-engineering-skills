create type webhook_processing_state as enum (
  'RECEIVED',
  'PROCESSING',
  'PROCESSED',
  'RETRYABLE',
  'QUARANTINED'
);

create table webhook_inbox (
  provider text not null,
  endpoint_id text not null,
  event_id text not null,
  object_id text,
  event_type text not null,
  provider_created_at timestamptz,
  received_at timestamptz not null default now(),
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
  primary key (provider, endpoint_id, event_id),
  check ((state = 'PROCESSED') = (processed_at is not null))
);

create index webhook_inbox_ready_idx
  on webhook_inbox (available_at, received_at)
  where state in ('RECEIVED', 'RETRYABLE');

create index webhook_inbox_object_idx
  on webhook_inbox (provider, object_id, provider_created_at)
  where object_id is not null;

-- Verify the signature against raw bytes before parsing and inserting payload.
-- Encrypt raw_payload and apply a bounded retention policy. If retaining it is
-- not permitted, keep the minimal envelope, digest, and protected evidence
-- pointer required by the product's security and audit boundary.
-- Workers can claim ready rows with SELECT ... FOR UPDATE SKIP LOCKED, commit a
-- lease, then process outside the claim transaction. Every downstream effect
-- still needs its own stable idempotency key.
