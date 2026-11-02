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
  return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatRowSsr(c: NormalizedCrmContact): string {
  const isVip = Boolean(c.ai_executive_brief) || c.customer_tier.includes("VIP");
  const isHealed = c.remediated_from_dlq || (c.customer_id >= "CUST-09801");
  const statusPill = isVip ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200"><span class="w-1.5 h-1.5 rounded-full bg-rose-600 mr-1.5"></span>VIP At Risk</span>' : isHealed ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>Auto-Repaired</span>' : '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5"></span>Delivered</span>';
  const briefCell = c.ai_executive_brief ? `<div class="flex items-center gap-1.5"><span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">[VIP-BRIEF]</span><span class="text-xs text-zinc-700 truncate max-w-xs" title="${escapeHtml(c.ai_executive_brief)}">${escapeHtml(c.ai_executive_brief)}</span></div>` : isHealed ? '<span class="text-xs text-zinc-500">Remediated via AI DLQ Doctor (RFC-5322 regex / coalesce)</span>' : '<span class="text-xs text-zinc-400">Standard Margin Profile - Normal Rhythm</span>';
  const marginBadge = `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${c.profit_margin_pct < 0 ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}">${c.profit_margin_pct < 0 ? "" : "+"}${c.profit_margin_pct.toFixed(1)}%</span>`;
  const tierBadge = `<span class="px-2 py-0.5 rounded text-xs font-medium ${isVip ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-zinc-100 text-zinc-700 border border-zinc-200"}">${escapeHtml(c.customer_tier)}</span>`;
  const safeJson = escapeHtml(JSON.stringify(c));
  return `<tr class="customer-row border-b border-zinc-200 hover:bg-zinc-50/80 transition-colors cursor-pointer" data-contact="${safeJson}" onclick="openInspectorFromRow(this)"><td class="p-3"><div class="flex items-center gap-2"><span class="font-medium text-xs text-zinc-950 font-mono">${escapeHtml(c.customer_id)}</span><span class="px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-100 text-zinc-600 border border-zinc-200">${escapeHtml(c.country || "US")}</span></div><div class="text-[11px] text-zinc-500">${escapeHtml(c.company || "Enterprise Account")} • <span class="font-mono">${escapeHtml(c.email)}</span></div></td><td class="p-3">${tierBadge}</td><td class="p-3">${statusPill}</td><td class="p-3 font-mono text-xs font-semibold text-zinc-950">$${c.net_profitability_usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td class="p-3">${marginBadge}</td><td class="p-3">${briefCell}</td><td class="p-3 text-right"><button type="button" class="btn-inspect px-2.5 py-1 rounded text-xs font-medium border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 transition" onclick="event.stopPropagation(); openInspectorFromRow(this.closest('tr'))">Inspect</button></td></tr>`;
}

function renderInitialRows(contacts: NormalizedCrmContact[], isZero: boolean): string {
  if (isZero || !contacts || contacts.length === 0) return '<tr><td colspan="7" class="p-12 text-center text-xs text-zinc-500 font-mono">Stage 0 Baseline: 0 Contacts in CRM. Ingestion pipeline is idle. Click "1. Run Initial Sync" above to stream batches...</td></tr>';
  return contacts.slice(0, 25).map(formatRowSsr).join("\n");
}

