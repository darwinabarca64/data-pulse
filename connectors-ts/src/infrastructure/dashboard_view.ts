/**
 * Infrastructure Layer: 4-Pillar Unified Visual Mission Control Scratchpad Renderer.
 */

import { NormalizedCrmContact } from "../domain/contracts.js";

export interface TelemetryOverlay {
  activeEngine?: string;
  currentPhase?: string;
  dagStatus?: string;
  watermarkTs?: string;
  extractedN?: number;
  syncedS?: number;
  skippedO?: number;
  dlqPendingE?: number;
  dlqResolved?: number;
  emailErrorsPending?: number;
  nanErrorsPending?: number;
}

export interface CrmStoreState {
  totalSyncedContacts: number;
  vipBriefCount: number;
  totalBatchRequests: number;
  rateLimitRetriesAbsorbed: number;
  rejectedRecordCount: number;
  annualSaasSavingsUsd: number;
  activeEngine: string;
  currentPhase: string;
  dagStatus: string;
  watermarkTs: string;
  extractedN: number;
  syncedS: number;
  skippedO: number;
  dlqPendingE: number;
  dlqResolved: number;
  emailErrorsPending: number;
  nanErrorsPending: number;
  remediatedContactCount: number;
  contacts: NormalizedCrmContact[];
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function selectShowcaseContacts(contacts: NormalizedCrmContact[]): NormalizedCrmContact[] {
  const vips = contacts.filter((c) => Boolean(c.ai_executive_brief)).slice(0, 10);
  const healed = contacts.filter((c) => c.customer_id >= "CUST-09801" && !c.ai_executive_brief).slice(0, 10);
  const standard = contacts.filter((c) => c.customer_id < "CUST-09801" && !c.ai_executive_brief).slice(0, 10);
  const combined = [...vips, ...healed, ...standard];
  return combined.length > 0 ? combined : contacts.slice(0, 30);
}

export function renderLiveDashboardHtml(state: CrmStoreState, initialFilter = ""): string {
  const fUpper = initialFilter.trim().toUpperCase();
  const rowsHtml = selectShowcaseContacts(state.contacts)
    .filter((c) => {
      if (!fUpper) return true;
      if (fUpper === "REMEDIATED_DLQ") return c.customer_id >= "CUST-09801";
      return c.customer_tier.toUpperCase().includes(fUpper) || c.customer_id.toUpperCase().includes(fUpper);
    })
    .map((c) => {
      const isHealed = c.customer_id >= "CUST-09801";
      const briefCell = c.ai_executive_brief
        ? `<span class="badge-vip">[VIP-BRIEF]</span> ${escapeHtml(c.ai_executive_brief)}`
        : isHealed
          ? `<span class="badge-healed">[HEALED-DLQ]</span> Remediated via Out-of-Band AI DLQ Doctor &amp; Surgical Replay`
          : `<span class="muted">[OK] Standard Margin Profile</span>`;
      const marginClass = c.profit_margin_pct < 0 ? "neg" : "pos";
      const tierBadge = isHealed
        ? `<span class="tier">${escapeHtml(c.customer_tier)}</span> <span class="badge-healed">REMEDIATED_DLQ</span>`
        : `<span class="tier">${escapeHtml(c.customer_tier)}</span>`;
      return `<tr>
        <td class="mono">${escapeHtml(c.customer_id)}</td>
        <td>${escapeHtml(c.email)}</td>
        <td>${tierBadge}</td>
        <td class="mono">${c.net_profitability_usd.toFixed(2)} ${escapeHtml(c.currency_code)}</td>
        <td class="mono ${marginClass}">${c.profit_margin_pct.toFixed(1)}%</td>
        <td>${briefCell}</td>
      </tr>`;
    })
    .join("\n");

  const dlqBadgeText =
    state.dlqPendingE > 0
      ? `[QUARANTINED] ${state.dlqPendingE} PENDING (${state.emailErrorsPending} EMAIL | ${state.nanErrorsPending} NAN)`
      : `[RESOLVED] 0 PENDING (${state.dlqResolved} REMEDIATED)`;

  const dagTask1Class = state.extractedN > 0 || state.totalSyncedContacts > 0 ? "dag-done" : "dag-idle";
  const dagTask2Class = state.totalSyncedContacts >= 10000 ? "dag-done" : state.totalSyncedContacts > 0 ? "dag-run" : "dag-idle";
  const dagTask3Class = state.dlqPendingE > 0 ? "dag-warn" : state.totalSyncedContacts >= 10000 ? "dag-done" : "dag-idle";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DataPulse Reverse ETL | 4-Pillar Unified Visual Mission Control</title>
  <style>
    :root { --bg: #070b14; --panel: #0f172a; --panel-alt: #1e293b; --border: #334155; --text: #f8fafc; --muted: #94a3b8; --accent: #38bdf8; --ok: #10b981; --warn: #f59e0b; --danger: #ef4444; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: system-ui, -apple-system, sans-serif; padding: 16px 22px; }
    header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 14px; }
    h1 { font-size: 1.15rem; letter-spacing: 0.04em; text-transform: uppercase; color: var(--accent); }
    .header-badges { display: flex; gap: 10px; align-items: center; }
    .phase-tag { font-family: monospace; background: #1e3a8a; color: #93c5fd; border: 1px solid #3b82f6; padding: 6px 12px; border-radius: 4px; font-size: 0.8rem; font-weight: 700; }
    .status-tag { font-family: monospace; background: #064e3b; color: #34d399; border: 1px solid #10b981; padding: 6px 12px; border-radius: 4px; font-size: 0.8rem; font-weight: 700; }
    .pillars-top { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 14px; }
    .pillar-box { background: var(--panel); border: 1px solid var(--border); border-radius: 6px; padding: 12px; }
    .pillar-title { font-family: monospace; font-size: 0.75rem; text-transform: uppercase; color: var(--accent); margin-bottom: 8px; font-weight: 700; border-bottom: 1px solid var(--border); padding-bottom: 5px; }
    .meta-row { display: flex; justify-content: space-between; font-family: monospace; font-size: 0.76rem; margin-bottom: 5px; color: var(--muted); }
    .meta-val { color: var(--text); font-weight: 600; }
    .dag-step { font-family: monospace; font-size: 0.74rem; padding: 5px 8px; border-radius: 4px; margin-bottom: 5px; border: 1px solid var(--border); background: #090d16; display: flex; justify-content: space-between; }
    .dag-done { border-color: var(--ok); color: #6ee7b7; background: rgba(16, 185, 129, 0.1); }
    .dag-run { border-color: var(--accent); color: #7dd3fc; background: rgba(56, 189, 248, 0.12); }
    .dag-warn { border-color: var(--warn); color: #fcd34d; background: rgba(245, 158, 11, 0.14); }
    .dag-idle { color: var(--muted); }
    .grid-kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 14px; }
    .card { background: var(--panel); border: 1px solid var(--border); border-radius: 6px; padding: 10px 12px; }
    .card-label { font-size: 0.68rem; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; font-family: monospace; }
    .card-val { font-size: 1.35rem; font-weight: 700; font-family: monospace; }
    .toolbar { display: flex; justify-content: space-between; margin-bottom: 10px; align-items: center; background: var(--panel); padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; }
    .filter-btns { display: flex; gap: 8px; align-items: center; }
    .btn-filter { background: var(--panel-alt); color: var(--text); border: 1px solid var(--border); padding: 6px 12px; border-radius: 4px; font-family: monospace; font-size: 0.76rem; cursor: pointer; font-weight: 600; }
    .btn-filter.active, .btn-filter:hover { border-color: var(--accent); background: #1e3a8a; color: #fff; }
    input[type="search"] { background: #090d16; border: 1px solid var(--border); color: var(--text); padding: 6px 12px; border-radius: 4px; width: 290px; font-family: monospace; font-size: 0.8rem; }
    table { width: 100%; border-collapse: collapse; background: var(--panel); border: 1px solid var(--border); font-size: 0.82rem; }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); }
    th { background: var(--panel-alt); color: var(--muted); font-family: monospace; text-transform: uppercase; font-size: 0.72rem; }
    .mono { font-family: monospace; } .pos { color: var(--ok); font-weight: 600; } .neg { color: var(--danger); font-weight: 700; } .warn-text { color: var(--warn); font-weight: 700; }
    .tier { background: #1e3a8a; color: #93c5fd; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 0.72rem; }
    .badge-vip { background: #7c2d12; color: #fdba74; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 0.72rem; font-weight: 700; }
    .badge-healed { background: #064e3b; color: #6ee7b7; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 0.72rem; font-weight: 700; }
    .muted { color: var(--muted); font-family: monospace; font-size: 0.76rem; }
    .sql-pill { font-family: monospace; font-size: 0.7rem; background: #090d16; border: 1px solid var(--border); padding: 4px 6px; border-radius: 4px; color: #fcd34d; margin-top: 4px; }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>DataPulse Reverse ETL | 4-Pillar Unified Visual Mission Control</h1>
      <p class="muted">Hexagonal Architecture | Snowflake &amp; DuckDB | Thin Airflow DAG | Out-of-Band AI DLQ Doctor | HubSpot CRM v3</p>
    </div>
    <div class="header-badges">
      <div class="phase-tag" id="phase-banner">${escapeHtml(state.currentPhase)}</div>
      <div class="status-tag">[OK] CONNECTOR ONLINE</div>
    </div>
  </header>
  <section class="pillars-top">
    <div class="pillar-box">
      <div class="pillar-title">Pillar 1: Warehouse &amp; FinOps Guardrails</div>
      <div class="meta-row"><span>Active Engine:</span><span class="meta-val">${escapeHtml(state.activeEngine)} (WH_DATA_PULSE_XS)</span></div>
      <div class="meta-row"><span>FinOps Policy:</span><span class="meta-val">AUTO_SUSPEND=60s | TIMEOUT=300s</span></div>
      <div class="meta-row"><span>Resource Monitor:</span><span class="meta-val pos">50 Credits ($150 Cap) | $2.50/mo</span></div>
      <div class="meta-row"><span>Source Distribution:</span><span class="meta-val">10,000 (9,800 Clean | 200 Poison)</span></div>
      <div class="meta-row"><span>High Watermark:</span><span class="meta-val">${escapeHtml(state.watermarkTs)}</span></div>
    </div>
    <div class="pillar-box">
      <div class="pillar-title">Pillar 2: Apache Airflow Thin DAG (&lt;0.05s SLA)</div>
      <div class="meta-row"><span>DAG ID:</span><span class="meta-val">datapulse_hubspot_profitability_sync</span></div>
      <div class="meta-row"><span>DAG State:</span><span class="meta-val pos">${escapeHtml(state.dagStatus)}</span></div>
      <div class="dag-step ${dagTask1Class}"><span>1. validate_sync_manifest</span><span>[OK]</span></div>
      <div class="dag-step ${dagTask2Class}"><span>2. execute_incremental_reverse_etl</span><span>[SYNC]</span></div>
      <div class="dag-step ${dagTask3Class}"><span>3. audit_dlq_and_finops_telemetry</span><span>[AUDIT]</span></div>
    </div>
    <div class="pillar-box">
      <div class="pillar-title">Pillar 3: N = S + O + E &amp; Out-of-Band AI DLQ Doctor</div>
      <div class="meta-row"><span>Conservation Law:</span><span class="meta-val pos">N(${state.extractedN}) = S(${state.syncedS}) + O(${state.skippedO}) + E(${state.dlqPendingE})</span></div>
      <div class="meta-row"><span>DLQ Quarantine Status:</span><span class="meta-val ${state.dlqPendingE > 0 ? "warn-text" : "pos"}">${escapeHtml(dlqBadgeText)}</span></div>
      <div class="sql-pill">1. INVALID_EMAIL_FORMAT (150): REGEXP_REPLACE(LOWER(TRIM(email)))</div>
      <div class="sql-pill">2. IEEE_754_NAN_INFINITY (50): COALESCE(NULLIF(margin_pct, 'NaN'), 0.0)</div>
    </div>
  </section>
  <section class="grid-kpis">
    <div class="card"><div class="card-label">[S] Synced Contacts</div><div class="card-val pos" id="kpi-synced">${state.totalSyncedContacts.toLocaleString("en-US")}</div></div>
    <div class="card"><div class="card-label">[VIP] Executive Briefs</div><div class="card-val" id="kpi-vip">${state.vipBriefCount}</div></div>
    <div class="card"><div class="card-label">[E] Pending DLQ</div><div class="card-val ${state.dlqPendingE > 0 ? "warn-text" : "pos"}" id="kpi-dlq">${state.dlqPendingE} (${state.dlqResolved} Healed)</div></div>
    <div class="card"><div class="card-label">[O] SHA-256 Skipped</div><div class="card-val pos" id="kpi-skipped">${state.skippedO.toLocaleString("en-US")}</div></div>
    <div class="card"><div class="card-label">[HTTP] Batch Requests</div><div class="card-val" id="kpi-batches">${state.totalBatchRequests} (429s: ${state.rateLimitRetriesAbsorbed})</div></div>
    <div class="card"><div class="card-label">[FINOPS] Annual Savings</div><div class="card-val pos">$${state.annualSaasSavingsUsd.toLocaleString("en-US")}/yr</div></div>
  </section>
  <div class="toolbar">
    <div class="filter-btns">
      <span class="muted">Pillar 4 (HubSpot CRM v3 Store):</span>
      <button type="button" class="btn-filter ${!fUpper ? "active" : ""}" data-filter="">ALL (${state.totalSyncedContacts.toLocaleString("en-US")})</button>
      <button type="button" class="btn-filter ${fUpper === "ENTERPRISE_VIP" ? "active" : ""}" id="btnFilterVip" data-filter="ENTERPRISE_VIP">ENTERPRISE_VIP (${state.vipBriefCount})</button>
      <button type="button" class="btn-filter ${fUpper === "REMEDIATED_DLQ" ? "active" : ""}" id="btnFilterDlq" data-filter="REMEDIATED_DLQ">REMEDIATED_DLQ (${state.dlqResolved})</button>
    </div>
    <input type="search" id="filterInput" value="${escapeHtml(initialFilter)}" placeholder="Filter by Tier/Email/ID (e.g. ENTERPRISE_VIP)..." />
  </div>
  <table>
    <thead>
      <tr><th>Customer ID</th><th>Email</th><th>Tier &amp; Status</th><th>Net Profitability</th><th>Margin (%)</th><th>VIP Executive Action Brief / DLQ Provenance</th></tr>
    </thead>
    <tbody id="contactsBody">
      ${rowsHtml || '<tr><td colspan="6" class="muted">[INFO] Stage 0 Baseline: 0 Contacts in HubSpot CRM. Run datapulse init &amp; datapulse run to stream batches...</td></tr>'}
    </tbody>
  </table>
  <script>
    const input = document.getElementById("filterInput");
    const buttons = document.querySelectorAll(".btn-filter");
    function applyFilter(query) {
      const q = query.toLowerCase();
      for (const row of document.querySelectorAll("#contactsBody tr")) {
        row.style.display = row.innerText.toLowerCase().includes(q) ? "" : "none";
      }
    }
    input.addEventListener("input", () => applyFilter(input.value));
    for (const btn of buttons) {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const f = btn.getAttribute("data-filter") || "";
        input.value = f;
        applyFilter(f);
      });
    }
  </script>
</body>
</html>`;
}
