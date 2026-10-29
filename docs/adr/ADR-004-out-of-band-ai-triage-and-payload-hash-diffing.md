# ADR-004: Out-of-Band AI DLQ Triage, SHA-256 Diffing & Reconciliation Equation

## Status
Accepted (2026-10-29) — Enforced via `ExecuteSyncUseCase`, `AIDLQDoctor`, & `FinOpsTelemetryCalculator`

## Context
- Re-syncing unchanged warehouse rows on every hourly schedule burns downstream CRM API rate limits and triggers redundant webhook automations.
- Invoking external LLM APIs synchronously inside the hot ETL loop or sending raw unredacted customer PII (`email`, `company_name`) to third-party AI endpoints violates latency SLAs and GDPR/CCPA data privacy controls.

## Decision
We architect `ExecuteSyncUseCase` around three mathematical and security invariants:
1. **SHA-256 Payload Hash Diffing:** Before dispatching to the destination connector, each valid `CustomerProfitabilityRecord` computes a canonical 6-field `SHA-256` digest compared against `audit.data_pulse_state_hashes`. Unchanged rows are skipped (`O`), reducing steady-state HTTP traffic from `98` batches (`9,800` rows) to `0` requests on subsequent runs.
2. **Strict Reconciliation Equation ($N = S + O + E$):** Every sync run verifies that Extracted rows ($N$) strictly equal Upserted ($S$) + Skipped Unchanged ($O$) + DLQ Quarantined ($E$). Any discrepancy triggers an immediate `CRITICAL` alert via `AlertPort`.
3. **Out-of-Band PII-Redacted `AIDLQDoctor`:** DLQ triage operates strictly out-of-band on aggregated error groups (`INVALID_EMAIL_FORMAT`, `IEEE_754_NAN_INFINITY`), redacting PII (`[REDACTED_PII_EMAIL]`) before generating deterministic remedial Snowflake/dbt SQL (`REGEXP_LIKE`, `COALESCE(NANVL(...), 0.0)`).
- **Rejected Alternatives:**
  - *Synchronous LLM calls per failed row:* Rejected due to `200` blocking HTTP calls to OpenAI/Gemini during an incident.
  - *Relying solely on `updated_at` watermarks without hash diffing:* Rejected because full-refresh dbt builds bump `updated_at` on unchanged business records.

## Consequences
- **Positive:**
  - Eliminates 100% of redundant CRM API calls on unchanged data and guarantees zero silent data loss via $N = S + O + E$.
  - Provides instant, zero-PII-leak root-cause SQL remediation.
- **Negative / Operational Trade-offs:**
  - Storing `(sync_id, record_id, payload_hash)` in `audit.data_pulse_state_hashes` adds ~1.2MB of state storage per 10,000 tracked entities.
  - Requires one batch hash lookup and one parameterized batch upsert per sync chunk.
