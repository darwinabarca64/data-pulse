"""Unit tests for Step 2: Pydantic v2 Domain Contracts, SHA-256 Diffing, and YAML Manifests."""

import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, List

import pytest
from pydantic import ValidationError

from datapulse.domain.models import (
    CustomerProfitabilityRecord,
    CustomerTier,
    DLQRecord,
    DLQStage,
)
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


def _base_valid_payload() -> dict[str, Any]:
    return {
        "customer_id": "CUST-00100",
        "email": "cfo@enterprise-client.io",
        "company_name": "Enterprise Client Corp",
        "country_code": "US",
        "currency_code": "USD",
        "annual_revenue": 250000.00,
        "annual_cost": 150000.00,
        "net_profitability_usd": 100000.00,
        "profit_margin_pct": 40.0,
        "customer_tier": CustomerTier.ENTERPRISE_VIP,
        "updated_at": datetime(2026, 10, 29, 12, 0, 0, tzinfo=timezone.utc),
    }


def test_valid_customer_record_and_deterministic_sha256_hash_diffing() -> None:
    """Verify valid record instantiation and deterministic SHA-256 payload hash diffing."""
    payload_a = _base_valid_payload()
    payload_b = _base_valid_payload()
    # Changing non-hashed metadata (like updated_at or company_name) must keep business hash identical
    payload_b["updated_at"] = datetime(2026, 10, 29, 13, 30, 0, tzinfo=timezone.utc)

    rec_a = CustomerProfitabilityRecord(**payload_a)
    rec_b = CustomerProfitabilityRecord(**payload_b)

    hash_a = rec_a.compute_payload_hash()
    hash_b = rec_b.compute_payload_hash()

    assert len(hash_a) == 64
    assert hash_a == hash_b

    # Changing net_profitability_usd by 0.01 must alter the SHA-256 hash
    payload_c = _base_valid_payload()
    payload_c["net_profitability_usd"] = 100000.01
    rec_c = CustomerProfitabilityRecord(**payload_c)
    assert rec_c.compute_payload_hash() != hash_a


@pytest.mark.parametrize(
    "field_name,bad_value",
    [
        ("annual_revenue", float("nan")),
        ("annual_cost", float("inf")),
        ("net_profitability_usd", float("-inf")),
        ("profit_margin_pct", float("nan")),
    ],
)
def test_reject_ieee754_nan_and_infinity_floats(field_name: str, bad_value: float) -> None:
    """Verify NaN, Infinity, and -Infinity in financial fields raise ValidationError."""
    payload = _base_valid_payload()
    payload[field_name] = bad_value

    with pytest.raises(ValidationError) as exc_info:
        CustomerProfitabilityRecord(**payload)

    assert "IEEE-754 NaN/Infinity values are forbidden" in str(exc_info.value)


@pytest.mark.parametrize(
    "bad_email",
    [
        "broken@@domain.com",
        "no-at-symbol.com",
        "@missing-local.com",
        "user@nodotdomain",
        "user@.leadingdot.com",
        "user@trailingdot.com.",
        "user with space@domain.com",
    ],
)
def test_reject_malformed_emails_and_route_to_dlq_record(bad_email: str) -> None:
    """Verify malformed emails fail validation and can be wrapped in DLQRecord."""
    payload = _base_valid_payload()
    payload["email"] = bad_email

    with pytest.raises(ValidationError) as exc_info:
        CustomerProfitabilityRecord(**payload)

    assert "Invalid RFC email format" in str(exc_info.value)

    dlq_entry = DLQRecord(
        sync_id="hubspot_customer_profitability",
        record_id=str(payload["customer_id"]),
        failed_at=datetime.now(timezone.utc),
        stage=DLQStage.CONTRACT_VALIDATION.value,
        error_code="CONTRACT_VALIDATION_ERROR",
        error_message=str(exc_info.value),
        raw_payload={"customer_id": payload["customer_id"], "email": bad_email},
    )
    assert dlq_entry.status == "PENDING"
    assert dlq_entry.stage == "CONTRACT_VALIDATION"


def test_load_sync_manifest_validates_hubspot_profitability_yaml() -> None:
    """Verify load_sync_manifest parses and validates syncs/hubspot_profitability.yml."""
    manifest_path = REPO_ROOT / "syncs" / "hubspot_profitability.yml"
    manifest = load_sync_manifest(manifest_path)

    assert manifest.version == "1.0"
    assert manifest.sync_id == "hubspot_customer_profitability"
    assert manifest.source.target_table == "analytics_prod.marts.fct_customer_profitability"
    assert manifest.source.watermark_column == "updated_at"
    assert manifest.source.lookback_window_minutes == 15
    assert manifest.source.batch_size == 1000
    assert manifest.destination.connector == "hubspot_crm_v3"
    assert manifest.destination.operation == "batch_upsert"
    assert manifest.destination.rate_limit.max_requests == 100
    assert manifest.destination.rate_limit.per_seconds == 10
    assert manifest.destination.field_mapping["net_profitability_usd"] == (
        "datapulse_net_profitability_usd"
    )


def test_step2_adr_and_repo_governance_compliance() -> None:
    """Verify ADR-002 <= 30 lines, all repo files <= 250 lines, and zero emojis."""
    adr2_path = (
        REPO_ROOT / "docs" / "adr" / "ADR-002-declarative-yaml-manifests-and-pydantic-contracts.md"
    )
    assert adr2_path.is_file()
    adr2_text = adr2_path.read_text(encoding="utf-8")
    assert len(adr2_text.splitlines()) <= 30
    for section in ("## Status", "## Context", "## Decision", "## Consequences"):
        assert section in adr2_text

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

