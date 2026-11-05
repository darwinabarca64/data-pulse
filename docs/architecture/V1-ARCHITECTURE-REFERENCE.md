# DataPulse V1 Architecture Reference & Engineering Specification

## Executive Summary & Document Purpose

This document provides a comprehensive technical audit, functional breakdown, and architectural blueprint of the original DataPulse production interface ("Style 4: Staff-Grade Ultimate Fusion"), captured from the initial operational release.

The purpose of this specification is to preserve the exact operational capabilities, FinOps telemetry, data pipeline topology, and mathematical invariants of Version 1. This ensures that future iterations can systematically restore and integrate these genuine data engineering features, replacing superficial SaaS or generic CRM mockups with authentic, production-grade warehouse-to-destination observability.

---

## 1. Core Architectural Identity: Data Engineering vs Generic UI

In generic dashboards, metrics often mimic end-user CRM views (such as "Total Visitors", "Revenue by Segment", or marketing funnels). However, DataPulse is fundamentally a **Reverse ETL & Data Pipeline Platform** that bridges analytical warehouses (Snowflake, BigQuery, DuckDB) with operational downstream systems (HubSpot CRM, Salesforce, Webhooks).

The V1 interface reflected the true realities of modern Data Platform Engineering:
- **Zero Painted Metrics:** Every counter represented an exact row state from the warehouse, engine, or destination.
- **Mathematical Invariant Enforcement:** Explicit verification of the Conservation Law of Data Ingestion ($N = S + O + E$).
- **Financial Operations (FinOps):** Real-time monitoring of Snowflake warehouse credit consumption and dollar cost avoidance vs third-party SaaS vendors (Census, Hightouch).
- **Out-of-Band Data Quality Remediation:** Live visibility into Dead Letter Queue (DLQ) triage and SQL regex healing routines.
- **Thin Orchestrator Observability:** Real-time synchronization state with Apache Airflow DAG execution steps.

---

## 2. Comprehensive Decomposition of V1 Interface Components

The V1 system was architected into five distinct operational tiers:

```
+----------------------------------------------------------------------------------------------------+
| TOP BAR: System Identity, Architectural Stack Subtitle, Sync Phase, Health, Auto-Poll, Theme       |
+----------------------------------------------------------------------------------------------------+
| 1. INTERACTIVE PIPELINE TOPOLOGY CANVAS                                                            |
|    [SOURCE: Snowflake/DuckDB] --> [DAG: Airflow Thin DAG] --> [AI DOCTOR: DLQ] --> [STORE: HubSpot] |
+----------------------------------------------------------------------------------------------------+
| 2. FINOPS & DATA QUALITY GAUGES (3 Cards)                                                          |
|    [Source Distribution: 10k]    | [Snowflake FinOps Budget: $2.50]  | [Commercial SaaS Savings: $4.1k] |
+----------------------------------------------------------------------------------------------------+
| 3. ARCHITECTURAL PILLARS (3 Deep-Inspection Panels)                                                |
|    [Pillar 1: Warehouse FinOps]   | [Pillar 2: Apache Airflow DAG]    | [Pillar 3: N=S+O+E & AI Doctor]  |
+----------------------------------------------------------------------------------------------------+
| 4. TELEMETRY LEDGER (6 KPI Invariant Cards)                                                        |
|    [S] Synced Contacts           | [VIP] Executive Briefs           | [E] Pending DLQ                  |
|    [O] SHA-256 Skipped           | [HTTP] Batch Requests (429s)     | [FINOPS] Annual Savings          |
+----------------------------------------------------------------------------------------------------+
| 5. DESTINATION STORE EXPLORER & DLQ PROVENANCE TABLE                                               |
|    Tabs: [ALL] | [ENTERPRISE_VIP] | [REMEDIATED_DLQ]               | Search | Full Provenance Grid     |
+----------------------------------------------------------------------------------------------------+
```

---

