# ADR-006: Thin Apache Airflow DAGs and Universal CLI Decoupling

## Status
Accepted

## Context
Embedding SQL queries, Pydantic data validation, or HTTP client logic directly inside Apache Airflow DAG files causes top-level DAG parse timeouts (`> 2.0s`), scheduler CPU saturation, and tight coupling to Airflow's Python dependency tree.

## Decision
We enforce the Thin DAG architectural pattern: `orchestration/dags/datapulse_hubspot_sync_dag.py` (`< 110` lines) contains zero business logic, database connections, or network calls at parse time. Instead, Airflow tasks invoke the self-contained `datapulse` CLI (`datapulse validate`, `datapulse run`, `datapulse dlq inspect`), which executes our Clean Architecture use cases (`ExecuteSyncUseCase`, `ManageDLQUseCase`).

## Consequences
Airflow DAG parsing completes in `< 0.05` seconds with zero warehouse load. The exact same `datapulse` CLI commands can be executed identically by local engineers, GitHub Actions CI, Docker Compose containers, or Apache Airflow workers.

