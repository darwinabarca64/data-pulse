# Runbook 09: Custom Database & Schema Integration Architecture

## 1. Purpose & Architectural Scope

This runbook documents how to connect, configure, and synchronize arbitrary source databases (e.g., local DuckDB simulation with 5,555 records, custom E-commerce/SaaS models, or cloud data warehouses such as Snowflake, BigQuery, and PostgreSQL) using DataPulse declarative YAML manifests and Pydantic v2 contract firewalling.

```
+-----------------------------------+       +-----------------------------------+
|      Source Warehouse Mart        |  -->  |    Declarative YAML Manifest      |
|  (DuckDB / Snowflake / Postgres)  |       |   (syncs/ecommerce_5555.yml)      |
+-----------------------------------+       +-----------------------------------+
                  |                                           |
                  v                                           v
+-----------------------------------+       +-----------------------------------+
|   Pydantic Row-Level Firewall     |  -->  |   Target Destination (CRM/API)    |
|   (NaN / RFC-5322 / extra="allow")|       |   (HubSpot v3 / Mock Server :3000)|
+-----------------------------------+       +-----------------------------------+
                  |
                  v
+-----------------------------------+
|   Dead-Letter Queue Quarantine    |
|   (audit.data_pulse_dlq_quarantine|
+-----------------------------------+
```

1. **Warehouse Mart:** Exposes the source analytical view of customer or entity records.
2. **Declarative YAML Manifest:** Maps arbitrary source column names to standardized destination properties without altering engine application source code.
3. **Pydantic Contract Firewall (`extra="allow"`):** Dynamically accepts arbitrary columns while enforcing core data integrity rules (valid RFC-5322 emails, non-NaN numerical floats).
4. **Dead-Letter Queue Isolation:** Diverts invalid rows to quarantine without crashing the pipeline stream.
5. **SHA-256 State Diffing:** Hashes incoming records against destination state to ensure zero redundant HTTP payload dispatches.

---

## 2. Local Simulation: Integrating a 5,555-Row E-Commerce Dataset

### 2.1 Generating the Custom Dataset in DuckDB

To simulate a real-world enterprise dataset containing 5,555 customers with custom metrics (`total_spend_usd`, `order_count`, `loyalty_tier`, `churn_risk_score`), execute the following Python seed script:

```bash
python -c "
import duckdb, random

con = duckdb.connect('data/ecommerce_5555.duckdb')
con.execute('''
CREATE OR REPLACE TABLE mart_ecommerce_customers AS 
SELECT 
  'CUST-' || LPAD(CAST(range AS VARCHAR), 5, '0') AS customer_id,
  'user_' || LPAD(CAST(range AS VARCHAR), 5, '0') || '@store.com' AS email,
  'Customer ' || LPAD(CAST(range AS VARCHAR), 5, '0') AS company_name,
  ROUND(CAST(random() * 50000 AS NUMERIC), 2) AS total_spend_usd,
  CAST(random() * 50 AS INTEGER) + 1 AS order_count,
  CASE WHEN random() > 0.85 THEN 'PLATINUM' WHEN random() > 0.50 THEN 'GOLD' ELSE 'STANDARD' END AS loyalty_tier,
  ROUND(CAST(random() * 100 AS NUMERIC), 1) AS churn_risk_score,
  CURRENT_TIMESTAMP AS updated_at
FROM range(1, 5556)
''')

# Inject deterministic edge-case anomalies for DLQ triage testing
con.execute(\"UPDATE mart_ecommerce_customers SET email = 'corrupt@@domain..com' WHERE customer_id IN ('CUST-00100', 'CUST-00200')\")
con.execute(\"UPDATE mart_ecommerce_customers SET total_spend_usd = 'NaN'::FLOAT WHERE customer_id IN ('CUST-00300', 'CUST-00400')\")
con.close()
print('[OK] Seeded 5,555 e-commerce rows into data/ecommerce_5555.duckdb')
"
```

