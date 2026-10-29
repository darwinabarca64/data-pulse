"""Unit and integration tests for Step 4: ExecuteSyncUseCase, Hash Diffing, FinOps, and AI Doctor."""

import re
from pathlib import Path
from typing import List

from datapulse.application.intelligence import AIDLQDoctor
from datapulse.application.sync_use_case import ExecuteSyncUseCase
from datapulse.infrastructure.alert_dispatcher import MultiChannelAlertDispatcher
from datapulse.infrastructure.duckdb_adapter import DuckDBWarehouseAdapter
from datapulse.infrastructure.http_connector_client import InMemoryMockDestinationConnector
from datapulse.infrastructure.manifest_loader import load_sync_manifest

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

EXCLUDED_DIRS = {".git", ".pytest_cache", "__pycache__", ".venv", "venv", "node_modules", "dist", "data_pulse.egg-info"}


def test_full_10k_sync_and_second_run_sha256_hash_diffing(tmp_path: Path) -> None:
    """Verify 1st run (10,000 -> 9,800 upserted, 200 DLQ) and 2nd run (0 upserted, 0 HTTP calls)."""
    db_file = tmp_path / "step4_warehouse.duckdb"
    manifest = load_sync_manifest(REPO_ROOT / "syncs" / "hubspot_profitability.yml")

    warehouse = DuckDBWarehouseAdapter(db_path=db_file, auto_seed=True)
    destination = InMemoryMockDestinationConnector()
    alerter = MultiChannelAlertDispatcher(provider="console", quiet_console=True)
    doctor = AIDLQDoctor(provider="heuristic_local")

    with warehouse:
        warehouse.ensure_governance_tables()
        use_case = ExecuteSyncUseCase(
            warehouse=warehouse,
            destination=destination,
            alerter=alerter,
            dlq_doctor=doctor,
        )

        # 1. First Full Sync Run across all 10,000 seeded rows
        report_run1 = use_case.execute(manifest)
        assert report_run1.extracted_count == 10000
        assert report_run1.upserted_count == 9800
        assert report_run1.skipped_unchanged_count == 0
        assert report_run1.dlq_isolated_count == 200
        assert report_run1.reconciliation_balanced is True
        assert report_run1.vip_briefs_generated >= 50
        assert report_run1.http_requests_made == 98  # 9,800 records / 100 per HubSpot batch
        assert report_run1.estimated_snowflake_credits > 0.0
        assert report_run1.annual_saas_savings_usd > 3000.0
        assert len(destination.upserted_store) == 9800

        # Verify VIP executive brief word count (15 to 22 words)
        vip_sample = destination.upserted_store["CUST-00001"]
        brief_text = vip_sample["datapulse_ai_executive_brief"]
        word_count = len(brief_text.split())
        assert 15 <= word_count <= 22

        # 2. Second Immediate Sync Run (Lookback Window Active + SHA-256 Hash Diffing)
        report_run2 = use_case.execute(manifest)
        assert report_run2.upserted_count == 0
        assert report_run2.http_requests_made == 0
        assert report_run2.skipped_unchanged_count > 0
        assert report_run2.reconciliation_balanced is True
        assert (
            report_run2.extracted_count
            == report_run2.upserted_count
            + report_run2.skipped_unchanged_count
            + report_run2.dlq_isolated_count
        )


def test_out_of_band_ai_dlq_doctor_grouping_and_remediation(tmp_path: Path) -> None:
    """Verify AIDLQDoctor groups 200 DLQ rows into 2 root causes (150 email, 50 NaN) with SQL fixes."""
    db_file = tmp_path / "dlq_doctor.duckdb"
    manifest = load_sync_manifest(REPO_ROOT / "syncs" / "hubspot_profitability.yml")

    with DuckDBWarehouseAdapter(db_path=db_file, auto_seed=True) as warehouse:
        warehouse.ensure_governance_tables()
        use_case = ExecuteSyncUseCase(
            warehouse=warehouse,
            destination=InMemoryMockDestinationConnector(),
            alerter=MultiChannelAlertDispatcher(provider="console", quiet_console=True),
        )
        use_case.execute(manifest)

        pending_dlq = warehouse.fetch_pending_dlq_records(manifest.sync_id)
        assert len(pending_dlq) == 200

        doctor = AIDLQDoctor(provider="heuristic_local")
        diagnosis = doctor.diagnose_dlq_records(pending_dlq)

        assert diagnosis["total_dlq_records"] == 200
        assert diagnosis["distinct_error_codes"] == 2
        groups = diagnosis["groups"]
        assert "INVALID_EMAIL_FORMAT" in groups
        assert "IEEE_754_NAN_INFINITY" in groups
        assert groups["INVALID_EMAIL_FORMAT"]["occurrence_count"] == 150
        assert groups["IEEE_754_NAN_INFINITY"]["occurrence_count"] == 50
        assert "REGEXP_LIKE" in groups["INVALID_EMAIL_FORMAT"]["remedial_sql"]
        assert "COALESCE" in groups["IEEE_754_NAN_INFINITY"]["remedial_sql"]
        assert "REDACTED" in str(groups["INVALID_EMAIL_FORMAT"]["anonymized_sample"]["email"])


def test_step4_adr_and_repo_governance_compliance() -> None:
    """Verify ADR-004 <= 30 lines, all repository files <= 250 lines, and zero emojis."""
    adr4_path = (
        REPO_ROOT / "docs" / "adr" / "ADR-004-out-of-band-ai-triage-and-payload-hash-diffing.md"
    )
    assert adr4_path.is_file()
    adr4_text = adr4_path.read_text(encoding="utf-8")
    assert len(adr4_text.splitlines()) <= 30
    for section in ("## Status", "## Context", "## Decision", "## Consequences"):
        assert section in adr4_text

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

