# Runbook 06: Universal DataPulse CLI, DLQ Auto-Remediation Replay, and Airflow/Docker Orchestration

## Overview
DataPulse exposes all Reverse ETL, FinOps, and Dead-Letter Queue operations through a unified CLI (`datapulse` / `python -m datapulse.interfaces.cli`). Apache Airflow (`orchestration/dags/datapulse_hubspot_sync_dag.py`) and Docker Compose (`docker-compose.yml`) invoke this CLI directly, guaranteeing zero drift between local development and production scheduling.

---

## 1. Universal `datapulse` CLI Reference

All 5 subcommands can be invoked via `datapulse <cmd>` (or `python -m datapulse.interfaces.cli <cmd>`):

### 1.1 `init` (Provision Schemas & Seed 10,000 Corporate Records)
```powershell
python -m datapulse.interfaces.cli init --rows 10000
```
- Creates `marts.fct_customer_profitability` and the 3 `audit` governance tables (`data_pulse_watermarks`, `data_pulse_state_hashes`, `data_pulse_dlq`).
- Seeds `9,800` valid records, `150` poison email records, and `50` poison IEEE-754 `NaN` records idempotently.

### 1.2 `validate` (Verify Declarative YAML Sync Contract)
```powershell
python -m datapulse.interfaces.cli validate --manifest syncs/hubspot_profitability.yml
```
- Validates the YAML manifest against `SyncManifest` and checks warehouse connectivity.

### 1.3 `run` (Execute Incremental Reverse ETL Sync)
```powershell
python -m datapulse.interfaces.cli run --manifest syncs/hubspot_profitability.yml
```
- Streams incremental batches (`fetchmany`), validates Pydantic v2 contracts, performs SHA-256 payload hash diffing, synthesizes in-memory VIP briefs, dispatches sub-batches of 100 to `connectors-ts`, and prints the full ASCII Reconciliation ($N = S + O + E$) and FinOps Report.

### 1.4 `dlq inspect` (Out-of-Band AI DLQ Doctor Root-Cause Triage)
```powershell
python -m datapulse.interfaces.cli dlq inspect --sync-id hubspot_customer_profitability
```
- Groups quarantined `PENDING` DLQ records by `error_code` (`INVALID_EMAIL_FORMAT`: 150, `IEEE_754_NAN_INFINITY`: 50), anonymizes PII samples, and prints remedial Snowflake/DuckDB SQL and dbt fixes.

### 1.5 `dlq replay` (Deterministic Auto-Remediation & Replay)
```powershell
python -m datapulse.interfaces.cli dlq replay --manifest syncs/hubspot_profitability.yml
```
- Applies `remediate_corrupt_payload()` (`core-engine/src/datapulse/application/dlq_use_case.py`) to repair malformed emails and coerce IEEE-754 `NaN` margins to `0.0`, validates the repaired records through `CustomerProfitabilityRecord`, dispatches them to HubSpot CRM, updates SHA-256 state hashes, and transitions all 200 DLQ rows from `PENDING` to `RESOLVED` (`remaining_pending = 0`).

---

## 2. Decoupled Apache Airflow Thin DAG (`datapulse_hubspot_profitability_sync`)

Located at `orchestration/dags/datapulse_hubspot_sync_dag.py` (`< 110` lines), the DAG enforces:
- **Schedule**: `"0 * * * *"` (hourly), `catchup=False`, `max_active_runs=1`, `retries=3` (`retry_delay=5m`).
- **Parse Time SLA**: `< 0.05s` (strictly under the `2.0s` engineering ceiling; zero top-level DB/HTTP calls).
- **Linear Pipeline**:
  `validate_sync_manifest >> execute_incremental_reverse_etl >> audit_dlq_and_finops_telemetry`

---

## 3. Multi-Container Docker Compose Execution

To launch the bounded multi-service stack (`connectors-ts` capped at `512M`, `core-engine` capped at `1G`):

```powershell
# Launch TypeScript CRM Server (Port 3000) + Core Reverse ETL Engine
docker compose up --build

# Optional: Launch with Apache Airflow Orchestrator (Port 8080, capped at 2G)
docker compose --profile orchestration up --build
```

