"""Automated verification suite for Step 3: Warehouse Port, 10k Seeder, and Adapters."""

import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import List

import pytest
from pydantic import ValidationError

from datapulse.domain.models import (
    CustomerProfitabilityRecord,
    CustomerTier,
    DLQRecord,
    DLQStage,
)
from datapulse.infrastructure.adapter_factory import create_warehouse_adapter
from datapulse.infrastructure.duckdb_adapter import DuckDBWarehouseAdapter
from datapulse.infrastructure.seeder import seed_duckdb_warehouse
from datapulse.infrastructure.snowflake_adapter import SnowflakeWarehouseAdapter

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


def test_deterministic_10k_seeder_and_streaming_contract_validation(tmp_path: Path) -> None:
    """Verify 10,000-row seeding speed, idempotency, 10x1000 streaming, and 9800/150/50 split."""
    db_file = tmp_path / "test_warehouse.duckdb"
    adapter = DuckDBWarehouseAdapter(db_path=db_file, auto_seed=False)

    with adapter:
        adapter.ensure_governance_tables()
        t_start = time.perf_counter()
        summary_first = seed_duckdb_warehouse(adapter.connection, total_rows=10000)
        elapsed_sec = time.perf_counter() - t_start

        assert elapsed_sec < 2.0, f"Seeding took too long: {elapsed_sec:.2f}s"
        assert summary_first["total_rows"] == 10000
        assert summary_first["clean_rows"] == 9800
        assert summary_first["poison_email_rows"] == 150
        assert summary_first["poison_nan_rows"] == 50
        assert summary_first["vip_margin_drop_rows"] >= 50

        # Re-running seeder must be idempotent (still 10,000 rows)
        summary_second = seed_duckdb_warehouse(adapter.connection, total_rows=10000)
        assert summary_second["total_rows"] == 10000

        # Stream via 3-part Snowflake table name in chunks of 1,000
        batches = list(
            adapter.fetch_incremental_batches(
                target_table="analytics_prod.marts.fct_customer_profitability",
                watermark_column="updated_at",
                effective_watermark=None,
                batch_size=1000,
            )
        )
        assert len(batches) == 10
        assert all(len(chunk) == 1000 for chunk in batches)

        valid_records: list[CustomerProfitabilityRecord] = []
        email_errors = 0
        nan_errors = 0

        for chunk in batches:
            for raw_row in chunk:
                try:
                    rec = CustomerProfitabilityRecord.model_validate(raw_row)
                    valid_records.append(rec)
                except ValidationError as exc:
                    err_text = str(exc)
                    if "Invalid RFC email format" in err_text:
                        email_errors += 1
                    elif "IEEE-754 NaN/Infinity" in err_text:
                        nan_errors += 1
                    else:
                        pytest.fail(f"Unexpected validation error: {err_text}")

        assert len(valid_records) == 9800
        assert email_errors == 150
        assert nan_errors == 50

        vip_margin_drops = [
            r
            for r in valid_records
            if r.customer_tier == CustomerTier.ENTERPRISE_VIP and r.profit_margin_pct < -12.0
        ]
        assert len(vip_margin_drops) >= 50


def test_watermarks_payload_hashes_and_dlq_lifecycle(tmp_path: Path) -> None:
    """Verify watermark persistence, SHA-256 state hash diff storage, and DLQ lifecycle."""
    db_file = tmp_path / "governance_state.duckdb"
    sync_id = "hubspot_customer_profitability"

    with DuckDBWarehouseAdapter(db_path=db_file, auto_seed=False) as adapter:
        adapter.ensure_governance_tables()

        # 1. Watermarks
        assert adapter.get_high_watermark(sync_id) is None
        wm_ts = datetime(2026, 10, 29, 12, 0, 0, tzinfo=timezone.utc)
        adapter.set_high_watermark(sync_id, wm_ts, records_processed=9800)
        stored_wm = adapter.get_high_watermark(sync_id)
        assert stored_wm is not None
        assert stored_wm.astimezone(timezone.utc) == wm_ts

        # 2. SHA-256 Payload Hashes
        hashes = {"CUST-00001": "a" * 64, "CUST-00002": "b" * 64}
        adapter.upsert_payload_hashes(sync_id, hashes)
        fetched_hashes = adapter.get_stored_payload_hashes(
            sync_id, ["CUST-00001", "CUST-00002", "CUST-99999"]
        )
        assert fetched_hashes == hashes

        # 3. DLQ Persistence & Resolution
        dlq_items = [
            DLQRecord(
                sync_id=sync_id,
                record_id="CUST-09801",
                failed_at=wm_ts,
                stage=DLQStage.CONTRACT_VALIDATION.value,
                error_code="INVALID_EMAIL",
                error_message="Invalid RFC email format",
                raw_payload={"customer_id": "CUST-09801", "email": "corrupt@@domain..com"},
            ),
            DLQRecord(
                sync_id=sync_id,
                record_id="CUST-09951",
                failed_at=wm_ts,
                stage=DLQStage.CONTRACT_VALIDATION.value,
                error_code="NAN_VALUE",
                error_message="IEEE-754 NaN/Infinity values are forbidden",
                raw_payload={"customer_id": "CUST-09951", "profit_margin_pct": "NaN"},
            ),
        ]
        adapter.insert_dlq_records(dlq_items)
        pending = adapter.fetch_pending_dlq_records(sync_id)
        assert len(pending) == 2

        adapter.mark_dlq_resolved(sync_id, ["CUST-09801"])
        remaining = adapter.fetch_pending_dlq_records(sync_id)
        assert len(remaining) == 1
        assert remaining[0].record_id == "CUST-09951"


def test_adapter_factory_license_and_repo_governance(tmp_path: Path) -> None:
    """Verify factory routing, Apache 2.0 LICENSE, ADR-003 <= 30 lines, and repo <= 250 lines."""
    duck_adapter = create_warehouse_adapter(
        env_override="duckdb_local", db_path=tmp_path / "factory.duckdb", auto_seed=False
    )
    assert isinstance(duck_adapter, DuckDBWarehouseAdapter)

    sf_adapter = create_warehouse_adapter(env_override="snowflake")
    assert isinstance(sf_adapter, SnowflakeWarehouseAdapter)

    with pytest.raises(ValueError, match="Unsupported SOURCE_ENGINE"):
        create_warehouse_adapter(env_override="invalid_engine")

    license_path = REPO_ROOT / "LICENSE"
    assert license_path.is_file()
    assert "Apache License" in license_path.read_text(encoding="utf-8")

    adr3_path = (
        REPO_ROOT / "docs" / "adr" / "ADR-003-dual-warehouse-adapter-and-deterministic-seeding.md"
    )
    assert adr3_path.is_file()
    assert len(adr3_path.read_text(encoding="utf-8").splitlines()) <= 30

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

