# Webhook security boundary

A webhook endpoint is an internet-facing authentication boundary. Treat its body and headers as untrusted until the provider-specific verification succeeds.

## Verify the signed representation

Capture the exact request bytes before any JSON parser, middleware, character conversion, whitespace normalization, or field reordering. Provider SDKs generally expect these bytes plus a signature header and endpoint secret.

Verification must include:

- the provider's current algorithm and signed-message format;
- a constant-time signature comparison where the SDK does not provide it;
- timestamp tolerance when the scheme includes a signed timestamp;
- the endpoint-specific secret and its active version;
- a bounded request body and header size.

Do not log signatures, endpoint secrets, or full sensitive payloads.

## Replay protection

A valid old signature may still authenticate an unwanted replay. Enforce the provider's timestamp-tolerance guidance, then rely on durable event uniqueness and idempotent processing. Timestamp checks alone cannot prevent a fast duplicate.

Record provider event ID, receipt time, payload digest, verification key version, and the signed timestamp. If a provider has no stable event ID, define and document a conservative digest/correlation strategy; do not pretend it has the same guarantees.

## Secret rotation

Support a short overlap in which the current and previous secrets are accepted. Record which key version verified the request, never the secret. Remove the prior secret after the provider's redelivery and deployment window has elapsed.

Separate secrets per environment and endpoint. A test-mode signature must not authenticate production traffic.

## Network controls

IP allowlists and mutual TLS can add defense in depth when the provider publishes reliable ranges or supports certificates, but they do not replace application-layer signature verification. Proxies must preserve the raw body and required headers.

## Acknowledgement boundary

Return success only after the event is durably accepted when loss would matter. Return an error for failed authentication or unavailable durable storage. Provider-specific status-code behavior varies, so document which responses cause retry and which permanently discard a delivery.

## Primary references

- [Stripe webhook signatures](https://docs.stripe.com/webhooks/signature)
- [Stripe webhook best practices](https://docs.stripe.com/webhooks)
- [Adyen verify HMAC signatures](https://docs.adyen.com/development-resources/webhooks/verify-hmac-signatures/)
- [Adyen webhook handling](https://docs.adyen.com/development-resources/webhooks/)
