# ADR-005: TypeScript Zod Connector Microservice and Full-Jitter Exponential Backoff

## Status
Accepted

## Context
Downstream SaaS CRM APIs (such as HubSpot CRM v3) enforce burst rate limits (`100` requests per `10` seconds) and reject entire batch requests when a single record violates property schema constraints. Naive fixed-interval retries across concurrent workers trigger Thundering Herd stampedes and duplicate non-idempotent writes.

## Decision
We isolate SaaS API delivery inside a strongly typed TypeScript microservice (`connectors-ts/`) enforcing granular row-level `zod` runtime contracts (`validateBatchRecordsGranular`), timing-safe HMAC-SHA256 webhook verification (`timingSafeEqual`), SHA-256 `Idempotency-Key` deduplication, a continuous `TokenBucketRateLimiter`, and Full-Jitter Exponential Backoff (`random() * min(maxDelay, base * 2^attempt)`) strictly for transient `HTTP 429/502/503/504` responses.

## Consequences
Transient CRM rate-limit spikes (`HTTP 429`) are absorbed automatically without Thundering Herd collisions or duplicate contact creation, while permanent `4xx` schema errors fail fast into the Dead-Letter Queue.

