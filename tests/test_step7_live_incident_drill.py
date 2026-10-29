"""Automated cross-language integration tests for Step 7: Live Incident Drill & Production Cutover."""

import re
from pathlib import Path
from typing import List

import duckdb
import pytest

from datapulse.interfaces.cli import main as cli_main
from scripts.live_incident_drill import run_live_incident_drill

REPO_ROOT = Path(__file__).resolve().parent.parent

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
    "data",
    "data_pulse.egg-info",
}
DOC_EXEMPT_NAMES = {"INDEX.md", "README.md", "AUDIT-REPORT.md", "MANUAL-MAESTRO-DARWIN-ES.md"}


def _is_doc_exempt_from_line_cap(path: Path) -> bool:
    return path.suffix.lower() == ".md" and (
        "runbooks" in path.parts or path.name in DOC_EXEMPT_NAMES
    )


def test_four_phase_live_http_incident_drill_python_to_typescript(tmp_path: Path) -> None:
    """Verify full 4-phase drill over live HTTP between Python engine and TypeScript CRM server."""
    drill_db = tmp_path / "live_drill.duckdb"
    metrics = run_live_incident_drill(db_path=drill_db)

    assert metrics["phase1_upserted"] == 9800
    assert metrics["phase1_dlq"] == 200
    assert metrics["phase1_balanced"] is True

    groups = metrics["phase2_groups"]
    assert groups["INVALID_EMAIL_FORMAT"]["occurrence_count"] == 150
    assert groups["IEEE_754_NAN_INFINITY"]["occurrence_count"] == 50

    assert metrics["phase3_remediated"] == 200
    assert metrics["phase3_remaining_dlq"] == 0
    assert metrics["phase3_total_crm_contacts"] == 10000

    assert metrics["phase4_upserted"] == 0
    assert metrics["phase4_http_requests"] == 0
    assert metrics["phase4_skipped_unchanged"] > 0


def test_production_mode_no_seed_safeguard(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Verify --no-seed and DEMO_SEED_ENABLED=false create governance tables with 0 synthetic rows."""
    prod_db = tmp_path / "prod_clean.duckdb"
    rc = cli_main(["init", "--no-seed", "--db-path", str(prod_db)])
    assert rc == 0
    out = capsys.readouterr().out
    assert "0 synthetic records seeded" in out

    with duckdb.connect(str(prod_db)) as conn:
        row = conn.execute("SELECT COUNT(*) FROM marts.fct_customer_profitability;").fetchone()
        assert row is not None and int(row[0]) == 0

    env_db = tmp_path / "prod_env.duckdb"
    monkeypatch.setenv("DEMO_SEED_ENABLED", "false")
    rc_env = cli_main(["init", "--db-path", str(env_db)])
    assert rc_env == 0
    with duckdb.connect(str(env_db)) as conn:
        row2 = conn.execute("SELECT COUNT(*) FROM marts.fct_customer_profitability;").fetchone()
        assert row2 is not None and int(row2[0]) == 0


def test_step7_adr_runbook_and_repo_governance_compliance() -> None:
    """Verify ADR-007 <= 30 lines, Runbook 07 exists, and all source files <= 250 lines."""
    adr7_path = (
        REPO_ROOT / "docs" / "adr" / "ADR-007-surgical-dlq-replay-and-idempotent-recovery.md"
    )
    assert adr7_path.is_file()
    adr7_text = adr7_path.read_text(encoding="utf-8")
    assert len(adr7_text.splitlines()) <= 30
    for section in ("## Status", "## Context", "## Decision", "## Consequences"):
        assert section in adr7_text

    runbook7_path = (
        REPO_ROOT
        / "docs"
        / "runbooks"
        / "07-live-production-incident-drill-and-production-cutover.md"
    )
    assert runbook7_path.is_file()
    rb7_text = runbook7_path.read_text(encoding="utf-8")
    assert "PART A" in rb7_text
    assert "PART B" in rb7_text

    files: List[Path] = [
        p
        for p in REPO_ROOT.rglob("*")
        if p.is_file() and not any(part in EXCLUDED_DIRS for part in p.parts)
    ]
    for file_path in files:
        content = file_path.read_text(encoding="utf-8")
        assert not EMOJI_PATTERN.search(content), f"Emoji detected in {file_path}"
        if _is_doc_exempt_from_line_cap(file_path):
            continue
        line_count = len(content.splitlines())
        assert line_count <= 250, f"File {file_path} exceeds 250 lines ({line_count})"
