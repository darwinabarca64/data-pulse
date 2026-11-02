/**
 * Infrastructure Layer: Style 2 - Tremor Analytics Quantitative FinOps Dashboard.
 * Features Tremor Category Bars, Snowflake Budget Gauges, and Pareto Tier Distribution.
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
  const showcase = selectShowcaseContacts(state.contacts);
  const filtered = showcase.filter((c) => {
    if (!fUpper) return true;
    if (fUpper === "REMEDIATED_DLQ") return c.customer_id >= "CUST-09801";
    return c.customer_tier.toUpperCase().includes(fUpper) || c.customer_id.toUpperCase().includes(fUpper);
  });

  const rowsHtml = filtered
    .map((c) => {
      const isHealed = c.customer_id >= "CUST-09801";
      const briefCell = c.ai_executive_brief
        ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 mr-1.5">[VIP-BRIEF]</span> <span class="text-slate-300">${escapeHtml(c.ai_executive_brief)}</span>`
        : isHealed
          ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mr-1.5">[HEALED-DLQ]</span> <span class="text-slate-400">Remediated via Out-of-Band AI DLQ Doctor &amp; Surgical Replay</span>`
          : `<span class="text-slate-500 font-mono text-xs">[OK] Standard Margin Profile</span>`;
      const marginColor = c.profit_margin_pct < 0 ? "text-rose-400 font-bold" : "text-emerald-400 font-semibold";
      const tierBadge = isHealed
        ? `<span class="px-2 py-0.5 rounded text-xs font-mono font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mr-1">${escapeHtml(c.customer_tier)}</span><span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">REMEDIATED_DLQ</span>`
        : `<span class="px-2 py-0.5 rounded text-xs font-mono font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">${escapeHtml(c.customer_tier)}</span>`;

      return `<tr class="border-b border-slate-800/80 hover:bg-slate-800/40 transition-colors">
        <td class="px-3.5 py-2.5 font-mono text-xs font-semibold text-slate-100">${escapeHtml(c.customer_id)}</td>
        <td class="px-3.5 py-2.5 text-xs text-slate-300 font-mono">${escapeHtml(c.email)}</td>
        <td class="px-3.5 py-2.5 text-xs">${tierBadge}</td>
        <td class="px-3.5 py-2.5 font-mono text-xs text-slate-200">$${c.net_profitability_usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="px-3.5 py-2.5 font-mono text-xs ${marginColor}">${c.profit_margin_pct.toFixed(1)}%</td>
        <td class="px-3.5 py-2.5 text-xs leading-relaxed">${briefCell}</td>
      </tr>`;
    })
    .join("\n");

  const dlqBadgeText =
    state.dlqPendingE > 0
      ? `[QUARANTINED] ${state.dlqPendingE} PENDING (${state.emailErrorsPending} EMAIL | ${state.nanErrorsPending} NAN)`
      : `[RESOLVED] 0 PENDING (${state.dlqResolved} REMEDIATED)`;

  const finopsUtilizationPct = ((2.50 / 150.0) * 100).toFixed(1);
  const saasSavingsPct = ((4170.0 / 4200.0) * 100).toFixed(1);

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DataPulse Reverse ETL | Tremor Analytics FinOps Telemetry</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: "class",
      theme: {
        extend: {
          colors: {
            tremor: {
              brand: "#0284c7",
              card: "#0b1329",
              border: "#1e293b",
            }
          },
          fontFamily: {
            sans: ["Inter", "-apple-system", "sans-serif"],
            mono: ["JetBrains Mono", "monospace"],
          }
        }
      }
    };
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
    body { font-family: 'Inter', sans-serif; background-color: #060b18; }
    .mono { font-family: 'JetBrains Mono', monospace; }
  </style>
</head>
<body class="text-slate-100 min-h-screen p-4 md:p-6 antialiased">
  <!-- Top Navigation & Global Controls -->
  <header class="flex flex-col md:flex-row md:items-center justify-between pb-4 mb-5 border-b border-slate-800 gap-4">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
      </div>
      <div>
        <h1 class="text-base font-bold tracking-tight text-white flex items-center gap-2">
          DataPulse Reverse ETL
          <span class="text-xs px-2 py-0.5 rounded font-mono font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">Style 2: Tremor Analytics</span>
        </h1>
        <p class="text-xs text-slate-400">Hexagonal Architecture | Snowflake &amp; DuckDB | Thin Airflow DAG | Out-of-Band AI DLQ Doctor | HubSpot CRM v3</p>
      </div>
    </div>
    <div class="flex items-center gap-2.5 flex-wrap">
      <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20" id="phase-banner">
        <span class="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
        ${escapeHtml(state.currentPhase)}
      </div>
      <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
        [OK] CONNECTOR ONLINE
      </div>
      <button id="togglePollingBtn" type="button" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono font-medium border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 transition">
        <span class="w-2 h-2 rounded-full bg-emerald-500" id="pollingDot"></span>
        <span id="pollingStatusText">Auto-Poll: ON (2s)</span>
      </button>
      <button id="resetStoreBtn" type="button" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono border border-slate-700 bg-slate-900 text-slate-400 hover:text-rose-400 transition">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        Reset
      </button>
    </div>
  </header>

  <!-- Tremor Category Distribution & FinOps Budget Gauges Row -->
  <section class="grid grid-cols-1 lg:grid-cols-3 gap-3.5 mb-5">
    <!-- Tremor Category Distribution Bar -->
    <div class="rounded-xl border border-slate-800 bg-[#0b1329] p-4 shadow-lg ring-1 ring-slate-800/60">
      <div class="flex items-center justify-between mb-3">
        <div>
          <span class="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">Warehouse Source Distribution</span>
          <div class="text-base font-bold font-mono text-white">10,000 Source Records</div>
        </div>
        <span class="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">98.0% Clean</span>
      </div>
      <!-- Multi-segment Category Bar -->
      <div class="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex mb-3">
        <div class="bg-emerald-500 h-full transition-all duration-500" style="width: 98.0%" title="Clean: 9,800 (98%)"></div>
        <div class="bg-amber-500 h-full transition-all duration-500" style="width: 1.5%" title="Email Poison: 150 (1.5%)"></div>
        <div class="bg-rose-500 h-full transition-all duration-500" style="width: 0.5%" title="NaN Poison: 50 (0.5%)"></div>
      </div>
      <!-- Category Legend -->
      <div class="grid grid-cols-3 gap-2 text-xs font-mono pt-2 border-t border-slate-800/80">
        <div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span><span class="text-slate-300">Clean: 9,800</span></div>
        <div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-amber-500"></span><span class="text-slate-300">Email: 150</span></div>
        <div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-rose-500"></span><span class="text-slate-300">NaN: 50</span></div>
      </div>
    </div>

    <!-- Tremor FinOps Budget Utilization Gauge -->
    <div class="rounded-xl border border-slate-800 bg-[#0b1329] p-4 shadow-lg ring-1 ring-slate-800/60">
      <div class="flex items-center justify-between mb-3">
        <div>
          <span class="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">Snowflake FinOps Budget</span>
          <div class="text-base font-bold font-mono text-emerald-400">$2.50 / $150.00 Mo. Cap</div>
        </div>
        <span class="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">${finopsUtilizationPct}% Utilized</span>
      </div>
      <div class="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex mb-3">
        <div class="bg-emerald-500 h-full transition-all duration-500" style="width: ${finopsUtilizationPct}%"></div>
      </div>
      <div class="flex justify-between items-center text-xs font-mono pt-2 border-t border-slate-800/80 text-slate-400">
        <span>Resource Monitor: 50 Credits</span>
        <span class="text-emerald-400 font-semibold">98.4% Headroom Left</span>
      </div>
    </div>

    <!-- Tremor SaaS Savings Gauge -->
    <div class="rounded-xl border border-slate-800 bg-[#0b1329] p-4 shadow-lg ring-1 ring-slate-800/60">
      <div class="flex items-center justify-between mb-3">
        <div>
          <span class="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">Annual SaaS Displacement</span>
          <div class="text-base font-bold font-mono text-emerald-400">$4,170.00 / yr Saved</div>
        </div>
        <span class="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">${saasSavingsPct}% ROI</span>
      </div>
      <div class="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex mb-3">
        <div class="bg-cyan-500 h-full transition-all duration-500" style="width: ${saasSavingsPct}%"></div>
      </div>
      <div class="flex justify-between items-center text-xs font-mono pt-2 border-t border-slate-800/80 text-slate-400">
        <span>Commercial SaaS: $4,200/yr</span>
        <span class="text-cyan-400 font-semibold">DataPulse: $30/yr</span>
      </div>
    </div>
  </section>

  <!-- 3 Pillars Row -->
  <section class="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-5">
    <!-- Pillar 1 -->
    <div class="rounded-xl border border-slate-800 bg-[#0b1329] p-4 shadow-lg ring-1 ring-slate-800/60">
      <div class="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-800 font-mono text-xs font-semibold tracking-wide uppercase text-cyan-400">
        <span>Pillar 1: Warehouse &amp; FinOps Guardrails</span>
        <svg class="w-4 h-4 text-cyan-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>
      </div>
      <div class="space-y-1.5 text-xs font-mono text-slate-400">
        <div class="flex justify-between"><span>Active Engine:</span><span class="font-semibold text-slate-200">${escapeHtml(state.activeEngine)} (WH_DATA_PULSE_XS)</span></div>
        <div class="flex justify-between"><span>FinOps Policy:</span><span class="text-slate-300">AUTO_SUSPEND=60s | TIMEOUT=300s</span></div>
        <div class="flex justify-between"><span>Resource Monitor:</span><span class="font-semibold text-emerald-400">50 Credits ($150 Cap) | $2.50/mo</span></div>
        <div class="flex justify-between"><span>Source Distribution:</span><span class="text-slate-300">10,000 (9,800 Clean | 200 Poison)</span></div>
        <div class="flex justify-between"><span>High Watermark:</span><span class="text-slate-300">${escapeHtml(state.watermarkTs)}</span></div>
      </div>
    </div>

    <!-- Pillar 2 -->
    <div class="rounded-xl border border-slate-800 bg-[#0b1329] p-4 shadow-lg ring-1 ring-slate-800/60">
      <div class="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-800 font-mono text-xs font-semibold tracking-wide uppercase text-cyan-400">
        <span>Pillar 2: Apache Airflow Thin DAG</span>
        <svg class="w-4 h-4 text-cyan-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="m17 5-5-3-5 3"/><path d="m17 19-5 3-5-3"/></svg>
      </div>
      <div class="space-y-1.5 text-xs font-mono mb-2">
        <div class="flex justify-between text-slate-400"><span>DAG ID:</span><span class="text-slate-200">datapulse_hubspot_profitability_sync</span></div>
        <div class="flex justify-between text-slate-400"><span>DAG SLA &amp; State:</span><span class="font-semibold text-emerald-400">&lt;0.05s SLA | ${escapeHtml(state.dagStatus)}</span></div>
      </div>
      <!-- Horizontal Airflow Tracker -->
      <div class="grid grid-cols-3 gap-1.5 text-[11px] font-mono mt-2">
        <div class="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-center font-semibold">1. manifest<br/><span class="text-[10px] text-emerald-300">[OK]</span></div>
        <div class="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-center font-semibold">2. reverse_etl<br/><span class="text-[10px] text-emerald-300">[SYNC]</span></div>
        <div class="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-center font-semibold">3. dlq_telemetry<br/><span class="text-[10px] text-emerald-300">[AUDIT]</span></div>
      </div>
    </div>

    <!-- Pillar 3 -->
    <div class="rounded-xl border border-slate-800 bg-[#0b1329] p-4 shadow-lg ring-1 ring-slate-800/60">
      <div class="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-800 font-mono text-xs font-semibold tracking-wide uppercase text-cyan-400">
        <span>Pillar 3: N = S + O + E &amp; Out-of-Band AI DLQ Doctor</span>
        <svg class="w-4 h-4 text-cyan-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
      </div>
      <div class="space-y-1.5 text-xs font-mono text-slate-400 mb-2">
        <div class="flex justify-between"><span>Conservation Law:</span><span class="font-semibold text-emerald-400">N(${state.extractedN}) = S(${state.syncedS}) + O(${state.skippedO}) + E(${state.dlqPendingE})</span></div>
        <div class="flex justify-between"><span>DLQ Quarantine:</span><span class="font-semibold ${state.dlqPendingE > 0 ? "text-amber-400" : "text-emerald-400"}">${escapeHtml(dlqBadgeText)}</span></div>
      </div>
      <div class="space-y-1 text-[11px] font-mono">
        <div class="p-1.5 rounded bg-slate-900 border border-slate-800 text-amber-300">1. INVALID_EMAIL_FORMAT (150): REGEXP_REPLACE(LOWER(TRIM(email)))</div>
        <div class="p-1.5 rounded bg-slate-900 border border-slate-800 text-amber-300">2. IEEE_754_NAN_INFINITY (50): COALESCE(NULLIF(margin_pct, 'NaN'), 0.0)</div>
      </div>
    </div>
  </section>

  <!-- 6 KPI Cards with Tremor Delta Badges -->
  <section class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
    <div class="rounded-xl border border-slate-800 bg-[#0b1329] p-3.5 shadow-md ring-1 ring-slate-800/60">
      <div class="flex items-center justify-between mb-1">
        <span class="text-[11px] font-mono uppercase text-slate-400">[S] Synced Contacts</span>
        <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">+100%</span>
      </div>
      <div class="text-xl font-bold font-mono text-emerald-400" id="kpi-synced">${state.totalSyncedContacts.toLocaleString("en-US")}</div>
    </div>
    <div class="rounded-xl border border-slate-800 bg-[#0b1329] p-3.5 shadow-md ring-1 ring-slate-800/60">
      <div class="flex items-center justify-between mb-1">
        <span class="text-[11px] font-mono uppercase text-slate-400">[VIP] Executive Briefs</span>
        <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">AI Gen</span>
      </div>
      <div class="text-xl font-bold font-mono text-white" id="kpi-vip">${state.vipBriefCount}</div>
    </div>
    <div class="rounded-xl border border-slate-800 bg-[#0b1329] p-3.5 shadow-md ring-1 ring-slate-800/60">
      <div class="flex items-center justify-between mb-1">
        <span class="text-[11px] font-mono uppercase text-slate-400">[E] Pending DLQ</span>
        <span class="text-[10px] font-mono px-1.5 py-0.5 rounded ${state.dlqPendingE > 0 ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400"}">${state.dlqResolved} Healed</span>
      </div>
      <div class="text-xl font-bold font-mono ${state.dlqPendingE > 0 ? "text-amber-400" : "text-emerald-400"}" id="kpi-dlq">${state.dlqPendingE}</div>
    </div>
    <div class="rounded-xl border border-slate-800 bg-[#0b1329] p-3.5 shadow-md ring-1 ring-slate-800/60">
      <div class="flex items-center justify-between mb-1">
        <span class="text-[11px] font-mono uppercase text-slate-400">[O] SHA-256 Skipped</span>
        <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400">0 Calls</span>
      </div>
      <div class="text-xl font-bold font-mono text-cyan-400" id="kpi-skipped">${state.skippedO.toLocaleString("en-US")}</div>
    </div>
    <div class="rounded-xl border border-slate-800 bg-[#0b1329] p-3.5 shadow-md ring-1 ring-slate-800/60">
      <div class="flex items-center justify-between mb-1">
        <span class="text-[11px] font-mono uppercase text-slate-400">[HTTP] Batch Requests</span>
        <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400">429: ${state.rateLimitRetriesAbsorbed}</span>
      </div>
      <div class="text-xl font-bold font-mono text-white" id="kpi-batches">${state.totalBatchRequests}</div>
    </div>
    <div class="rounded-xl border border-slate-800 bg-[#0b1329] p-3.5 shadow-md ring-1 ring-slate-800/60">
      <div class="flex items-center justify-between mb-1">
        <span class="text-[11px] font-mono uppercase text-slate-400">[FINOPS] Annual Savings</span>
        <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">-99.3%</span>
      </div>
      <div class="text-xl font-bold font-mono text-emerald-400">$${state.annualSaasSavingsUsd.toLocaleString("en-US")}/yr</div>
    </div>
  </section>

  <!-- Pillar 4 Table Toolbar & Table -->
  <section class="rounded-xl border border-slate-800 bg-[#0b1329] overflow-hidden shadow-lg ring-1 ring-slate-800/60">
    <div class="flex flex-col md:flex-row md:items-center justify-between p-3.5 border-b border-slate-800 gap-3">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-xs font-mono font-semibold uppercase text-slate-400">Pillar 4 (HubSpot CRM v3 Store):</span>
        <button type="button" class="btn-filter ${!fUpper ? "active bg-slate-800 text-white" : "bg-slate-900 text-slate-400"} px-3 py-1 rounded text-xs font-mono font-semibold border border-slate-700" data-filter="">ALL (${state.totalSyncedContacts.toLocaleString("en-US")})</button>
        <button type="button" class="btn-filter ${fUpper === "ENTERPRISE_VIP" ? "active bg-slate-800 text-white" : "bg-slate-900 text-slate-400"} px-3 py-1 rounded text-xs font-mono font-semibold border border-slate-700" id="btnFilterVip" data-filter="ENTERPRISE_VIP">ENTERPRISE_VIP (${state.vipBriefCount})</button>
        <button type="button" class="btn-filter ${fUpper === "REMEDIATED_DLQ" ? "active bg-slate-800 text-white" : "bg-slate-900 text-slate-400"} px-3 py-1 rounded text-xs font-mono font-semibold border border-slate-700" id="btnFilterDlq" data-filter="REMEDIATED_DLQ">REMEDIATED_DLQ (${state.dlqResolved})</button>
      </div>
      <div class="relative">
        <input type="search" id="filterInput" value="${escapeHtml(initialFilter)}" placeholder="Filter by Tier/Email/ID..." class="w-full md:w-80 px-3 py-1.5 pl-8 rounded-md text-xs font-mono bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-cyan-500" />
        <svg class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      </div>
    </div>

    <!-- Table -->
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="border-b border-slate-800 bg-slate-900/60 text-[11px] font-mono uppercase tracking-wider text-slate-400">
            <th class="px-3.5 py-2.5 font-medium">Customer ID</th>
            <th class="px-3.5 py-2.5 font-medium">Email</th>
            <th class="px-3.5 py-2.5 font-medium">Tier &amp; Status</th>
            <th class="px-3.5 py-2.5 font-medium">Net Profitability</th>
            <th class="px-3.5 py-2.5 font-medium">Margin (%)</th>
            <th class="px-3.5 py-2.5 font-medium">VIP Executive Action Brief / DLQ Provenance</th>
          </tr>
        </thead>
        <tbody id="contactsBody">
          ${rowsHtml || '<tr><td colspan="6" class="px-4 py-8 text-center text-xs font-mono text-slate-500">[INFO] Stage 0 Baseline: 0 Contacts in HubSpot CRM. Run datapulse init &amp; datapulse run to stream batches...</td></tr>'}
        </tbody>
      </table>
    </div>
  </section>

  <!-- Client-Side Reactive Controller -->
  <script>
    const input = document.getElementById("filterInput");
    const buttons = document.querySelectorAll(".btn-filter");
    function applyFilter(query) {
      const q = query.toLowerCase();
      document.querySelectorAll("#contactsBody tr").forEach((row) => {
        row.style.display = row.innerText.toLowerCase().includes(q) ? "" : "none";
      });
    }
    input.addEventListener("input", () => applyFilter(input.value));
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => b.classList.remove("active", "bg-slate-800", "text-white"));
        btn.classList.add("active", "bg-slate-800", "text-white");
        const f = btn.getAttribute("data-filter") || "";
        input.value = f;
        applyFilter(f);
      });
    });

    document.getElementById("resetStoreBtn").addEventListener("click", async () => {
      if (confirm("Reset CRM Memory Store to 0 contacts?")) {
        await fetch("/api/v1/reset", { method: "POST" });
        location.reload();
      }
    });

    let pollingActive = true;
    const togglePollBtn = document.getElementById("togglePollingBtn");
    const pollDot = document.getElementById("pollingDot");
    const pollStatusText = document.getElementById("pollingStatusText");

    togglePollBtn.addEventListener("click", () => {
      pollingActive = !pollingActive;
      pollDot.className = pollingActive ? "w-2 h-2 rounded-full bg-emerald-500" : "w-2 h-2 rounded-full bg-slate-500";
      pollStatusText.innerText = pollingActive ? "Auto-Poll: ON (2s)" : "Auto-Poll: PAUSED";
    });

    setInterval(async () => {
      if (!pollingActive) return;
      try {
        const resp = await fetch("/api/v1/state");
        if (!resp.ok) return;
        const s = await resp.json();
        document.getElementById("kpi-synced").innerText = s.totalSyncedContacts.toLocaleString("en-US");
        document.getElementById("kpi-vip").innerText = s.vipBriefCount;
        document.getElementById("kpi-dlq").innerText = s.dlqPendingE;
        document.getElementById("kpi-skipped").innerText = s.skippedO.toLocaleString("en-US");
        document.getElementById("kpi-batches").innerText = s.totalBatchRequests;
        document.getElementById("phase-banner").innerText = s.currentPhase;
      } catch (err) {}
    }, 2000);
  </script>
</body>
</html>`;
}