## 3. Tier-by-Tier Functional Specification

### 3.1 Top Bar & System Control
- **System Title:** `DataPulse Reverse ETL`
- **Architectural Tagline:** `Hexagonal Architecture | Snowflake & DuckDB | Thin Airflow DAG | Out-of-Band AI DLQ Doctor | HubSpot CRM v3`
- **Execution Phase Badge:** Dynamic banner indicating pipeline stage:
  - `PHASE 1: INITIAL SYNC (9,800 SYNCED | 200 DLQ)`
  - `PHASE 2: SURGICAL REPLAY (10,000 SYNCED | 0 DLQ)`
- **System Health Dot:** `[OK] CONNECTOR ONLINE` (real-time ping to the TypeScript HTTP engine).
- **Polling Indicator:** `Auto-Poll (2s)` reflecting automated telemetry refresh.
- **Operational Controls:**
  - `Reset` button: Triggers clean-slate wipe across both in-memory store and warehouse database files.
  - Multi-theme selector: `Obsidian` (dark terminal theme), `Tremor` (minimalist enterprise), and `Light` (clean high-contrast mode).

### 3.2 Tier 1: Interactive Pipeline Topology Canvas
An interactive DAG canvas rendering the four nodes of the reverse ETL lifecycle with real-time counters and node-selection inspectors:

1. **Node 1: SOURCE (Analytical Warehouse)**
   - Engine: `Snowflake / DuckDB`
   - Compute Cluster: `WH_DATA_PULSE_XS (XSMALL)`
   - Live Volume: `10,000 Extracted` | `9,800 Clean`
   - Purpose: Visualizes the source data mart extracted under incremental watermark boundaries.

2. **Node 2: DAG (Orchestration Engine)**
   - Engine: `Airflow Thin DAG`
   - Performance SLA: `<0.05s SLA | 3 Tasks`
   - State & Schedule: `IDLE (SCHEDULE: 0 * * * *)` | Status: `Audited`
   - Purpose: Confirms that orchestration is delegated to a thin containerized workflow without blocking compute threads.

3. **Node 3: AI DOCTOR (Quality & Quarantine Engine)**
   - Subsystem: `Python AI DLQ Doctor`
   - Mathematical Target: `N = S + O + E Invariant`
   - Healing State: `200/200 Healed` | `0 Pending`
   - Purpose: Displays real-time repair of malformed inputs without interrupting the main delivery stream.

4. **Node 4: STORE (Operational Target)**
   - Subsystem: `HubSpot CRM v3 Store`
   - Backpressure Defense: `Rate Limit Burst Absorbed`
   - Ingestion Counts: `0 Synced` | `0 VIPs` (updates dynamically during batch upserts).
   - Purpose: Confirms token-bucket rate-limiting and HTTP 429 backoff handling on the destination API.

### 3.3 Tier 2: FinOps & Data Quality Distribution Visualizers
Three horizontal visual gauges focused on cost, compute, and data hygiene:

1. **Card 1: Source Distribution**
   - Headline: `10,000 Source Records`
   - Metric Badge: `98.0% Clean`
   - Multi-segment Progress Bar:
     - Green segment: Clean warehouse rows (`9,800`)
     - Amber segment: Poison email formats (`150`)
     - Red segment: IEEE-754 NaN/Infinity corrupt numbers (`50`)
   - Functionality: Immediate identification of warehouse data drift and malformed inputs before ingestion.

2. **Card 2: Snowflake FinOps Budget**
   - Headline: `$2.50 / $150.00 Mo. Cap`
   - Metric Badge: `1.7% Utilized`
   - Progress Bar: Proportional credit burn rate.
   - Subtext: `Quota: 50 Credits ($150)` | `98.4% Budget Intact`
   - Functionality: Real-time FinOps governance preventing warehouse credit overruns and surprise cloud bills.

