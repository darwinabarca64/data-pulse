# GUIA: INTEGRACION DE NUEVAS BASES DE DATOS Y MODELOS DE NEGOCIO EN DATAPULSE

Este documento detalla paso a paso la arquitectura, los comandos y las rutas necesarias para conectar, procesar y sincronizar una nueva base de datos (por ejemplo, 5,555 clientes con un modelo de negocio de E-commerce, Fintech o SaaS) utilizando el motor declarativo de DataPulse, tanto en entorno local como en produccion cloud (online).

---

## 1. Arquitectura Agnóstica del Esquema

DataPulse opera mediante una arquitectura desacoplada en tres capas:

```
[ Data Warehouse / Mart ] ---> [ Manifiesto Declarativo YAML ] ---> [ Destino CRM / API ]
  (DuckDB / Snowflake)          (Contrato, Reglas y Mapeos)          (HubSpot / Salesforce)
                                            |
                                            v
                                 [ Dead-Letter Queue (DLQ) ]
                                 (Cuarentena y Auto-Reparacion)
```

1. **Warehouse Mart:** Expone la vista analitica limpia de clientes.
2. **Manifiesto YAML:** Traduce cualquier esquema fuente hacia las propiedades esperadas por la plataforma de destino sin modificar el codigo fuente de la aplicacion.
3. **Mecanismo de Calidad:** Si una fila no cumple los contratos de tipos o validacion (ej. email invalido, NaN numerico), el motor la desvia a la Dead-Letter Queue (DLQ) sin interrumpir el resto de la sincronizacion.
4. **Idempotencia SHA-256:** DataPulse computa un hash determinista por cada registro. Si los datos no han cambiado respecto al destino, la llamada HTTP se omite (0 llamadas duplicadas).

---

## 2. Implementación Paso a Paso en Entorno Local (DuckDB)

### Paso 1: Generar la Base de Datos Simulada (5,555 registros)

Para simular una base de datos de 5,555 clientes correspondiente a un nuevo negocio (ej. E-commerce con `total_spend_usd`, `order_count`, `loyalty_tier` y `churn_risk_score`), se genera una base de datos local DuckDB en:

- **Ruta de destino:** `data/ecommerce_5555.duckdb`

Se puede generar ejecutando un script de seeding en Python:

```bash
python -c "
import duckdb, random

con = duckdb.connect('data/ecommerce_5555.duckdb')
con.execute('CREATE OR REPLACE TABLE mart_ecommerce_customers AS SELECT * FROM (SELECT ' ||
  '''CUST-'' || LPAD(CAST(range AS VARCHAR), 5, ''0'') AS customer_id, ''' ||
  '''user_'' || LPAD(CAST(range AS VARCHAR), 5, ''0'') || ''@store.com'' AS email, ''' ||
  '''Customer '' || LPAD(CAST(range AS VARCHAR), 5, ''0'') AS company_name, ''' ||
  'ROUND(CAST(random() * 50000 AS NUMERIC), 2) AS total_spend_usd, ''' ||
  'CAST(random() * 50 AS INTEGER) + 1 AS order_count, ''' ||
  'CASE WHEN random() > 0.85 THEN ''PLATINUM'' WHEN random() > 0.50 THEN ''GOLD'' ELSE ''STANDARD'' END AS loyalty_tier, ''' ||
  'ROUND(CAST(random() * 100 AS NUMERIC), 1) AS churn_risk_score ' ||
  'FROM range(1, 5556)
)')

# Inyectar una fraccion controlada de anomalias (DLQ edge cases)
con.execute('UPDATE mart_ecommerce_customers SET email = ''corrupt@@domain..com'' WHERE customer_id IN (''CUST-00100'', ''CUST-00200'')')
con.execute('UPDATE mart_ecommerce_customers SET total_spend_usd = ''NaN''::FLOAT WHERE customer_id IN (''CUST-00300'', ''CUST-00400'')')
con.close()
print('Base de datos data/ecommerce_5555.duckdb creada con 5,555 clientes.')
"
```

---

### Paso 2: Crear el Manifiesto Declarativo YAML

Crea el archivo de configuracion que mapea los 5,555 registros al conector de destino:

- **Ruta del archivo:** `syncs/ecommerce_5555.yml`

**Contenido del manifiesto:**

```yaml
version: "1.0"
sync_id: "ecommerce_customer_sync"
description: "Reverse ETL Sync: 5,555 E-commerce Customers to CRM"

source:
  type: "duckdb"
  connection:
    database: "data/ecommerce_5555.duckdb"
  query: "SELECT customer_id, email, company_name, total_spend_usd, order_count, loyalty_tier, churn_risk_score FROM mart_ecommerce_customers"
  primary_key: "customer_id"

destination:
  type: "hubspot_mock"
  endpoint: "http://localhost:3000/api/v1/contacts/batch"
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
    target_field: "hs_net_profitability_usd"
    data_type: "float"
    validation: "not_nan"
  - source_field: "churn_risk_score"
    target_field: "hs_profit_margin_pct"
    data_type: "float"
  - source_field: "loyalty_tier"
    target_field: "datapulse_customer_tier"

dlq:
  storage: "duckdb"
  table: "ecommerce_dlq_quarantine"
  auto_replay: true
```

