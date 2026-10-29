# Runbook 05: TypeScript CRM Connector Microservice, Full-Jitter Backoff, and Live Executive Monitor

## Overview
The `connectors-ts/` microservice implements the outbound SaaS delivery tier and local HubSpot CRM v3 simulation server for DataPulse. It follows Clean Architecture boundaries (`domain`, `application`, `infrastructure`) with strict TypeScript (`strict: true`) and `zod` runtime schema enforcement.

---

## 1. Starting and Verifying the TypeScript Microservice

Run the following commands inside `connectors-ts/`:

```powershell
cd connectors-ts

# 1. Typecheck strict TypeScript contracts
npm run typecheck

# 2. Execute Vitest unit & integration suite
npm test

# 3. Start the live HTTP server & Executive Monitor on port 3000
npm start
```

### Exposed Endpoints (`http://localhost:3000`)
- **`GET /`**: Live No-Code Executive HubSpot CRM & FinOps Web Monitor (dark-slate HTML/CSS dashboard with real-time search filtering).
- **`GET /health`**: Liveness probe returning `{"status": "[OK]", "service": "datapulse-connectors-ts"}`.
- **`GET /api/v1/state`**: Returns current JSON telemetry (`totalSyncedContacts`, `vipBriefCount`, `totalBatchRequests`, `rateLimitRetriesAbsorbed`, `contacts`).
- **`POST /crm/v3/objects/contacts/batch/upsert`** (and `/api/v1/dispatch`): Receives HMAC-SHA256 signed sub-batches of up to 100 contacts, validates each row via `validateBatchRecordsGranular()`, and performs idempotent upserts.

---

## 2. Mathematical Formulation of Token Bucket & Full-Jitter Backoff

To comply with HubSpot CRM v3 rate limits (`100` requests per `10` seconds) and survive burst `HTTP 429 Too Many Requests` responses without Thundering Herd synchronization across concurrent workers, `connectors-ts/src/application/resilience.ts` implements two mathematical controls:

1. **Continuous Token Bucket (`TokenBucketRateLimiter`)**:
   - Replenishes tokens at a continuous rate $R = \text{maxRequests} / (\text{perSeconds} \times 1000)\text{ tokens/ms}$.
   - Before any HTTP request is dispatched, `acquireToken()` awaits sufficient token accumulation.
2. **Exponential Backoff with Full Jitter (`calculateFullJitterBackoffMs`)**:
   - On transient HTTP status codes (`429`, `502`, `503`, `504`), the sleep interval before retry attempt $k \in \{0, 1, \dots\}$ is drawn uniformly from:
     $$T_{\text{sleep}}(k) = U(0, 1) \times \min\left(T_{\max},\, T_{\text{base}} \times 2^k\right)$$
   - Permanent client errors (`400`, `401`, `403`, `422`) return `isRetryableStatus(status) == false` and are never retried.
3. **Cryptographic Idempotency (`Idempotency-Key` & `X-DataPulse-Signature`)**:
   - Each batch request carries a deterministic SHA-256 `Idempotency-Key` header (`computeIdempotencyKey`) and an HMAC-SHA256 `X-DataPulse-Signature` verified via `node:crypto.timingSafeEqual`.

---

## 3. Inspecting the Live Executive Monitor (`http://localhost:3000`)

Non-technical stakeholders andRevOps managers can open `http://localhost:3000` in any browser to inspect:
- **Executive KPI Cards**: Total Synced Contacts ($S$), VIP Executive Retention Alerts (`[VIP-BRIEF]`), Batch Requests Processed, `HTTP 429` Retries Absorbed (`[RATE-LIMIT]`), and Annual SaaS Savings (`$4,170/yr vs Hightouch`).
- **Interactive Contact Table**: Searchable by `Customer ID`, `Email`, or `Tier`, highlighting negative margins and deterministic 21-word VIP retention directives.

