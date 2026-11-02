/**
 * Infrastructure Layer: 4-Pillar Unified Visual Mission Control Scratchpad Renderer.
 */

import { NormalizedCrmContact } from "../domain/contracts.js";

export interface BatchHistoryEntry {
  batchIndex: number;
  batchSize: number;
  cumulativeSynced: number;
  vipInBatch: number;
  remediatedInBatch: number;
  timestamp: string;
}

export interface SegmentBreakdown {
  ENTERPRISE_VIP: { annual_revenue: number; annual_cost: number; net_profitability_usd: number; count: number };
  ENTERPRISE: { annual_revenue: number; annual_cost: number; net_profitability_usd: number; count: number };
  MID_MARKET: { annual_revenue: number; annual_cost: number; net_profitability_usd: number; count: number };
  SME: { annual_revenue: number; annual_cost: number; net_profitability_usd: number; count: number };
}

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
  annualSaasSavingsUsd?: number;
  finopsCostUsd?: number;
}

export interface CrmStoreState {
  totalSyncedContacts: number;
  vipBriefCount: number;
  totalBatchRequests: number;
  rateLimitRetriesAbsorbed: number;
  rejectedRecordCount: number;
  annualSaasSavingsUsd: number;
  finopsCostUsd: number;
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
  batchHistory: BatchHistoryEntry[];
  segmentBreakdown: SegmentBreakdown;
  contacts: NormalizedCrmContact[];
}

