"""Decoupled Apache Airflow Thin DAG for DataPulse Reverse ETL orchestration."""

from datetime import datetime, timedelta, timezone
from types import TracebackType
from typing import Any

try:
    from airflow import DAG  # type: ignore[import-not-found]
    from airflow.operators.bash import BashOperator  # type: ignore[import-not-found]
except ImportError:
    _ACTIVE_DAG: Any = None

    class DAG:  # type: ignore[no-redef]
        """Lightweight Airflow DAG shim for fast local CI validation without heavy deps."""

        def __init__(
            self,
            dag_id: str,
            default_args: dict[str, Any] | None = None,
            description: str = "",
            schedule: str = "0 * * * *",
            start_date: datetime | None = None,
            catchup: bool = False,
            max_active_runs: int = 1,
            tags: list[str] | None = None,
        ) -> None:
            self.dag_id = dag_id
            self.default_args = default_args or {}
            self.description = description
            self.schedule = schedule
            self.start_date = start_date
            self.catchup = catchup
            self.max_active_runs = max_active_runs
            self.tags = tags or []
            self.tasks: list[Any] = []

        def __enter__(self) -> "DAG":
            global _ACTIVE_DAG
            _ACTIVE_DAG = self
            return self

        def __exit__(
            self,
            exc_type: type[BaseException] | None,
            exc_val: BaseException | None,
            exc_tb: TracebackType | None,
        ) -> None:
            global _ACTIVE_DAG
            _ACTIVE_DAG = None

    class BashOperator:  # type: ignore[no-redef]
        """Lightweight BashOperator shim recording task dependencies via >> operator."""

        def __init__(self, task_id: str, bash_command: str, dag: DAG | None = None) -> None:
            self.task_id = task_id
            self.bash_command = bash_command
            self.downstream_task_ids: set[str] = set()
            self.upstream_task_ids: set[str] = set()
            target_dag = dag or _ACTIVE_DAG
            if target_dag is not None:
                target_dag.tasks.append(self)

        def __rshift__(self, other: "BashOperator") -> "BashOperator":
            self.downstream_task_ids.add(other.task_id)
            other.upstream_task_ids.add(self.task_id)
            return other


MANIFEST_PATH = "syncs/hubspot_profitability.yml"
SYNC_ID = "hubspot_customer_profitability"
CLI_INVOCATION = "python -m datapulse.interfaces.cli"

DEFAULT_ARGS: dict[str, Any] = {
    "owner": "datapulse-platform-engineering",
    "depends_on_past": False,
    "retries": 3,
    "retry_delay": timedelta(minutes=5),
}

with DAG(
    dag_id="datapulse_hubspot_profitability_sync",
    default_args=DEFAULT_ARGS,
    description="Thin Reverse ETL orchestration DAG delegating execution to datapulse CLI",
    schedule="0 * * * *",
    start_date=datetime(2026, 1, 1, tzinfo=timezone.utc),
    catchup=False,
    max_active_runs=1,
    tags=["reverse-etl", "finops", "hubspot", "datapulse"],
) as dag:
    validate_sync_manifest = BashOperator(
        task_id="validate_sync_manifest",
        bash_command=f"{CLI_INVOCATION} validate --manifest {MANIFEST_PATH}",
    )

    execute_incremental_reverse_etl = BashOperator(
        task_id="execute_incremental_reverse_etl",
        bash_command=f"{CLI_INVOCATION} run --manifest {MANIFEST_PATH}",
    )

    audit_dlq_and_finops_telemetry = BashOperator(
        task_id="audit_dlq_and_finops_telemetry",
        bash_command=f"{CLI_INVOCATION} dlq inspect --sync-id {SYNC_ID}",
    )

    (
        validate_sync_manifest
        >> execute_incremental_reverse_etl
        >> audit_dlq_and_finops_telemetry
    )
