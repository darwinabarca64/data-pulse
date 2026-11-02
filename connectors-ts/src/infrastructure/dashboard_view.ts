/**
 * Infrastructure Layer: Style 1 - Shadcn/UI & Vercel Obsidian Mission Control.
 * Features Slide-Over JSON Inspector, Dark/Light Mode, and 2s Live Auto-Polling.
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
        ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 mr-1">[VIP-BRIEF]</span> <span class="text-zinc-300 dark:text-zinc-300">${escapeHtml(c.ai_executive_brief)}</span>`
        : isHealed
          ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mr-1">[HEALED-DLQ]</span> <span class="text-zinc-400">Remediated via Out-of-Band AI DLQ Doctor &amp; Surgical Replay</span>`
          : `<span class="text-zinc-500 dark:text-zinc-400 font-mono text-xs">[OK] Standard Margin Profile</span>`;
      const marginColor = c.profit_margin_pct < 0 ? "text-rose-400 font-bold" : "text-emerald-400 font-semibold";
      const tierBadge = isHealed
        ? `<span class="px-2 py-0.5 rounded text-xs font-mono font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 mr-1">${escapeHtml(c.customer_tier)}</span><span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">REMEDIATED_DLQ</span>`
        : `<span class="px-2 py-0.5 rounded text-xs font-mono font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">${escapeHtml(c.customer_tier)}</span>`;
      const safeJson = escapeHtml(JSON.stringify(c));

      return `<tr class="customer-row border-b border-zinc-200 dark:border-zinc-800/80 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors" data-contact="${safeJson}">
        <td class="px-3.5 py-2.5 font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">${escapeHtml(c.customer_id)}</td>
        <td class="px-3.5 py-2.5 text-xs text-zinc-600 dark:text-zinc-300 font-mono">${escapeHtml(c.email)}</td>
        <td class="px-3.5 py-2.5 text-xs">${tierBadge}</td>
        <td class="px-3.5 py-2.5 font-mono text-xs text-zinc-900 dark:text-zinc-200">$${c.net_profitability_usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="px-3.5 py-2.5 font-mono text-xs ${marginColor}">${c.profit_margin_pct.toFixed(1)}%</td>
        <td class="px-3.5 py-2.5 text-xs leading-relaxed">${briefCell}</td>
      </tr>`;
    })
    .join("\n");

  const dlqBadgeText =
    state.dlqPendingE > 0
      ? `[QUARANTINED] ${state.dlqPendingE} PENDING (${state.emailErrorsPending} EMAIL | ${state.nanErrorsPending} NAN)`
      : `[RESOLVED] 0 PENDING (${state.dlqResolved} REMEDIATED)`;

  const dagTask1Class = state.extractedN > 0 || state.totalSyncedContacts > 0 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-zinc-800 bg-zinc-900/40 text-zinc-400";
  const dagTask2Class = state.totalSyncedContacts >= 10000 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : state.totalSyncedContacts > 0 ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-400" : "border-zinc-800 bg-zinc-900/40 text-zinc-400";
  const dagTask3Class = state.dlqPendingE > 0 ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : state.totalSyncedContacts >= 10000 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-zinc-800 bg-zinc-900/40 text-zinc-400";

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DataPulse Reverse ETL | 4-Pillar Unified Visual Mission Control (Shadcn/Vercel)</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: "class",
      theme: {
        extend: {
          colors: {
            obsidian: "#09090b",
            subtle: "#18181b",
          },
          fontFamily: {
            sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
            mono: ["JetBrains Mono", "monospace"],
          }
        }
      }
    };
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
    body { font-family: 'Inter', sans-serif; }
    .mono { font-family: 'JetBrains Mono', monospace; }
  </style>
</head>
<body class="bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 min-h-screen p-4 md:p-6 transition-colors duration-200">
  <!-- Top Navigation & Global Controls -->
  <header class="flex flex-col md:flex-row md:items-center justify-between pb-4 mb-5 border-b border-zinc-200 dark:border-zinc-800/80 gap-4">
    <div>
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-zinc-800 border border-zinc-700/50 flex items-center justify-center text-cyan-400 shadow-sm">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        </div>
        <div>
          <h1 class="text-base font-bold tracking-tight text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
            DataPulse Reverse ETL
            <span class="text-xs px-2 py-0.5 rounded font-mono font-medium bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700">Style 1: Shadcn / Vercel Obsidian</span>
          </h1>
          <p class="text-xs text-zinc-500 dark:text-zinc-400">Hexagonal Architecture | Snowflake &amp; DuckDB | Thin Airflow DAG | Out-of-Band AI DLQ Doctor | HubSpot CRM v3</p>
        </div>
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
      <!-- Live 2s Auto-Polling Toggle -->
      <button id="togglePollingBtn" type="button" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono font-medium border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
        <span class="w-2 h-2 rounded-full bg-emerald-500" id="pollingDot"></span>
        <span id="pollingStatusText">Auto-Poll: ON (2s)</span>
      </button>
      <!-- Reset Store Button -->
      <button id="resetStoreBtn" type="button" title="Reset CRM Store to 0 contacts" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-rose-400 hover:border-rose-500/30 transition">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        Reset Store
      </button>
      <!-- Dark / Light Mode Toggle -->
      <button id="themeToggleBtn" type="button" class="p-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
        <svg id="moonIcon" class="w-4 h-4 hidden dark:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
        <svg id="sunIcon" class="w-4 h-4 block dark:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
      </button>
    </div>
  </header>

  <!-- 3 Pillars Row -->
  <section class="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-5">
    <!-- Pillar 1 -->
    <div class="rounded-lg border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950/70 p-3.5 shadow-sm">
      <div class="flex items-center justify-between pb-2 mb-2.5 border-b border-zinc-100 dark:border-zinc-800/60 font-mono text-xs font-semibold tracking-wide uppercase text-cyan-600 dark:text-cyan-400">
        <span>Pillar 1: Warehouse &amp; FinOps Guardrails</span>
        <svg class="w-4 h-4 text-cyan-500/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>
      </div>
      <div class="space-y-1.5 text-xs font-mono text-zinc-600 dark:text-zinc-400">
        <div class="flex justify-between"><span>Active Engine:</span><span class="font-semibold text-zinc-900 dark:text-zinc-200">${escapeHtml(state.activeEngine)} (WH_DATA_PULSE_XS)</span></div>
        <div class="flex justify-between"><span>FinOps Policy:</span><span class="text-zinc-700 dark:text-zinc-300">AUTO_SUSPEND=60s | TIMEOUT=300s</span></div>
        <div class="flex justify-between"><span>Resource Monitor:</span><span class="font-semibold text-emerald-600 dark:text-emerald-400">50 Credits ($150 Cap) | $2.50/mo</span></div>
        <div class="flex justify-between"><span>Source Distribution:</span><span class="text-zinc-700 dark:text-zinc-300">10,000 (9,800 Clean | 200 Poison)</span></div>
        <div class="flex justify-between"><span>High Watermark:</span><span class="text-zinc-700 dark:text-zinc-300" id="valWatermark">${escapeHtml(state.watermarkTs)}</span></div>
      </div>
    </div>

    <!-- Pillar 2 -->
    <div class="rounded-lg border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950/70 p-3.5 shadow-sm">
      <div class="flex items-center justify-between pb-2 mb-2.5 border-b border-zinc-100 dark:border-zinc-800/60 font-mono text-xs font-semibold tracking-wide uppercase text-cyan-600 dark:text-cyan-400">
        <span>Pillar 2: Apache Airflow Thin DAG</span>
        <svg class="w-4 h-4 text-cyan-500/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="m17 5-5-3-5 3"/><path d="m17 19-5 3-5-3"/></svg>
      </div>
      <div class="space-y-1.5 text-xs font-mono mb-2">
        <div class="flex justify-between text-zinc-600 dark:text-zinc-400"><span>DAG ID:</span><span class="text-zinc-900 dark:text-zinc-200">datapulse_hubspot_profitability_sync</span></div>
        <div class="flex justify-between text-zinc-600 dark:text-zinc-400"><span>DAG SLA &amp; State:</span><span class="font-semibold text-emerald-600 dark:text-emerald-400">&lt;0.05s SLA | ${escapeHtml(state.dagStatus)}</span></div>
      </div>
      <div class="space-y-1 text-xs font-mono">
        <div class="flex items-center justify-between px-2.5 py-1 rounded border ${dagTask1Class}"><span>1. validate_sync_manifest</span><span>[OK]</span></div>
        <div class="flex items-center justify-between px-2.5 py-1 rounded border ${dagTask2Class}"><span>2. execute_incremental_reverse_etl</span><span>[SYNC]</span></div>
        <div class="flex items-center justify-between px-2.5 py-1 rounded border ${dagTask3Class}"><span>3. audit_dlq_and_finops_telemetry</span><span>[AUDIT]</span></div>
      </div>
    </div>

    <!-- Pillar 3 -->
    <div class="rounded-lg border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950/70 p-3.5 shadow-sm">
      <div class="flex items-center justify-between pb-2 mb-2.5 border-b border-zinc-100 dark:border-zinc-800/60 font-mono text-xs font-semibold tracking-wide uppercase text-cyan-600 dark:text-cyan-400">
        <span>Pillar 3: N = S + O + E &amp; Out-of-Band AI DLQ Doctor</span>
        <svg class="w-4 h-4 text-cyan-500/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
      </div>
      <div class="space-y-1.5 text-xs font-mono text-zinc-600 dark:text-zinc-400 mb-2">
        <div class="flex justify-between"><span>Conservation Law:</span><span class="font-semibold text-emerald-600 dark:text-emerald-400" id="valConservation">N(${state.extractedN}) = S(${state.syncedS}) + O(${state.skippedO}) + E(${state.dlqPendingE})</span></div>
        <div class="flex justify-between"><span>DLQ Quarantine:</span><span class="font-semibold ${state.dlqPendingE > 0 ? "text-amber-500" : "text-emerald-400"}" id="valDlqBadge">${escapeHtml(dlqBadgeText)}</span></div>
      </div>
      <div class="space-y-1 text-[11px] font-mono">
        <div class="p-1.5 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-amber-600 dark:text-amber-300">1. INVALID_EMAIL_FORMAT (150): REGEXP_REPLACE(LOWER(TRIM(email)))</div>
        <div class="p-1.5 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-amber-600 dark:text-amber-300">2. IEEE_754_NAN_INFINITY (50): COALESCE(NULLIF(margin_pct, 'NaN'), 0.0)</div>
      </div>
    </div>
  </section>

  <!-- 6 KPI Cards -->
  <section class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
    <div class="rounded-lg border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950/70 p-3 shadow-sm">
      <div class="text-[11px] font-mono uppercase text-zinc-500 dark:text-zinc-400 mb-1">[S] Synced Contacts</div>
      <div class="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400" id="kpi-synced">${state.totalSyncedContacts.toLocaleString("en-US")}</div>
    </div>
    <div class="rounded-lg border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950/70 p-3 shadow-sm">
      <div class="text-[11px] font-mono uppercase text-zinc-500 dark:text-zinc-400 mb-1">[VIP] Executive Briefs</div>
      <div class="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100" id="kpi-vip">${state.vipBriefCount}</div>
    </div>
    <div class="rounded-lg border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950/70 p-3 shadow-sm">
      <div class="text-[11px] font-mono uppercase text-zinc-500 dark:text-zinc-400 mb-1">[E] Pending DLQ</div>
      <div class="text-xl font-bold font-mono ${state.dlqPendingE > 0 ? "text-amber-500" : "text-emerald-400"}" id="kpi-dlq">${state.dlqPendingE} (${state.dlqResolved} Healed)</div>
    </div>
    <div class="rounded-lg border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950/70 p-3 shadow-sm">
      <div class="text-[11px] font-mono uppercase text-zinc-500 dark:text-zinc-400 mb-1">[O] SHA-256 Skipped</div>
      <div class="text-xl font-bold font-mono text-cyan-600 dark:text-cyan-400" id="kpi-skipped">${state.skippedO.toLocaleString("en-US")}</div>
    </div>
    <div class="rounded-lg border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950/70 p-3 shadow-sm">
      <div class="text-[11px] font-mono uppercase text-zinc-500 dark:text-zinc-400 mb-1">[HTTP] Batch Requests</div>
      <div class="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100" id="kpi-batches">${state.totalBatchRequests} <span class="text-xs text-zinc-500">(429s: ${state.rateLimitRetriesAbsorbed})</span></div>
    </div>
    <div class="rounded-lg border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950/70 p-3 shadow-sm">
      <div class="text-[11px] font-mono uppercase text-zinc-500 dark:text-zinc-400 mb-1">[FINOPS] Annual Savings</div>
      <div class="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400" id="kpi-savings">$${state.annualSaasSavingsUsd.toLocaleString("en-US")}/yr</div>
    </div>
  </section>

  <!-- Pillar 4 Table Toolbar -->
  <section class="rounded-lg border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950/70 overflow-hidden shadow-sm">
    <div class="flex flex-col md:flex-row md:items-center justify-between p-3 border-b border-zinc-200 dark:border-zinc-800/80 gap-3">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-xs font-mono font-semibold uppercase text-zinc-500 dark:text-zinc-400">Pillar 4 (HubSpot CRM v3 Store):</span>
        <button type="button" class="btn-filter ${!fUpper ? "active bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300"} px-2.5 py-1 rounded text-xs font-mono font-semibold border border-zinc-300 dark:border-zinc-700" data-filter="">ALL (${state.totalSyncedContacts.toLocaleString("en-US")})</button>
        <button type="button" class="btn-filter ${fUpper === "ENTERPRISE_VIP" ? "active bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300"} px-2.5 py-1 rounded text-xs font-mono font-semibold border border-zinc-300 dark:border-zinc-700" id="btnFilterVip" data-filter="ENTERPRISE_VIP">ENTERPRISE_VIP (${state.vipBriefCount})</button>
        <button type="button" class="btn-filter ${fUpper === "REMEDIATED_DLQ" ? "active bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300"} px-2.5 py-1 rounded text-xs font-mono font-semibold border border-zinc-300 dark:border-zinc-700" id="btnFilterDlq" data-filter="REMEDIATED_DLQ">REMEDIATED_DLQ (${state.dlqResolved})</button>
      </div>
      <div class="relative">
        <input type="search" id="filterInput" value="${escapeHtml(initialFilter)}" placeholder="Filter by Tier/Email/ID (e.g. ENTERPRISE_VIP)..." class="w-full md:w-80 px-3 py-1.5 pl-8 rounded-md text-xs font-mono bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-cyan-500" />
        <svg class="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      </div>
    </div>

    <!-- Contacts Table -->
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/50 text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            <th class="px-3.5 py-2.5 font-medium">Customer ID</th>
            <th class="px-3.5 py-2.5 font-medium">Email</th>
            <th class="px-3.5 py-2.5 font-medium">Tier &amp; Status</th>
            <th class="px-3.5 py-2.5 font-medium">Net Profitability</th>
            <th class="px-3.5 py-2.5 font-medium">Margin (%)</th>
            <th class="px-3.5 py-2.5 font-medium">VIP Executive Action Brief / DLQ Provenance</th>
          </tr>
        </thead>
        <tbody id="contactsBody">
          ${rowsHtml || '<tr><td colspan="6" class="px-4 py-8 text-center text-xs font-mono text-zinc-500">[INFO] Stage 0 Baseline: 0 Contacts in HubSpot CRM. Run datapulse init &amp; datapulse run to stream batches...</td></tr>'}
        </tbody>
      </table>
    </div>
  </section>

  <!-- Slide-Over Row Inspector Drawer -->
  <div id="drawerBackdrop" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 hidden opacity-0 transition-opacity duration-200"></div>
  <aside id="inspectorDrawer" class="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800/80 shadow-2xl z-50 transform translate-x-full transition-transform duration-300 ease-out flex flex-col">
    <div class="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800/80">
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        <h2 class="text-sm font-bold font-mono uppercase text-zinc-900 dark:text-zinc-100" id="drawerTitle">Customer Payload Inspector</h2>
      </div>
      <button id="closeDrawerBtn" type="button" class="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition">
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>
    <div class="p-4 space-y-4 overflow-y-auto flex-1 font-mono text-xs">
      <div>
        <div class="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">Customer Identifier &amp; Tier</div>
        <div class="flex items-center gap-2">
          <span class="text-base font-bold text-zinc-900 dark:text-zinc-100" id="drawerCustId">-</span>
          <span class="px-2 py-0.5 rounded text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20" id="drawerTier">-</span>
        </div>
      </div>
      <div>
        <div class="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">Computed SHA-256 Payload Hash</div>
        <div class="p-2 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 break-all text-cyan-600 dark:text-cyan-300 select-all" id="drawerSha256">-</div>
      </div>
      <div>
        <div class="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">HubSpot v3 Property Mapping</div>
        <div class="rounded border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <table class="w-full text-left">
            <tbody id="drawerPropMapping" class="divide-y divide-zinc-200 dark:divide-zinc-800 text-[11px]"></tbody>
          </table>
        </div>
      </div>
      <div>
        <div class="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">Canonical RFC-8259 JSON Payload</div>
        <pre class="p-3 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 overflow-x-auto text-[11px] leading-relaxed" id="drawerJson">-</pre>
      </div>
    </div>
  </aside>

  <!-- Client-Side Reactive Controller -->
  <script>
    // Theme toggle
    const themeBtn = document.getElementById("themeToggleBtn");
    themeBtn.addEventListener("click", () => {
      document.documentElement.classList.toggle("dark");
      localStorage.setItem("datapulse-theme", document.documentElement.classList.contains("dark") ? "dark" : "light");
    });

    // Row Inspector Slide-Over
    const drawer = document.getElementById("inspectorDrawer");
    const backdrop = document.getElementById("drawerBackdrop");
    const closeBtn = document.getElementById("closeDrawerBtn");

    async function computeSha256(str) {
      const buffer = new TextEncoder().encode(str);
      const hash = await crypto.subtle.digest("SHA-256", buffer);
      return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }

    async function openInspector(contact) {
      document.getElementById("drawerCustId").innerText = contact.customer_id || "-";
      document.getElementById("drawerTier").innerText = contact.customer_tier || "UNKNOWN";
      const jsonStr = JSON.stringify(contact, null, 2);
      document.getElementById("drawerJson").innerText = jsonStr;
      const hash = await computeSha256(JSON.stringify(contact));
      document.getElementById("drawerSha256").innerText = hash;

      const mapping = [
        ["hs_external_customer_id", contact.customer_id],
        ["email", contact.email],
        ["hs_net_profitability_usd", "$" + (contact.net_profitability_usd || 0).toFixed(2)],
        ["hs_profit_margin_pct", (contact.profit_margin_pct || 0).toFixed(1) + "%"],
        ["datapulse_customer_tier", contact.customer_tier],
        ["datapulse_ai_executive_brief", contact.ai_executive_brief || "[NONE - Standard Margin Profile]"]
      ];
      document.getElementById("drawerPropMapping").innerHTML = mapping
        .map(([k, v]) => '<tr class="border-b border-zinc-200 dark:border-zinc-800/60"><td class="p-2 text-zinc-500 dark:text-zinc-400 font-mono">' + k + '</td><td class="p-2 font-mono font-semibold text-zinc-900 dark:text-zinc-100">' + v + '</td></tr>')
        .join("");

      backdrop.classList.remove("hidden");
      setTimeout(() => backdrop.classList.remove("opacity-0"), 10);
      drawer.classList.remove("translate-x-full");
    }

    function closeInspector() {
      drawer.classList.add("translate-x-full");
      backdrop.classList.add("opacity-0");
      setTimeout(() => backdrop.classList.add("hidden"), 200);
    }

    closeBtn.addEventListener("click", closeInspector);
    backdrop.addEventListener("click", closeInspector);

    function bindRowClicks() {
      document.querySelectorAll(".customer-row").forEach((row) => {
        row.addEventListener("click", () => {
          try {
            const contact = JSON.parse(row.getAttribute("data-contact"));
            openInspector(contact);
          } catch (e) {
            console.error("Failed to parse row contact", e);
          }
        });
      });
    }
    bindRowClicks();

    // Table Filtering
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
        buttons.forEach((b) => b.classList.remove("active", "bg-zinc-900", "text-white", "dark:bg-zinc-100", "dark:text-zinc-900"));
        btn.classList.add("active", "bg-zinc-900", "text-white", "dark:bg-zinc-100", "dark:text-zinc-900");
        const f = btn.getAttribute("data-filter") || "";
        input.value = f;
        applyFilter(f);
      });
    });

    // Reset Store Button
    document.getElementById("resetStoreBtn").addEventListener("click", async () => {
      if (confirm("Reset CRM Memory Store to 0 contacts?")) {
        await fetch("/api/v1/reset", { method: "POST" });
        location.reload();
      }
    });

    // 2s Auto-Polling Loop
    let pollingActive = true;
    const togglePollBtn = document.getElementById("togglePollingBtn");
    const pollDot = document.getElementById("pollingDot");
    const pollStatusText = document.getElementById("pollingStatusText");

    togglePollBtn.addEventListener("click", () => {
      pollingActive = !pollingActive;
      pollDot.className = pollingActive ? "w-2 h-2 rounded-full bg-emerald-500" : "w-2 h-2 rounded-full bg-zinc-500";
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
        document.getElementById("kpi-dlq").innerText = s.dlqPendingE + " (" + s.dlqResolved + " Healed)";
        document.getElementById("kpi-skipped").innerText = s.skippedO.toLocaleString("en-US");
        document.getElementById("kpi-batches").innerHTML = s.totalBatchRequests + ' <span class="text-xs text-zinc-500">(429s: ' + s.rateLimitRetriesAbsorbed + ")</span>";
        document.getElementById("phase-banner").innerText = s.currentPhase;
      } catch (err) {
        // quiet poll fail
      }
    }, 2000);
  </script>
</body>
</html>`;
}
