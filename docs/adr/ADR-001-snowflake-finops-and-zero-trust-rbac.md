# ADR-001: Snowflake FinOps Guardrails and Zero-Trust RBAC Governance

## Status
Accepted

## Context
Automated Reverse ETL pipelines executing recurring extraction queries against Snowflake risk runaway credit burn from un-suspended warehouses, Cartesian queries, or accidental compute resizing. Furthermore, static password credentials for service accounts create credential leakage and rotation vulnerabilities.

## Decision
We enforce three physical FinOps guardrails on `WH_DATA_PULSE_XS` (`XSMALL`, `AUTO_SUSPEND = 60`): (1) `STATEMENT_TIMEOUT_IN_SECONDS = 300`, (2) `RESOURCE MONITOR` (`RM_DATA_PULSE_MONTHLY_GUARD`) with `SUSPEND_IMMEDIATE` at 100% of a 50-credit monthly quota, and (3) revoking `MODIFY` privileges from `ROLE_DATA_PULSE_SERVICE`. Service account `SVC_DATA_PULSE` authenticates exclusively via 2048-bit RSA Key-Pair with least-privilege `SELECT` access on `MARTS` and write isolation restricted to `AUDIT` tables.

## Consequences
Monthly warehouse spend is mathematically capped at 50 credits and queries exceeding 5 minutes terminate deterministically. Password compromise vectors are eliminated, and unauthorized schema mutations or warehouse scale-ups are blocked by Snowflake RBAC.