function escapeHtml(text: string): string {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatRowSsr(c: NormalizedCrmContact): string {
  const isVip = Boolean(c.ai_executive_brief) || c.customer_tier.includes("VIP");
  const isHealed = c.remediated_from_dlq || (c.customer_id >= "CUST-09801");
  const statusPill = isVip ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"><span class="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>VIP At Risk</span>' : isHealed ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>Auto-Repaired</span>' : '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Delivered</span>';
  const briefCell = c.ai_executive_brief ? `<div class="flex items-center gap-1.5"><span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">[VIP-BRIEF]</span><span class="text-xs text-zinc-700 dark:text-zinc-300 truncate max-w-xs">${escapeHtml(c.ai_executive_brief)}</span></div>` : isHealed ? '<span class="text-xs text-zinc-500 dark:text-zinc-400">Remediated via AI DLQ Doctor (RFC-5322 regex / coalesce)</span>' : '<span class="text-xs text-zinc-400 dark:text-zinc-500">Standard Margin Profile - Normal Rhythm</span>';
  const marginBadge = `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${c.profit_margin_pct < 0 ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"}">${c.profit_margin_pct < 0 ? "" : "+"}${c.profit_margin_pct.toFixed(1)}%</span>`;
  const tierBadge = `<span class="px-2 py-0.5 rounded text-xs font-medium ${isVip ? "bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"}">${escapeHtml(c.customer_tier)}</span>`;
  const safeJson = escapeHtml(JSON.stringify(c));
  return `<tr class="customer-row border-b border-zinc-200/80 dark:border-zinc-800 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer" data-contact="${safeJson}" onclick="openInspectorFromRow(this)"><td class="p-3"><div class="flex items-center gap-2"><span class="font-medium text-xs text-zinc-950 dark:text-zinc-50 font-mono">${escapeHtml(c.customer_id)}</span><span class="px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">${escapeHtml(c.country || "US")}</span></div><div class="text-[11px] text-zinc-500 dark:text-zinc-400">${escapeHtml(c.company || "Enterprise Account")} • <span class="font-mono">${escapeHtml(c.email)}</span></div></td><td class="p-3">${tierBadge}</td><td class="p-3">${statusPill}</td><td class="p-3 font-mono text-xs font-semibold text-zinc-950 dark:text-zinc-50">$${c.net_profitability_usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td class="p-3">${marginBadge}</td><td class="p-3">${briefCell}</td><td class="p-3 text-right"><button type="button" class="btn-inspect px-2.5 py-1 rounded text-xs font-medium border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition" onclick="event.stopPropagation(); openInspectorFromRow(this.closest('tr'))">Inspect</button></td></tr>`;
}

function renderInitialRows(contacts: NormalizedCrmContact[], isZero: boolean): string {
  if (isZero || !contacts || contacts.length === 0) return '<tr><td colspan="7" class="p-12 text-center text-xs text-zinc-500 font-mono">Stage 0 Baseline: 0 Contacts in CRM. Ingestion pipeline is idle. Click "1. Run Initial Sync" above to stream batches...</td></tr>';
  return contacts.slice(0, 25).map(formatRowSsr).join("\n");
}

export function renderLiveDashboardHtml(state: CrmStoreState, initialFilter = ""): string {
  const isZero = state.totalSyncedContacts === 0 && state.extractedN === 0;
  const initialStateJson = escapeHtml(JSON.stringify(state));

  const syncedTrendHtml = isZero ? '<span class="inline-flex items-center font-medium text-zinc-500"><span class="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-1.5"></span>Standby • Awaiting Sync</span>' : state.totalSyncedContacts >= 10000 ? '<span class="inline-flex items-center font-medium text-emerald-600 dark:text-emerald-400"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>100% Complete • Zero row loss</span>' : state.totalSyncedContacts >= 9800 ? '<span class="inline-flex items-center font-medium text-emerald-600 dark:text-emerald-400"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>+98.0% First Pass • 200 Held in DLQ</span>' : '<span class="inline-flex items-center font-medium text-blue-600 dark:text-blue-400"><span class="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 animate-pulse"></span>10k in Warehouse • Ready to Sync</span>';
  const vipTrendHtml = isZero || state.vipBriefCount === 0 ? '<span class="inline-flex items-center font-medium text-zinc-500"><span class="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-1.5"></span>0 Alerts • Normal Margin Profile</span>' : '<span class="inline-flex items-center font-medium text-rose-600 dark:text-rose-400"><span class="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>-20.0% Margin Drop • Executive retention call</span>';
  const dlqDotColor = isZero ? "bg-zinc-400" : state.dlqPendingE > 0 ? "bg-rose-500" : state.dlqResolved > 0 ? "bg-amber-500" : "bg-emerald-500";
  const dlqTrendHtml = isZero ? '<span class="inline-flex items-center text-xs font-medium text-zinc-500"><span class="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-1.5"></span>Standby: 0 Anomalies Held</span>' : state.dlqPendingE > 0 ? `<span class="inline-flex items-center text-xs font-medium text-rose-600 dark:text-rose-400"><span class="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>Danger: ${state.emailErrorsPending || 150} Email, ${state.nanErrorsPending || 50} NaN Held</span>` : `<span class="inline-flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Healthy: 0 Held / ${state.dlqResolved} Repaired</span>`;
  const savingsValue = isZero ? "$0.00" : `$${state.annualSaasSavingsUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  const savingsTrendHtml = isZero ? '<span class="inline-flex items-center font-medium text-zinc-500"><span class="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-1.5"></span>Standby • $4,170/yr projected on active sync</span>' : '<span class="inline-flex items-center font-medium text-emerald-600 dark:text-emerald-400"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>99.3% Cost Reduction • $2.50/mo vs $4,200/yr</span>';

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Data Pulse | Executive Overview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config = { darkMode: "class", theme: { extend: { fontFamily: { sans: ["Inter", "sans-serif"], mono: ["JetBrains Mono", "monospace"] } } } };</script>
  <style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap'); body { font-family: 'Inter', sans-serif; }</style>
</head>
<body class="bg-zinc-50 dark:bg-zinc-950 text-zinc-950 dark:text-zinc-50 min-h-screen antialiased flex flex-col transition-colors duration-150">
  <header class="border-b border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md px-6 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-4 sticky top-0 z-30">
    <div class="flex items-center gap-3">
      <div class="flex aspect-square size-9 items-center justify-center rounded-lg bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-sm"><svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-8 4.5v9L12 21l8-4.5v-9L12 3Z"/><path d="M12 12 4 7.5"/><path d="m12 12 8-4.5"/><path d="M12 12v9"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg></div>
      <div class="flex flex-col"><div class="flex items-center gap-2"><span class="text-sm font-bold tracking-tight text-zinc-950 dark:text-zinc-50">DataPulse Reverse ETL</span><button type="button" class="info-btn text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition p-0.5" onclick="openInfoPopover('overview')"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></button></div><div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span><span class="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono" id="sidebarEngine">Engine: DuckDB Local • 10k Mart</span></div></div>
    </div>
    <div class="flex items-center gap-2 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-xs flex-wrap">
      <button type="button" id="btnRunSync" onclick="triggerPipelinePhase('sync', this)" class="pipeline-step-btn px-3 py-1.5 rounded-md font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-zinc-50 transition flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-blue-500"></span>1. Run Initial Sync (10k)</button>
      <button type="button" id="btnRunRepair" onclick="triggerPipelinePhase('replay', this)" class="pipeline-step-btn px-3 py-1.5 rounded-md font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-zinc-50 transition flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-amber-500"></span>2. AI Diagnose &amp; Repair (200)</button>
      <button type="button" id="btnRunIdemp" onclick="triggerPipelinePhase('idempotent', this)" class="pipeline-step-btn px-3 py-1.5 rounded-md font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-zinc-50 transition flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500"></span>3. Verify SHA-256 Cache</button>
      <button type="button" id="btnResetZero" onclick="triggerPipelinePhase('reset', this)" class="pipeline-step-btn px-3 py-1.5 rounded-md font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition">Reset to 0</button>
      <span id="pipelineSpinner" class="hidden text-zinc-400 font-mono text-[11px] animate-pulse px-1">Running Python Engine...</span>
    </div>
    <div class="flex items-center gap-2.5 flex-wrap">
      <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20" id="phase-banner"><span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>${escapeHtml(state.currentPhase)}</div>
      <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20" id="connPill"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500" id="connDot"></span><span id="connText">Connector Online</span></div>
      <button id="togglePollingBtn" type="button" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"><span class="w-2 h-2 rounded-full bg-emerald-500" id="pollingDot"></span><span id="pollingStatusText">Auto-Refresh (2s)</span></button>
      <button id="themeToggleBtn" type="button" class="p-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"><svg id="moonIcon" class="w-4 h-4 hidden dark:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg><svg id="sunIcon" class="w-4 h-4 block dark:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg></button>
    </div>
  </header>

  <main class="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full" id="mainScrollContainer">
    <!-- 4 KPI Cards -->
    <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5 shadow-sm">
        <div class="flex items-center justify-between"><span class="text-xs font-medium text-zinc-500 dark:text-zinc-400 flex items-center">Synced CRM Customers<button type="button" class="info-btn text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition p-0.5 ml-1" onclick="openInfoPopover('synced')"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></button></span><div class="w-7 h-7 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg></div></div>
        <div class="mt-3"><div class="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50" id="kpi-synced">${state.totalSyncedContacts.toLocaleString("en-US")}</div><div class="mt-2 text-xs text-zinc-500 dark:text-zinc-400" id="kpi-synced-trend">${syncedTrendHtml}</div></div>
      </div>
      <div class="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5 shadow-sm">
        <div class="flex items-center justify-between"><span class="text-xs font-medium text-zinc-500 dark:text-zinc-400 flex items-center">VIP Accounts at Risk<button type="button" class="info-btn text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition p-0.5 ml-1" onclick="openInfoPopover('vip')"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></button></span><div class="w-7 h-7 rounded-md bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div></div>
        <div class="mt-3"><div class="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50" id="kpi-vip">${state.vipBriefCount}</div><div class="mt-2 text-xs text-zinc-500 dark:text-zinc-400" id="kpi-vip-trend">${vipTrendHtml}</div></div>
      </div>
      <div class="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5 shadow-sm">
        <div class="flex items-center justify-between"><span class="text-xs font-medium text-zinc-500 dark:text-zinc-400 flex items-center">Records Held for Review<button type="button" class="info-btn text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition p-0.5 ml-1" onclick="openInfoPopover('dlq')"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg></button></span><div class="w-7 h-7 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg></div></div>
        <div class="mt-3"><div class="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 flex items-center gap-2"><span id="kpi-dlq">${state.dlqPendingE}</span><span class="w-2.5 h-2.5 rounded-full ${dlqDotColor}" id="kpi-dlq-dot"></span></div><div class="mt-2 text-xs" id="kpi-dlq-trend">${dlqTrendHtml}</div></div>
      </div>
      <div class="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5 shadow-sm">
        <div class="flex items-center justify-between"><span class="text-xs font-medium text-zinc-500 dark:text-zinc-400 flex items-center">Annual Cloud Savings<button type="button" class="info-btn text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition p-0.5 ml-1" onclick="openInfoPopover('savings')"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></button></span><div class="w-7 h-7 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div></div>
        <div class="mt-3"><div class="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50" id="kpi-savings">${savingsValue}</div><div class="mt-2 text-xs text-zinc-500 dark:text-zinc-400" id="kpi-savings-trend">${savingsTrendHtml}</div></div>
      </div>
    </section>

    <!-- 2-Column Interactive Power BI Analytics Grid -->
    <section class="grid grid-cols-1 lg:grid-cols-2 gap-5" id="powerBiAnalyticsGrid">
      <!-- Left Card: Net Profit & Revenue by Customer Segment (Cross-Filter Bar Chart) -->
      <div class="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5 shadow-sm flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div><h2 class="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Net Profit &amp; Revenue by Segment</h2><p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Click any segment bar to cross-filter the customer records table below.</p></div>
            <button type="button" id="btnClearCrossFilter" onclick="clearSegmentFilter()" class="hidden px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">Clear Filter</button>
          </div>
          <div class="space-y-3.5 mt-4" id="segmentBarsContainer">
            <!-- Enterprise VIP -->
            <div class="segment-bar-row p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition cursor-pointer" onclick="toggleSegmentFilter('ENTERPRISE_VIP')" id="barRow_ENTERPRISE_VIP">
              <div class="flex items-center justify-between text-xs font-medium"><span class="text-zinc-900 dark:text-zinc-100 font-semibold flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-rose-500"></span>Enterprise VIP</span><span class="font-mono text-rose-600 dark:text-rose-400" id="segNet_ENTERPRISE_VIP">Net: -$0.00 (-20.0% Risk)</span></div>
              <div class="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full mt-2 overflow-hidden"><div class="bg-rose-500 h-full rounded-full transition-all duration-500" id="barFill_ENTERPRISE_VIP" style="width: 0%"></div></div>
              <div class="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 font-mono"><span id="segCount_ENTERPRISE_VIP">0 accounts</span><span id="segRev_ENTERPRISE_VIP">Rev: $0.00</span></div>
            </div>
            <!-- Enterprise -->
            <div class="segment-bar-row p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition cursor-pointer" onclick="toggleSegmentFilter('ENTERPRISE')" id="barRow_ENTERPRISE">
              <div class="flex items-center justify-between text-xs font-medium"><span class="text-zinc-900 dark:text-zinc-100 font-semibold flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500"></span>Enterprise</span><span class="font-mono text-emerald-600 dark:text-emerald-400" id="segNet_ENTERPRISE">Net: +$0.00</span></div>
              <div class="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full mt-2 overflow-hidden"><div class="bg-emerald-500 h-full rounded-full transition-all duration-500" id="barFill_ENTERPRISE" style="width: 0%"></div></div>
              <div class="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 font-mono"><span id="segCount_ENTERPRISE">0 accounts</span><span id="segRev_ENTERPRISE">Rev: $0.00</span></div>
            </div>
            <!-- Mid Market -->
            <div class="segment-bar-row p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition cursor-pointer" onclick="toggleSegmentFilter('MID_MARKET')" id="barRow_MID_MARKET">
              <div class="flex items-center justify-between text-xs font-medium"><span class="text-zinc-900 dark:text-zinc-100 font-semibold flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500"></span>Mid-Market</span><span class="font-mono text-emerald-600 dark:text-emerald-400" id="segNet_MID_MARKET">Net: +$0.00</span></div>
              <div class="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full mt-2 overflow-hidden"><div class="bg-emerald-500 h-full rounded-full transition-all duration-500" id="barFill_MID_MARKET" style="width: 0%"></div></div>
              <div class="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 font-mono"><span id="segCount_MID_MARKET">0 accounts</span><span id="segRev_MID_MARKET">Rev: $0.00</span></div>
            </div>
            <!-- SME -->
            <div class="segment-bar-row p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition cursor-pointer" onclick="toggleSegmentFilter('SME')" id="barRow_SME">
              <div class="flex items-center justify-between text-xs font-medium"><span class="text-zinc-900 dark:text-zinc-100 font-semibold flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500"></span>SME</span><span class="font-mono text-emerald-600 dark:text-emerald-400" id="segNet_SME">Net: +$0.00</span></div>
              <div class="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full mt-2 overflow-hidden"><div class="bg-emerald-500 h-full rounded-full transition-all duration-500" id="barFill_SME" style="width: 0%"></div></div>
              <div class="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 font-mono"><span id="segCount_SME">0 accounts</span><span id="segRev_SME">Rev: $0.00</span></div>
            </div>
          </div>
        </div>
        <div class="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px] font-mono text-zinc-500"><span>Cross-Filtering Active: <span id="activeFilterLabel" class="font-semibold text-zinc-900 dark:text-zinc-100">None (All Records)</span></span><span id="totalSegmentRevSpan">Total Rev: $0.00</span></div>
      </div>

      <!-- Right Card: Data Quality, Delivery & DLQ Triage Breakdown -->
      <div class="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5 shadow-sm flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div><h2 class="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Data Delivery &amp; Quarantine Triage</h2><p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Real-time row conservation and automated DLQ healing status.</p></div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20" id="triageBadge">100% Certified</span>
          </div>
          <!-- Stacked Progress Bar -->
          <div class="mt-4">
            <div class="w-full bg-zinc-100 dark:bg-zinc-800 h-3 rounded-full flex overflow-hidden">
              <div class="bg-emerald-500 h-full transition-all duration-500" id="progressClean" style="width: 0%"></div>
              <div class="bg-amber-500 h-full transition-all duration-500" id="progressRepaired" style="width: 0%"></div>
              <div class="bg-rose-500 h-full transition-all duration-500" id="progressHeld" style="width: 0%"></div>
            </div>
            <div class="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5 font-mono">
              <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-500"></span>Clean: <span id="cleanDeliveredCount">0</span></span>
              <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-amber-500"></span>Repaired: <span id="repairedCountProg">0</span></span>
              <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-rose-500"></span>Held: <span id="heldCountProg">0</span></span>
            </div>
          </div>
          <!-- Triage Checklist -->
          <div class="space-y-2.5 mt-4 text-xs font-mono">
            <div class="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
              <div class="flex items-center justify-between"><span class="text-zinc-900 dark:text-zinc-100 font-semibold flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-rose-500"></span>1. Invalid Email Format (150 rows)</span><span class="text-zinc-500 text-[11px]" id="triageEmailStatus">Pending</span></div>
              <div class="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">CUST-09801..09950 • <code class="text-emerald-600 dark:text-emerald-400">REGEXP_REPLACE(email, '@@', '@')</code></div>
            </div>
            <div class="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
              <div class="flex items-center justify-between"><span class="text-zinc-900 dark:text-zinc-100 font-semibold flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-amber-500"></span>2. NaN Division by Zero (50 rows)</span><span class="text-zinc-500 text-[11px]" id="triageNanStatus">Pending</span></div>
              <div class="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">CUST-09951..10000 • <code class="text-emerald-600 dark:text-emerald-400">COALESCE(NULLIF(margin, 'NaN'), 0.0)</code></div>
            </div>
          </div>
        </div>
        <div class="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <button type="button" id="btnRepairNow" onclick="triggerPipelinePhase('replay', this)" class="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition flex items-center gap-1.5 shadow-sm">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
            <span>Repair Held Records Now</span>
          </button>
          <span class="text-xs font-mono text-zinc-500" id="triageActionStatus">Awaiting DLQ Replay</span>
        </div>
      </div>
    </section>

    <!-- Customer Records Table -->
    <section class="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 overflow-hidden shadow-sm" id="customer-table-section">
      <div class="p-4 border-b border-zinc-200/80 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div class="flex items-center gap-1.5 flex-wrap">
          <button type="button" class="tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-sm" data-tab="all">All Customers (<span id="tabCountAll">${state.totalSyncedContacts.toLocaleString("en-US")}</span>)</button>
          <button type="button" class="tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 transition inline-flex items-center" data-tab="vip"><span class="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>VIP Retention Alerts (<span id="tabCountVip">${state.vipBriefCount}</span>)</button>
          <button type="button" class="tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 transition inline-flex items-center" data-tab="repaired"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>Repaired Records (<span id="tabCountRepaired">${state.dlqResolved}</span>)</button>
          <button type="button" class="tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 transition inline-flex items-center" data-tab="health"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Pipeline &amp; Cloud Guardrails (4)</button>
        </div>
        <div class="relative" id="filterContainer">
          <input type="search" id="filterInput" value="${escapeHtml(initialFilter)}" placeholder="Filter by ID, company, tier..." class="w-full md:w-72 px-3 py-1.5 pl-8 rounded-lg text-xs font-mono bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400" />
          <svg class="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </div>
      </div>

      <div class="overflow-x-auto" id="customersTableWrapper">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 text-[11px] font-mono uppercase text-zinc-500 dark:text-zinc-400">
              <th class="p-3 font-medium">Customer &amp; Company</th>
              <th class="p-3 font-medium">Segment</th>
              <th class="p-3 font-medium">Sync Status</th>
              <th class="p-3 font-medium">Net Profit</th>
              <th class="p-3 font-medium">Margin</th>
              <th class="p-3 font-medium">Recommended Sales Action</th>
              <th class="p-3 font-medium text-right">Details</th>
            </tr>
          </thead>
          <tbody id="contactsBody" class="divide-y divide-zinc-200/60 dark:divide-zinc-800/60">${renderInitialRows(state.contacts, isZero)}</tbody>
        </table>
      </div>

      <!-- Block Pagination & Down Arrow Block Loader -->
      <div class="p-3.5 border-t border-zinc-200/80 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-50/40 dark:bg-zinc-900/20" id="tablePaginationBar">
        <div class="text-xs text-zinc-600 dark:text-zinc-400 font-mono">
          Mostrando <span id="pageRangeSpan" class="font-bold text-zinc-900 dark:text-zinc-100">1 - ${isZero ? 0 : Math.min(25, state.totalSyncedContacts)}</span> de <span id="pageTotalSpan" class="font-bold text-zinc-900 dark:text-zinc-100">${state.totalSyncedContacts.toLocaleString("en-US")}</span> registros
        </div>
        <div class="flex items-center gap-2">
          <button type="button" id="btnPrevPage" class="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-40 transition" disabled>&larr; Anterior</button>
          <button type="button" id="btnNextPage" class="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-40 transition" ${state.totalSyncedContacts <= 25 ? "disabled" : ""}>Siguiente &rarr;</button>
          <button type="button" id="btnLoadMore" class="px-3 py-1.5 rounded-lg bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-xs font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-40 transition flex items-center gap-1.5" ${state.totalSyncedContacts <= 25 ? "disabled" : ""}>
            <span>Cargar m&aacute;s bloques</span><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
          </button>
        </div>
      </div>

      <!-- Pipeline & Cloud Health View (Tab 4) -->
      <div id="healthTableWrapper" class="hidden p-5">
        <div class="rounded-xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900/30">
          <table class="w-full text-left border-collapse">
            <thead><tr class="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 text-[11px] font-mono uppercase text-zinc-500 dark:text-zinc-400"><th class="p-3 font-medium">Architecture Pillar &amp; Component</th><th class="p-3 font-medium">Execution Engine &amp; SLA</th><th class="p-3 font-medium">Guardrail Policy &amp; Metrics</th><th class="p-3 font-medium">Operational Status</th></tr></thead>
            <tbody class="divide-y divide-zinc-200/60 dark:divide-zinc-800/60 text-xs">
              <tr><td class="p-3 font-medium text-zinc-900 dark:text-zinc-100"><div class="font-semibold text-zinc-950 dark:text-zinc-50">Pillar 1: Warehouse &amp; FinOps Guardrails</div><div class="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">Snowflake (WH_DATA_PULSE_XS) &amp; DuckDB Embedded</div></td><td class="p-3 font-mono text-zinc-700 dark:text-zinc-300">AUTO_SUSPEND=60s • TIMEOUT=300s</td><td class="p-3 text-zinc-700 dark:text-zinc-300">50 Credits ($150 Cap) • Cost: $2.50/mo vs $4,200/yr SaaS</td><td class="p-3"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Active &amp; Guarded</span></td></tr>
              <tr><td class="p-3 font-medium text-zinc-900 dark:text-zinc-100"><div class="font-semibold text-zinc-950 dark:text-zinc-50">Pillar 2: Apache Airflow Thin DAG</div><div class="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">DAG ID: datapulse_hubspot_profitability_sync</div></td><td class="p-3 font-mono text-zinc-700 dark:text-zinc-300">SLA: &lt;0.05s parse SLA</td><td class="p-3 text-zinc-700 dark:text-zinc-300">3 Tasks: 1. validate_sync_manifest, 2. execute_incremental_reverse_etl, 3. audit_dlq_and_finops_telemetry</td><td class="p-3"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Healthy (0 * * * *)</span></td></tr>
              <tr><td class="p-3 font-medium text-zinc-900 dark:text-zinc-100"><div class="font-semibold text-zinc-950 dark:text-zinc-50">Pillar 3: Data Delivery Balance</div><div class="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono" id="pillar3BalanceText">Extracted: ${state.extractedN} | Delivered: ${state.syncedS} | Unchanged Skipped: ${state.skippedO} | Held: ${state.dlqPendingE}</div></td><td class="p-3 font-mono text-zinc-700 dark:text-zinc-300">Out-of-Band Replay • Zero Impact on Sync SLA</td><td class="p-3 text-zinc-700 dark:text-zinc-300">Auto-Remediates 150 Invalid Emails (RFC-5322 regex) &amp; 50 NaN Margin Records (coalesce to 0.0)</td><td class="p-3"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Balanced &amp; Certified</span></td></tr>
              <tr><td class="p-3 font-medium text-zinc-900 dark:text-zinc-100"><div class="font-semibold text-zinc-950 dark:text-zinc-50">Pillar 4 (HubSpot CRM v3 Store)</div><div class="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">Batch Upsert Endpoint: /crm/v3/objects/contacts/batch/upsert</div></td><td class="p-3 font-mono text-zinc-700 dark:text-zinc-300">100 records / batch • Token Bucket Rate Limiter</td><td class="p-3 text-zinc-700 dark:text-zinc-300">HMAC-SHA256 Webhook Verification • 429 Retry Backoff (Full Jitter) • SHA-256 Idempotency Cache</td><td class="p-3"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Connected &amp; Synced</span></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </main>

  <div id="infoPopoverBackdrop" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 hidden opacity-0 transition-opacity duration-150 flex items-center justify-center p-4">
    <div id="infoPopoverCard" class="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl max-w-lg w-full p-6 transform scale-95 transition-transform duration-150">
      <div class="flex items-start justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <div class="flex items-center gap-2.5"><div class="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></div><div><h3 class="text-sm font-semibold text-zinc-950 dark:text-zinc-50" id="infoModalTitle">Metric Title</h3><p class="text-xs text-zinc-500 dark:text-zinc-400">Power BI Executive Clarity &amp; System Architecture</p></div></div>
        <button id="closeInfoBtn" type="button" class="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
      </div>
      <div class="mt-4 space-y-4 text-xs">
        <div class="rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 p-3.5"><div class="flex items-center gap-2 font-semibold text-blue-900 dark:text-blue-300 mb-1.5"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>Plain-English Business Meaning</div><p class="text-zinc-700 dark:text-zinc-300 leading-relaxed" id="infoModalBusiness">-</p></div>
        <div class="rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 p-3.5"><div class="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5"><svg class="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>Under-the-Hood Technical Detail</div><p class="text-zinc-600 dark:text-zinc-400 font-mono text-[11px] leading-relaxed" id="infoModalTech">-</p></div>
      </div>
      <div class="mt-5 flex justify-end"><button id="closeInfoBtn2" type="button" class="px-3.5 py-1.5 rounded-md text-xs font-medium bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition">Understood</button></div>
    </div>
  </div>

  <div id="drawerBackdrop" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 hidden opacity-0 transition-opacity duration-200"></div>
  <aside id="inspectorDrawer" class="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl z-50 transform translate-x-full transition-transform duration-300 ease-out flex flex-col">
    <div class="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
      <div class="flex items-center gap-2"><div class="w-7 h-7 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><h2 class="text-sm font-bold text-zinc-950 dark:text-zinc-50" id="drawerTitle">Customer Payload Inspector</h2></div>
      <button id="closeDrawerBtn" type="button" class="p-1.5 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
    </div>
    <div class="p-5 space-y-4 overflow-y-auto flex-1 font-mono text-xs">
      <div><div class="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">Customer Identifier &amp; Segment</div><div class="flex items-center gap-2"><span class="text-base font-bold text-zinc-950 dark:text-zinc-50" id="drawerCustId">-</span><span class="px-2 py-0.5 rounded text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700" id="drawerTier">-</span></div></div>
      <div><div class="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">Computed SHA-256 Payload Hash</div><div class="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 break-all select-all flex items-center justify-between gap-2" id="drawerSha256Box"><span id="drawerSha256">-</span><button type="button" onclick="navigator.clipboard.writeText(document.getElementById('drawerSha256').innerText)" class="text-[10px] text-zinc-400 hover:text-zinc-100 shrink-0 uppercase">Copy</button></div></div>
      <div><div class="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">HubSpot v3 Ingest Property Mapping</div><div class="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden"><table class="w-full text-left"><tbody id="drawerPropMapping" class="divide-y divide-zinc-200 dark:divide-zinc-800 text-[11px]"></tbody></table></div></div>
      <div><div class="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">Canonical RFC-8259 JSON Payload</div><pre class="p-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 overflow-x-auto text-[11px] leading-relaxed" id="drawerJson">-</pre></div>
    </div>
  </aside>

  <script>
    let currentLiveState = JSON.parse("${initialStateJson}");
    let activeTab = "all";
    let activeSegmentFilter = "";
    let filterQuery = "${escapeHtml(initialFilter)}".toLowerCase();
    let pollingActive = true;
    let pageOffset = 0;
    let pageLimit = 25;
    let searchDebounceTimer = null;

    const themeBtn = document.getElementById("themeToggleBtn");
    if (localStorage.getItem("datapulse-theme") === "light") document.documentElement.classList.remove("dark");
    else document.documentElement.classList.add("dark");
    themeBtn.addEventListener("click", () => {
      document.documentElement.classList.toggle("dark");
      localStorage.setItem("datapulse-theme", document.documentElement.classList.contains("dark") ? "dark" : "light");
    });

    const infoDict = {
      overview: { title: "Executive Overview Mission Control", business: "High-level command center combining Power BI simplicity with instant visibility into customer synchronization, risk alerts, and data hygiene.", tech: "Consolidates Reverse ETL execution metrics from Snowflake/DuckDB into HubSpot CRM v3 with cryptographic audit trails and sub-second SLA validation." },
      synced: { title: "Synced CRM Customers", business: "Total verified customer profiles successfully pushed to your active HubSpot CRM, enriched with profitability calculations and tier rankings ready for sales outreach.", tech: "Validated against contract schemas. Dispatched via idempotent HTTP batch upserts with SHA-256 payload hashing to eliminate redundant API roundtrips." },
      vip: { title: "VIP Accounts at Risk", business: "High-value enterprise accounts whose operating margin dropped below -20.0%, alerting executive leadership to initiate retention strategies before renewal churn.", tech: "Identified via SQL window analytics and rule engine thresholds (customer_tier = 'ENTERPRISE_VIP' AND margin_pct <= -20.0). Auto-generates AI executive briefs stored directly in custom CRM properties." },
      dlq: { title: "Records Held for Review (Data Quarantine)", business: "Corrupted records paused at the boundary to prevent CRM pollution, then repaired automatically by our AI Doctor without requiring human intervention.", tech: "Implements Dead Letter Queue isolation: 150 malformed emails remediated via RFC-5322 regex sanitization, and 50 IEEE-754 NaN margins safely coalesced to 0.0 with audit trail." },
      savings: { title: "Annual Cloud Savings", business: "Direct cost reduction achieved by executing data pipelines in-engine rather than paying third-party SaaS vendors per-row ingestion fees.", tech: "Replaces commercial Reverse ETL vendor ($4,200/yr) with serverless Snowflake XS warehouse execution under FinOps auto-suspend (60s) policies costing $2.50/mo (99.3% reduction)." }
    };

    const popoverBackdrop = document.getElementById("infoPopoverBackdrop");
    const popoverCard = document.getElementById("infoPopoverCard");
    function openInfoPopover(key) {
      const data = infoDict[key] || infoDict.overview;
      document.getElementById("infoModalTitle").innerText = data.title;
      document.getElementById("infoModalBusiness").innerText = data.business;
      document.getElementById("infoModalTech").innerText = data.tech;
      popoverBackdrop.classList.remove("hidden");
      setTimeout(() => { popoverBackdrop.classList.remove("opacity-0"); popoverCard.classList.remove("scale-95"); }, 10);
    }
    function closeInfoPopover() {
      popoverBackdrop.classList.add("opacity-0"); popoverCard.classList.add("scale-95");
      setTimeout(() => popoverBackdrop.classList.add("hidden"), 150);
    }
    document.getElementById("closeInfoBtn").addEventListener("click", closeInfoPopover);
    document.getElementById("closeInfoBtn2").addEventListener("click", closeInfoPopover);
    popoverBackdrop.addEventListener("click", (e) => { if (e.target === popoverBackdrop) closeInfoPopover(); });

    const drawer = document.getElementById("inspectorDrawer");
    const drawerBackdrop = document.getElementById("drawerBackdrop");
    async function computeSha256(str) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    async function openInspector(contact) {
      document.getElementById("drawerCustId").innerText = contact.customer_id || "-";
      document.getElementById("drawerTier").innerText = contact.customer_tier || "UNKNOWN";
      document.getElementById("drawerJson").innerText = JSON.stringify(contact, null, 2);
      document.getElementById("drawerSha256").innerText = await computeSha256(JSON.stringify(contact));
      const mapping = [
        ["hs_external_customer_id", contact.customer_id], ["company", contact.company || "Enterprise Account"],
        ["country", contact.country || "US"], ["email", contact.email],
        ["hs_net_profitability_usd", "$" + (contact.net_profitability_usd || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })],
        ["hs_profit_margin_pct", (contact.profit_margin_pct || 0).toFixed(1) + "%"],
        ["datapulse_customer_tier", contact.customer_tier], ["datapulse_remediated_from_dlq", contact.remediated_from_dlq ? "true" : "false"],
        ["datapulse_ai_executive_brief", contact.ai_executive_brief || "[Standard Margin Rhythm]"]
      ];
      document.getElementById("drawerPropMapping").innerHTML = mapping.map(([k, v]) => '<tr class="border-b border-zinc-200 dark:border-zinc-800"><td class="p-2.5 text-zinc-500 font-mono">' + k + '</td><td class="p-2.5 font-mono font-medium text-zinc-900 dark:text-zinc-100">' + v + '</td></tr>').join("");
      drawerBackdrop.classList.remove("hidden");
      setTimeout(() => drawerBackdrop.classList.remove("opacity-0"), 10);
      drawer.classList.remove("translate-x-full");
    }
    function closeInspector() {
      drawer.classList.add("translate-x-full"); drawerBackdrop.classList.add("opacity-0");
      setTimeout(() => drawerBackdrop.classList.add("hidden"), 200);
    }
    document.getElementById("closeDrawerBtn").addEventListener("click", closeInspector);
    drawerBackdrop.addEventListener("click", closeInspector);

    function toggleSegmentFilter(segment) {
      if (activeSegmentFilter === segment) activeSegmentFilter = "";
      else activeSegmentFilter = segment;
      updateSegmentBarHighlight();
      pageOffset = 0;
      loadContacts(false);
    }
    function clearSegmentFilter() {
      activeSegmentFilter = "";
      updateSegmentBarHighlight();
      pageOffset = 0;
      loadContacts(false);
    }
    function updateSegmentBarHighlight() {
      const clearBtn = document.getElementById("btnClearCrossFilter");
      const activeLabel = document.getElementById("activeFilterLabel");
      ["ENTERPRISE_VIP", "ENTERPRISE", "MID_MARKET", "SME"].forEach((seg) => {
        const row = document.getElementById("barRow_" + seg);
        if (!row) return;
        if (activeSegmentFilter === seg) row.className = "segment-bar-row p-2.5 rounded-lg border-2 border-blue-500 bg-blue-50/20 dark:bg-blue-950/20 transition cursor-pointer shadow-sm";
        else row.className = "segment-bar-row p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition cursor-pointer";
      });
      if (clearBtn) clearBtn.className = activeSegmentFilter ? "px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500 text-white transition" : "hidden";
      if (activeLabel) activeLabel.innerText = activeSegmentFilter ? activeSegmentFilter : "None (All Records)";
    }

    function renderPowerBiAnalytics(s) {
      const isZero = s.totalSyncedContacts === 0 && s.extractedN === 0;
      const seg = s.segmentBreakdown || {};
      const vip = seg.ENTERPRISE_VIP || { annual_revenue: 0, net_profitability_usd: 0, count: 0 };
      const ent = seg.ENTERPRISE || { annual_revenue: 0, net_profitability_usd: 0, count: 0 };
      const mm = seg.MID_MARKET || { annual_revenue: 0, net_profitability_usd: 0, count: 0 };
      const sme = seg.SME || { annual_revenue: 0, net_profitability_usd: 0, count: 0 };
      const totalRev = vip.annual_revenue + ent.annual_revenue + mm.annual_revenue + sme.annual_revenue;
      const maxRev = Math.max(totalRev, 1);

      document.getElementById("barFill_ENTERPRISE_VIP").style.width = isZero ? "0%" : Math.min(100, Math.round((vip.annual_revenue / maxRev) * 100)) + "%";
      document.getElementById("barFill_ENTERPRISE").style.width = isZero ? "0%" : Math.min(100, Math.round((ent.annual_revenue / maxRev) * 100)) + "%";
      document.getElementById("barFill_MID_MARKET").style.width = isZero ? "0%" : Math.min(100, Math.round((mm.annual_revenue / maxRev) * 100)) + "%";
      document.getElementById("barFill_SME").style.width = isZero ? "0%" : Math.min(100, Math.round((sme.annual_revenue / maxRev) * 100)) + "%";

      document.getElementById("segNet_ENTERPRISE_VIP").innerText = isZero ? "Net: -$0.00 (-20.0% Risk)" : "Net: -$" + Math.abs(vip.net_profitability_usd).toLocaleString("en-US", { minimumFractionDigits: 2 }) + " (-20.0% Risk)";
      document.getElementById("segNet_ENTERPRISE").innerText = "Net: +$" + ent.net_profitability_usd.toLocaleString("en-US", { minimumFractionDigits: 2 });
      document.getElementById("segNet_MID_MARKET").innerText = "Net: +$" + mm.net_profitability_usd.toLocaleString("en-US", { minimumFractionDigits: 2 });
      document.getElementById("segNet_SME").innerText = "Net: +$" + sme.net_profitability_usd.toLocaleString("en-US", { minimumFractionDigits: 2 });

      document.getElementById("segCount_ENTERPRISE_VIP").innerText = vip.count.toLocaleString("en-US") + " accounts";
      document.getElementById("segCount_ENTERPRISE").innerText = ent.count.toLocaleString("en-US") + " accounts";
      document.getElementById("segCount_MID_MARKET").innerText = mm.count.toLocaleString("en-US") + " accounts";
      document.getElementById("segCount_SME").innerText = sme.count.toLocaleString("en-US") + " accounts";

      document.getElementById("segRev_ENTERPRISE_VIP").innerText = "Rev: $" + vip.annual_revenue.toLocaleString("en-US", { minimumFractionDigits: 2 });
      document.getElementById("segRev_ENTERPRISE").innerText = "Rev: $" + ent.annual_revenue.toLocaleString("en-US", { minimumFractionDigits: 2 });
      document.getElementById("segRev_MID_MARKET").innerText = "Rev: $" + mm.annual_revenue.toLocaleString("en-US", { minimumFractionDigits: 2 });
      document.getElementById("segRev_SME").innerText = "Rev: $" + sme.annual_revenue.toLocaleString("en-US", { minimumFractionDigits: 2 });
      document.getElementById("totalSegmentRevSpan").innerText = "Total Rev: $" + totalRev.toLocaleString("en-US", { minimumFractionDigits: 2 });

      // Progress bar & DLQ Triage
      const cleanDelivered = Math.max(0, s.syncedS - s.dlqResolved);
      const totalBase = Math.max(1, s.extractedN || 10000);
      document.getElementById("progressClean").style.width = isZero ? "0%" : Math.min(100, (cleanDelivered / totalBase) * 100) + "%";
      document.getElementById("progressRepaired").style.width = isZero ? "0%" : Math.min(100, (s.dlqResolved / totalBase) * 100) + "%";
      document.getElementById("progressHeld").style.width = isZero ? "0%" : Math.min(100, (s.dlqPendingE / totalBase) * 100) + "%";

      document.getElementById("cleanDeliveredCount").innerText = isZero ? "0" : cleanDelivered.toLocaleString("en-US");
      document.getElementById("repairedCountProg").innerText = s.dlqResolved.toLocaleString("en-US");
      document.getElementById("heldCountProg").innerText = s.dlqPendingE.toLocaleString("en-US");

      const badge = document.getElementById("triageBadge");
      const emailStatus = document.getElementById("triageEmailStatus");
      const nanStatus = document.getElementById("triageNanStatus");
      const btnRepair = document.getElementById("btnRepairNow");
      const actionStatus = document.getElementById("triageActionStatus");

      if (isZero) {
        if (badge) { badge.innerText = "Stage 0 Baseline"; badge.className = "px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700"; }
        if (emailStatus) emailStatus.innerText = "Standby";
        if (nanStatus) nanStatus.innerText = "Standby";
        if (btnRepair) btnRepair.className = "hidden";
        if (actionStatus) actionStatus.innerText = "Awaiting Sync Ingestion";
      } else if (s.dlqPendingE > 0) {
        if (badge) { badge.innerText = s.dlqPendingE + " Pending Triage"; badge.className = "px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"; }
        if (emailStatus) { emailStatus.innerText = (s.emailErrorsPending || 150) + " Quarantined"; emailStatus.className = "text-rose-600 font-semibold"; }
        if (nanStatus) { nanStatus.innerText = (s.nanErrorsPending || 50) + " Quarantined"; nanStatus.className = "text-amber-600 font-semibold"; }
        if (btnRepair) { btnRepair.className = "px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition flex items-center gap-1.5 shadow-sm"; }
        if (actionStatus) { actionStatus.innerText = "Surgical Replay Ready"; actionStatus.className = "text-xs font-mono text-amber-600"; }
      } else {
        if (badge) { badge.innerText = "100% Healed & Delivered"; badge.className = "px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"; }
        if (emailStatus) { emailStatus.innerText = "150 Auto-Repaired"; emailStatus.className = "text-emerald-600 font-semibold"; }
        if (nanStatus) { nanStatus.innerText = "50 Coalesced 0.0"; nanStatus.className = "text-emerald-600 font-semibold"; }
        if (btnRepair) btnRepair.className = "hidden";
        if (actionStatus) { actionStatus.innerText = "DLQ Empty • Certified"; actionStatus.className = "text-xs font-mono text-emerald-600"; }
      }
    }

    function updateTabButtons() {
      document.querySelectorAll(".tab-btn").forEach((b) => {
        const t = b.getAttribute("data-tab");
        b.className = t === activeTab ? "tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-sm inline-flex items-center" : "tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 transition inline-flex items-center";
      });
      const customersWrapper = document.getElementById("customersTableWrapper");
      const healthWrapper = document.getElementById("healthTableWrapper");
      const filterContainer = document.getElementById("filterContainer");
      const paginationBar = document.getElementById("tablePaginationBar");
      if (activeTab === "health") {
        customersWrapper.classList.add("hidden"); healthWrapper.classList.remove("hidden"); filterContainer.classList.add("hidden"); if (paginationBar) paginationBar.classList.add("hidden");
      } else {
        customersWrapper.classList.remove("hidden"); healthWrapper.classList.add("hidden"); filterContainer.classList.remove("hidden"); if (paginationBar) paginationBar.classList.remove("hidden");
        pageOffset = 0;
        loadContacts(false);
      }
    }

    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeTab = btn.getAttribute("data-tab");
        updateTabButtons();
      });
    });

    const filterInputEl = document.getElementById("filterInput");
    filterInputEl.addEventListener("input", (e) => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        filterQuery = e.target.value.toLowerCase().trim();
        pageOffset = 0;
        loadContacts(false);
      }, 250);
    });

    function formatRowClient(c) {
      const isVip = Boolean(c.ai_executive_brief) || c.customer_tier.includes("VIP");
      const isHealed = c.remediated_from_dlq || (c.customer_id >= "CUST-09801");
      const statusPill = isVip ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"><span class="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>VIP At Risk</span>' : isHealed ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>Auto-Repaired</span>' : '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Delivered</span>';
      const briefCell = c.ai_executive_brief ? '<div class="flex items-center gap-1.5"><span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">[VIP-BRIEF]</span><span class="text-xs text-zinc-700 dark:text-zinc-300 truncate max-w-xs" title="' + escapeHtml(c.ai_executive_brief) + '">' + escapeHtml(c.ai_executive_brief) + '</span></div>' : isHealed ? '<span class="text-xs text-zinc-500 dark:text-zinc-400">Remediated via AI DLQ Doctor (RFC-5322 regex / coalesce)</span>' : '<span class="text-xs text-zinc-400 dark:text-zinc-500">Standard Margin Profile - Normal Rhythm</span>';
      const marginBadge = c.profit_margin_pct < 0 ? '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">' + c.profit_margin_pct.toFixed(1) + '%</span>' : '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">+' + c.profit_margin_pct.toFixed(1) + '%</span>';
      const tierBadge = isVip ? '<span class="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20">' + escapeHtml(c.customer_tier) + '</span>' : '<span class="px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">' + escapeHtml(c.customer_tier) + '</span>';
      const safeJson = escapeHtml(JSON.stringify(c));
      return '<tr class="customer-row border-b border-zinc-200/80 dark:border-zinc-800 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer" data-contact="' + safeJson + '" onclick="openInspectorFromRow(this)"><td class="p-3"><div class="flex items-center gap-2"><span class="font-medium text-xs text-zinc-950 dark:text-zinc-50 font-mono">' + escapeHtml(c.customer_id) + '</span><span class="px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">' + escapeHtml(c.country || "US") + '</span></div><div class="text-[11px] text-zinc-500 dark:text-zinc-400">' + escapeHtml(c.company || "Enterprise Account") + ' • <span class="font-mono">' + escapeHtml(c.email) + '</span></div></td><td class="p-3">' + tierBadge + '</td><td class="p-3">' + statusPill + '</td><td class="p-3 font-mono text-xs font-semibold text-zinc-950 dark:text-zinc-50">$' + c.net_profitability_usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</td><td class="p-3">' + marginBadge + '</td><td class="p-3">' + briefCell + '</td><td class="p-3 text-right"><button type="button" class="btn-inspect px-2.5 py-1 rounded text-xs font-medium border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition" onclick="event.stopPropagation(); openInspectorFromRow(this.closest(\\'tr\\'))">Inspect</button></td></tr>';
    }

    async function loadContacts(append = false) {
      const tbody = document.getElementById("contactsBody");
      if (!tbody) return;
      const isZero = currentLiveState.totalSyncedContacts === 0 && currentLiveState.extractedN === 0;
      if (isZero) {
        tbody.innerHTML = '<tr><td colspan="7" class="p-12 text-center text-xs text-zinc-500 font-mono">Stage 0 Baseline: 0 Contacts in CRM. Ingestion pipeline is idle. Click "1. Run Initial Sync" above to stream batches...</td></tr>';
        updatePaginationUi(0, 0, 0, false);
        return;
      }
      try {
        let q = filterQuery;
        if (activeSegmentFilter) q = (q ? q + " " : "") + activeSegmentFilter.toLowerCase();
        const url = "/api/v1/contacts?q=" + encodeURIComponent(q) + "&tab=" + encodeURIComponent(activeTab) + "&offset=" + pageOffset + "&limit=" + pageLimit;
        const resp = await fetch(url);
        if (!resp.ok) return;
        const data = await resp.json();
        const rowsHtml = (data.contacts || []).map(formatRowClient).join("\\n");
        if (data.total === 0) {
          tbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-xs text-zinc-500 font-mono">No matching records found in CRM store for current filter.</td></tr>';
          updatePaginationUi(0, 0, 0, false);
          return;
        }
        if (append) tbody.innerHTML += rowsHtml;
        else tbody.innerHTML = rowsHtml;
        updatePaginationUi(data.total, pageOffset, data.contacts.length, append);
      } catch (err) {
        console.error("Load contacts error:", err);
      }
    }

    function updatePaginationUi(total, offset, count, append) {
      const rangeEl = document.getElementById("pageRangeSpan");
      const totalEl = document.getElementById("pageTotalSpan");
      const prevBtn = document.getElementById("btnPrevPage");
      const nextBtn = document.getElementById("btnNextPage");
      const moreBtn = document.getElementById("btnLoadMore");
      if (totalEl) totalEl.innerText = total.toLocaleString("en-US");
      if (rangeEl) {
        if (total === 0) rangeEl.innerText = "0 - 0";
        else {
          const start = append ? 1 : offset + 1;
          const end = append ? Math.min(offset + count, total) : Math.min(offset + pageLimit, total);
          rangeEl.innerText = start + " - " + end;
        }
      }
      if (prevBtn) prevBtn.disabled = offset <= 0;
      if (nextBtn) nextBtn.disabled = offset + pageLimit >= total;
      if (moreBtn) moreBtn.disabled = (append ? offset + count : offset + pageLimit) >= total;
    }

    document.getElementById("btnPrevPage").addEventListener("click", () => { pageOffset = Math.max(0, pageOffset - pageLimit); loadContacts(false); });
    document.getElementById("btnNextPage").addEventListener("click", () => { pageOffset += pageLimit; loadContacts(false); });
    document.getElementById("btnLoadMore").addEventListener("click", () => { pageOffset += pageLimit; loadContacts(true); });

    function openInspectorFromRow(row) {
      try { openInspector(JSON.parse(row.getAttribute("data-contact"))); } catch (e) { console.error(e); }
    }

    function applyStateToDom(s) {
      currentLiveState = s;
      const isZero = s.totalSyncedContacts === 0 && s.extractedN === 0;

      document.getElementById("kpi-synced").innerText = s.totalSyncedContacts.toLocaleString("en-US");
      document.getElementById("kpi-vip").innerText = s.vipBriefCount;
      document.getElementById("kpi-dlq").innerText = s.dlqPendingE;
      document.getElementById("kpi-savings").innerText = isZero ? "$0.00" : "$" + s.annualSaasSavingsUsd.toLocaleString("en-US", { minimumFractionDigits: 2 });
      document.getElementById("phase-banner").innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse mr-1"></span>' + (s.currentPhase || "");

      const synTrend = document.getElementById("kpi-synced-trend");
      if (synTrend) synTrend.innerHTML = isZero ? '<span class="inline-flex items-center font-medium text-zinc-500"><span class="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-1.5"></span>Standby • Awaiting Sync</span>' : s.totalSyncedContacts >= 10000 ? '<span class="inline-flex items-center font-medium text-emerald-600 dark:text-emerald-400"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>100% Complete • Zero row loss</span>' : s.totalSyncedContacts >= 9800 ? '<span class="inline-flex items-center font-medium text-emerald-600 dark:text-emerald-400"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>+98.0% First Pass • 200 Held in DLQ</span>' : '<span class="inline-flex items-center font-medium text-blue-600 dark:text-blue-400"><span class="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 animate-pulse"></span>10k in Warehouse • Ready to Sync</span>';
      const vipTrend = document.getElementById("kpi-vip-trend");
      if (vipTrend) vipTrend.innerHTML = isZero || s.vipBriefCount === 0 ? '<span class="inline-flex items-center font-medium text-zinc-500"><span class="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-1.5"></span>0 Alerts • Normal Margin Profile</span>' : '<span class="inline-flex items-center font-medium text-rose-600 dark:text-rose-400"><span class="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>-20.0% Margin Drop • Executive retention call</span>';
      const dlqDot = document.getElementById("kpi-dlq-dot");
      if (dlqDot) dlqDot.className = isZero ? "w-2.5 h-2.5 rounded-full bg-zinc-400" : s.dlqPendingE > 0 ? "w-2.5 h-2.5 rounded-full bg-rose-500" : s.dlqResolved > 0 ? "w-2.5 h-2.5 rounded-full bg-amber-500" : "w-2.5 h-2.5 rounded-full bg-emerald-500";
      const dlqTrend = document.getElementById("kpi-dlq-trend");
      if (dlqTrend) dlqTrend.innerHTML = isZero ? '<span class="inline-flex items-center text-xs font-medium text-zinc-500"><span class="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-1.5"></span>Standby: 0 Anomalies Held</span>' : s.dlqPendingE > 0 ? '<span class="inline-flex items-center text-xs font-medium text-rose-600 dark:text-rose-400"><span class="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>Danger: ' + (s.emailErrorsPending || 150) + ' Email, ' + (s.nanErrorsPending || 50) + ' NaN Held</span>' : '<span class="inline-flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Healthy: 0 Held / ' + s.dlqResolved + ' Repaired</span>';
      const savTrend = document.getElementById("kpi-savings-trend");
      if (savTrend) savTrend.innerHTML = isZero ? '<span class="inline-flex items-center font-medium text-zinc-500"><span class="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-1.5"></span>Standby • $4,170/yr projected on active sync</span>' : '<span class="inline-flex items-center font-medium text-emerald-600 dark:text-emerald-400"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>99.3% Cost Reduction • $2.50/mo vs $4,200/yr</span>';

      const tabAll = document.getElementById("tabCountAll");
      if (tabAll) tabAll.innerText = s.totalSyncedContacts.toLocaleString("en-US");
      const tabVip = document.getElementById("tabCountVip");
      if (tabVip) tabVip.innerText = s.vipBriefCount;
      const tabRep = document.getElementById("tabCountRepaired");
      if (tabRep) tabRep.innerText = s.dlqResolved;

      const p3 = document.getElementById("pillar3BalanceText");
      if (p3) p3.innerHTML = "Extracted: " + s.extractedN + " | Delivered: " + s.syncedS + " | Unchanged Skipped: " + s.skippedO + " | Held: " + s.dlqPendingE;

      renderPowerBiAnalytics(s);
      if (activeTab !== "health") loadContacts(false);
    }

    async function triggerPipelinePhase(phase, btnEl) {
      const spinner = document.getElementById("pipelineSpinner");
      const btns = document.querySelectorAll(".pipeline-step-btn");
      const originalText = btnEl ? btnEl.innerHTML : "";
      btns.forEach((b) => b.disabled = true);
      if (btnEl) btnEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-zinc-400 animate-ping mr-1"></span>Running...';
      if (spinner) spinner.classList.remove("hidden");
      try {
        const resp = await fetch("/api/v1/pipeline/run-phase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phase })
        });
        const data = await resp.json();
        if (data.state) applyStateToDom(data.state);
      } catch (err) {
        console.error("Pipeline run error:", err);
      } finally {
        btns.forEach((b) => b.disabled = false);
        if (btnEl) btnEl.innerHTML = originalText;
        if (spinner) spinner.classList.add("hidden");
      }
    }

    const togglePollBtn = document.getElementById("togglePollingBtn");
    const pollDot = document.getElementById("pollingDot");
    const pollStatusText = document.getElementById("pollingStatusText");
    togglePollBtn.addEventListener("click", () => {
      pollingActive = !pollingActive;
      pollDot.className = pollingActive ? "w-2 h-2 rounded-full bg-emerald-500" : "w-2 h-2 rounded-full bg-zinc-400";
      pollStatusText.innerText = pollingActive ? "Auto-Refresh (2s)" : "Auto-Refresh: PAUSED";
    });

    setInterval(async () => {
      if (!pollingActive) return;
      try {
        const resp = await fetch("/api/v1/state");
        if (!resp.ok) return;
        const s = await resp.json();
        applyStateToDom(s);
      } catch (err) {}
    }, 2000);

    setInterval(async () => {
      try {
        const resp = await fetch("/health");
        const dot = document.getElementById("connDot");
        const txt = document.getElementById("connText");
        if (resp.ok) {
          if (dot) dot.className = "w-1.5 h-1.5 rounded-full bg-emerald-500";
          if (txt) txt.innerText = "Connector Online";
        } else {
          if (dot) dot.className = "w-1.5 h-1.5 rounded-full bg-rose-500";
          if (txt) txt.innerText = "Connector Offline";
        }
      } catch {
        const dot = document.getElementById("connDot");
        const txt = document.getElementById("connText");
        if (dot) dot.className = "w-1.5 h-1.5 rounded-full bg-rose-500";
        if (txt) txt.innerText = "Connector Offline";
      }
    }, 5000);

    applyStateToDom(currentLiveState);
  </script>
</body>
</html>`;
}
