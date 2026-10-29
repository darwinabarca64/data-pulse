# ADR-006: Thin Airflow DAG Architecture & Universal CLI Decoupling

## Status
Accepted (2026-10-29) — Enforced via `datapulse.interfaces.cli` & `orchestration/dags/datapulse_hubspot_sync_dag.py`

## Context
- Embedding business logic, Pydantic models, Snowflake connectors, and DuckDB transformations directly inside Apache Airflow DAG files causes Airflow scheduler parse times to exceed 5–10 seconds per file.
- Top-level application imports inside DAG files create dependency conflicts with Airflow's internal SQLAlchemy/Pydantic versions and prevent engineers from running sync steps locally without starting Airflow.

## Decision
We enforce a strict **Thin DAG Pattern** that decouples orchestration scheduling from execution logic via the Universal `datapulse` CLI (`core-engine/src/datapulse/interfaces/cli.py`):
1. **Universal CLI Entrypoint (`datapulse`):** Exposes 5 self-contained subcommands (`init`, `validate`, `run`, `dlq inspect`, `dlq replay`) with zero-dependency `.env` auto-loading (`_load_dotenv_if_present()`).
2. **Explicit Destination Resolution Telemetry:** Logs an explicit `[WARN]` message if falling back to `InMemoryMockDestinationConnector` when the HTTP connector is unreachable.
3. **Thin Airflow DAG (`datapulse_hubspot_sync_dag.py`):** Contains zero domain imports and parses in `< 0.05s` (`<= 110` lines). It wires 3 linear `BashOperator` tasks (`validate_sync_manifest >> execute_incremental_reverse_etl >> audit_dlq_and_finops_telemetry`) invoking `python -m datapulse.interfaces.cli` against the bind-mounted `./core-engine` volume.
- **Rejected Alternatives:**
  - *Monolithic `PythonOperator` DAG importing `datapulse.*` at top level:* Rejected for coupling the Airflow scheduler to engine dependencies.
  - *`DockerOperator` per task:* Rejected because mounting `/var/run/docker.sock` inside Airflow containers creates a root privilege-escalation vulnerability.

## Consequences
- **Positive:**
  - Identical CLI commands run in developer terminals, GitHub Actions CI, standalone Docker containers, and Airflow `BashOperator` tasks.
  - Airflow DAG parse time remains `< 50ms`, well below the `500ms` SLA.
- **Negative / Operational Trade-offs:**
  - Inter-task communication relies on persisted warehouse governance state (`audit.data_pulse_*` tables) and CLI exit codes (`0` vs `2`) rather than Airflow XCom objects.
  - Requires mounting `./core-engine:/opt/airflow/core-engine:ro` and setting `PYTHONPATH=/opt/airflow/core-engine/src` in `docker-compose.yml`.