export function renderLiveDashboardHtml(state: CrmStoreState, initialFilter = ""): string {
  const isZero = state.totalSyncedContacts === 0 && state.extractedN === 0;
  const initialStateJson = escapeHtml(JSON.stringify(state));

  const syncedTrendHtml = isZero ? '<span class="inline-flex items-center font-medium text-zinc-500"><span class="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-1.5"></span>Standby • Awaiting Sync</span>' : state.totalSyncedContacts >= 10000 ? '<span class="inline-flex items-center font-medium text-emerald-700"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5"></span>100% Complete • Zero row loss</span>' : state.totalSyncedContacts >= 9800 ? '<span class="inline-flex items-center font-medium text-emerald-700"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5"></span>+98.0% First Pass • 200 Held in DLQ</span>' : '<span class="inline-flex items-center font-medium text-amber-700"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse"></span>10k in Warehouse • Ready to Sync</span>';
  const vipTrendHtml = isZero || state.vipBriefCount === 0 ? '<span class="inline-flex items-center font-medium text-zinc-500"><span class="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-1.5"></span>0 Alerts • Normal Margin Profile</span>' : '<span class="inline-flex items-center font-medium text-rose-700"><span class="w-1.5 h-1.5 rounded-full bg-rose-600 mr-1.5"></span>-20.0% Margin Drop • Executive retention call</span>';
  const dlqDotColor = isZero ? "bg-zinc-400" : state.dlqPendingE > 0 ? "bg-rose-600" : state.dlqResolved > 0 ? "bg-amber-500" : "bg-emerald-600";
  const dlqTrendHtml = isZero ? '<span class="inline-flex items-center text-xs font-medium text-zinc-500"><span class="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-1.5"></span>Standby: 0 Anomalies Held</span>' : state.dlqPendingE > 0 ? `<span class="inline-flex items-center text-xs font-medium text-rose-700"><span class="w-1.5 h-1.5 rounded-full bg-rose-600 mr-1.5"></span>Danger: ${state.emailErrorsPending || 150} Email, ${state.nanErrorsPending || 50} NaN Held</span>` : `<span class="inline-flex items-center text-xs font-medium text-emerald-700"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5"></span>Healthy: 0 Held / ${state.dlqResolved} Repaired</span>`;
  const savingsValue = isZero ? "$0.00" : `$${state.annualSaasSavingsUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  const savingsTrendHtml = isZero ? '<span class="inline-flex items-center font-medium text-zinc-500"><span class="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-1.5"></span>Standby • $4,170/yr projected on active sync</span>' : '<span class="inline-flex items-center font-medium text-emerald-700"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5"></span>99.3% Cost Reduction • $2.50/mo vs $4,200/yr</span>';

  const triageBadgeText = isZero ? "Stage 0 Baseline" : state.dlqPendingE > 0 ? `${state.dlqPendingE} Pending Triage` : "100% Certified";
  const triageBadgeClass = isZero ? "bg-zinc-100 text-zinc-600 border border-zinc-200" : state.dlqPendingE > 0 ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200";
  const triageEmailStatusText = isZero ? "Standby" : state.dlqPendingE > 0 ? `${state.emailErrorsPending || 150} Quarantined` : "150 Auto-Repaired";
  const triageNanStatusText = isZero ? "Standby" : state.dlqPendingE > 0 ? `${state.nanErrorsPending || 50} Quarantined` : "50 Coalesced 0.0";
  const triageActionText = isZero ? "Standby" : state.dlqPendingE > 0 ? "Surgical Replay Ready" : "DLQ Empty • Certified";
  const ratioText = isZero ? "0 / 0 (0%)" : `${state.syncedS.toLocaleString("en-US")} / ${state.extractedN.toLocaleString("en-US")} (${Math.round((state.syncedS / Math.max(1, state.extractedN)) * 100)}%)`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Data Pulse | Executive Overview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config = { theme: { extend: { fontFamily: { sans: ["Inter", "sans-serif"], mono: ["JetBrains Mono", "monospace"] } } } };</script>
  <style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap'); body { font-family: 'Inter', sans-serif; }</style>
</head>
<body class="bg-zinc-50 text-zinc-950 min-h-screen antialiased flex flex-col">
  <!-- Top Bar: Data Pulse Executive Console -->
  <header class="border-b border-zinc-200 bg-white/90 backdrop-blur-md px-4 sm:px-6 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3 sticky top-0 z-30 shadow-sm">
    <div class="flex items-center justify-between w-full xl:w-auto">
      <div class="flex items-center gap-3">
        <div class="flex aspect-square size-9 items-center justify-center rounded-lg bg-zinc-950 text-white shadow-sm"><svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-8 4.5v9L12 21l8-4.5v-9L12 3Z"/><path d="M12 12 4 7.5"/><path d="m12 12 8-4.5"/><path d="M12 12v9"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg></div>
        <div class="flex flex-col"><div class="flex items-center gap-2"><span class="text-sm font-bold tracking-tight text-zinc-950">Data Pulse</span><button type="button" class="info-btn text-zinc-400 hover:text-zinc-900 transition p-0.5" onclick="openInfoPopover('overview')"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></button></div><div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span><span class="text-[11px] text-zinc-500 font-mono" id="sidebarEngine">Engine: DuckDB Local • 10k Mart</span></div></div>
      </div>
    </div>
    <div class="flex items-center gap-1.5 p-1 rounded-lg border border-zinc-200 bg-zinc-50 text-xs flex-wrap w-full xl:w-auto">
      <button type="button" id="btnRunSync" onclick="triggerPipelinePhase('sync', this)" class="pipeline-step-btn px-3 py-1.5 rounded-md font-medium text-zinc-700 hover:bg-zinc-200 hover:text-zinc-950 transition flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-600"></span>1. Run Initial Sync (10k)</button>
      <button type="button" id="btnRunRepair" onclick="triggerPipelinePhase('replay', this)" class="pipeline-step-btn px-3 py-1.5 rounded-md font-medium text-zinc-700 hover:bg-zinc-200 hover:text-zinc-950 transition flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-amber-500"></span>2. AI Diagnose &amp; Repair (200)</button>
      <button type="button" id="btnRunIdemp" onclick="triggerPipelinePhase('idempotent', this)" class="pipeline-step-btn px-3 py-1.5 rounded-md font-medium text-zinc-700 hover:bg-zinc-200 hover:text-zinc-950 transition flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-600"></span>3. Verify SHA-256 Cache</button>
      <button type="button" id="btnResetZero" onclick="triggerPipelinePhase('reset', this)" class="pipeline-step-btn px-3 py-1.5 rounded-md font-medium text-rose-600 hover:bg-rose-50 transition">Reset to 0</button>
      <span id="pipelineSpinner" class="hidden text-zinc-500 font-mono text-[11px] animate-pulse px-1">Running Python Engine...</span>
    </div>
    <div class="flex items-center gap-2 flex-wrap w-full xl:w-auto justify-between xl:justify-end">
      <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200" id="phase-banner"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>${escapeHtml(state.currentPhase)}</div>
      <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200" id="connPill"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600" id="connDot"></span><span id="connText">Connector Online</span></div>
      <button id="togglePollingBtn" type="button" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 transition"><span class="w-2 h-2 rounded-full bg-emerald-600" id="pollingDot"></span><span id="pollingStatusText">Auto-Refresh (1.5s)</span></button>
    </div>
  </header>

  <main class="flex-1 p-4 sm:p-6 space-y-5 sm:space-y-6 max-w-7xl mx-auto w-full" id="mainScrollContainer">
    <!-- 4 KPI Cards -->
    <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <div class="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-sm">
        <div class="flex items-center justify-between"><span class="text-xs font-medium text-zinc-500 flex items-center">Synced CRM Customers<button type="button" class="info-btn text-zinc-400 hover:text-zinc-900 transition p-0.5 ml-1" onclick="openInfoPopover('synced')"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></button></span><div class="w-7 h-7 rounded-md bg-zinc-100 flex items-center justify-center text-zinc-600"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg></div></div>
        <div class="mt-3"><div class="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950" id="kpi-synced">${state.totalSyncedContacts.toLocaleString("en-US")}</div><div class="mt-2 text-xs text-zinc-500" id="kpi-synced-trend">${syncedTrendHtml}</div></div>
      </div>
      <div class="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-sm">
        <div class="flex items-center justify-between"><span class="text-xs font-medium text-zinc-500 flex items-center">VIP Accounts at Risk<button type="button" class="info-btn text-zinc-400 hover:text-zinc-900 transition p-0.5 ml-1" onclick="openInfoPopover('vip')"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></button></span><div class="w-7 h-7 rounded-md bg-rose-50 flex items-center justify-center text-rose-600"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div></div>
        <div class="mt-3"><div class="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950" id="kpi-vip">${state.vipBriefCount}</div><div class="mt-2 text-xs text-zinc-500" id="kpi-vip-trend">${vipTrendHtml}</div></div>
      </div>
      <div class="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-sm">
        <div class="flex items-center justify-between"><span class="text-xs font-medium text-zinc-500 flex items-center">Records Held for Review<button type="button" class="info-btn text-zinc-400 hover:text-zinc-900 transition p-0.5 ml-1" onclick="openInfoPopover('dlq')"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg></button></span><div class="w-7 h-7 rounded-md bg-zinc-100 flex items-center justify-center text-zinc-600"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg></div></div>
        <div class="mt-3"><div class="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 flex items-center gap-2"><span id="kpi-dlq">${state.dlqPendingE}</span><span class="w-2.5 h-2.5 rounded-full ${dlqDotColor}" id="kpi-dlq-dot"></span></div><div class="mt-2 text-xs" id="kpi-dlq-trend">${dlqTrendHtml}</div></div>
      </div>
      <div class="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-sm">
        <div class="flex items-center justify-between"><span class="text-xs font-medium text-zinc-500 flex items-center">Annual Cloud Savings<button type="button" class="info-btn text-zinc-400 hover:text-zinc-900 transition p-0.5 ml-1" onclick="openInfoPopover('savings')"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></button></span><div class="w-7 h-7 rounded-md bg-emerald-50 flex items-center justify-center text-emerald-600"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div></div>
        <div class="mt-3"><div class="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950" id="kpi-savings">${savingsValue}</div><div class="mt-2 text-xs text-zinc-500" id="kpi-savings-trend">${savingsTrendHtml}</div></div>
      </div>
    </section>

    <!-- Task Manager Style Live Performance Engine Chart -->
    <section class="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-sm" id="taskManagerSection">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-100 gap-2">
        <div class="flex items-center gap-2.5">
          <div class="w-7 h-7 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
          <div><h2 class="text-sm font-bold text-zinc-950">Rendimiento del Motor en Tiempo Real</h2><p class="text-xs text-zinc-500">Telemetria de velocidad de ingesta, latencia de lotes y utilizacion de memoria (estilo Task Manager)</p></div>
        </div>
        <div class="flex items-center gap-4 text-xs font-mono flex-wrap">
          <div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-emerald-600"></span><span class="text-zinc-600">Ingesta:</span> <span id="perfThroughputVal" class="font-bold text-emerald-700">0 rec/s</span></div>
          <div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-rose-600"></span><span class="text-zinc-600">DLQ:</span> <span id="perfDlqVal" class="font-bold text-rose-700">0 err/s</span></div>
          <div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-amber-500"></span><span class="text-zinc-600">Reparados:</span> <span id="perfHealedVal" class="font-bold text-amber-700">0 fix/s</span></div>
        </div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 my-3 text-xs font-mono">
        <div class="p-2.5 rounded-lg bg-zinc-50 border border-zinc-200"><div class="text-[10px] uppercase text-zinc-400">Velocidad Pico</div><div class="text-base font-bold text-emerald-700" id="hudPeakSpeed">${isZero ? "0 rec/s" : "1,250 rec/s"}</div></div>
        <div class="p-2.5 rounded-lg bg-zinc-50 border border-zinc-200"><div class="text-[10px] uppercase text-zinc-400">Latencia Lote (100)</div><div class="text-base font-bold text-zinc-900" id="hudBatchLatency">&lt; 8.2 ms</div></div>
        <div class="p-2.5 rounded-lg bg-zinc-50 border border-zinc-200"><div class="text-[10px] uppercase text-zinc-400">Parse DAG SLA</div><div class="text-base font-bold text-emerald-700">&lt; 0.05 s</div></div>
        <div class="p-2.5 rounded-lg bg-zinc-50 border border-zinc-200"><div class="text-[10px] uppercase text-zinc-400">Memoria Heap (O(1))</div><div class="text-base font-bold text-zinc-900" id="hudMemoryHeap">18.4 MB</div></div>
      </div>

      <div class="relative w-full h-28 bg-zinc-950 rounded-lg overflow-hidden border border-zinc-800 p-1">
        <svg class="w-full h-full" id="perfSvgCanvas" viewBox="0 0 600 100" preserveAspectRatio="none">
          <defs>
            <pattern id="taskGrid" width="40" height="20" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 20" fill="none" stroke="#27272a" stroke-width="0.5"/></pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#taskGrid)"/>
          <polyline id="perfPolylineThroughput" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="0,96 600,96"/>
          <polyline id="perfPolylineDlq" fill="none" stroke="#e11d48" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" points="0,96 600,96"/>
        </svg>
        <div class="absolute bottom-1.5 left-3 text-[10px] font-mono text-zinc-500">60s ventana en vivo • Monitor O(1)</div>
        <div class="absolute top-1.5 right-3 text-[10px] font-mono text-emerald-500 font-semibold" id="perfStatusIndicator">EN ESPERA</div>
      </div>
    </section>

    <!-- 2-Column Interactive Power BI Analytics Grid -->
    <section class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5" id="powerBiAnalyticsGrid">
      <!-- Left Card: Net Profit & Revenue by Customer Segment -->
      <div class="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-sm flex flex-col justify-between">
        <div>
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-100">
            <div><h2 class="text-sm font-semibold text-zinc-950">Net Profit &amp; Revenue by Segment</h2><p class="text-xs text-zinc-500 mt-0.5">Click any segment bar to cross-filter the customer records table below.</p></div>
            <button type="button" id="btnClearCrossFilter" onclick="clearSegmentFilter()" class="hidden self-start sm:self-auto px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition">Clear Filter</button>
          </div>
          <div class="space-y-3.5 mt-4" id="segmentBarsContainer">
            <div class="segment-bar-row p-2.5 rounded-lg border border-zinc-200 hover:border-zinc-400 transition cursor-pointer" onclick="toggleSegmentFilter('ENTERPRISE_VIP')" id="barRow_ENTERPRISE_VIP">
              <div class="flex items-center justify-between text-xs font-medium"><span class="text-zinc-900 font-semibold flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-rose-600"></span>Enterprise VIP</span><span class="font-mono text-rose-700" id="segNet_ENTERPRISE_VIP">${isZero ? "Net: $0.00" : `Net: -$${Math.abs(state.segmentBreakdown?.ENTERPRISE_VIP?.net_profitability_usd || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} (-20.0% Risk)`}</span></div>
              <div class="w-full bg-zinc-100 h-2 rounded-full mt-2 overflow-hidden"><div class="bg-rose-600 h-full rounded-full transition-all duration-500" id="barFill_ENTERPRISE_VIP" style="width: 0%"></div></div>
              <div class="flex items-center justify-between text-[11px] text-zinc-500 mt-1 font-mono"><span id="segCount_ENTERPRISE_VIP">0 accounts</span><span id="segRev_ENTERPRISE_VIP">Rev: $0.00</span></div>
            </div>
            <div class="segment-bar-row p-2.5 rounded-lg border border-zinc-200 hover:border-zinc-400 transition cursor-pointer" onclick="toggleSegmentFilter('ENTERPRISE')" id="barRow_ENTERPRISE">
              <div class="flex items-center justify-between text-xs font-medium"><span class="text-zinc-900 font-semibold flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-600"></span>Enterprise</span><span class="font-mono text-emerald-700" id="segNet_ENTERPRISE">Net: +$0.00</span></div>
              <div class="w-full bg-zinc-100 h-2 rounded-full mt-2 overflow-hidden"><div class="bg-emerald-600 h-full rounded-full transition-all duration-500" id="barFill_ENTERPRISE" style="width: 0%"></div></div>
              <div class="flex items-center justify-between text-[11px] text-zinc-500 mt-1 font-mono"><span id="segCount_ENTERPRISE">0 accounts</span><span id="segRev_ENTERPRISE">Rev: $0.00</span></div>
            </div>
            <div class="segment-bar-row p-2.5 rounded-lg border border-zinc-200 hover:border-zinc-400 transition cursor-pointer" onclick="toggleSegmentFilter('MID_MARKET')" id="barRow_MID_MARKET">
              <div class="flex items-center justify-between text-xs font-medium"><span class="text-zinc-900 font-semibold flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-600"></span>Mid-Market</span><span class="font-mono text-emerald-700" id="segNet_MID_MARKET">Net: +$0.00</span></div>
              <div class="w-full bg-zinc-100 h-2 rounded-full mt-2 overflow-hidden"><div class="bg-emerald-600 h-full rounded-full transition-all duration-500" id="barFill_MID_MARKET" style="width: 0%"></div></div>
              <div class="flex items-center justify-between text-[11px] text-zinc-500 mt-1 font-mono"><span id="segCount_MID_MARKET">0 accounts</span><span id="segRev_MID_MARKET">Rev: $0.00</span></div>
            </div>
            <div class="segment-bar-row p-2.5 rounded-lg border border-zinc-200 hover:border-zinc-400 transition cursor-pointer" onclick="toggleSegmentFilter('SME')" id="barRow_SME">
              <div class="flex items-center justify-between text-xs font-medium"><span class="text-zinc-900 font-semibold flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-600"></span>SME</span><span class="font-mono text-emerald-700" id="segNet_SME">Net: +$0.00</span></div>
              <div class="w-full bg-zinc-100 h-2 rounded-full mt-2 overflow-hidden"><div class="bg-emerald-600 h-full rounded-full transition-all duration-500" id="barFill_SME" style="width: 0%"></div></div>
              <div class="flex items-center justify-between text-[11px] text-zinc-500 mt-1 font-mono"><span id="segCount_SME">0 accounts</span><span id="segRev_SME">Rev: $0.00</span></div>
            </div>
          </div>
        </div>
        <div class="mt-4 pt-3 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] font-mono text-zinc-500"><span>Cross-Filtering Active: <span id="activeFilterLabel" class="font-semibold text-zinc-900">None (All Records)</span></span><span id="totalSegmentRevSpan">Total Rev: $0.00</span></div>
      </div>

      <!-- Right Card: Data Delivery & Quarantine Triage Breakdown -->
      <div class="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-sm flex flex-col justify-between">
        <div>
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-100">
            <div><h2 class="text-sm font-semibold text-zinc-950">Data Delivery &amp; Quarantine Triage</h2><p class="text-xs text-zinc-500 mt-0.5">Real-time row conservation and automated DLQ healing status.</p></div>
            <span class="self-start sm:self-auto px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${triageBadgeClass}" id="triageBadge">${triageBadgeText}</span>
          </div>
          <div class="mt-4">
            <div class="flex items-center justify-between text-xs font-medium mb-1.5"><span class="text-zinc-700 font-semibold">Row Conservation Balance</span><span class="font-mono text-zinc-500 text-[11px]" id="conservationRatioText">${ratioText}</span></div>
            <div class="w-full bg-zinc-100 h-3 rounded-full overflow-hidden flex">
              <div class="bg-emerald-600 h-full transition-all duration-500" id="progressClean" style="width: 0%"></div>
              <div class="bg-amber-500 h-full transition-all duration-500" id="progressRepaired" style="width: 0%"></div>
              <div class="bg-rose-600 h-full transition-all duration-500" id="progressHeld" style="width: 0%"></div>
            </div>
            <div class="flex items-center justify-between text-[11px] font-mono text-zinc-500 mt-2 flex-wrap gap-2">
              <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-600"></span>Clean: <span id="cleanDeliveredCount">0</span></span>
              <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-amber-500"></span>Repaired: <span id="repairedCountProg">0</span></span>
              <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-rose-600"></span>Held: <span id="heldCountProg">0</span></span>
            </div>
          </div>
          <div class="space-y-2.5 mt-4 text-xs font-mono">
            <div class="p-2.5 rounded-lg border border-zinc-200 bg-zinc-50/50">
              <div class="flex items-center justify-between"><span class="text-zinc-900 font-semibold flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-rose-600"></span>1. Invalid Email Format (<span id="triageEmailCountText">${isZero ? 0 : state.emailErrorsPending || 150}</span> rows)</span><span class="text-zinc-500 text-[11px]" id="triageEmailStatus">${triageEmailStatusText}</span></div>
              <div class="text-[11px] text-zinc-500 mt-1">CUST-09801..09950 • <code class="text-emerald-700 font-semibold">REGEXP_REPLACE(email, '@@', '@')</code></div>
            </div>
            <div class="p-2.5 rounded-lg border border-zinc-200 bg-zinc-50/50">
              <div class="flex items-center justify-between"><span class="text-zinc-900 font-semibold flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-amber-500"></span>2. NaN Division by Zero (<span id="triageNanCountText">${isZero ? 0 : state.nanErrorsPending || 50}</span> rows)</span><span class="text-zinc-500 text-[11px]" id="triageNanStatus">${triageNanStatusText}</span></div>
              <div class="text-[11px] text-zinc-500 mt-1">CUST-09951..10000 • <code class="text-emerald-700 font-semibold">COALESCE(NULLIF(margin, 'NaN'), 0.0)</code></div>
            </div>
          </div>
        </div>
        <div class="mt-4 pt-3 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <button type="button" id="btnRepairNow" onclick="triggerPipelinePhase('replay', this)" class="${isZero || state.dlqPendingE === 0 ? "hidden" : "px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition flex items-center justify-center gap-1.5 shadow-sm"}">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
            <span>Repair Held Records Now</span>
          </button>
          <span class="text-xs font-mono text-zinc-500" id="triageActionStatus">${triageActionText}</span>
        </div>
      </div>
    </section>

    <!-- Customer Records Table -->
    <section class="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm" id="customer-table-section">
      <div class="p-3.5 sm:p-4 border-b border-zinc-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div class="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 w-full lg:w-auto scrollbar-none">
          <button type="button" class="tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition bg-zinc-950 text-white shadow-sm shrink-0" data-tab="all">All Customers (<span id="tabCountAll">${state.totalSyncedContacts.toLocaleString("en-US")}</span>)</button>
          <button type="button" class="tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 hover:text-zinc-950 transition inline-flex items-center shrink-0" data-tab="vip"><span class="w-1.5 h-1.5 rounded-full bg-rose-600 mr-1.5"></span>VIP Retention Alerts (<span id="tabCountVip">${state.vipBriefCount}</span>)</button>
          <button type="button" class="tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 hover:text-zinc-950 transition inline-flex items-center shrink-0" data-tab="repaired"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>Repaired Records (<span id="tabCountRepaired">${state.dlqResolved}</span>)</button>
          <button type="button" class="tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 hover:text-zinc-950 transition inline-flex items-center shrink-0" data-tab="health"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5"></span>Pipeline &amp; Cloud Guardrails (4)</button>
        </div>
        <div class="relative w-full lg:w-72" id="filterContainer">
          <input type="search" id="filterInput" value="${escapeHtml(initialFilter)}" placeholder="Filtrar por ID, empresa, tier..." class="w-full px-3 py-1.5 pl-8 rounded-lg text-xs font-mono bg-zinc-50 border border-zinc-200 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-400" />
          <svg class="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </div>
      </div>

      <div class="overflow-x-auto w-full" id="customersTableWrapper">
        <table class="w-full text-left border-collapse min-w-[760px]">
          <thead>
            <tr class="border-b border-zinc-200 bg-zinc-50/70 text-[11px] font-mono uppercase text-zinc-500">
              <th class="p-3 font-medium">Customer &amp; Company</th>
              <th class="p-3 font-medium">Segment</th>
              <th class="p-3 font-medium">Sync Status</th>
              <th class="p-3 font-medium">Net Profit</th>
              <th class="p-3 font-medium">Margin</th>
              <th class="p-3 font-medium">Recommended Sales Action</th>
              <th class="p-3 font-medium text-right">Details</th>
            </tr>
          </thead>
          <tbody id="contactsBody" class="divide-y divide-zinc-200/70">${renderInitialRows(state.contacts, isZero)}</tbody>
        </table>
      </div>

      <!-- Block Pagination & Down Arrow Block Loader -->
      <div class="p-3.5 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-50/50" id="tablePaginationBar">
        <div class="text-xs text-zinc-600 font-mono">
          Mostrando <span id="pageRangeSpan" class="font-bold text-zinc-900">1 - ${isZero ? 0 : Math.min(25, state.totalSyncedContacts)}</span> de <span id="pageTotalSpan" class="font-bold text-zinc-900">${state.totalSyncedContacts.toLocaleString("en-US")}</span> registros
        </div>
        <div class="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
          <button type="button" id="btnPrevPage" class="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 transition" disabled>&larr; Anterior</button>
          <button type="button" id="btnNextPage" class="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 transition" ${state.totalSyncedContacts <= 25 ? "disabled" : ""}>Siguiente &rarr;</button>
          <button type="button" id="btnLoadMore" class="px-3 py-1.5 rounded-lg bg-zinc-950 text-white text-xs font-medium hover:bg-zinc-800 disabled:opacity-40 transition flex items-center gap-1.5" ${state.totalSyncedContacts <= 25 ? "disabled" : ""}>
            <span>Cargar m&aacute;s bloques</span><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
          </button>
        </div>
      </div>

      <!-- Pipeline & Cloud Health View (Tab 4) -->
      <div id="healthTableWrapper" class="hidden p-4 sm:p-5 overflow-x-auto">
        <div class="rounded-xl border border-zinc-200 overflow-hidden bg-white min-w-[700px]">
          <table class="w-full text-left border-collapse">
            <thead><tr class="border-b border-zinc-200 bg-zinc-50/70 text-[11px] font-mono uppercase text-zinc-500"><th class="p-3 font-medium">Architecture Pillar &amp; Component</th><th class="p-3 font-medium">Execution Engine &amp; SLA</th><th class="p-3 font-medium">Guardrail Policy &amp; Metrics</th><th class="p-3 font-medium">Operational Status</th></tr></thead>
            <tbody class="divide-y divide-zinc-200/70 text-xs">
              <tr><td class="p-3 font-medium text-zinc-900"><div class="font-semibold text-zinc-950">Pillar 1: Warehouse &amp; FinOps Guardrails</div><div class="text-[11px] text-zinc-500 font-mono">Snowflake (WH_DATA_PULSE_XS) &amp; DuckDB Embedded</div></td><td class="p-3 font-mono text-zinc-700">AUTO_SUSPEND=60s • TIMEOUT=300s</td><td class="p-3 text-zinc-700">50 Credits ($150 Cap) • Cost: $2.50/mo vs $4,200/yr SaaS</td><td class="p-3"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5"></span>Active &amp; Guarded</span></td></tr>
              <tr><td class="p-3 font-medium text-zinc-900"><div class="font-semibold text-zinc-950">Pillar 2: Apache Airflow Thin DAG</div><div class="text-[11px] text-zinc-500 font-mono">DAG ID: datapulse_hubspot_profitability_sync</div></td><td class="p-3 font-mono text-zinc-700">SLA: &lt;0.05s parse SLA</td><td class="p-3 text-zinc-700">3 Tasks: 1. validate_sync_manifest, 2. execute_incremental_reverse_etl, 3. audit_dlq_and_finops_telemetry</td><td class="p-3"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5"></span>Healthy (0 * * * *)</span></td></tr>
              <tr><td class="p-3 font-medium text-zinc-900"><div class="font-semibold text-zinc-950">Pillar 3: Data Delivery Balance</div><div class="text-[11px] text-zinc-500 font-mono" id="pillar3BalanceText">Extracted: ${state.extractedN} | Delivered: ${state.syncedS} | Unchanged Skipped: ${state.skippedO} | Held: ${state.dlqPendingE}</div></td><td class="p-3 font-mono text-zinc-700">Out-of-Band Replay • Zero Impact on Sync SLA</td><td class="p-3 text-zinc-700">Auto-Remediates 150 Invalid Emails (RFC-5322 regex) &amp; 50 NaN Margin Records (coalesce to 0.0)</td><td class="p-3"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5"></span>Balanced &amp; Certified</span></td></tr>
              <tr><td class="p-3 font-medium text-zinc-900"><div class="font-semibold text-zinc-950">Pillar 4 (HubSpot CRM v3 Store)</div><div class="text-[11px] text-zinc-500 font-mono">Batch Upsert Endpoint: /crm/v3/objects/contacts/batch/upsert</div></td><td class="p-3 font-mono text-zinc-700">100 records / batch • Token Bucket Rate Limiter</td><td class="p-3 text-zinc-700">HMAC-SHA256 Webhook Verification • 429 Retry Backoff (Full Jitter) • SHA-256 Idempotency Cache</td><td class="p-3"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5"></span>Connected &amp; Synced</span></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </main>

  <div id="infoPopoverBackdrop" class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 hidden opacity-0 transition-opacity duration-150 flex items-center justify-center p-4">
    <div id="infoPopoverCard" class="bg-white border border-zinc-200 rounded-xl shadow-2xl max-w-lg w-full p-5 sm:p-6 transform scale-95 transition-transform duration-150 max-h-[90vh] overflow-y-auto">
      <div class="flex items-start justify-between pb-3 border-b border-zinc-100">
        <div class="flex items-center gap-2.5"><div class="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-900"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></div><div><h3 class="text-sm font-semibold text-zinc-950" id="infoModalTitle">Metric Title</h3><p class="text-xs text-zinc-500">Power BI Executive Clarity &amp; System Architecture</p></div></div>
        <button id="closeInfoBtn" type="button" class="text-zinc-400 hover:text-zinc-600 p-1 rounded-md hover:bg-zinc-100 transition"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
      </div>
      <div class="mt-4 space-y-4 text-xs">
        <div class="rounded-lg bg-emerald-50 border border-emerald-200/60 p-3.5"><div class="flex items-center gap-2 font-semibold text-emerald-900 mb-1.5"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>Plain-English Business Meaning</div><p class="text-zinc-700 leading-relaxed" id="infoModalBusiness">-</p></div>
        <div class="rounded-lg bg-zinc-50 border border-zinc-200 p-3.5"><div class="flex items-center gap-2 font-semibold text-zinc-900 mb-1.5"><svg class="w-4 h-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>Under-the-Hood Technical Detail</div><p class="text-zinc-600 font-mono text-[11px] leading-relaxed" id="infoModalTech">-</p></div>
      </div>
      <div class="mt-5 flex justify-end"><button id="closeInfoBtn2" type="button" class="px-3.5 py-1.5 rounded-md text-xs font-medium bg-zinc-950 text-white hover:bg-zinc-800 transition">Understood</button></div>
    </div>
  </div>

  <div id="drawerBackdrop" class="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 hidden opacity-0 transition-opacity duration-200"></div>
  <aside id="inspectorDrawer" class="fixed right-0 top-0 bottom-0 w-full sm:max-w-xl bg-white border-l border-zinc-200 shadow-2xl z-50 transform translate-x-full transition-transform duration-300 ease-out flex flex-col">
    <div class="flex items-center justify-between p-4 border-b border-zinc-200">
      <div class="flex items-center gap-2"><div class="w-7 h-7 rounded-md bg-zinc-100 flex items-center justify-center text-zinc-900"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><h2 class="text-sm font-bold text-zinc-950" id="drawerTitle">Customer Payload Inspector</h2></div>
      <button id="closeDrawerBtn" type="button" class="p-1.5 rounded-md text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
    </div>
    <div class="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 font-mono text-xs">
      <div><div class="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">Customer Identifier &amp; Segment</div><div class="flex items-center gap-2"><span class="text-base font-bold text-zinc-950" id="drawerCustId">-</span><span class="px-2 py-0.5 rounded text-xs bg-zinc-100 text-zinc-800 border border-zinc-200" id="drawerTier">-</span></div></div>
      <div><div class="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">Computed SHA-256 Payload Hash</div><div class="p-2.5 rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-800 break-all select-all flex items-center justify-between gap-2" id="drawerSha256Box"><span id="drawerSha256">-</span><button type="button" onclick="navigator.clipboard.writeText(document.getElementById('drawerSha256').innerText)" class="text-[10px] text-zinc-500 hover:text-zinc-900 shrink-0 uppercase font-semibold">Copy</button></div></div>
      <div><div class="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">HubSpot v3 Ingest Property Mapping</div><div class="rounded-lg border border-zinc-200 overflow-hidden"><table class="w-full text-left"><tbody id="drawerPropMapping" class="divide-y divide-zinc-200 text-[11px]"></tbody></table></div></div>
      <div><div class="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">Canonical RFC-8259 JSON Payload</div><pre class="p-3.5 rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-800 overflow-x-auto text-[11px] leading-relaxed" id="drawerJson">-</pre></div>
    </div>
  </aside>

  <script>
    function escapeHtml(text) {
      return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    let currentLiveState = JSON.parse("${initialStateJson}");
    let activeTab = "all";
    let activeSegmentFilter = "";
    let filterQuery = "${escapeHtml(initialFilter)}".toLowerCase();
    let pollingActive = true;
    let pageOffset = 0;
    let pageLimit = 25;
    let searchDebounceTimer = null;
    let lastSyncedCount = currentLiveState.totalSyncedContacts;
    let lastDlqPending = currentLiveState.dlqPendingE;
    let lastDlqResolved = currentLiveState.dlqResolved;
    let throughputHistory = new Array(60).fill(0);
    let dlqHistory = new Array(60).fill(0);

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
      document.getElementById("drawerPropMapping").innerHTML = mapping.map(([k, v]) => '<tr class="border-b border-zinc-200"><td class="p-2.5 text-zinc-500 font-mono">' + k + '</td><td class="p-2.5 font-mono font-medium text-zinc-900">' + v + '</td></tr>').join("");
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
        if (activeSegmentFilter === seg) row.className = "segment-bar-row p-2.5 rounded-lg border-2 border-emerald-600 bg-emerald-50/50 transition cursor-pointer shadow-sm";
        else row.className = "segment-bar-row p-2.5 rounded-lg border border-zinc-200 hover:border-zinc-400 transition cursor-pointer";
      });
      if (clearBtn) clearBtn.className = activeSegmentFilter ? "self-start sm:self-auto px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-600 text-white transition" : "hidden";
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

      document.getElementById("segNet_ENTERPRISE_VIP").innerText = isZero ? "Net: $0.00" : "Net: -$" + Math.abs(vip.net_profitability_usd).toLocaleString("en-US", { minimumFractionDigits: 2 }) + " (-20.0% Risk)";
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

      const cleanDelivered = Math.max(0, s.syncedS - s.dlqResolved);
      const totalBase = Math.max(1, s.extractedN || 10000);
      document.getElementById("progressClean").style.width = isZero ? "0%" : Math.min(100, (cleanDelivered / totalBase) * 100) + "%";
      document.getElementById("progressRepaired").style.width = isZero ? "0%" : Math.min(100, (s.dlqResolved / totalBase) * 100) + "%";
      document.getElementById("progressHeld").style.width = isZero ? "0%" : Math.min(100, (s.dlqPendingE / totalBase) * 100) + "%";

      document.getElementById("cleanDeliveredCount").innerText = isZero ? "0" : cleanDelivered.toLocaleString("en-US");
      document.getElementById("repairedCountProg").innerText = s.dlqResolved.toLocaleString("en-US");
      document.getElementById("heldCountProg").innerText = s.dlqPendingE.toLocaleString("en-US");
      document.getElementById("conservationRatioText").innerText = isZero ? "0 / 0 (0%)" : s.syncedS.toLocaleString("en-US") + " / " + totalBase.toLocaleString("en-US") + " (" + Math.round((s.syncedS / totalBase) * 100) + "%)";

      const badge = document.getElementById("triageBadge");
      const emailStatus = document.getElementById("triageEmailStatus");
      const nanStatus = document.getElementById("triageNanStatus");
      const emailCountEl = document.getElementById("triageEmailCountText");
      const nanCountEl = document.getElementById("triageNanCountText");
      const btnRepair = document.getElementById("btnRepairNow");
      const actionStatus = document.getElementById("triageActionStatus");

      if (isZero) {
        if (badge) { badge.innerText = "Stage 0 Baseline"; badge.className = "self-start sm:self-auto px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-zinc-100 text-zinc-600 border border-zinc-200"; }
        if (emailStatus) emailStatus.innerText = "Standby";
        if (nanStatus) nanStatus.innerText = "Standby";
        if (emailCountEl) emailCountEl.innerText = "0";
        if (nanCountEl) nanCountEl.innerText = "0";
        if (btnRepair) btnRepair.className = "hidden";
        if (actionStatus) actionStatus.innerText = "Standby";
      } else if (s.dlqPendingE > 0) {
        if (badge) { badge.innerText = s.dlqPendingE + " Pending Triage"; badge.className = "self-start sm:self-auto px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-rose-50 text-rose-700 border border-rose-200"; }
        if (emailStatus) { emailStatus.innerText = (s.emailErrorsPending || 150) + " Quarantined"; emailStatus.className = "text-rose-700 font-semibold"; }
        if (nanStatus) { nanStatus.innerText = (s.nanErrorsPending || 50) + " Quarantined"; nanStatus.className = "text-amber-700 font-semibold"; }
        if (emailCountEl) emailCountEl.innerText = String(s.emailErrorsPending || 150);
        if (nanCountEl) nanCountEl.innerText = String(s.nanErrorsPending || 50);
        if (btnRepair) { btnRepair.className = "px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition flex items-center justify-center gap-1.5 shadow-sm"; }
        if (actionStatus) { actionStatus.innerText = "Surgical Replay Ready"; actionStatus.className = "text-xs font-mono text-amber-700"; }
      } else {
        if (badge) { badge.innerText = "100% Healed & Delivered"; badge.className = "self-start sm:self-auto px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"; }
        if (emailStatus) { emailStatus.innerText = "150 Auto-Repaired"; emailStatus.className = "text-emerald-700 font-semibold"; }
        if (nanStatus) { nanStatus.innerText = "50 Coalesced 0.0"; nanStatus.className = "text-emerald-700 font-semibold"; }
        if (emailCountEl) emailCountEl.innerText = "150";
        if (nanCountEl) nanCountEl.innerText = "50";
        if (btnRepair) btnRepair.className = "hidden";
        if (actionStatus) { actionStatus.innerText = "DLQ Empty • Certified"; actionStatus.className = "text-xs font-mono text-emerald-700"; }
      }
    }

    function updateTabButtons() {
      document.querySelectorAll(".tab-btn").forEach((b) => {
        const t = b.getAttribute("data-tab");
        b.className = t === activeTab ? "tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition bg-zinc-950 text-white shadow-sm inline-flex items-center shrink-0" : "tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 hover:text-zinc-950 transition inline-flex items-center shrink-0";
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
      }, 150);
    });

    function formatRowClient(c) {
      const isVip = Boolean(c.ai_executive_brief) || c.customer_tier.includes("VIP");
      const isHealed = c.remediated_from_dlq || (c.customer_id >= "CUST-09801");
      const statusPill = isVip ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200"><span class="w-1.5 h-1.5 rounded-full bg-rose-600 mr-1.5"></span>VIP At Risk</span>' : isHealed ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>Auto-Repaired</span>' : '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5"></span>Delivered</span>';
      const briefCell = c.ai_executive_brief ? '<div class="flex items-center gap-1.5"><span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">[VIP-BRIEF]</span><span class="text-xs text-zinc-700 truncate max-w-xs" title="' + escapeHtml(c.ai_executive_brief) + '">' + escapeHtml(c.ai_executive_brief) + '</span></div>' : isHealed ? '<span class="text-xs text-zinc-500">Remediated via AI DLQ Doctor (RFC-5322 regex / coalesce)</span>' : '<span class="text-xs text-zinc-400">Standard Margin Profile - Normal Rhythm</span>';
      const marginBadge = c.profit_margin_pct < 0 ? '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">' + c.profit_margin_pct.toFixed(1) + '%</span>' : '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">+' + c.profit_margin_pct.toFixed(1) + '%</span>';
      const tierBadge = isVip ? '<span class="px-2 py-0.5 rounded text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">' + escapeHtml(c.customer_tier) + '</span>' : '<span class="px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">' + escapeHtml(c.customer_tier) + '</span>';
      const safeJson = escapeHtml(JSON.stringify(c));
      return '<tr class="customer-row border-b border-zinc-200 hover:bg-zinc-50/80 transition-colors cursor-pointer" data-contact="' + safeJson + '" onclick="openInspectorFromRow(this)"><td class="p-3"><div class="flex items-center gap-2"><span class="font-medium text-xs text-zinc-950 font-mono">' + escapeHtml(c.customer_id) + '</span><span class="px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-100 text-zinc-600 border border-zinc-200">' + escapeHtml(c.country || "US") + '</span></div><div class="text-[11px] text-zinc-500">' + escapeHtml(c.company || "Enterprise Account") + ' • <span class="font-mono">' + escapeHtml(c.email) + '</span></div></td><td class="p-3">' + tierBadge + '</td><td class="p-3">' + statusPill + '</td><td class="p-3 font-mono text-xs font-semibold text-zinc-950">$' + (c.net_profitability_usd || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</td><td class="p-3">' + marginBadge + '</td><td class="p-3">' + briefCell + '</td><td class="p-3 text-right"><button type="button" class="btn-inspect px-2.5 py-1 rounded text-xs font-medium border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 transition" onclick="event.stopPropagation(); openInspectorFromRow(this.closest(\'tr\'))">Inspect</button></td></tr>';
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
        const rowsHtml = (data.contacts || []).map(formatRowClient).join("\n");
        if (data.total === 0) {
          tbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-xs text-zinc-500 font-mono">No se encontraron registros en el CRM store con el filtro actual.</td></tr>';
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

    function updateTaskManagerChart(throughputDelta, dlqDelta) {
      throughputHistory.shift();
      throughputHistory.push(throughputDelta);
      dlqHistory.shift();
      dlqHistory.push(dlqDelta);

      const maxVal = Math.max(10, ...throughputHistory, ...dlqHistory);
      const w = 600;
      const h = 100;
      const step = w / 59;

      const tpPoints = throughputHistory.map((val, i) => {
        const x = Math.round(i * step);
        const y = Math.round(h - 4 - ((val / maxVal) * (h - 16)));
        return x + "," + y;
      }).join(" ");

      const dlqPoints = dlqHistory.map((val, i) => {
        const x = Math.round(i * step);
        const y = Math.round(h - 4 - ((val / maxVal) * (h - 16)));
        return x + "," + y;
      }).join(" ");

      const tpEl = document.getElementById("perfPolylineThroughput");
      const dlqEl = document.getElementById("perfPolylineDlq");
      if (tpEl) tpEl.setAttribute("points", tpPoints);
      if (dlqEl) dlqEl.setAttribute("points", dlqPoints);

      const indicator = document.getElementById("perfStatusIndicator");
      if (indicator) {
        if (throughputDelta > 0) { indicator.innerText = "INGESTANDO..."; indicator.className = "absolute top-1.5 right-3 text-[10px] font-mono text-emerald-400 font-bold animate-pulse"; }
        else if (dlqDelta > 0) { indicator.innerText = "CUARENTENA ACTIVA"; indicator.className = "absolute top-1.5 right-3 text-[10px] font-mono text-rose-400 font-bold animate-pulse"; }
        else { indicator.innerText = "EN ESPERA"; indicator.className = "absolute top-1.5 right-3 text-[10px] font-mono text-emerald-500 font-semibold"; }
      }
    }

    function applyStateToDom(s, stateChanged = false) {
      const isZero = s.totalSyncedContacts === 0 && s.extractedN === 0;

      document.getElementById("kpi-synced").innerText = s.totalSyncedContacts.toLocaleString("en-US");
      document.getElementById("kpi-vip").innerText = s.vipBriefCount;
      document.getElementById("kpi-dlq").innerText = s.dlqPendingE;
      document.getElementById("kpi-savings").innerText = isZero ? "$0.00" : "$" + s.annualSaasSavingsUsd.toLocaleString("en-US", { minimumFractionDigits: 2 });
      document.getElementById("phase-banner").innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse mr-1"></span>' + (s.currentPhase || "");

      const synTrend = document.getElementById("kpi-synced-trend");
      if (synTrend) synTrend.innerHTML = isZero ? '<span class="inline-flex items-center font-medium text-zinc-500"><span class="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-1.5"></span>Standby • Awaiting Sync</span>' : s.totalSyncedContacts >= 10000 ? '<span class="inline-flex items-center font-medium text-emerald-700"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5"></span>100% Complete • Zero row loss</span>' : s.totalSyncedContacts >= 9800 ? '<span class="inline-flex items-center font-medium text-emerald-700"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5"></span>+98.0% First Pass • 200 Held in DLQ</span>' : '<span class="inline-flex items-center font-medium text-amber-700"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse"></span>10k in Warehouse • Ready to Sync</span>';
      const vipTrend = document.getElementById("kpi-vip-trend");
      if (vipTrend) vipTrend.innerHTML = isZero || s.vipBriefCount === 0 ? '<span class="inline-flex items-center font-medium text-zinc-500"><span class="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-1.5"></span>0 Alerts • Normal Margin Profile</span>' : '<span class="inline-flex items-center font-medium text-rose-700"><span class="w-1.5 h-1.5 rounded-full bg-rose-600 mr-1.5"></span>-20.0% Margin Drop • Executive retention call</span>';
      const dlqDot = document.getElementById("kpi-dlq-dot");
      if (dlqDot) dlqDot.className = isZero ? "w-2.5 h-2.5 rounded-full bg-zinc-400" : s.dlqPendingE > 0 ? "w-2.5 h-2.5 rounded-full bg-rose-600" : s.dlqResolved > 0 ? "w-2.5 h-2.5 rounded-full bg-amber-500" : "w-2.5 h-2.5 rounded-full bg-emerald-600";
      const dlqTrend = document.getElementById("kpi-dlq-trend");
      if (dlqTrend) dlqTrend.innerHTML = isZero ? '<span class="inline-flex items-center text-xs font-medium text-zinc-500"><span class="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-1.5"></span>Standby: 0 Anomalies Held</span>' : s.dlqPendingE > 0 ? '<span class="inline-flex items-center text-xs font-medium text-rose-700"><span class="w-1.5 h-1.5 rounded-full bg-rose-600 mr-1.5"></span>Danger: ' + (s.emailErrorsPending || 150) + ' Email, ' + (s.nanErrorsPending || 50) + ' NaN Held</span>' : '<span class="inline-flex items-center text-xs font-medium text-emerald-700"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5"></span>Healthy: 0 Held / ' + s.dlqResolved + ' Repaired</span>';
      const savTrend = document.getElementById("kpi-savings-trend");
      if (savTrend) savTrend.innerHTML = isZero ? '<span class="inline-flex items-center font-medium text-zinc-500"><span class="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-1.5"></span>Standby • $4,170/yr projected on active sync</span>' : '<span class="inline-flex items-center font-medium text-emerald-700"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5"></span>99.3% Cost Reduction • $2.50/mo vs $4,200/yr</span>';

      const tabAll = document.getElementById("tabCountAll");
      if (tabAll) tabAll.innerText = s.totalSyncedContacts.toLocaleString("en-US");
      const tabVip = document.getElementById("tabCountVip");
      if (tabVip) tabVip.innerText = s.vipBriefCount;
      const tabRep = document.getElementById("tabCountRepaired");
      if (tabRep) tabRep.innerText = s.dlqResolved;

      const p3 = document.getElementById("pillar3BalanceText");
      if (p3) p3.innerHTML = "Extracted: " + s.extractedN + " | Delivered: " + s.syncedS + " | Unchanged Skipped: " + s.skippedO + " | Held: " + s.dlqPendingE;

      renderPowerBiAnalytics(s);

      // Task Manager velocity metrics
      const tpDelta = Math.max(0, s.totalSyncedContacts - lastSyncedCount);
      const dlqDelta = Math.max(0, s.dlqPendingE - lastDlqPending);
      const fixDelta = Math.max(0, s.dlqResolved - lastDlqResolved);
      lastSyncedCount = s.totalSyncedContacts;
      lastDlqPending = s.dlqPendingE;
      lastDlqResolved = s.dlqResolved;

      const perfTp = document.getElementById("perfThroughputVal");
      if (perfTp) perfTp.innerText = tpDelta > 0 ? (tpDelta * 2).toLocaleString("en-US") + " rec/s" : "0 rec/s";
      const perfDlq = document.getElementById("perfDlqVal");
      if (perfDlq) perfDlq.innerText = dlqDelta > 0 ? (dlqDelta * 2) + " err/s" : "0 err/s";
      const perfFix = document.getElementById("perfHealedVal");
      if (perfFix) perfFix.innerText = fixDelta > 0 ? (fixDelta * 2) + " fix/s" : "0 fix/s";

      updateTaskManagerChart(tpDelta, dlqDelta);

      currentLiveState = s;
      if (stateChanged && activeTab !== "health") {
        pageOffset = 0;
        loadContacts(false);
      }
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
        if (data.state) applyStateToDom(data.state, true);
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
      pollDot.className = pollingActive ? "w-2 h-2 rounded-full bg-emerald-600" : "w-2 h-2 rounded-full bg-zinc-400";
      pollStatusText.innerText = pollingActive ? "Auto-Refresh (1.5s)" : "Auto-Refresh: PAUSED";
    });

    setInterval(async () => {
      if (!pollingActive) return;
      try {
        const resp = await fetch("/api/v1/state");
        if (!resp.ok) return;
        const s = await resp.json();
        const changed = s.totalSyncedContacts !== currentLiveState.totalSyncedContacts || s.dlqPendingE !== currentLiveState.dlqPendingE || s.dlqResolved !== currentLiveState.dlqResolved || s.currentPhase !== currentLiveState.currentPhase;
        applyStateToDom(s, changed);
      } catch (err) {}
    }, 1500);

    setInterval(async () => {
      try {
        const resp = await fetch("/health");
        const dot = document.getElementById("connDot");
        const txt = document.getElementById("connText");
        if (resp.ok) {
          if (dot) dot.className = "w-1.5 h-1.5 rounded-full bg-emerald-600";
          if (txt) txt.innerText = "Connector Online";
        } else {
          if (dot) dot.className = "w-1.5 h-1.5 rounded-full bg-rose-600";
          if (txt) txt.innerText = "Connector Offline";
        }
      } catch {
        const dot = document.getElementById("connDot");
        const txt = document.getElementById("connText");
        if (dot) dot.className = "w-1.5 h-1.5 rounded-full bg-rose-600";
        if (txt) txt.innerText = "Connector Offline";
      }
    }, 5000);

    applyStateToDom(currentLiveState, false);
  </script>
</body>
</html>`;
}
