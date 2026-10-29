# ADR-007: Surgical DLQ Replay, Clean Architecture Port & Production Cutover

## Status
Accepted (2026-10-29) — Enforced via `ReplayDLQUseCase`, `WarehousePort.apply_remediated_source_records`, & `scripts/live_incident_drill.py`

## Context
- When 200 poison rows (`150` `INVALID_EMAIL_FORMAT` + `50` `IEEE_754_NAN_INFINITY`) are quarantined into `audit.data_pulse_dlq` during a 10,000-row sync, re-running the entire 10,000-row extraction wastes warehouse compute credits and CRM API quota.
- DLQ remediation logic in the Application layer must not violate Clean Architecture by inspecting concrete adapter connections (`hasattr(warehouse, "connection")`), and operators need a deterministic way to disable synthetic chaos seeding for production cutover.

## Decision
We implement surgical out-of-band DLQ recovery (`datapulse dlq replay`) and dual-lock production seeding guards:
1. **Surgical DLQ Replay (`ReplayDLQUseCase`):** Fetches only `PENDING` rows from `audit.data_pulse_dlq` (`200` rows), applies deterministic normalization rules (`_remediate_raw_payload`: collapses duplicate `@`/`..` in emails and recomputes `NaN`/`Infinity` margins from `annual_revenue` and `annual_cost`), re-validates through `CustomerProfitabilityRecord`, dispatches only the `2` remediated batches (`200` rows) to the CRM, and updates `audit.data_pulse_state_hashes` and `audit.data_pulse_dlq` (`STATUS = 'RESOLVED'`).
2. **Clean Architecture Port (`apply_remediated_source_records`):** Delegates optional local source-table healing through `WarehousePort.apply_remediated_source_records()` (transactional `UPDATE` in `DuckDBWarehouseAdapter`; read-only PoLP no-op in `SnowflakeWarehouseAdapter`).
3. **Production Cutover Safeguards:** Both `--no-seed` CLI flags (`datapulse init --no-seed`, `datapulse run --no-seed`) and `DEMO_SEED_ENABLED=false` disable the 10k chaos generator.
- **Rejected Alternatives:**
  - *Full watermark reset and re-extraction of all 10,000 rows:* Rejected for wasting 98 redundant HTTP batch calls.
  - *Executing raw DuckDB SQL inside `dlq_use_case.py`:* Rejected for violating the Clean Architecture Dependency Rule.

## Consequences
- **Positive:**
  - Recovers `200` quarantined records in `2` HTTP batch requests instead of `100`, bringing CRM state from `9,800 -> 10,000` contacts (`100%` convergence).
  - Subsequent sync runs (`Phase 4`) perform `0` HTTP requests (`10,000` skipped via `SHA-256` hash diffing).
- **Negative / Operational Trade-offs:**
  - Auto-remediation heuristics handle structural corruption (`@@`, `..`, `NaN`); novel business logic errors (`--no-remediate`) remain `PENDING` until upstream warehouse models are patched.