3. **Card 3: Commercial SaaS Savings**
   - Headline: `$4,170.00 / yr Saved`
   - Metric Badge: `99.3% Saved`
   - Progress Bar: Cost comparison visualizer.
   - Subtext: `SaaS: $4,200/yr` vs `DataPulse: $30/yr`
   - Functionality: Demonstrates the economic ROI of in-house thin reverse ETL versus commercial solutions (Census, Hightouch).

### 3.4 Tier 3: The Three Architectural Pillars (Technical Guardrails)
Three deep-inspection terminal cards articulating the internal mechanics of the pipeline:

#### Pillar 1: Warehouse & FinOps Guardrails
- **Active Engine:** `duckdb_local (WH_DATA_PULSE_XS)`
- **FinOps Policy:** `AUTO_SUSPEND=60s | TIMEOUT=300s`
- **Resource Monitor:** `50 Credits ($150 Cap) | $2.50/mo`
- **Source Distribution:** `10,000 (9,800 Clean | 200 Poison)`
- **High Watermark:** `2026-10-29T02:46:40Z (15m Lookback)`
- **Engineering Value:** Validates incremental watermark filtering and engine auto-suspension policies.

#### Pillar 2: Apache Airflow Thin DAG
- **DAG Identifier:** `datapulse_hubspot_profitability_sync`
- **DAG SLA & State:** `<0.05s SLA | IDLE (SCHEDULE: 0 * * * *)`
- **Task Progression Ledger:**
  1. `validate_sync_manifest [OK]` (validates YAML schema, credentials, field mappings).
  2. `execute_incremental_reverse_etl [SYNC]` (extracts delta rows, hashes state, dispatches batches).
  3. `audit_dlq_and_finops_telemetry [AUDIT]` (reconciles equations, logs FinOps telemetry).
- **Engineering Value:** Transparent task-level status verifying that data transformations happen in warehouse SQL, keeping the DAG thin and resilient.

#### Pillar 3: N = S + O + E & Out-of-Band AI DLQ Doctor
- **Conservation Equation:** `N(0) = S(0) + O(0) + E(0)`
  - $N$: Extracted rows from warehouse
  - $S$: Successfully synchronized to CRM
  - $O$: Omitted (unchanged state via SHA-256 hash match)
  - $E$: Errored/quarantined in Dead Letter Queue
- **Quarantine Status:** `[RESOLVED] 0 PENDING (0 REMEDIATED)`
- **Automated Remediation Rules:**
  1. `INVALID_EMAIL_FORMAT (150)`:
     ```sql
     REGEXP_REPLACE(LOWER(TRIM(email)), '@@', '@')
     ```
  2. `IEEE_754_NAN_INFINITY (50)`:
     ```sql
     COALESCE(NULLIF(margin_pct, 'NaN'), 0.0)
     ```
- **Engineering Value:** Mathematical proof of zero data loss combined with self-documenting SQL healing logic.

### 3.5 Tier 4: Telemetry KPI Cards (Hexagonal Ledger)
Six granular counters reflecting exact pipeline telemetry:

| KPI Metric Card | Typical State | Operational Meaning |
| :--- | :--- | :--- |
| `[S] SYNCED CONTACTS` | `9,800` (or `10,000`) | Clean records successfully upserted into the downstream CRM. |
| `[VIP] EXECUTIVE BRIEFS` | `243` | Accounts with critical margin drops processed through the AI summarizer. |
| `[E] PENDING DLQ` | `200 (0 Healed)` | Records quarantined due to schema validation failure. |
| `[O] SHA-256 SKIPPED` | `0` (or `9,800`) | Unchanged records skipped by hash comparison, saving downstream API calls. |
| `[HTTP] BATCH REQUESTS` | `98 (429s: 0)` | Number of chunked HTTP calls sent, with rate-limiting retries tracked. |
| `[FINOPS] ANNUAL SAVINGS` | `$4,170/yr` | Net annual cost difference compared to fixed-tier SaaS platforms. |

