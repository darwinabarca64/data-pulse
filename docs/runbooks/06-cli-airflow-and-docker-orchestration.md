# Runbook 06: Universal `datapulse` CLI, Thin Airflow DAG & Docker Compose Orchestration

## 1. Purpose & Architectural Scope

This runbook governs **Step 6** of the `data-pulse` platform: bootstrapping the Python virtual environment, operating all 5 subcommands of the **Universal `datapulse` CLI** (`core-engine/src/datapulse/interfaces/cli.py`), verifying the **Thin Apache Airflow DAG** (`orchestration/dags/datapulse_hubspot_sync_dag.py`), and managing the 4-container **Docker Compose stack** (`docker-compose.yml`).

```mermaid
flowchart TD
    subgraph AirflowDAG["Thin Apache Airflow DAG (datapulse_hubspot_profitability_sync)"]
        CRON["Schedule: 0 * * * * (Hourly Cron)
        max_active_runs = 1 | catchup = False
        DAG Parse Time: < 0.05s (Zero Top-Level Domain Imports)"]
        T1["Task 1: validate_sync_manifest (BashOperator)
        python -m datapulse.interfaces.cli validate
        --manifest syncs/hubspot_profitability.yml"]
        T2["Task 2: execute_incremental_reverse_etl (BashOperator, retries=2)
        python -m datapulse.interfaces.cli run
        --manifest syncs/hubspot_profitability.yml"]
        T3["Task 3: audit_dlq_and_finops_telemetry (BashOperator)
        python -m datapulse.interfaces.cli dlq inspect
        --sync-id hubspot_customer_profitability"]
    end

    subgraph DockerStack["Docker Compose Bridge Network (datapulse-net — 4.00 GB Total Cap)"]
        PG["datapulse-postgres (512m)"]
        SCHED["datapulse-airflow-scheduler (1536m)
        Mounts: ./core-engine, ./syncs, ./data"]
        WEB["datapulse-airflow-webserver (1536m :8080)"]
        CONN["datapulse-connector-ts (512m :3000)"]
    end

    CRON --> T1
    T1 --> T2
    T2 --> T3
    T2 -->|"HUBSPOT_API_BASE_URL=http://connector-ts:3000"| CONN
    SCHED -->|"Executes CLI Tasks"| AirflowDAG
    PG -->|"Metadata DB"| SCHED
    PG -->|"Metadata DB"| WEB
```

---

## 2. Python Virtual Environment Bootstrap & `.env` Auto-Discovery

### 2.1 Creating `.venv` and Installing `data-pulse` in Editable Mode

**On Windows PowerShell:**

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -e ".[dev]"
# Optional: Install Snowflake cloud adapter extras when connecting to live Snowflake
# pip install -e ".[dev,snowflake]"
```

**On Linux / macOS / WSL2 Bash:**

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -e ".[dev]"
```

### 2.2 Zero-Dependency `.env` Auto-Loader Behavior

At startup, `datapulse.interfaces.cli.main()` invokes `_load_dotenv_if_present()`, which searches the current working directory and `$REPO_ROOT` for a `.env` file and populates `os.environ` via `os.environ.setdefault(key, value)` (never overwriting explicit shell environment variables).

Create your local `.env` from `.env.example`:

```bash
cp .env.example .env
```

---

## 3. Complete `datapulse` CLI Command & Flag Reference Matrix

All CLI commands can be invoked either via the installed entrypoint (`datapulse ...`) or module execution (`python -m datapulse.interfaces.cli ...`):

| Subcommand | Supported CLI Flags | Default Flag Values | Operational Behavior & Exit Codes |
| :--- | :--- | :--- | :--- |
| **`datapulse init`** | `--rows <int>`<br>`--db-path <path>`<br>`--no-seed` | `--rows 10000`<br>`--db-path None` (uses `DUCKDB_DATABASE_PATH`)<br>`--no-seed False` | Creates `marts` & `audit` tables in DuckDB. Seeds `10,000` synthetic chaos records unless `--no-seed` or `DEMO_SEED_ENABLED=false` is set. Returns `0`. |
| **`datapulse validate`** | `--manifest <path>`<br>`--db-path <path>` | `--manifest syncs/hubspot_profitability.yml` | Validates YAML manifest against `SyncManifest` contract and verifies warehouse governance tables exist. Returns `0` on valid, raises on invalid. |
| **`datapulse run`** | `--manifest <path>`<br>`--db-path <path>`<br>`--use-mock-destination`<br>`--no-seed` | `--manifest syncs/hubspot_profitability.yml`<br>`--use-mock-destination False`<br>`--no-seed False` | Runs incremental extraction, Pydantic validation, `SHA-256` hash diffing, CRM batch upserts, and FinOps telemetry. Returns `0` if $N = S + O + E$, or `2` on reconciliation imbalance. |
| **`datapulse dlq inspect`** | `--sync-id <str>`<br>`--db-path <path>` | `--sync-id hubspot_customer_profitability` | Runs out-of-band PII-redacted `AIDLQDoctor` over `PENDING` rows in `audit.data_pulse_dlq`, printing root causes and remedial SQL. Returns `0`. |
| **`datapulse dlq replay`** | `--manifest <path>`<br>`--db-path <path>`<br>`--use-mock-destination`<br>`--no-remediate` | `--manifest syncs/hubspot_profitability.yml`<br>`--use-mock-destination False`<br>`--no-remediate False` | Surgically heals `PENDING` DLQ records (`200` rows), re-validates contracts, upserts to CRM, heals local source rows via `WarehousePort`, and marks DLQ `RESOLVED`. Returns `0` (`1` if any remain pending). |

