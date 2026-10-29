"""In-memory deterministic VIP executive brief synthesis and out-of-band AI DLQ Doctor."""

import os
from typing import Any

from datapulse.domain.models import CustomerProfitabilityRecord, CustomerTier, DLQRecord

REMEDIATION_KNOWLEDGE_BASE: dict[str, dict[str, str]] = {
    "INVALID_EMAIL_FORMAT": {
        "root_cause": (
            "Source warehouse rows contain malformed RFC-5322 email addresses "
            "(double '@' symbols, missing domain TLD, or missing '@' separator)."
        ),
        "remedial_sql": (
            "SELECT * FROM analytics_prod.marts.fct_customer_profitability "
            "WHERE REGEXP_LIKE(TRIM(email), '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$');"
        ),
        "dbt_fix": (
            "Add dbt_utils.not_null_proportion and regex test on MARTS.FCT_CUSTOMER_PROFITABILITY.EMAIL "
            "or filter invalid emails into an upstream staging quarantine model."
        ),
    },
    "IEEE_754_NAN_INFINITY": {
        "root_cause": (
            "Upstream SQL division by zero (0.0 / 0.0) produced IEEE-754 NaN or Infinity floats, "
            "which violate RFC-8259 JSON serialization contracts."
        ),
        "remedial_sql": (
            "SELECT customer_id, COALESCE(NULLIF(profit_margin_pct, 'NaN'::DOUBLE), 0.0) "
            "AS profit_margin_pct FROM analytics_prod.marts.fct_customer_profitability;"
        ),
        "dbt_fix": (
            "Wrap margin division in SQL SAFE_DIVIDE / CASE WHEN annual_revenue = 0 "
            "THEN 0.0 ELSE ((annual_revenue - annual_cost) / annual_revenue) * 100.0 END."
        ),
    },
    "DESTINATION_REJECTED": {
        "root_cause": (
            "Downstream SaaS CRM connector rejected payload due to schema mismatch or HTTP 4xx status."
        ),
        "remedial_sql": (
            "SELECT record_id, error_message FROM audit.data_pulse_dlq "
            "WHERE error_code = 'DESTINATION_REJECTED' AND status = 'PENDING';"
        ),
        "dbt_fix": (
            "Verify syncs/hubspot_profitability.yml field_mapping matches HubSpot CRM v3 property names."
        ),
    },
}


def generate_vip_executive_brief(
    record: CustomerProfitabilityRecord,
    threshold_pct: float = -10.0,
) -> str | None:
    """Synthesize a deterministic 21-word commercial retention directive in <0.01ms (zero I/O)."""
    if (
        record.customer_tier == CustomerTier.ENTERPRISE_VIP
        and record.profit_margin_pct <= threshold_pct
    ):
        return (
            f"Action required for VIP account {record.customer_id}: operating margin dropped to "
            f"{record.profit_margin_pct:.1f}% with net profitability {record.net_profitability_usd:.2f} "
            f"{record.currency_code}; initiate immediate executive retention review."
        )
    return None


def _anonymize_sample(raw_payload: dict[str, Any]) -> dict[str, Any]:
    """Redact PII fields from a DLQ sample before diagnostic inspection."""
    sanitized: dict[str, Any] = {}
    for key, val in raw_payload.items():
        if key.lower() == "email" and isinstance(val, str):
            sanitized[key] = f"<REDACTED_INVALID:{len(val)}_CHARS>"
        elif key.lower() == "company_name":
            sanitized[key] = "<REDACTED_COMPANY>"
        else:
            sanitized[key] = str(val) if isinstance(val, float) else val
    return sanitized


class AIDLQDoctor:
    """Out-of-band Dead-Letter Queue root-cause analyzer and SQL remediation advisor."""

    def __init__(self, provider: str | None = None) -> None:
        self._provider = (
            provider or os.environ.get("AI_PROVIDER", "heuristic_local")
        ).strip().lower()

    @property
    def provider(self) -> str:
        """Return configured diagnostic provider identifier."""
        return self._provider

    def diagnose_dlq_records(self, dlq_records: list[DLQRecord]) -> dict[str, Any]:
        """Group DLQ records by error_code (1 anonymized sample/group) and generate SQL fixes."""
        grouped_counts: dict[str, int] = {}
        grouped_samples: dict[str, dict[str, Any]] = {}
        grouped_stages: dict[str, str] = {}

        for rec in dlq_records:
            code = rec.error_code
            grouped_counts[code] = grouped_counts.get(code, 0) + 1
            if code not in grouped_samples:
                grouped_samples[code] = _anonymize_sample(rec.raw_payload)
                grouped_stages[code] = rec.stage

        error_groups: dict[str, dict[str, Any]] = {}
        for code, count in sorted(grouped_counts.items()):
            kb_entry = REMEDIATION_KNOWLEDGE_BASE.get(
                code,
                {
                    "root_cause": f"Unclassified data contract or dispatch error ({code}).",
                    "remedial_sql": "SELECT * FROM audit.data_pulse_dlq WHERE status = 'PENDING';",
                    "dbt_fix": "Inspect raw_payload in audit.data_pulse_dlq and add column constraints.",
                },
            )
            error_groups[code] = {
                "error_code": code,
                "occurrence_count": count,
                "stage": grouped_stages[code],
                "anonymized_sample": grouped_samples[code],
                "root_cause": kb_entry["root_cause"],
                "remedial_sql": kb_entry["remedial_sql"],
                "dbt_fix": kb_entry["dbt_fix"],
            }

        return {
            "provider": self._provider,
            "total_dlq_records": len(dlq_records),
            "distinct_error_codes": len(error_groups),
            "groups": error_groups,
        }

    def format_diagnosis_summary(self, diagnosis: dict[str, Any]) -> str:
        """Render a concise ASCII engineering summary of DLQ root causes and SQL fixes."""
        if diagnosis.get("total_dlq_records", 0) == 0:
            return "[AI-DOCTOR] Zero DLQ records detected. All contracts clean."

        lines = [
            f"Provider: {diagnosis['provider']} | Total Quarantined: {diagnosis['total_dlq_records']} "
            f"| Error Categories: {diagnosis['distinct_error_codes']}"
        ]
        for code, info in diagnosis.get("groups", {}).items():
            lines.append(
                f"  * [{code}] (Count: {info['occurrence_count']}, Stage: {info['stage']})"
            )
            lines.append(f"    Root Cause  : {info['root_cause']}")
            lines.append(f"    Remedial SQL: {info['remedial_sql']}")
        return "\n".join(lines)