### 3.6 Tier 5: Destination Store Explorer & DLQ Provenance Table
A detailed inspection table designed for data engineers and operational teams:
- **Filtering Capabilities:**
  - `ALL (0)`: Displays the entire synced dataset.
  - `ENTERPRISE_VIP (0)`: Filters for high-value accounts with negative or volatile margins.
  - `REMEDIATED_DLQ (0)`: Specifically isolates rows that failed initial ingestion and were repaired by the DLQ Doctor.
- **Search Bar:** Real-time client-side filter by Customer ID, Email, or Remediation status.
- **Table Columns:**
  1. `CUSTOMER ID`: Unique warehouse surrogate key (`CUST-00001`).
  2. `EMAIL`: Sanitized email address.
  3. `TIER & STATUS`: Account segment (`ENTERPRISE_VIP`, `MID_MARKET`) and sync state.
  4. `NET PROFITABILITY`: Calculated profit/loss dollar amount.
  5. `MARGIN (%)`: Calculated percentage margin.
  6. `VIP EXECUTIVE ACTION BRIEF / DLQ PROVENANCE`: AI-synthesized warning for executive retention, or quarantine audit trail detailing which error code was caught and which SQL rule repaired it.

---

## 4. Key Strengths of V1 to Preserve in Future Upgrades

1. **Self-Documenting Invariant Equation ($N = S + O + E$):**
   Unlike standard web dashboards that show isolated counts, V1 anchored every single metric to a formal conservation law. If 10,000 rows were extracted, the sum of Synced, Skipped, and Errored rows had to equal 10,000 at all times.

2. **Explicit FinOps Attribution:**
   Data platform engineers are judged on cloud warehouse efficiency. Showing Snowflake credit consumption, auto-suspend timeouts, and annual cost savings makes the business case for custom Reverse ETL self-evident.

3. **Direct Exposure of DLQ Remediation SQL:**
   Showing the exact regex and coalesce expressions used to fix poison records elevates the tool from a black-box synchronizer to an enterprise data quality asset.

4. **Provenance Tracking in the Data Table:**
   Displaying why a record was held and how it was repaired provides audit compliance and eliminates support tickets from CRM users asking why emails or numbers look modified.

---

## 5. Roadmap for Future Implementation

When upgrading the interface, the following strategy will seamlessly merge the strengths of both versions:

1. **Modular Tabs / View Switcher:**
   - **Executive / Ingestion View (Current):** Dual-Wave Shadcn Area Chart, throughput volume, batch timeline, and declarative schema mapping modal.
   - **Data Engineering / FinOps View (V1):** The 4-node Topology Canvas, Airflow Task Ledger, Snowflake Credit Monitor, and Conservation Equation.

2. **Integration of the DLQ Doctor Card:**
   - Incorporate the SQL repair expressions (`REGEXP_REPLACE` and `COALESCE`) directly into the DLQ Review drawer or modal.

3. **Telemetry Card Fusion:**
   - Retain the exact mathematical counters `[S]`, `[VIP]`, `[E]`, `[O]`, `[HTTP]` and `[FINOPS]` as selectable metric headers above the main chart.

---

## 6. Notas de Auditoria y Feedback Operacional (Darwin)

Esta seccion compila, estructura y documenta formalmente las observaciones de auditoria detectadas durante las pruebas locales en `http://localhost:3000`. Estas notas definen los requerimientos de rectificacion funcional para futuras iteraciones del conector y de la interfaz, asegurando fidelidad 100% real con el estado de ejecucion.

---

