# Runbook 01: Snowflake FinOps Guardrails and Zero-Trust RBAC Provisioning

## Overview
This runbook documents the end-to-end operational procedure for provisioning DataPulse's Snowflake infrastructure (`WH_DATA_PULSE_XS`, `RM_DATA_PULSE_MONTHLY_GUARD`, `ANALYTICS_PROD`, and `SVC_DATA_PULSE`) using asymmetric 2048-bit RSA Key-Pair authentication and strict FinOps cost controls.

---

## 1. Generate 2048-Bit RSA Key Pair for `SVC_DATA_PULSE`

DataPulse prohibits static passwords for automated service accounts. Generate an unencrypted (or passphrase-protected PKCS#8) 2048-bit RSA key pair locally inside `infra/keys/` (ensure `*.p8` and `*.pub` are never committed to Git).

### Step-by-Step Key Generation
1. Create the local key directory and ensure it is excluded from version control:
   ```powershell
   New-Item -ItemType Directory -Force -Path "infra\keys"
   ```
2. Generate the private key in PKCS#8 format using OpenSSL:
   ```powershell
   openssl genrsa 2048 | openssl pkcs8 -topk8 -inform PEM -out infra/keys/rsa_key.p8 -nocrypt
   ```
3. Derive the corresponding RSA public key:
   ```powershell
   openssl rsa -in infra/keys/rsa_key.p8 -pubout -out infra/keys/rsa_key.pub
   ```
4. Extract the single-line base64 public key body (stripping `-----BEGIN PUBLIC KEY-----` and `-----END PUBLIC KEY-----` headers) to paste into `infra/snowflake/01_security_rbac.sql`:
   ```powershell
   Get-Content infra/keys/rsa_key.pub | Where-Object { $_ -notmatch "PUBLIC KEY" } | Join-String
   ```

---

## 2. Provision FinOps Guardrails (`00_finops_guardrails.sql`)

Execute `infra/snowflake/00_finops_guardrails.sql` as `ACCOUNTADMIN` via Snowsight or SnowSQL CLI:

```powershell
snowsql -a <SNOWFLAKE_ACCOUNT> -u <ADMIN_USER> -r ACCOUNTADMIN -f infra/snowflake/00_finops_guardrails.sql
```

### What This Script Enforces
- **Warehouse Sizing**: Creates `WH_DATA_PULSE_XS` (`XSMALL`, `AUTO_SUSPEND = 60`, `AUTO_RESUME = TRUE`, `INITIALLY_SUSPENDED = TRUE`).
- **Guardrail 1 (Query Timeout)**: Sets `STATEMENT_TIMEOUT_IN_SECONDS = 300` and `STATEMENT_QUEUED_TIMEOUT_IN_SECONDS = 120`.
- **Guardrail 2 (Hard Credit Cap)**: Creates `RM_DATA_PULSE_MONTHLY_GUARD` with `CREDIT_QUOTA = 50` (`MONTHLY`), triggering `NOTIFY` at 75%, `SUSPEND` at 95%, and `SUSPEND_IMMEDIATE` at 100%.
- **Guardrail 3 (Scale-Up Lock)**: Grants only `USAGE, OPERATE` on `WH_DATA_PULSE_XS` to `ROLE_DATA_PULSE_SERVICE` and explicitly revokes `MODIFY` so pipelines cannot resize the warehouse.

---

## 3. Provision Zero-Trust RBAC & Governance Policies (`01_security_rbac.sql`)

1. Replace the `RSA_PUBLIC_KEY` placeholder in `infra/snowflake/01_security_rbac.sql` with the public key string generated in Section 1.
2. Execute `infra/snowflake/01_security_rbac.sql`:
   ```powershell
   snowsql -a <SNOWFLAKE_ACCOUNT> -u <ADMIN_USER> -r ACCOUNTADMIN -f infra/snowflake/01_security_rbac.sql
   ```

### What This Script Enforces
- **Schemas & Tables**: Creates `ANALYTICS_PROD.MARTS.FCT_CUSTOMER_PROFITABILITY`, `ANALYTICS_PROD.AUDIT.DATA_PULSE_WATERMARKS`, and `ANALYTICS_PROD.AUDIT.DATA_PULSE_DLQ`.
- **Principle of Least Privilege (PoLP)**: Grants `ROLE_DATA_PULSE_SERVICE` read-only `SELECT` on `MARTS.FCT_CUSTOMER_PROFITABILITY` and restricts `INSERT, UPDATE` privileges strictly to `AUDIT` tables.
- **Enterprise Governance**: Attaches Dynamic Data Masking (`pii_email_mask`) to `EMAIL` and Row-Level Security (`region_isolation_policy`) to `REGION`.

---

## 4. Verification Queries

Run the following verification commands in Snowsight or SnowSQL to confirm all FinOps and RBAC controls are active:

```sql
-- 1. Verify Warehouse Auto-Suspend and Resource Monitor Binding
SHOW WAREHOUSES LIKE 'WH_DATA_PULSE_XS';

-- 2. Verify Timeout Parameters (Must show 300s statement timeout)
SHOW PARAMETERS IN WAREHOUSE WH_DATA_PULSE_XS;

-- 3. Verify Active Resource Monitor Triggers (75% / 95% / 100% SUSPEND_IMMEDIATE)
SHOW RESOURCE MONITORS LIKE 'RM_DATA_PULSE_MONTHLY_GUARD';

-- 4. Verify RSA Public Key Fingerprint on Service User
DESC USER SVC_DATA_PULSE;

-- 5. Verify PoLP Grants on Service Role
SHOW GRANTS TO ROLE ROLE_DATA_PULSE_SERVICE;
```

