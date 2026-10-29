# Runbook 04: Resilience Engine, Reconciliation Equation, FinOps Telemetry, and Out-of-Band DLQ Doctor

## Overview
`ExecuteSyncUseCase` (`core-engine/src/datapulse/application/sync_use_case.py`) orchestrates the core Reverse ETL lifecycle: incremental high-watermark extraction with lookback overlap, row-level Pydantic v2 contract validation, SHA-256 payload hash diffing, deterministic in-memory VIP brief synthesis, concurrent sub-batch HTTP dispatch, FinOps cost accounting, and out-of-band DLQ root-cause triage.

---

## 1. The Mathematical Reconciliation Invariant ($N = S + O + E$)

Every execution of `ExecuteSyncUseCase` enforces a strict conservation law across all extracted rows (`core-engine/src/datapulse/application/finops_telemetry.py`):

$$N = S + O + E$$

Where:
- **$N$ (`extracted_count`)**: Total rows streamed from `fct_customer_profitability` where `updated_at >= effective_watermark`.
- **$S$ (`upserted_count`)**: Validated rows whose SHA-256 payload digest changed (or were unseen) and were accepted by the destination CRM connector.
- **$O$ (`skipped_unchanged_count`)**: Validated rows whose canonical SHA-256 digest (`compute_payload_hash()`) matched `audit.data_pulse_state_hashes`, bypassing network I/O completely.
- **$E$ (`dlq_isolated_count`)**: Rows quarantined into `audit.data_pulse_dlq` due to Pydantic contract violations (`INVALID_EMAIL_FORMAT`, `IEEE_754_NAN_INFINITY`) or downstream HTTP rejections (`DESTINATION_REJECTED`).

If $N \neq S + O + E$ at the conclusion of any run, the engine raises a `[CRITICAL]` runtime exception and halts watermark advancement.

---

## 2. FinOps Unit-Cost Telemetry (`WH_DATA_PULSE_XS`)

`build_reconciliation_report()` models Snowflake compute expenditure on `WH_DATA_PULSE_XS` (`XSMALL`, 1 credit/hour, `AUTO_SUSPEND = 60` seconds):

1. **Billable Compute Window**: $\max(\text{duration\_seconds}, 60.0)\text{ s}$.
2. **Estimated Credits**: $\text{billable\_seconds} / 3600.0 \times 1.0\text{ credit/hr}$.
3. **Run Cost (USD)**: $\text{estimated\_credits} \times \$3.00/\text{credit}$.
4. **Annual SaaS Savings**: Compares the projected annualized compute run-rate against a $\$4,200.00/\text{year}$ commercial Reverse ETL SaaS baseline.

---

## 3. Deterministic VIP Briefs vs. Out-of-Band `AIDLQDoctor`

1. **Hot-Path In-Memory VIP Enrichment (`generate_vip_executive_brief`)**:
   - Executes in `< 0.01ms` with zero network calls.
   - When `customer_tier == "ENTERPRISE_VIP"` and `profit_margin_pct <= -10.0`, synthesizes a 21-word commercial retention directive citing exact operating margin and net profitability.
2. **Post-Batch Out-of-Band Triage (`AIDLQDoctor.diagnose_dlq_records`)**:
   - Executes strictly after batch completion when `E > 0`.
   - Aggregates quarantined records by `error_code`, redacts PII (`_anonymize_sample`) from a single representative sample per group, and emits remedial SQL and dbt fixes (`REGEXP_LIKE` email filters and `COALESCE(NULLIF(..., 'NaN'::DOUBLE), 0.0)`).

---

## 4. Configuring Multi-Channel Alerting (`console`, `discord`, `slack`)

`MultiChannelAlertDispatcher` (`core-engine/src/datapulse/infrastructure/alert_dispatcher.py`) routes the executive summary based on `ALERT_PROVIDER`:

```ini
# Options: console | discord | slack
ALERT_PROVIDER=console
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/<id>/<token>
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/<T>/<B>/<token>
```

If `discord` or `slack` is selected without a valid webhook URL (or if the webhook endpoint is unreachable), the dispatcher degrades gracefully and prints the ASCII report to standard output.

