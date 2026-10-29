"""Application use case orchestrating incremental extraction, hash diffing, and dispatch."""

import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from typing import Any

from pydantic import ValidationError

from datapulse.application.finops_telemetry import (
    SyncReconciliationReport,
    build_reconciliation_report,
    format_executive_telemetry_summary,
)
from datapulse.application.intelligence import (
    AIDLQDoctor,
    generate_vip_executive_brief,
)
from datapulse.domain.manifest import SyncManifest
from datapulse.domain.models import (
    CustomerProfitabilityRecord,
    DLQRecord,
    DLQStage,
)
from datapulse.domain.ports import (
    AlertDispatcherPort,
    BatchUpsertResult,
    DestinationConnectorPort,
    WarehouseAdapterPort,
)

HUBSPOT_SUB_BATCH_LIMIT = 100
MAX_DISPATCH_WORKERS = 4


def _classify_validation_error(exc: ValidationError) -> str:
    """Classify Pydantic ValidationError into deterministic DLQ error_code."""
    text = str(exc)
    if "Invalid RFC email format" in text:
        return "INVALID_EMAIL_FORMAT"
    if "IEEE-754 NaN/Infinity" in text:
        return "IEEE_754_NAN_INFINITY"
    return "CONTRACT_VALIDATION_ERROR"


def _map_record_fields(
    record: CustomerProfitabilityRecord, field_mapping: dict[str, str]
) -> dict[str, Any]:
    """Project domain record attributes to destination connector schema."""
    source_dict = record.model_dump(mode="json")
    mapped_props: dict[str, Any] = {}
    for src_field, dst_prop in field_mapping.items():
        if src_field in source_dict and source_dict[src_field] is not None:
            mapped_props[dst_prop] = source_dict[src_field]
    return {
        "customer_id": record.customer_id,
        "email": record.email,
        "properties": mapped_props,
        **mapped_props,
    }