### 3.1 Copy-Pasteable CLI Walkthrough (Full 5-Step Lifecycle)

```bash
# Step 1: Initialize and seed 10,000 synthetic records in DuckDB
python -m datapulse.interfaces.cli init --rows 10000 --db-path data/local_warehouse.duckdb

# Step 2: Validate declarative YAML manifest
python -m datapulse.interfaces.cli validate --manifest syncs/hubspot_profitability.yml --db-path data/local_warehouse.duckdb

# Step 3: Execute incremental sync (uses live HTTP connector on :3000 if running, or --use-mock-destination)
python -m datapulse.interfaces.cli run --manifest syncs/hubspot_profitability.yml --use-mock-destination --db-path data/local_warehouse.duckdb

# Step 4: Inspect the 200 quarantined DLQ records out-of-band with PII redaction
python -m datapulse.interfaces.cli dlq inspect --sync-id hubspot_customer_profitability --db-path data/local_warehouse.duckdb

# Step 5: Surgically remediate and replay all 200 DLQ records (200 -> 0 pending)
python -m datapulse.interfaces.cli dlq replay --manifest syncs/hubspot_profitability.yml --use-mock-destination --db-path data/local_warehouse.duckdb
```

Expected Output from Step 5 (`dlq replay`):

```text
[OK] DLQ Replay Summary (hubspot_customer_profitability): total_pending=200, remediated_and_synced=200, remaining_pending=0
```

---

## 4. Docker Compose 3-Service Unified Stack & Memory Governance

### 4.1 Container Resource Allocation Table (`docker-compose.yml`)

| Container Name | Service Key | Image / Dockerfile | Hard `mem_limit` | Host Port Mapping | Architectural Role & Configuration |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `datapulse-connectors-ts` | `connectors-ts` | `infra/docker/Dockerfile.connector` (Node 22 + Python 3.11) | `512M` | `3000:3000` | Unified interactive Executive Console, CRM mock endpoint, HMAC security, DuckDB CLI runner, and Airflow REST trigger client. |
| `datapulse-core-engine` | `core-engine` | `infra/docker/Dockerfile.engine` | `1024M` (`1G`) | None (batch job) | One-off CLI execution container (`datapulse init && datapulse run`). |
| `datapulse-airflow-orchestrator` | `airflow-orchestrator` | `apache/airflow:2.10.2-python3.12` | `3072M` (`3G`) | `8080:8080` | Complete Apache Airflow 2.10 standalone orchestrator with basic auth (`admin` / `datapulse2026`) and REST API enablement. |
| **Total Stack Footprint** | **3 Services** | **Bridge: `datapulse-net`** | **`4,608 MB` (`4.5 GB`)** | **`:3000`, `:8080`** | **Strictly governed inside the `6.0 GB` WSL2 `.wslconfig` cap** |

### 4.2 Starting, Inspecting, Triggering & Tearing Down the Docker Stack

```bash
# 1. Build images and start all services in detached mode
docker compose up --build -d

# 2. Verify container health status and memory allocations
docker compose ps
docker stats --no-stream

# 3. Access the web consoles in your browser
# Executive CRM Console: http://localhost:3000
# Apache Airflow Console: http://localhost:8080 (User: admin | Password: datapulse2026)

# 4. Follow live logs from the interactive connector and Airflow orchestrator
docker compose logs -f connectors-ts airflow-orchestrator

# 5. Tear down containers, networks, and persistent volumes cleanly
docker compose down -v
```

### 4.3 Bidirectional REST Bridge Between Executive Console (:3000) & Airflow (:8080)

