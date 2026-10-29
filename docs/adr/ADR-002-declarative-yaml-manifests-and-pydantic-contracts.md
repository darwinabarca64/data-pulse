# ADR-002: Declarative YAML Sync Manifests & Pydantic v2 Domain Contracts

## Status
Accepted (2026-10-29) — Enforced via `datapulse.domain.models` & `syncs/hubspot_profitability.yml`

## Context
- Imperative Reverse-ETL scripts hardcode SQL table names, watermark lookback intervals, destination API rate limits, and field mappings inside Python loops.
- When upstream warehouse views introduce malformed RFC emails (`corrupt_email@@domain..com`) or IEEE-754 floating-point anomalies (`NaN`, `Infinity`, `-Infinity` from divide-by-zero margin calculations), unvalidated batch payloads fail mid-flight at the CRM API boundary.

## Decision
We decouple sync topology from execution logic using declarative YAML manifests (`SyncManifest`) paired with strict row-level Pydantic v2 domain contracts (`CustomerProfitabilityRecord`):
1. **Declarative Manifest (`syncs/hubspot_profitability.yml`):** Defines source table (`analytics_prod.marts.fct_customer_profitability`), `watermark_column: updated_at`, `lookback_window_minutes: 15`, `batch_size: 1000`, destination rate limits (`100 req / 10s`), and explicit `field_mapping` into HubSpot custom properties (`datapulse_*`).
2. **Row-Level Contract Firewall (`CustomerProfitabilityRecord`):** Enforces `ConfigDict(extra="forbid")`, custom `@field_validator` checks rejecting `math.isnan()` / `math.isinf()` on all 4 financial float fields, and strict RFC 5322 email regex validation.
3. **Canonical Digest Projection:** Implements a canonical 6-field `compute_payload_hash()` (`SHA-256`) that excludes `updated_at` metadata timestamps.
- **Rejected Alternatives:**
  - *dbt-only schema tests:* Rejected because warehouse tests do not run at Reverse-ETL egress time.
  - *Whole-batch rejection on first invalid row:* Rejected because 1 poison row would starve 99 clean CRM records in the same 100-row batch.

## Consequences
- **Positive:**
  - Adding a new Reverse-ETL sync requires only a declarative YAML manifest.
  - Poison rows (`150` invalid emails + `50` `NaN` margins in the 10k simulation) are quarantined individually into `DLQRecord` without halting the `9,800` valid records.
- **Negative / Operational Trade-offs:**
  - Row-by-row Pydantic v2 validation adds ~35ms CPU overhead per 10,000 rows compared to raw tuple pass-through.
  - Excluding `updated_at` from `compute_payload_hash()` requires any newly mapped business column to be added to the canonical hash dictionary.
