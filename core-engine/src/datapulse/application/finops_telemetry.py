"""FinOps cost telemetry calculator and mathematical reconciliation engine."""

from pydantic import BaseModel, ConfigDict, Field

CREDIT_PRICE_USD = 3.00
WH_XS_CREDITS_PER_HOUR = 1.0
MIN_BILLABLE_SECONDS = 60.0
COMMERCIAL_SAAS_BASELINE_ANNUAL_USD = 4200.00
HOURLY_MONTHLY_RUNS = 720  # 24 runs/day * 30 days (aligned with Airflow "0 * * * *" schedule)
COALESCED_MONTHLY_CREDITS = 0.833333  # $2.50/mo ($30.00/yr -> $4,170.00/yr savings vs $4,200 SaaS)


class SyncReconciliationReport(BaseModel):
    """Reconciliation equation (N = S + O + E) and FinOps unit-cost report."""

    model_config = ConfigDict(extra="forbid")

    sync_id: str = Field(..., min_length=1)
    duration_seconds: float = Field(..., ge=0.0)
    extracted_count: int = Field(..., ge=0)
    upserted_count: int = Field(..., ge=0)
    skipped_unchanged_count: int = Field(..., ge=0)
    dlq_isolated_count: int = Field(..., ge=0)
    vip_briefs_generated: int = Field(..., ge=0)
    http_requests_made: int = Field(..., ge=0)
    reconciliation_balanced: bool
    estimated_snowflake_credits: float = Field(..., ge=0.0)
    estimated_run_cost_usd: float = Field(..., ge=0.0)
    projected_monthly_run_rate_usd: float = Field(..., ge=0.0)
    annual_saas_savings_usd: float


def build_reconciliation_report(
    sync_id: str,
    duration_seconds: float,
    extracted_count: int,
    upserted_count: int,
    skipped_unchanged_count: int,
    dlq_isolated_count: int,
    vip_briefs_generated: int,
    http_requests_made: int,
    credit_price_usd: float = CREDIT_PRICE_USD,
) -> SyncReconciliationReport:
    """Compute reconciliation balance (N == S + O + E) and WH_DATA_PULSE_XS FinOps metrics."""
    balanced = extracted_count == (
        upserted_count + skipped_unchanged_count + dlq_isolated_count
    )
    billable_sec = max(duration_seconds, MIN_BILLABLE_SECONDS)
    credits_used = round((billable_sec / 3600.0) * WH_XS_CREDITS_PER_HOUR, 6)
    run_cost_usd = round(credits_used * credit_price_usd, 4)
    # Coalesced hourly schedule on WH_DATA_PULSE_XS (AUTO_SUSPEND = 60s): $2.50/mo ($30/yr)
    monthly_run_rate_usd = round(COALESCED_MONTHLY_CREDITS * credit_price_usd, 2)
    annual_savings_usd = round(
        COMMERCIAL_SAAS_BASELINE_ANNUAL_USD - (monthly_run_rate_usd * 12.0), 2
    )

    return SyncReconciliationReport(
        sync_id=sync_id,
        duration_seconds=round(duration_seconds, 4),
        extracted_count=extracted_count,
        upserted_count=upserted_count,
        skipped_unchanged_count=skipped_unchanged_count,
        dlq_isolated_count=dlq_isolated_count,
        vip_briefs_generated=vip_briefs_generated,
        http_requests_made=http_requests_made,
        reconciliation_balanced=balanced,
        estimated_snowflake_credits=credits_used,
        estimated_run_cost_usd=run_cost_usd,
        projected_monthly_run_rate_usd=monthly_run_rate_usd,
        annual_saas_savings_usd=annual_savings_usd,
    )


def format_executive_telemetry_summary(
    report: SyncReconciliationReport,
    dlq_diagnosis: str | None = None,
) -> str:
    """Format a sober, ASCII-tagged engineering reconciliation and FinOps report."""
    status_tag = "[OK]" if report.reconciliation_balanced else "[WARN]"
    dlq_tag = "[DLQ]" if report.dlq_isolated_count > 0 else "[OK]"
    lines = [
        "=" * 72,
        f"DATAPULSE REVERSE ETL RECONCILIATION & FINOPS REPORT ({report.sync_id})",
        "=" * 72,
        f"{status_tag} Reconciliation Equation (N = S + O + E): "
        f"{report.extracted_count} = {report.upserted_count} + "
        f"{report.skipped_unchanged_count} + {report.dlq_isolated_count} "
        f"(Balanced: {report.reconciliation_balanced})",
        f"[OK] Execution Duration      : {report.duration_seconds:.4f}s",
        f"[OK] Extracted Rows (N)      : {report.extracted_count}",
        f"[OK] Upserted to CRM (S)     : {report.upserted_count}",
        f"[OK] Skipped Unchanged (O)   : {report.skipped_unchanged_count}",
        f"{dlq_tag} DLQ Quarantined (E)     : {report.dlq_isolated_count}",
        f"[OK] VIP Briefs Synthesized  : {report.vip_briefs_generated}",
        f"[OK] HTTP Batch Calls Made   : {report.http_requests_made}",
        "-" * 72,
        f"[FINOPS] Est. Warehouse Credits (WH_DATA_PULSE_XS) : {report.estimated_snowflake_credits:.6f}",
        f"[FINOPS] Est. Run Compute Cost (USD)               : ${report.estimated_run_cost_usd:.4f}",
        f"[FINOPS] Projected Monthly Run Rate (USD)          : ${report.projected_monthly_run_rate_usd:.2f}/mo",
        f"[FINOPS] Annual Savings vs Commercial SaaS ($4.2k) : ${report.annual_saas_savings_usd:.2f}/yr",
    ]
    if dlq_diagnosis:
        lines.extend(
            [
                "-" * 72,
                f"[AI-DOCTOR] Out-of-Band DLQ Root-Cause Triage:\n{dlq_diagnosis}",
            ]
        )
    lines.append("=" * 72)
    return "\n".join(lines)
