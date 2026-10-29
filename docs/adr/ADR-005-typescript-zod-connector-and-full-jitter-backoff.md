# ADR-005: TypeScript/Zod CRM Connector, HMAC Security & Full-Jitter Backoff

## Status
Accepted (2026-10-29) — Enforced via `connectors-ts/` & `HttpCRMConnectorClient`

## Context
- Enterprise CRM APIs (such as HubSpot CRM v3 `/crm/v3/objects/contacts/batch/upsert`) enforce strict burst rate limits (`HTTP 429 Too Many Requests`) and require strict payload schema compliance.
- Webhook and batch ingestion endpoints must be protected against unauthorized spoofing, payload memory-exhaustion DoS attacks, and duplicate network retries during transient gateway failures (`HTTP 502/503/504`).

## Decision
We implement a dedicated TypeScript/Node.js microservice (`connectors-ts`) and paired Python HTTP client (`HttpCRMConnectorClient`) with four resilience and security mechanisms:
1. **Runtime Zod Schema Contract (`contracts.ts`):** Validates every incoming batch (`1..100` items) against strict Zod schemas (`HubSpotBatchUpsertRequestSchema`), rejecting malformed JSON with structured `HTTP 422` diagnostics.
2. **Timing-Safe HMAC-SHA256 & 5MB Body Guard (`server.ts`):** Verifies `X-HubSpot-Signature-v3` via `crypto.timingSafeEqual` (enforced unconditionally when `ENFORCE_HMAC=true` or when signature headers are supplied) and aborts payloads exceeding `5MB` with `HTTP 413`.
3. **End-to-End Idempotency & Full-Jitter Exponential Backoff:** Both the Python client and TypeScript `ResilientBatchDispatcher` attach deterministic `Idempotency-Key` (`SHA-256`) headers and retry `HTTP 429/502/503/504` using AWS-style Full-Jitter Exponential Backoff: $sleep = \text{random}(0, \min(cap, base \times 2^{attempt}))$.
- **Rejected Alternatives:**
  - *Fixed-interval retry sleep:* Rejected because synchronized retries cause thundering-herd spikes across concurrent workers.
  - *Unbounded `req.on("data")` buffering in Node.js:* Rejected due to heap-exhaustion DoS risk.

## Consequences
- **Positive:**
  - Survives burst `HTTP 429` rate limits (`X-Simulate-Rate-Limit-429: true`) with zero dropped batches and prevents duplicate contact writes via idempotency keys.
  - Provides a zero-dependency live SSR executive dashboard at `http://localhost:3000`.
- **Negative / Operational Trade-offs:**
  - Operating a polyglot Python + TypeScript stack requires Node.js 20+ in local/CI environments.
  - Requires coordinated `WEBHOOK_HMAC_SECRET` configuration across both services.
