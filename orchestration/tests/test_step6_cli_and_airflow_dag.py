"""Automated verification tests for Step 6: Universal CLI, DLQ Auto-Replay, and Thin Airflow DAG."""

import importlib.util
import re
import time
from pathlib import Path
from typing import List

import pytest

from datapulse.interfaces.cli import main as cli_main

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

EMOJI_PATTERN = re.compile(
    "["
    "\U0001F600-\U0001F64F"
    "\U0001F300-\U0001F5FF"
    "\U0001F680-\U0001F6FF"
    "\U0001F1E0-\U0001F1FF"
    "\U00002702-\U000027B0"
    "\U000024C2-\U0001F251"
    "]+",
    flags=re.UNICODE,
)

EXCLUDED_DIRS = {
    ".git",
    ".pytest_cache",
    "__pycache__",
    ".venv",
    "venv",
    "node_modules",
    "dist",
    "data_pulse.egg-info",
}


def test_airflow_thin_dag_parse_sla_and_topology() -> None:
    """Verify Thin DAG parses in < 0.5s, has < 110 lines, and wires 3 tasks linearly."""
    dag_file = REPO_ROOT / "orchestration" / "dags" / "datapulse_hubspot_sync_dag.py"
    assert dag_file.is_file()
    dag_lines = dag_file.read_text(encoding="utf-8").splitlines()
    assert len(dag_lines) < 110, f"Thin DAG exceeds 110 lines ({len(dag_lines)})"

    t_start = time.perf_counter()
    spec = importlib.util.spec_from_file_location("datapulse_hubspot_sync_dag", dag_file)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    parse_elapsed = time.perf_counter() - t_start

    assert parse_elapsed < 0.5, f"DAG parse exceeded 0.5s SLA ({parse_elapsed:.3f}s)"
    dag_obj = getattr(module, "dag", None)
    assert dag_obj is not None
    assert dag_obj.dag_id == "datapulse_hubspot_profitability_sync"
    assert dag_obj.schedule == "0 * * * *"
    assert dag_obj.catchup is False
    assert dag_obj.max_active_runs == 1

    tasks = {t.task_id: t for t in dag_obj.tasks}
    assert len(tasks) == 3
    assert set(tasks.keys()) == {
        "validate_sync_manifest",
        "execute_incremental_reverse_etl",
        "audit_dlq_and_finops_telemetry",
    }
    assert "execute_incremental_reverse_etl" in tasks["validate_sync_manifest"].downstream_task_ids
    assert (
        "audit_dlq_and_finops_telemetry"
        in tasks["execute_incremental_reverse_etl"].downstream_task_ids
    )


def test_cli_end_to_end_lifecycle_and_dlq_auto_remediation_replay(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """Verify datapulse init -> validate -> run -> dlq inspect -> dlq replay (200 -> 0 pending)."""
    db_path = str(tmp_path / "cli_lifecycle.duckdb")
    manifest_path = str(REPO_ROOT / "syncs" / "hubspot_profitability.yml")

    # 1. datapulse init
    rc_init = cli_main(["init", "--rows", "10000", "--db-path", db_path])
    assert rc_init == 0
    out_init = capsys.readouterr().out
    assert "[OK] Initialized local warehouse with 10,000 records" in out_init

    # 2. datapulse validate
    rc_val = cli_main(["validate", "--manifest", manifest_path, "--db-path", db_path])
    assert rc_val == 0
    out_val = capsys.readouterr().out
    assert "[OK] Validated sync manifest 'hubspot_customer_profitability'" in out_val

    # 3. datapulse run --use-mock-destination
    rc_run = cli_main(
        ["run", "--manifest", manifest_path, "--use-mock-destination", "--db-path", db_path]
    )
    assert rc_run == 0
    out_run = capsys.readouterr().out
    assert "10000 = 9800 + 0 + 200 (Balanced: True)" in out_run
    assert "[DLQ] DLQ Quarantined (E)     : 200" in out_run

    # 4. datapulse dlq inspect
    rc_insp = cli_main(
        ["dlq", "inspect", "--sync-id", "hubspot_customer_profitability", "--db-path", db_path]
    )
    assert rc_insp == 0
    out_insp = capsys.readouterr().out
    assert "INVALID_EMAIL_FORMAT" in out_insp
    assert "Count: 150" in out_insp
    assert "IEEE_754_NAN_INFINITY" in out_insp
    assert "Count: 50" in out_insp

    # 5. datapulse dlq replay (Auto-Remediation of all 200 rows -> 0 remaining)
    rc_rep = cli_main(
        [
            "dlq",
            "replay",
            "--manifest",
            manifest_path,
            "--use-mock-destination",
            "--db-path",
            db_path,
        ]
    )
    assert rc_rep == 0
    out_rep = capsys.readouterr().out
    assert (
        "[OK] DLQ Replay Summary (hubspot_customer_profitability): "
        "total_pending=200, remediated_and_synced=200, remaining_pending=0"
    ) in out_rep


def test_step6_docker_adr_and_repo_governance_compliance() -> None:
    """Verify Dockerfiles, docker-compose.yml, ADR-006 <= 30 lines, and repo <= 250 lines."""
    required_files = [
        REPO_ROOT / "infra" / "docker" / "Dockerfile.engine",
        REPO_ROOT / "infra" / "docker" / "Dockerfile.connector",
        REPO_ROOT / "docker-compose.yml",
        REPO_ROOT / "docs" / "adr" / "ADR-006-thin-airflow-dags-and-cli-decoupling.md",
        REPO_ROOT / "docs" / "runbooks" / "06-cli-airflow-and-docker-orchestration.md",
    ]
    for path in required_files:
        assert path.is_file(), f"Missing required Step 6 file: {path}"

    adr6_path = REPO_ROOT / "docs" / "adr" / "ADR-006-thin-airflow-dags-and-cli-decoupling.md"
    adr6_text = adr6_path.read_text(encoding="utf-8")
    assert len(adr6_text.splitlines()) <= 30
    for section in ("## Status", "## Context", "## Decision", "## Consequences"):
        assert section in adr6_text

    files: List[Path] = [
        p
        for p in REPO_ROOT.rglob("*")
        if p.is_file() and not any(part in EXCLUDED_DIRS for part in p.parts)
    ]
    for file_path in files:
        content = file_path.read_text(encoding="utf-8")
        assert not EMOJI_PATTERN.search(content), f"Emoji detected in {file_path}"
        line_count = len(content.splitlines())
        assert line_count <= 250, f"File {file_path} exceeds 250 lines ({line_count})"

