# ADR-003: Dual Warehouse Adapter Pattern & Deterministic 10k Chaos Seeding

## Status
Accepted (2026-10-29) — Enforced via `WarehousePort`, `DuckDBWarehouseAdapter`, & `SnowflakeWarehouseAdapter`

## Context
- Developing, testing, and auditing an enterprise Snowflake Reverse-ETL engine requires verifying incremental watermarks, `SHA-256` state hash diffing, and Dead-Letter Queue (DLQ) quarantine across thousands of rows.
- Requiring live Snowflake credentials for every developer laptop, CI run, or technical audit incurs cloud credit costs, network latency, and credential distribution friction.

## Decision
We implement the Hexagonal Ports & Adapters pattern around an abstract `WarehousePort` (`datapulse/domain/ports.py`) with two interchangeable concrete adapters selected via `SOURCE_ENGINE`:
1. **Local Zero-Cost Simulation (`DuckDBWarehouseAdapter`, `SOURCE_ENGINE=duckdb_local`):** Embeds an in-process DuckDB database (`data/local_warehouse.duckdb`) with identical `marts` and `audit` schemas and parameterized multi-row `VALUES (?, ?, ?, ?)` batch upserts.
2. **Deterministic 10k Chaos Seeder (`seed_duckdb_warehouse`):** Uses vectorized SQL to generate `10,000` rows in `<0.5s`: `9,800` clean rows (`CUST-00001`..`CUST-09800`, including `60` `ENTERPRISE_VIP` accounts with `< -12%` negative margin), `150` malformed email rows (`CUST-09801`..`CUST-09950`), and `50` IEEE-754 `NaN` margin rows (`CUST-09951`..`CUST-10000`).
3. **Enterprise Cloud Production (`SnowflakeWarehouseAdapter`, `SOURCE_ENGINE=snowflake`):** Connects via PKCS#8 RSA private key, streams batches via `cursor.fetchmany(batch_size)`, and executes transactional `MERGE INTO` on `DATA_PULSE_WATERMARKS` and `DATA_PULSE_STATE_HASHES`.
- **Rejected Alternatives:**
  - *SQLite local adapter:* Rejected because SQLite lacks native IEEE-754 `NaN` float storage and analytical window functions.
  - *In-memory Python dict mocks for `WarehousePort`:* Rejected because they fail to test real SQL DDL, transactions, and watermark predicates.

## Consequences
- **Positive:**
  - 100% offline reproducibility for CI/CD and local incident drills (`0` cloud dollars spent).
  - `ExecuteSyncUseCase` and `ReplayDLQUseCase` remain completely agnostic of the underlying SQL engine.
- **Negative / Operational Trade-offs:**
  - Maintaining SQL dialect parity between DuckDB (`INSERT OR REPLACE`, `JSON`) and Snowflake (`MERGE INTO`, `PARSE_JSON(%s)`) requires dedicated adapter implementations.
  - Production cutover requires explicit `--no-seed` / `DEMO_SEED_ENABLED=false` safeguards documented in Runbook `07`.