### 2.2 Crafting the Declarative YAML Manifest

Create the manifest file at `syncs/ecommerce_5555.yml` to define source extraction, rate limiting, and field mappings:

```yaml
version: "1.0"
sync_id: "ecommerce_customer_sync"
description: "Reverse ETL Sync: 5,555 E-commerce Customers to CRM"

source:
  type: "duckdb"
  connection:
    database: "data/ecommerce_5555.duckdb"
  query: "SELECT customer_id, email, company_name, total_spend_usd, order_count, loyalty_tier, churn_risk_score, updated_at FROM mart_ecommerce_customers"
  primary_key: "customer_id"

destination:
  type: "hubspot_mock"
  endpoint: "http://localhost:3000/crm/v3/objects/contacts/batch/upsert"
  batch_size: 100
  rate_limit:
    max_requests_per_second: 50
    token_bucket_capacity: 100

mappings:
  - source_field: "customer_id"
    target_field: "hs_external_customer_id"
    required: true
  - source_field: "email"
    target_field: "email"
    required: true
    validation: "email_rfc_5322"
  - source_field: "company_name"
    target_field: "company"
  - source_field: "total_spend_usd"
    target_field: "annual_revenue"
    data_type: "float"
    validation: "not_nan"
  - source_field: "churn_risk_score"
    target_field: "profit_margin_pct"
    data_type: "float"
  - source_field: "loyalty_tier"
    target_field: "customer_tier"

dlq:
  storage: "duckdb"
  table: "ecommerce_dlq_quarantine"
  auto_replay: true
```

### 2.3 Step-by-Step Execution via CLI

Ensure the DataPulse connector microservice is running (`http://localhost:3000`), then execute:

#### Step 1: Initial Sync & Anomaly Quarantine
```bash
python -m datapulse.interfaces.cli run --manifest syncs/ecommerce_5555.yml --db-path data/ecommerce_5555.duckdb
```
*Expected Outcome:* 5,551 records upserted across 56 HTTP micro-batches; 4 anomaly records quarantined to DLQ.

#### Step 2: Out-of-Band Forensic Triage & Surgical Replay
```bash
python -m datapulse.interfaces.cli dlq inspect --sync-id ecommerce_customer_sync --db-path data/ecommerce_5555.duckdb
python -m datapulse.interfaces.cli dlq replay --manifest syncs/ecommerce_5555.yml --db-path data/ecommerce_5555.duckdb
```
*Expected Outcome:* 4 poisoned rows sanitized and replayed. Total contacts in CRM: 5,555. Remaining DLQ: 0.

#### Step 3: Idempotent Pass & State Diffing
```bash
python -m datapulse.interfaces.cli run --manifest syncs/ecommerce_5555.yml --no-seed --db-path data/ecommerce_5555.duckdb
```
*Expected Outcome:* 5,555 records skipped in memory via SHA-256 hash match; 0 redundant HTTP calls made.

---

## 3. Production Cloud Deployment: Snowflake, BigQuery, or PostgreSQL

To cut over to live production warehouses:

### 3.1 Production Environment Variables
Configure the connection parameters in `.env`:

```bash
# Cloud Warehouse Connection
SOURCE_ENGINE=snowflake
DEMO_SEED_ENABLED=false
SNOWFLAKE_ACCOUNT=xy12345.us-east-1
SNOWFLAKE_USER=SVC_DATA_PULSE
SNOWFLAKE_PRIVATE_KEY_PATH=infra/keys/rsa_key.p8
SNOWFLAKE_DATABASE=ANALYTICS_PROD
SNOWFLAKE_SCHEMA=MARTS
SNOWFLAKE_WAREHOUSE=WH_DATA_PULSE_XS

# Live Destination API
HUBSPOT_API_BASE_URL=https://api.hubapi.com
HUBSPOT_ACCESS_TOKEN=pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ENFORCE_HMAC=true
WEBHOOK_HMAC_SECRET=prod-vault-hmac-secret-key-32b
```

