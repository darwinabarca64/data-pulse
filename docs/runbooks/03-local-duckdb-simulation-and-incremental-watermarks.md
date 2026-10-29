# Runbook 03: Local DuckDB Warehouse Emulation, Deterministic Seeding, and O(1) Streaming

## Overview
DataPulse implements the Clean Architecture Adapter Pattern via `WarehouseAdapterPort` (`core-engine/src/datapulse/domain/ports.py`). By default (`SOURCE_ENGINE=duckdb_local`), the engine provisions an embedded DuckDB analytical warehouse that emulates Snowflake's `MARTS` and `AUDIT` schemas with zero external cloud dependencies.

---

## 1. Dual-Engine Adapter Architecture

The factory `create_warehouse_adapter()` (`core-engine/src/datapulse/infrastructure/adapter_factory.py`) inspects `SOURCE_ENGINE`:

1. **`duckdb_local` (`DuckDBWarehouseAdapter`)**:
   - Stores analytical tables and operational governance state in `data/local_warehouse.duckdb` (or `:memory:` / temporary paths during testing).
   - Transparently normalizes three-part Snowflake identifiers (`analytics_prod.marts.fct_customer_profitability`) into two-part DuckDB schema paths (`marts.fct_customer_profitability`).
   - Automatically provisions `audit.data_pulse_watermarks`, `audit.data_pulse_state_hashes`, and `audit.data_pulse_dlq`.
2. **`snowflake` (`SnowflakeWarehouseAdapter`)**:
   - Connects to `ANALYTICS_PROD` on `WH_DATA_PULSE_XS` using 2048-bit PKCS#8 RSA private key authentication (`SVC_DATA_PULSE` / `ROLE_DATA_PULSE_SERVICE`).
   - Lazily imports `snowflake.connector` so local DuckDB workflows run without requiring cloud driver installation.

---

## 2. Deterministic 10,000-Customer Seeder (98% Clean / 2% Controlled Anomalies)

When `ensure_governance_tables()` runs on an empty local DuckDB database, `seed_duckdb_warehouse()` (`core-engine/src/datapulse/infrastructure/seeder.py`) uses `random.Random(42)` to bulk-insert **10,000** corporate records (`CUST-00001` through `CUST-10000`) in `< 0.5` seconds:

| Record Band | Customer ID Range | Row Count | Share | Engineered Characteristics |
| :--- | :--- | :--- | :--- | :--- |
| **Band 1: Clean Records** | `CUST-00001` .. `CUST-09800` | `9,800` | `98.0%` | Valid RFC emails, ISO-3166 country codes, ISO-4217 currencies, Pareto revenue/cost, and 60 `ENTERPRISE_VIP` accounts with `profit_margin_pct = -20.0%` (`< -12.0%` threshold). |
| **Band 2: Poison Emails** | `CUST-09801` .. `CUST-09950` | `150` | `1.5%` | Malformed email strings (`corrupt@@domain..com`, `missing-at-symbol.org`) designed to trigger `CustomerProfitabilityRecord` email validation errors. |
| **Band 3: Poison IEEE-754 NaNs** | `CUST-09951` .. `CUST-10000` | `50` | `0.5%` | `profit_margin_pct = 'nan'::DOUBLE` (simulating SQL `0.0 / 0.0` division by zero) designed to trigger RFC-8259 `NaN` contract rejection. |

---

## 3. O(1) Memory Cursor Streaming & Incremental Watermarks

To prevent Out-Of-Memory (OOM) crashes on bounded WSL2 hosts (`memory=6GB`), neither adapter ever invokes `fetchall()` on `fct_customer_profitability`:

1. **Dedicated Streaming Cursor**:
   - `fetch_incremental_batches(target_table, watermark_column, effective_watermark, batch_size)` opens a dedicated database cursor and executes a parameterized query ordered deterministically by `updated_at ASC, customer_id ASC`.
2. **Bounded Chunk Iteration (`fetchmany`)**:
   - Rows are pulled in chunks of `batch_size` (default `1,000` rows per chunk), yielding `list[dict[str, Any]]` to the application layer while keeping peak heap memory proportional to `O(batch_size)`.
3. **High-Watermark & Lookback Overlap**:
   - On incremental runs, the application layer subtracts `lookback_window_minutes` (default `15` minutes) from `get_high_watermark(sync_id)` to compute `effective_watermark`.
   - Any late-arriving rows within the 15-minute overlap window are safely deduplicated via `get_stored_payload_hashes()` (SHA-256 Payload Hash Diffing) before committing the new watermark via `set_high_watermark()`.