When clicking pipeline action buttons on `http://localhost:3000`:
1. `server.ts` spawns `datapulse.interfaces.cli` inside the multi-runtime Node+Python container to process local DuckDB data.
2. Simultaneously, `server.ts` invokes the Apache Airflow REST API (`POST http://airflow-orchestrator:8080/api/v1/dags/datapulse_hubspot_sync_dag/dagRuns`) authenticated with Basic Auth (`admin`:`datapulse2026`), passing payload:
   ```json
   { "conf": { "triggered_by": "datapulse-mission-control-ui" } }
   ```
3. The response status is returned to the browser and updates the live `airflowOnline` and `airflowDagStatus` badges on the console.

### 4.4 Inspecting Container Environment & Executing Ad-Hoc CLI Commands Inside Docker

You can invoke any `datapulse` CLI subcommand directly inside either running container:

```bash
# Run CLI validation inside the multi-runtime connector container
docker exec datapulse-connectors-ts python -m datapulse.interfaces.cli validate --manifest /app/syncs/hubspot_profitability.yml --db-path /app/data/local_warehouse.duckdb

# Trigger manual DAG execution inside the Airflow container
docker exec datapulse-airflow-orchestrator airflow dags trigger datapulse_hubspot_sync_dag
```

### 4.5 Verifying the Thin DAG Parse SLA (`< 0.5 Seconds`) Locally

```bash
python -m pytest orchestration/tests/test_step6_cli_and_airflow_dag.py -v
```

Expected Test Output:

```text
orchestration/tests/test_step6_cli_and_airflow_dag.py::test_airflow_thin_dag_parse_sla_and_topology PASSED
orchestration/tests/test_step6_cli_and_airflow_dag.py::test_cli_end_to_end_lifecycle_and_dlq_auto_remediation_replay PASSED
orchestration/tests/test_step6_cli_and_airflow_dag.py::test_step6_docker_adr_and_repo_governance_compliance PASSED
```

---

## 5. Operational Troubleshooting Table

| Failure Symptom / Error Code | Root Cause Analysis | Diagnostic Verification Command | Definitive Remediation Action |
| :--- | :--- | :--- | :--- |
| **`[WARN] Live HTTP connector unreachable at http://localhost:3000; falling back to InMemoryMockDestinationConnector`** | `datapulse run` or `datapulse dlq replay` was invoked without `--use-mock-destination`, and the TypeScript server on `:3000` is not running. | `curl -i http://localhost:3000/health` | Start the TypeScript connector in Terminal 1 (`npm --prefix connectors-ts start`) or pass `--use-mock-destination` for offline CLI runs. |
| **`ModuleNotFoundError: No module named 'datapulse'` inside Airflow container or host shell** | On host: `pip install -e ".[dev]"` was not run; in Docker: `./core-engine` volume mount or `PYTHONPATH=/opt/airflow/core-engine/src` was omitted. | `docker exec datapulse-airflow-scheduler python -c "import datapulse; print(datapulse.__file__)"` | On host run `pip install -e ".[dev]"`; in Docker ensure `docker-compose.yml` mounts `./core-engine:/opt/airflow/core-engine:ro` and sets `PYTHONPATH`. |
| **Airflow task `execute_incremental_reverse_etl` fails to connect to `localhost:3000` inside Docker** | Inside Docker Compose (`datapulse-net`), `localhost` refers to the Airflow container itself, not the `connector-ts` container. | `docker exec datapulse-airflow-scheduler env \| grep HUBSPOT_API_BASE_URL` | Ensure `docker-compose.yml` sets `HUBSPOT_API_BASE_URL: http://connector-ts:3000` on both Airflow services (already configured in `docker-compose.yml`). |
| **`datapulse dlq replay` exits with code `1` (`remaining_pending > 0`)** | `--no-remediate` was passed while the raw payloads in `audit.data_pulse_dlq` still contain unhealed emails (`@@`) or `NaN` floats. | `python -m datapulse.interfaces.cli dlq inspect --sync-id hubspot_customer_profitability` | Omit `--no-remediate` to enable surgical auto-remediation, or fix the upstream records in the warehouse before replaying. |
| **`airflow-webserver` healthcheck stays `starting` for > 60 seconds on first boot** | `airflow db migrate` and `airflow users create` run sequentially on container startup before Gunicorn binds port `8080`. | `docker compose logs airflow-webserver` | Wait ~45–60 seconds for `airflow db migrate` to finish; once `[OK] Listening at: http://0.0.0.0:8080` appears, log in with `admin` / `admin`. |
