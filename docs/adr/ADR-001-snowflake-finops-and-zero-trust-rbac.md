# ADR-001: Snowflake FinOps Guardrails & Zero-Trust RBAC Provisioning

## Status
Accepted (2026-10-29) — Enforced via `infra/snowflake/00_finops_guardrails.sql` & `01_security_rbac.sql`

## Context
- Enterprise Reverse-ETL pipelines querying cloud data warehouses every hour risk runaway compute spend from unthrottled warehouse sizes, Cartesian queries, or default 600-second auto-suspend windows.
- Service accounts using static passwords or over-privileged roles (`ACCOUNTADMIN` / `SYSADMIN`) expose customer PII and allow accidental mutation of analytical marts.

## Decision
We codify defense-in-depth Snowflake FinOps and Zero-Trust RBAC directly in versioned DDL:
1. **Three-Layer FinOps Guardrails (`00_finops_guardrails.sql`):** Provision `WH_DATA_PULSE_XS` (`XSMALL`, 1 credit/hr, `AUTO_SUSPEND = 60`, `STATEMENT_TIMEOUT_IN_SECONDS = 300`, `STATEMENT_QUEUED_TIMEOUT_IN_SECONDS = 120`), bind `RM_DATA_PULSE_MONTHLY` (`CREDIT_QUOTA = 50` credits = `$150.00/mo` hard ceiling at `$3.00/credit` with `AT 100 PERCENT DO SUSPEND_IMMEDIATE`), and `REVOKE MODIFY ON WAREHOUSE` from the service role.
2. **Coalesced FinOps Economics:** Hourly coalesced runs consume `~0.8333` billed credits/mo (`$2.50/mo` or `$30.00/yr`, saving `$4,170.00/yr` vs a `$4,200.00/yr` commercial Reverse-ETL SaaS license).
3. **Zero-Trust RBAC (`01_security_rbac.sql`):** Authenticate `SVC_DATA_PULSE` exclusively via 2048-bit PKCS#8 RSA key-pair (`MUST_CHANGE_PASSWORD = FALSE`), grant `SELECT` only on `ANALYTICS_PROD.MARTS.FCT_CUSTOMER_PROFITABILITY` (11 columns) and `SELECT, INSERT, UPDATE` on `ANALYTICS_PROD.AUDIT` (`DATA_PULSE_WATERMARKS`, `DATA_PULSE_STATE_HASHES`, `DATA_PULSE_DLQ`), and bind `email_masking_policy` and `region_isolation_policy` (on `COUNTRY_CODE`).
- **Rejected Alternatives:**
  - *Password + MFA service logins:* Rejected because interactive MFA breaks headless cron orchestration.
  - *Granting `UPDATE` on `MARTS` to `ROLE_DATA_PULSE_SERVICE`:* Rejected for violating Principle of Least Privilege.

## Consequences
- **Positive:**
  - Mathematically caps worst-case monthly Snowflake exposure at `$150.00/mo` while operating steady-state at `$2.50/mo`.
  - Prevents `SVC_DATA_PULSE` from mutating source analytical marts.
- **Negative / Operational Trade-offs:**
  - Because `SVC_DATA_PULSE` has read-only access to `MARTS`, `SnowflakeWarehouseAdapter.apply_remediated_source_records()` is a deliberate PoLP no-op; upstream dbt models remediate `MARTS`.
  - Zero-downtime key rotation requires managing `RSA_PUBLIC_KEY` and `RSA_PUBLIC_KEY_2` slots per Runbook `01`.
