# Runbook 02: Declarative Sync Manifests, Pydantic v2 Data Contracts, and Payload Hash Diffing

## Overview
DataPulse enforces strict separation between declarative pipeline configuration (`syncs/*.yml`) and pure domain validation (`core-engine/src/datapulse/domain/`). Every extracted analytical row must pass a deterministic Pydantic v2 contract before any HTTP request is dispatched to a downstream SaaS API.

---

## 1. Declarative YAML Sync Manifest Specification

All Reverse ETL pipelines are defined as declarative YAML files inside `syncs/` and loaded via `load_sync_manifest()` (`core-engine/src/datapulse/infrastructure/manifest_loader.py`).

### Reference Contract (`syncs/hubspot_profitability.yml`)
- **`source`**:
  - `engine_env`: Environment variable selecting the adapter (`SOURCE_ENGINE` -> `duckdb_local` or `snowflake`).
  - `target_table`: Fully qualified analytical table (`analytics_prod.marts.fct_customer_profitability`).
  - `watermark_column`: Timestamp column used for incremental high-watermarking (`updated_at`).
  - `lookback_window_minutes`: Safety overlap window (`15` minutes) to capture late-arriving warehouse frames.
  - `batch_size`: Bounded memory chunk size (`1` to `10000`, default `1000`).
- **`ai_enrichment`**:
  - Controls out-of-band executive brief generation and automated DLQ post-mortem triage (`dlq_auto_triage: true`).
- **`destination`**:
  - Declares target connector (`hubspot_crm_v3`), operation (`batch_upsert`), idempotency key (`email`), token-bucket rate limits (`100` requests per `10` seconds), and explicit column-to-property `field_mapping`.

### Validating a Sync Manifest via CLI / Python
```powershell
python -c "from datapulse.infrastructure.manifest_loader import load_sync_manifest; m = load_sync_manifest('syncs/hubspot_profitability.yml'); print('[OK] Loaded sync:', m.sync_id)"
```

---

## 2. Pydantic v2 Data Contract & DLQ Quarantine

The `CustomerProfitabilityRecord` entity (`core-engine/src/datapulse/domain/models.py`) enforces three non-negotiable domain invariants prior to network dispatch:

1. **IEEE-754 `NaN` / `Infinity` Rejection**:
   - SQL divisions by zero or NULL coercions in analytical views can emit `NaN` or `Infinity` floats, which violate RFC-8259 JSON and cause entire 100-record HubSpot batches to fail with HTTP 400.
   - `CustomerProfitabilityRecord.reject_nan_and_infinity` intercepts `math.isnan(x)` and `math.isinf(x)` at validation time, raising a deterministic `ValueError`.
2. **Deterministic RFC Email & ISO Code Validation**:
   - Emails must contain exactly one `@`, a non-empty local part, and a valid dot-separated domain with zero whitespace.
   - `country_code` must be a 2-letter uppercase ISO-3166 string, and `currency_code` must belong to `{"USD", "EUR", "GBP"}`.
3. **Row-Level Isolation via `DLQRecord`**:
   - When a row fails Pydantic validation, the application layer catches `ValidationError` and constructs a `DLQRecord` with `stage=DLQStage.CONTRACT_VALIDATION`, preserving the raw payload for out-of-band triage while allowing the remaining valid records in the batch to proceed.

---

## 3. Mathematical Formulation of SHA-256 Payload Hash Diffing

Even when a warehouse row's `updated_at` timestamp advances due to a full dbt table rebuild, its business values may be identical to the previous sync. To prevent redundant SaaS API calls and rate-limit exhaustion, `CustomerProfitabilityRecord.compute_payload_hash()` computes a canonical SHA-256 digest:

1. **Canonical Projection**: Extracts the business-critical tuple:
   - `currency_code` (uppercase ISO-4217)
   - `customer_id`
   - `customer_tier` (enum string value)
   - `email` (normalized to lowercase)
   - `net_profitability_usd` (rounded to 4 decimal places)
   - `profit_margin_pct` (rounded to 4 decimal places)
2. **Deterministic Serialization**: Serializes the dictionary to UTF-8 JSON with sorted keys and zero whitespace (`sort_keys=True, separators=(",", ":")`).
3. **Cryptographic Digest**: Computes the 64-character hexadecimal SHA-256 hash (`hashlib.sha256(serialized).hexdigest()`).
4. **Delta Decision**: If `current_hash == state_store.get_last_hash(customer_id)`, the record is skipped (`NO_OP`), reducing downstream HTTP volume.