### 3.2 Production Cloud Manifest
In `syncs/production_snowflake.yml`:

```yaml
version: "1.0"
sync_id: "prod_customer_profitability"

source:
  type: "snowflake"
  connection:
    account: "${SNOWFLAKE_ACCOUNT}"
    database: "${SNOWFLAKE_DATABASE}"
    schema: "${SNOWFLAKE_SCHEMA}"
    warehouse: "${SNOWFLAKE_WAREHOUSE}"
  query: "SELECT customer_id, email, company_name, annual_revenue, annual_cost, net_profitability_usd, profit_margin_pct, customer_tier, updated_at FROM mart_customer_profitability"
  primary_key: "customer_id"

destination:
  type: "hubspot_v3"
  endpoint: "${HUBSPOT_API_BASE_URL}/crm/v3/objects/contacts/batch/upsert"
  auth_bearer_token: "${HUBSPOT_ACCESS_TOKEN}"
  batch_size: 100
  rate_limit:
    max_requests_per_second: 100
```

### 3.3 Production Apache Airflow Thin DAG
Deploy thin DAG to `orchestration/dags/datapulse_ecommerce_sync_dag.py`:

```python
"""Thin Airflow DAG orchestrating production custom database sync via DataPulse CLI."""
from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.bash import BashOperator

default_args = {
    "owner": "data-engineering",
    "depends_on_past": False,
    "email_on_failure": False,
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
}

with DAG(
    "datapulse_ecommerce_sync",
    default_args=default_args,
    description="Hourly Reverse-ETL sync for E-commerce customer mart",
    schedule_interval="@hourly",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    max_active_runs=1,
) as dag:
    sync_task = BashOperator(
        task_id="run_reverse_etl_sync",
        bash_command="datapulse run --manifest syncs/ecommerce_5555.yml --no-seed",
    )
    dlq_task = BashOperator(
        task_id="auto_heal_dlq",
        bash_command="datapulse dlq replay --manifest syncs/ecommerce_5555.yml --no-seed",
    )
    sync_task >> dlq_task
```

---

## 4. Operational Troubleshooting Table

| Error / Failure Symptom | Root Cause Analysis | Diagnostic Command | Remediation Action |
| :--- | :--- | :--- | :--- |
| **`ValidationError: extra fields not permitted`** | Manifest model has `extra="forbid"` instead of `extra="allow"` on domain contracts. | `python -m pytest core-engine/tests/ -v` | Ensure `CustomerProfitabilityRecord` has `model_config = ConfigDict(extra="allow")`. |
| **`DuckDB Error: Table ... does not exist`** | Source database file was not seeded or file path is relative to wrong directory. | `python -c "import duckdb; print(duckdb.connect('data/ecommerce_5555.duckdb').execute('SHOW TABLES').fetchall())"` | Execute the Python seed script to instantiate table `mart_ecommerce_customers`. |
| **`HTTP 422 Unprocessable Entity on Batch Upsert`** | Target field mapping produces invalid JSON payload violating destination schema. | Inspect `connectors-ts` log output: `npm run test` | Verify mapping definitions in YAML match destination property contracts. |
| **`DLQ Auto-Replay Fails with Unrecognized Signature`** | Quarantined records contain an anomaly pattern not covered by deterministic sanitizers. | `datapulse dlq inspect --sync-id ecommerce_customer_sync` | Add appropriate regex or replacement logic in `AIDLQDoctor` for the new failure code. |
| **`Airflow DAG Parse Timeout > 0.5s`** | Top-level database or heavy library imports placed inside the Airflow DAG file. | `python orchestration/dags/datapulse_hubspot_sync_dag.py` | Keep DAG thin: use `BashOperator` to invoke CLI, avoiding heavy imports in module scope. |