class ExecuteSyncUseCase:
    """Orchestrate an incremental Reverse ETL sync run with DLQ isolation and FinOps."""

    def __init__(
        self,
        warehouse: WarehouseAdapterPort,
        destination: DestinationConnectorPort,
        alerter: AlertDispatcherPort,
        dlq_doctor: AIDLQDoctor | None = None,
    ) -> None:
        self._warehouse = warehouse
        self._destination = destination
        self._alerter = alerter
        self._dlq_doctor = dlq_doctor or AIDLQDoctor()

    def execute(self, manifest: SyncManifest) -> SyncReconciliationReport:
        """Run end-to-end incremental sync for the given declarative SyncManifest."""
        t_start = time.perf_counter()
        sync_id = manifest.sync_id
        src = manifest.source

        last_watermark = self._warehouse.get_high_watermark(sync_id)
        effective_watermark: datetime | None = None
        if last_watermark is not None:
            effective_watermark = last_watermark - timedelta(
                minutes=src.lookback_window_minutes
            )

        extracted_count = 0
        upserted_count = 0
        skipped_unchanged_count = 0
        dlq_isolated_count = 0
        vip_briefs_generated = 0
        http_requests_made = 0
        max_watermark_ts: datetime | None = last_watermark
        all_dlq_records: list[DLQRecord] = []

        for raw_chunk in self._warehouse.fetch_incremental_batches(
            target_table=src.target_table,
            watermark_column=src.watermark_column,
            effective_watermark=effective_watermark,
            batch_size=src.batch_size,
        ):
            extracted_count += len(raw_chunk)
            valid_records: list[CustomerProfitabilityRecord] = []
            chunk_dlq: list[DLQRecord] = []

            for raw_row in raw_chunk:
                row_ts = raw_row.get(src.watermark_column)
                if isinstance(row_ts, datetime):
                    if max_watermark_ts is None or row_ts > max_watermark_ts:
                        max_watermark_ts = row_ts
                try:
                    rec = CustomerProfitabilityRecord.model_validate(raw_row)
                    valid_records.append(rec)
                except ValidationError as exc:
                    dlq_entry = DLQRecord(
                        sync_id=sync_id,
                        record_id=str(raw_row.get(src.primary_key, "UNKNOWN")),
                        failed_at=datetime.now(timezone.utc),
                        stage=DLQStage.CONTRACT_VALIDATION.value,
                        error_code=_classify_validation_error(exc),
                        error_message=str(exc).splitlines()[0][:512],
                        raw_payload=raw_row,
                    )
                    chunk_dlq.append(dlq_entry)
                    dlq_isolated_count += 1

            # SHA-256 Payload Hash Diffing against stored state
            valid_ids = [r.customer_id for r in valid_records]
            stored_hashes = self._warehouse.get_stored_payload_hashes(sync_id, valid_ids)
            changed_payloads: list[dict[str, Any]] = []
            candidate_hashes: dict[str, str] = {}

            for rec in valid_records:
                current_hash = rec.compute_payload_hash()
                if stored_hashes.get(rec.customer_id) == current_hash:
                    skipped_unchanged_count += 1
                    continue

                if manifest.ai_enrichment.enabled:
                    brief = generate_vip_executive_brief(
                        rec,
                        manifest.ai_enrichment.executive_brief_threshold_margin_drop_pct,
                    )
                    if brief is not None:
                        rec.ai_executive_brief = brief
                        vip_briefs_generated += 1

                candidate_hashes[rec.customer_id] = current_hash
                changed_payloads.append(
                    _map_record_fields(rec, manifest.destination.field_mapping)
                )

            # Dispatch changed records in sub-batches of 100 via ThreadPoolExecutor
            if changed_payloads:
                sub_batches = [
                    changed_payloads[i : i + HUBSPOT_SUB_BATCH_LIMIT]
                    for i in range(0, len(changed_payloads), HUBSPOT_SUB_BATCH_LIMIT)
                ]
                with ThreadPoolExecutor(max_workers=MAX_DISPATCH_WORKERS) as pool:
                    futures = [
                        pool.submit(
                            self._destination.send_batch,
                            sync_id,
                            sb,
                            manifest.destination,
                        )
                        for sb in sub_batches
                    ]
                    batch_results: list[BatchUpsertResult] = [f.result() for f in futures]

                accepted_hashes: dict[str, str] = {}
                for res in batch_results:
                    http_requests_made += res.http_requests_made
                    upserted_count += len(res.accepted_ids)
                    for acc_id in res.accepted_ids:
                        if acc_id in candidate_hashes:
                            accepted_hashes[acc_id] = candidate_hashes[acc_id]
                    for failed_item in res.failed_records:
                        rec_id = str(failed_item.get("customer_id", "UNKNOWN"))
                        chunk_dlq.append(
                            DLQRecord(
                                sync_id=sync_id,
                                record_id=rec_id,
                                failed_at=datetime.now(timezone.utc),
                                stage=DLQStage.DESTINATION_DISPATCH.value,
                                error_code="DESTINATION_REJECTED",
                                error_message=str(
                                    failed_item.get("error", "Downstream HTTP error")
                                ),
                                raw_payload=failed_item,
                            )
                        )
                        dlq_isolated_count += 1

                if accepted_hashes:
                    self._warehouse.upsert_payload_hashes(sync_id, accepted_hashes)

            if chunk_dlq:
                self._warehouse.insert_dlq_records(chunk_dlq)
                all_dlq_records.extend(chunk_dlq)

        if max_watermark_ts is not None and extracted_count > 0:
            self._warehouse.set_high_watermark(
                sync_id, max_watermark_ts, records_processed=upserted_count
            )

        # Out-of-Band AI DLQ Doctor Triage (strictly post-batch, over grouped error codes)
        dlq_summary_text: str | None = None
        diagnosis_dict: dict[str, Any] = {}
        if all_dlq_records and manifest.ai_enrichment.dlq_auto_triage:
            diagnosis_dict = self._dlq_doctor.diagnose_dlq_records(all_dlq_records)
            dlq_summary_text = self._dlq_doctor.format_diagnosis_summary(diagnosis_dict)

        duration_sec = time.perf_counter() - t_start
        report = build_reconciliation_report(
            sync_id=sync_id,
            duration_seconds=duration_sec,
            extracted_count=extracted_count,
            upserted_count=upserted_count,
            skipped_unchanged_count=skipped_unchanged_count,
            dlq_isolated_count=dlq_isolated_count,
            vip_briefs_generated=vip_briefs_generated,
            http_requests_made=http_requests_made,
        )
        if not report.reconciliation_balanced:
            raise RuntimeError(
                f"[CRITICAL] Reconciliation equation violated for {sync_id}: "
                f"N={report.extracted_count} != S={report.upserted_count} + "
                f"O={report.skipped_unchanged_count} + E={report.dlq_isolated_count}"
            )

        formatted_report = format_executive_telemetry_summary(report, dlq_summary_text)
        self._alerter.dispatch_sync_report(
            report_text=formatted_report,
            payload={"report": report.model_dump(mode="json"), "dlq_triage": diagnosis_dict},
        )
        return report