---

### Paso 3: Ejecutar el Flujo de Datos via CLI

Con el servidor de DataPulse activo (`http://localhost:3000`), ejecuta los comandos paso a paso:

#### 1. Sincronización Inicial (Extract & Sync)
Extrae las 5,555 filas, sincroniza los registros validos al CRM y aisla las anomalias en la Dead-Letter Queue:
```bash
python -m datapulse.interfaces.cli run --manifest syncs/ecommerce_5555.yml
```
*Resultado esperado:* 5,551 registros sincronizados exitosamente, 4 registros retenidos en DLQ.

#### 2. Diagnóstico y Auto-Reparación (AI Doctor & Replay)
Repara los correos mal formados mediante regex RFC-5322 y sanea los valores NaN antes de reenviarlos al CRM:
```bash
python -m datapulse.interfaces.cli dlq replay --manifest syncs/ecommerce_5555.yml
```
*Resultado esperado:* 4 registros reparados e inyectados al CRM. Total clientes en CRM: 5,555 (0 registros perdidos).

#### 3. Verificación de Idempotencia y Caché SHA-256
Ejecuta una sincronización incremental sobre los mismos registros para validar el ahorro de peticiones HTTP:
```bash
python -m datapulse.interfaces.cli run --manifest syncs/ecommerce_5555.yml
```
*Resultado esperado:* 5,555 llamadas omitidas por comparacion de firma hash SHA-256 (100% cache hit, 0 llamadas duplicadas a la API).

#### 4. Reinicio a Cero (Opcional)
Para limpiar el almacenamiento en memoria y volver al estado inicial base:
```bash
powershell -Command "Invoke-RestMethod -Uri 'http://localhost:3000/api/v1/reset' -Method Post"
```

---

## 3. Despliegue en Entorno Online / Producción Cloud

Para operar con bases de datos en la nube (Snowflake, BigQuery, PostgreSQL) y destinos CRM reales (HubSpot Cloud v3):

### 1. Variables de Entorno de Producción
Configura en tu gestor de secretos o en `.env` las credenciales de produccion:
```bash
# Data Warehouse Cloud
WAREHOUSE_TYPE=snowflake
SNOWFLAKE_ACCOUNT=xy12345.us-east-1
SNOWFLAKE_USER=DATAPULSE_SVC
SNOWFLAKE_PASSWORD=SecretVaultPassword123
SNOWFLAKE_DATABASE=ANALYTICS_PROD
SNOWFLAKE_SCHEMA=MARTS
SNOWFLAKE_WAREHOUSE=COMPUTE_WH

# Destino CRM Cloud
CRM_DESTINATION_URL=https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert
CRM_API_KEY=pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
CRM_RATE_LIMIT_RPS=100
```

### 2. Modificación del Manifiesto para Cloud
En `syncs/production_sync.yml`:
```yaml
version: "1.0"
sync_id: "prod_customer_sync"

source:
  type: "snowflake"
  connection:
    account: "${SNOWFLAKE_ACCOUNT}"
    database: "${SNOWFLAKE_DATABASE}"
    schema: "${SNOWFLAKE_SCHEMA}"
  query: "SELECT customer_id, email, company_name, total_spend_usd, churn_risk_score, loyalty_tier FROM mart_customers"
  primary_key: "customer_id"

destination:
  type: "hubspot_v3"
  endpoint: "${CRM_DESTINATION_URL}"
  auth_bearer_token: "${CRM_API_KEY}"
  batch_size: 100
  rate_limit:
    max_requests_per_second: 100
```

### 3. Orquestación Automatizada en Producción (Airflow / CronJob)
Programa la ejecución del contenedor de DataPulse dentro de tu DAG de Apache Airflow (`orchestration/dags/`):
```python
from airflow import DAG
from airflow.operators.bash import BashOperator
from datetime import datetime, timedelta

default_args = {
    "owner": "data-engineering",
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
}

with DAG("datapulse_reverse_etl_hourly", default_args=default_args, schedule_interval="@hourly", start_date=datetime(2026, 1, 1), catchup=False) as dag:
    sync_task = BashOperator(
        task_id="run_reverse_etl_sync",
        bash_command="python -m datapulse.interfaces.cli run --manifest syncs/production_sync.yml",
    )
    dlq_task = BashOperator(
        task_id="auto_heal_dlq",
        bash_command="python -m datapulse.interfaces.cli dlq replay --manifest syncs/production_sync.yml",
    )
    sync_task >> dlq_task
```

### 4. Monitoreo y Gobernanza
- La telemetria se expone a traves del endpoint `GET /api/v1/telemetry` compatible con Prometheus, Datadog o Grafana.
- El panel de control web permite a los ingenieros de datos auditar en tiempo real la tasa de entrega limpia, las filas en cuarentena y el ahorro acumulado por deduplicación SHA-256.