### Nota 1: Erradicacion de Datos Mockeados / Suposiciones Previas en Estado Cero
- **Observacion:** En la pantalla inicial aparecian valores como `+99.3%`, `10k Mart`, y rangos predefinidos de registros (`CUST-09801..09950` y `CUST-09951..10000`), aun cuando el usuario todavia no habia ejecutado el comando de inicializacion de la base de datos (`datapulse init`).
- **Analisis Tecnico:** Antes de inicializar la base de datos DuckDB, el sistema conector no puede presuponer que existen 10,000 registros ni deducir que rangos exactos de IDs contienen anomalias. Mostrar esos textos en estado inicial constituye una suposicion cableada (mocked metadata).
- **Requerimiento:** Cuando la base de datos no ha sido inicializada (`totalSyncedContacts === 0` y `extracted === 0`), todos los indicadores deben mostrar estrictamente `0` o `Standby: Esperando inicializacion`. Ningun rango de clientes ni porcentaje proyectado debe figurar como dato hardcodeado en las plantillas HTML o modales informativos.

---

### Nota 2: Reactividad del Auto-Refresh (Polling Automatico sin F5)
- **Observacion:** Al ejecutar comandos desde la terminal, la pagina en el navegador no actualizaba automaticamente los contadores, obligando a presionar F5 manualmente.
- **Analisis Tecnico:** El script del cliente web contaba con un intervalo de auto-polling (`setInterval`), pero si la conexion HTTP caia, el endpoint no retornaba diferencias detectables o la funcion interna de actualizacion fallaba silenciosamente, el DOM permanecia congelado.
- **Requerimiento:** El bucle de refresco (cada 2 segundos) contra `/api/v1/telemetry` debe ser infalible y reactivo. Debe parsear el payload JSON recibido, verificar cambios en los contadores y actualizar directamente los nodos del DOM (KPIs, barras de progreso, SVG del grafico y tabla) sin requerir intervencion manual del usuario ni recarga de la pagina web.

---

### Nota 3: Navegacion de Filas (Visualizacion de Registros Iniciales y Finales) y Buscador
- **Observacion:** La tabla unicamente desplegaba un bloque fijo de las primeras 25 filas. Esto impedia auditar las filas finales del dataset (donde residen los casos venenosos de prueba `CUST-09801` a `CUST-10000`). Asimismo, el campo de busqueda presentaba lentitud y no filtraba registros fuera de la vista activa.
- **Analisis Tecnico:** La paginacion no ofrecia botones directos para saltar al inicio o al final del dataset, y el filtrado se ejecutaba sobre el DOM renderizado en lugar de filtrar sobre la matriz de memoria completa de registros.
- **Requerimiento:**
  1. Implementar controles de navegacion con acceso rapido a las paginas iniciales y finales del almacén.
  2. El buscador debe operar de forma instantanea en memoria (`client-side memory index`), evaluando ID de cliente, correo electronico y clasificacion de tier sobre todo el conjunto cargado en microsegundos.

---

### Nota 4: Diagnostico del Comando de Replay de la CLI
- **Observacion:** El comando `python -m datapulse.interfaces.cli replay --manifest syncs/hubspot_profitability.yml --db-path data/local_warehouse.duckdb` reporto no haber surtido efecto en la ejecucion de prueba.
- **Analisis Tecnico:** El comando `replay` consulta la tabla `audit.data_pulse_dlq_quarantine` en DuckDB. Si dicha base de datos fue reseteada por completo o si la fase 1 (`run`) no se ejecuto previamente, no existiran registros en estado pendiente de cuarentena para ser reparados. Adicionalmente, si el endpoint de reseteo borro la base DuckDB pero no se reinicializo con `init`, el archivo de base de datos no existia en disco.
- **Requerimiento:** La CLI debe imprimir mensajes descriptivos claros en terminal si no encuentra registros en cuarentena o si la tabla de DLQ esta vacia, guiando al operador sobre la fase requerida.

---

