"""DLQ inspection, deterministic payload auto-remediation, and replay use case."""

import math
from typing import Any

from pydantic import ValidationError

from datapulse.application.intelligence import (
    AIDLQDoctor,
    generate_vip_executive_brief,
)
from datapulse.application.sync_use_case import (
    HUBSPOT_SUB_BATCH_LIMIT,
    _map_record_fields,
)
from datapulse.domain.manifest import SyncManifest
from datapulse.domain.models import CustomerProfitabilityRecord
from datapulse.domain.ports import DestinationConnectorPort, WarehouseAdapterPort


def _is_nan_or_inf(val: Any) -> bool:
    """Return True if val represents IEEE-754 NaN or Infinity (float or string)."""
    if isinstance(val, (int, float)) and not isinstance(val, bool):
        return math.isnan(float(val)) or math.isinf(float(val))
    if isinstance(val, str) and val.strip().lower() in (
        "nan",
        "inf",
        "-inf",
        "infinity",
        "-infinity",
    ):
        return True
    return False


def _sanitize_float(val: Any, fallback: float = 0.0) -> float:
    """Apply SQL COALESCE(NULLIF(val, 'NaN'), fallback) semantics in Python."""
    if _is_nan_or_inf(val):
        return fallback
    try:
        parsed = float(val)
        return fallback if (math.isnan(parsed) or math.isinf(parsed)) else parsed
    except (TypeError, ValueError):
        return fallback


def _sanitize_email(raw_email: str) -> str:
    """Repair malformed RFC-5322 email strings deterministically."""
    cleaned = raw_email.strip().replace(" ", "")
    while "@@" in cleaned:
        cleaned = cleaned.replace("@@", "@")
    while ".." in cleaned:
        cleaned = cleaned.replace("..", ".")
    cleaned = cleaned.strip(".")

    if "@" not in cleaned:
        if "." in cleaned:
            cleaned = f"contact@{cleaned}"
        else:
            cleaned = f"{cleaned or 'contact'}@remediated-domain.com"

    parts = [p for p in cleaned.split("@") if p]
    if len(parts) >= 2:
        local = parts[0].strip(".") or "contact"
        domain = parts[-1].strip(".")
        if "." not in domain:
            domain = f"{domain}.com"
        return f"{local}@{domain}"
    return "contact@remediated-domain.com"


def remediate_corrupt_payload(
    raw_payload: dict[str, Any], error_code: str = ""
) -> dict[str, Any]:
    """Repair malformed emails and IEEE-754 NaN/Infinity floats in a quarantined payload."""
    repaired = dict(raw_payload)

    if "email" in repaired and isinstance(repaired["email"], str):
        if (
            error_code == "INVALID_EMAIL_FORMAT"
            or "@@" in repaired["email"]
            or "@" not in repaired["email"]
            or ".." in repaired["email"]
        ):
            repaired["email"] = _sanitize_email(repaired["email"])

    rev = _sanitize_float(repaired.get("annual_revenue", 0.0))
    cost = _sanitize_float(repaired.get("annual_cost", 0.0))
    net = _sanitize_float(repaired.get("net_profitability_usd", rev - cost))
    raw_margin = repaired.get("profit_margin_pct", 0.0)

    if _is_nan_or_inf(raw_margin) or error_code == "IEEE_754_NAN_INFINITY":
        margin = round((net / rev) * 100.0, 2) if rev > 0.0 else 0.0
    else:
        margin = _sanitize_float(raw_margin, 0.0)

    repaired["annual_revenue"] = rev
    repaired["annual_cost"] = cost
    repaired["net_profitability_usd"] = net
    repaired["profit_margin_pct"] = margin
    return repaired


class ManageDLQUseCase:
    """Inspect, diagnose, remediate, and replay quarantined Dead-Letter Queue records."""

    def __init__(
        self,
        warehouse: WarehouseAdapterPort,
        destination: DestinationConnectorPort | None = None,
        dlq_doctor: AIDLQDoctor | None = None,
    ) -> None:
        self._warehouse = warehouse
        self._destination = destination
        self._dlq_doctor = dlq_doctor or AIDLQDoctor()

    def inspect_pending(self, sync_id: str) -> dict[str, Any]:
        """Fetch PENDING DLQ records and run out-of-band AIDLQDoctor root-cause triage."""
        pending = self._warehouse.fetch_pending_dlq_records(sync_id)
        diagnosis = self._dlq_doctor.diagnose_dlq_records(pending)
        diagnosis["sync_id"] = sync_id
        diagnosis["formatted_summary"] = self._dlq_doctor.format_diagnosis_summary(diagnosis)
        return diagnosis

    def replay_pending(
        self,
        sync_id: str,
        manifest: SyncManifest,
        apply_remediation: bool = True,
    ) -> dict[str, Any]:
        """Remediate PENDING DLQ records, validate contracts, dispatch to CRM, and resolve."""
        if self._destination is None:
            raise RuntimeError("[ERROR] DestinationConnectorPort is required for DLQ replay.")

        pending = self._warehouse.fetch_pending_dlq_records(sync_id)
        total_pending = len(pending)
        if total_pending == 0:
            return {
                "sync_id": sync_id,
                "total_pending": 0,
                "remediated_and_synced": 0,
                "remaining_pending": 0,
            }

        repaired_payloads: list[dict[str, Any]] = []
        candidate_hashes: dict[str, str] = {}
        validated_by_id: dict[str, CustomerProfitabilityRecord] = {}

        for dlq_item in pending:
            candidate = (
                remediate_corrupt_payload(dlq_item.raw_payload, dlq_item.error_code)
                if apply_remediation
                else dict(dlq_item.raw_payload)
            )
            try:
                valid_rec = CustomerProfitabilityRecord.model_validate(candidate)
            except ValidationError:
                continue

            if manifest.ai_enrichment.enabled:
                brief = generate_vip_executive_brief(
                    valid_rec,
                    manifest.ai_enrichment.executive_brief_threshold_margin_drop_pct,
                )
                if brief is not None:
                    valid_rec.ai_executive_brief = brief

            validated_by_id[valid_rec.customer_id] = valid_rec
            candidate_hashes[valid_rec.customer_id] = valid_rec.compute_payload_hash()
            repaired_payloads.append(
                _map_record_fields(valid_rec, manifest.destination.field_mapping)
            )

        accepted_ids: list[str] = []
        for i in range(0, len(repaired_payloads), HUBSPOT_SUB_BATCH_LIMIT):
            sub_batch = repaired_payloads[i : i + HUBSPOT_SUB_BATCH_LIMIT]
            res = self._destination.send_batch(sync_id, sub_batch, manifest.destination)
            accepted_ids.extend(res.accepted_ids)

        if accepted_ids:
            accepted_hashes = {
                cid: candidate_hashes[cid] for cid in accepted_ids if cid in candidate_hashes
            }
            self._warehouse.upsert_payload_hashes(sync_id, accepted_hashes)
            self._warehouse.mark_dlq_resolved(sync_id, accepted_ids)
            if apply_remediation:
                remediated_records = [
                    validated_by_id[cid] for cid in accepted_ids if cid in validated_by_id
                ]
                self._warehouse.apply_remediated_source_records(remediated_records)

        remaining = len(self._warehouse.fetch_pending_dlq_records(sync_id))
        return {
            "sync_id": sync_id,
            "total_pending": total_pending,
            "remediated_and_synced": len(accepted_ids),
            "remaining_pending": remaining,
        }