### Nota 5: Fundamento Tecnico: Que es SHA-256 en Reverse ETL
- **Observacion:** Necesidad de clarificar conceptualmente que es y para que se utiliza el hash SHA-256 en esta arquitectura.
- **Explicacion de Arquitectura:**
  1. **Que es:** SHA-256 (Secure Hash Algorithm de 256 bits) es una funcion criptografica que convierte cualquier conjunto de datos en una cadena alfanumerica unica de 64 caracteres (por ejemplo, `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`). Si un solo caracter del registro cambia, el hash resultante cambia por completo.
  2. **Rol en Reverse ETL (Deduplicacion de Estado):** En lugar de enviar 10,000 registros por HTTP al CRM en cada corrida (lo cual saturaria los limites de tasa de HubSpot o Salesforce y costaria miles de dolares en llamadas API), DataPulse concatena los campos clave de cada fila (`customer_id`, `email`, `net_profitability_usd`, `margin_pct`) y calcula su hash SHA-256.
  3. **Ahorro Operativo:** Este hash se contrasta contra la tabla interna `audit.data_pulse_state_hashes`. Si el hash coincide con el de la corrida anterior, el motor sabe matematicamente que el registro no ha sufrido modificaciones y lo clasifica como `[O] SHA-256 SKIPPED`. No se realiza ninguna llamada de red, logrando sincronizaciones en menos de 0.2 segundos y cero gasto innecesario de cuota.

---

### Nota 6: Interactividad y Despliegue de Puntos de Informacion y Botones
- **Observacion:** Varios botones interactivos y los iconos de informacion `(i)` en las cabeceras no respondian al clic.
- **Analisis Tecnico:** La delegacion de eventos del cliente web presentaba colisiones entre el evento `onclick` general de las filas de la tabla (`openInspectorFromRow`) y los botones internos, o los identificadores de modales tenian discrepancias con el DOM generado.
- **Requerimiento:**
  - Aislar los eventos con `event.stopPropagation()` en todos los botones y selectores.
  - Asegurar que los botones `(i)` desplieguen popovers modales limpios con la explicacion de arquitectura de cada seccion.

---

### Nota 7: Dinamica del Grafico de Flujo de Pipeline
- **Observacion:** El grafico de dos olas en el panel central no reflejaba la evolucion de los lotes durante la ingesta.
- **Analisis Tecnico:** El endpoint de telemetria emitia metricas globales pero no transmitia el historial secuencial de lotes (`batches: [...]`), lo que obligaba al cliente a dibujar una linea plana o a esperar la finalizacion total.
- **Requerimiento:** El conector debe acumular en un arreglo circular de memoria los ultimos 100 lotes recibidos (`{ batchIndex, deliveredCount, quarantinedCount, timestamp }`), y el cliente debe recalcular las curvas SVG de Bezier en cada sondeo de 2 segundos para mostrar la onda en tiempo real.

---

### Nota 8: Secuencia Operacional Estandar Verificada (Git Bash)

Para validar el ciclo de vida completo de forma controlada desde terminales independientes de Git Bash:

#### Terminal 1: Servidor de Conectores
```bash
npm --prefix connectors-ts start
```
*Inicia el conector en `http://localhost:3000` con el endpoint de ingestion y telemetria activo.*

#### Terminal 2: Pipeline de Datos CLI
```bash
# 1. Configurar path de Python para Git Bash
export PYTHONPATH="core-engine/src"

# 2. Resetear el sistema a cero absoluto
curl.exe -s -X POST http://localhost:3000/api/v1/reset

# 3. Inicializar DuckDB con 10,000 registros sinteticos
python -m datapulse.interfaces.cli init --rows 10000 --db-path data/local_warehouse.duckdb

# 4. Ejecutar sincronizacion principal (Fase 1: 9,800 entregados, 200 a DLQ)
python -m datapulse.interfaces.cli run --manifest syncs/hubspot_profitability.yml --db-path data/local_warehouse.duckdb

# 5. Ejecutar remediacion quirurgica (Fase 2: 200 reparados, 0 pendientes)
python -m datapulse.interfaces.cli replay --manifest syncs/hubspot_profitability.yml --db-path data/local_warehouse.duckdb
```
---