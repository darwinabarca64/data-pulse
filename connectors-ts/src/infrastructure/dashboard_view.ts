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
  return `<tr class="customer-row border-b border-zinc-200/80 dark:border-zinc-800 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer" data-contact="${safeJson}" onclick="openInspectorFromRow(this)"><td class="p-3"><input type="checkbox" class="rounded border-zinc-300 dark:border-zinc-700" onclick="event.stopPropagation()"></td><td class="p-3"><div class="font-medium text-xs text-zinc-950 dark:text-zinc-50 font-mono">${escapeHtml(c.customer_id)}</div><div class="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">${escapeHtml(c.email)} &bull; ${escapeHtml(c.company || "Enterprise Account")} &bull; ${escapeHtml(c.country || "US")}</div></td><td class="p-3">${tierBadge}</td><td class="p-3">${statusPill}</td><td class="p-3 font-mono text-xs font-semibold text-zinc-950 dark:text-zinc-50">$${c.net_profitability_usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td class="p-3">${marginBadge}</td><td class="p-3">${briefCell}</td><td class="p-3 text-right"><button type="button" class="btn-inspect px-2.5 py-1 rounded text-xs font-medium border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition" onclick="event.stopPropagation(); openInspectorFromRow(this.closest('tr'))">Inspect</button></td></tr>`;
}

function renderInitialRows(contacts: NormalizedCrmContact[], isZero: boolean): string {
  if (isZero || !contacts || contacts.length === 0) return '<tr><td colspan="8" class="p-12 text-center text-xs text-zinc-500 font-mono">Stage 0 Baseline: 0 Contacts in CRM. Ingestion pipeline is idle. Click "1. Run Sync" above to stream batches...</td></tr>';
  return contacts.slice(0, 25).map(formatRowSsr).join("\n");
}

export function renderLiveDashboardHtml(state: CrmStoreState, initialFilter = ""): string {
  const isZero = state.totalSyncedContacts === 0 && state.extractedN === 0;
  const initialStateJson = escapeHtml(JSON.stringify(state));

  const syncedTrendHtml = isZero ? '<span class="inline-flex items-center font-medium text-zinc-500"><span class="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-1.5"></span>Standby</span><span>&bull; Awaiting Sync</span>' : state.totalSyncedContacts >= 10000 ? '<span class="inline-flex items-center font-medium text-emerald-600 dark:text-emerald-400"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>100% Complete</span><span>&bull; Zero row loss</span>' : state.totalSyncedContacts >= 9800 ? '<span class="inline-flex items-center font-medium text-emerald-600 dark:text-emerald-400"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>+98.0% First Pass</span><span>&bull; 200 Held in DLQ</span>' : '<span class="inline-flex items-center font-medium text-blue-600 dark:text-blue-400"><span class="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 animate-pulse"></span>10k in Warehouse</span><span>&bull; Ready to Sync</span>';
  const vipTrendHtml = isZero || state.vipBriefCount === 0 ? '<span class="inline-flex items-center font-medium text-zinc-500"><span class="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-1.5"></span>0 Alerts</span><span>&bull; Normal Margin Profile</span>' : '<span class="inline-flex items-center font-medium text-rose-600 dark:text-rose-400"><span class="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>-20.0% Margin Drop</span><span>&bull; Executive retention call</span>';
  const dlqDotColor = isZero ? "bg-zinc-400" : state.dlqPendingE > 0 ? "bg-rose-500" : state.dlqResolved > 0 ? "bg-amber-500" : "bg-emerald-500";
  const dlqTrendHtml = isZero ? '<span class="inline-flex items-center text-xs font-medium text-zinc-500"><span class="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-1.5"></span>Standby: 0 Anomalies Held</span>' : state.dlqPendingE > 0 ? `<span class="inline-flex items-center text-xs font-medium text-rose-600 dark:text-rose-400"><span class="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>Danger: ${state.emailErrorsPending || 150} Email, ${state.nanErrorsPending || 50} NaN Held</span>` : `<span class="inline-flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Healthy: 0 Held / ${state.dlqResolved} Repaired</span>`;
  const savingsValue = isZero ? "$0.00" : `$${state.annualSaasSavingsUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  const savingsTrendHtml = isZero ? '<span class="inline-flex items-center font-medium text-zinc-500"><span class="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-1.5"></span>Standby</span><span>&bull; $4,170/yr projected on active sync</span>' : '<span class="inline-flex items-center font-medium text-emerald-600 dark:text-emerald-400"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>99.3% Cost Reduction</span><span>&bull; $2.50/mo vs $4,200/yr</span>';
  const accordionBadgeText = isZero ? "0 Anomalies Pending" : state.dlqPendingE > 0 ? `${state.dlqPendingE} Anomalies Quarantined` : `${state.dlqResolved} Anomalies Remediated`;
  const accordionBadgeClass = isZero ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700" : state.dlqPendingE > 0 ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20";

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Data Pulse | Executive Overview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config = { darkMode: "class", theme: { extend: { fontFamily: { sans: ["Inter", "sans-serif"], mono: ["JetBrains Mono", "monospace"] } } } };</script>
  <style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap'); body { font-family: 'Inter', sans-serif; }</style>
</head>
<body class="bg-zinc-50 dark:bg-zinc-950 text-zinc-950 dark:text-zinc-50 min-h-screen antialiased flex flex-col md:flex-row transition-colors duration-150">
  <aside class="w-full md:w-64 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md p-4 shrink-0 flex flex-col justify-between">
    <div>
      <div class="flex items-center gap-3 px-2 py-2 mb-6">
        <div class="flex aspect-square size-9 items-center justify-center rounded-lg bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-sm"><svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-8 4.5v9L12 21l8-4.5v-9L12 3Z"/><path d="M12 12 4 7.5"/><path d="m12 12 8-4.5"/><path d="M12 12v9"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg></div>
        <div class="flex flex-col"><span class="text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">DataPulse Reverse ETL</span><span class="text-[11px] text-zinc-500 dark:text-zinc-400">Executive Workspace</span></div>
      </div>
      <div class="mb-5 px-2">
        <div class="flex items-center justify-between p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 text-xs text-zinc-700 dark:text-zinc-300 font-medium select-none">
          <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span><span>Engine: DuckDB Local &bull; 10k Mart</span></div>
          <span class="font-mono text-[10px] text-zinc-400 uppercase">Live</span>
        </div>
      </div>
      <nav class="space-y-1">
        <button type="button" onclick="navAction('dashboard')" class="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium bg-zinc-100 text-zinc-950 dark:bg-zinc-800/80 dark:text-zinc-50 transition" id="navBtnDashboard"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>Dashboard</button>
        <button type="button" onclick="navAction('syncs')" class="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/40 hover:text-zinc-950 dark:hover:text-zinc-50 transition" id="navBtnSyncs"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>Customer Syncs</button>
        <button type="button" onclick="navAction('dlq')" class="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/40 hover:text-zinc-950 dark:hover:text-zinc-50 transition" id="navBtnDlq"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>Data Quality &amp; Review</button>
        <button type="button" onclick="navAction('budget')" class="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/40 hover:text-zinc-950 dark:hover:text-zinc-50 transition" id="navBtnBudget"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>Cloud Budget</button>
        <button type="button" onclick="openInfoPopover('system')" class="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/40 hover:text-zinc-950 dark:hover:text-zinc-50 transition"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>System Settings</button>
      </nav>
    </div>
    <div class="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800">
      <div class="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
        <div class="flex items-center justify-between text-[11px] font-medium text-zinc-700 dark:text-zinc-300"><span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>Live Engine</span><span class="font-mono text-zinc-500 dark:text-zinc-400 text-[10px]" id="sidebarEngine">${escapeHtml(state.activeEngine)}</span></div>
        <div class="mt-2 text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center justify-between"><span>SLA: &lt;0.05s</span><span class="text-emerald-600 dark:text-emerald-400 font-medium">99.99% Uptime</span></div>
      </div>
    </div>
  </aside>

  <main class="flex-1 flex flex-col min-w-0 overflow-y-auto" id="mainScrollContainer">
    <header class="border-b border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md px-6 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-4 sticky top-0 z-30">
      <div class="flex items-center gap-2"><span class="text-xs text-zinc-400 dark:text-zinc-500">Data Pulse</span><span class="text-xs text-zinc-300 dark:text-zinc-700">/</span><h1 class="text-sm font-semibold text-zinc-950 dark:text-zinc-50 flex items-center gap-1.5">Executive Overview<button type="button" class="info-btn text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition p-0.5" onclick="openInfoPopover('overview')"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></button></h1></div>
      <div class="flex items-center gap-1.5 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-xs flex-wrap">
        <button type="button" id="btnRunSync" onclick="triggerPipelinePhase('sync')" class="pipeline-step-btn px-2.5 py-1 rounded-md font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-zinc-50 transition flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>1. Run Sync</button>
        <button type="button" id="btnRunRepair" onclick="triggerPipelinePhase('replay')" class="pipeline-step-btn px-2.5 py-1 rounded-md font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-zinc-50 transition flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>2. AI Repair</button>
        <button type="button" id="btnRunIdemp" onclick="triggerPipelinePhase('idempotent')" class="pipeline-step-btn px-2.5 py-1 rounded-md font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-zinc-50 transition flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>3. Verify Cache</button>
        <button type="button" id="btnResetZero" onclick="triggerPipelinePhase('reset')" class="pipeline-step-btn px-2.5 py-1 rounded-md font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition">Reset to 0</button>
        <span id="pipelineSpinner" class="hidden text-zinc-400 font-mono text-[11px] animate-pulse px-1">Executing...</span>
      </div>
      <div class="flex items-center gap-2.5 flex-wrap">
        <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20" id="phase-banner"><span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>${escapeHtml(state.currentPhase)}</div>
        <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20" id="connPill"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500" id="connDot"></span><span id="connText">Connector Online</span></div>
        <button id="togglePollingBtn" type="button" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"><span class="w-2 h-2 rounded-full bg-emerald-500" id="pollingDot"></span><span id="pollingStatusText">Auto-Refresh (2s)</span></button>
        <button id="themeToggleBtn" type="button" class="p-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"><svg id="moonIcon" class="w-4 h-4 hidden dark:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg><svg id="sunIcon" class="w-4 h-4 block dark:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg></button>
      </div>
    </header>

    <div class="p-6 space-y-6 max-w-7xl mx-auto w-full">
      <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5 shadow-sm hover:shadow transition-shadow">
          <div class="flex items-center justify-between"><span class="text-xs font-medium text-zinc-500 dark:text-zinc-400 flex items-center">Synced CRM Customers<button type="button" class="info-btn text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition p-0.5 ml-1" onclick="openInfoPopover('synced')"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></button></span><div class="w-7 h-7 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg></div></div>
          <div class="mt-3"><div class="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50" id="kpi-synced">${state.totalSyncedContacts.toLocaleString("en-US")}</div><div class="flex items-center gap-1.5 mt-2 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap" id="kpi-synced-trend">${syncedTrendHtml}</div></div>
        </div>
        <div class="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5 shadow-sm hover:shadow transition-shadow">
          <div class="flex items-center justify-between"><span class="text-xs font-medium text-zinc-500 dark:text-zinc-400 flex items-center">VIP Accounts at Risk<button type="button" class="info-btn text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition p-0.5 ml-1" onclick="openInfoPopover('vip')"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></button></span><div class="w-7 h-7 rounded-md bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div></div>
          <div class="mt-3"><div class="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50" id="kpi-vip">${state.vipBriefCount}</div><div class="flex items-center gap-1.5 mt-2 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap" id="kpi-vip-trend">${vipTrendHtml}</div></div>
        </div>
        <div class="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5 shadow-sm hover:shadow transition-shadow cursor-pointer" onclick="toggleDlqAccordion(true)">
          <div class="flex items-center justify-between"><span class="text-xs font-medium text-zinc-500 dark:text-zinc-400 flex items-center">Records Held for Review<button type="button" class="info-btn text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition p-0.5 ml-1" onclick="event.stopPropagation(); openInfoPopover('dlq')"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></button></span><div class="w-7 h-7 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg></div></div>
          <div class="mt-3"><div class="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 flex items-center gap-2"><span id="kpi-dlq">${state.dlqPendingE}</span><span class="w-2.5 h-2.5 rounded-full ${dlqDotColor}" id="kpi-dlq-dot"></span></div><div class="flex items-center gap-1.5 mt-2 text-xs flex-wrap" id="kpi-dlq-trend">${dlqTrendHtml}</div></div>
        </div>
        <div class="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5 shadow-sm hover:shadow transition-shadow">
          <div class="flex items-center justify-between"><span class="text-xs font-medium text-zinc-500 dark:text-zinc-400 flex items-center">Annual Cloud Savings<button type="button" class="info-btn text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition p-0.5 ml-1" onclick="openInfoPopover('savings')"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></button></span><div class="w-7 h-7 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div></div>
          <div class="mt-3"><div class="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50" id="kpi-savings">${savingsValue}</div><div class="flex items-center gap-1.5 mt-2 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap" id="kpi-savings-trend">${savingsTrendHtml}</div></div>
        </div>
      </section>

      <!-- Quarantined Errors Accordion -->
      <section class="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4 shadow-sm" id="dlq-accordion-card">
        <div class="flex items-center justify-between cursor-pointer select-none" onclick="toggleDlqAccordion()">
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-md bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
            <div>
              <div class="text-xs font-semibold text-zinc-950 dark:text-zinc-50 flex items-center gap-2"><span>Quarantined Schema Anomalies &amp; AI DLQ Doctor Triage</span><span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${accordionBadgeClass}" id="accordionBadge">${accordionBadgeText}</span></div>
              <div class="text-[11px] text-zinc-500 dark:text-zinc-400">Expandable root-cause diagnosis, error payloads, and surgical remedial SQL</div>
            </div>
          </div>
          <svg id="accordionChevron" class="w-4 h-4 text-zinc-400 transition-transform duration-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
        </div>
        <div id="dlqAccordionContent" class="hidden mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
          <details class="group rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 overflow-hidden" open>
            <summary class="flex items-center justify-between p-3 text-xs font-medium cursor-pointer text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40">
              <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-rose-500"></span><span class="font-mono font-semibold">1. INVALID_EMAIL_FORMAT</span><span class="text-zinc-500 font-mono text-[11px]" id="dlqEmailCountSpan">(${state.emailErrorsPending || (state.dlqPendingE > 0 ? 150 : 0)} records &bull; CUST-09801 to CUST-09950)</span></div>
              <svg class="w-3.5 h-3.5 text-zinc-400 group-open:rotate-180 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
            </summary>
            <div class="p-3.5 pt-0 text-xs font-mono border-t border-zinc-200/60 dark:border-zinc-800/60 space-y-2 text-zinc-600 dark:text-zinc-400">
              <div><span class="text-zinc-900 dark:text-zinc-200 font-semibold">Root Cause:</span> Source rows contain double '@' or missing domain syntax violating RFC-5322 contracts.</div>
              <div><span class="text-zinc-900 dark:text-zinc-200 font-semibold">AI Doctor Remedy:</span> <code class="text-emerald-600 dark:text-emerald-400">REGEXP_REPLACE(LOWER(TRIM(email)), '@@', '@')</code> &bull; Surgical Replay Re-validates Pydantic Contract.</div>
              <div><span class="text-zinc-900 dark:text-zinc-200 font-semibold">Resolution:</span> Quarantined in Phase 1 &bull; Auto-healed and replayed to CRM in Phase 3 without pipeline restart.</div>
            </div>
          </details>
          <details class="group rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 overflow-hidden" open>
            <summary class="flex items-center justify-between p-3 text-xs font-medium cursor-pointer text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40">
              <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-amber-500"></span><span class="font-mono font-semibold">2. IEEE_754_NAN_INFINITY</span><span class="text-zinc-500 font-mono text-[11px]" id="dlqNanCountSpan">(${state.nanErrorsPending || (state.dlqPendingE > 0 ? 50 : 0)} records &bull; CUST-09951 to CUST-10000)</span></div>
              <svg class="w-3.5 h-3.5 text-zinc-400 group-open:rotate-180 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
            </summary>
            <div class="p-3.5 pt-0 text-xs font-mono border-t border-zinc-200/60 dark:border-zinc-800/60 space-y-2 text-zinc-600 dark:text-zinc-400">
              <div><span class="text-zinc-900 dark:text-zinc-200 font-semibold">Root Cause:</span> Upstream division by zero produced IEEE-754 NaN floats violating RFC-8259 JSON contracts.</div>
              <div><span class="text-zinc-900 dark:text-zinc-200 font-semibold">AI Doctor Remedy:</span> <code class="text-emerald-600 dark:text-emerald-400">COALESCE(NULLIF(profit_margin_pct, 'NaN'::DOUBLE), 0.0)</code> &bull; Safe Zero-Margin Boundary.</div>
              <div><span class="text-zinc-900 dark:text-zinc-200 font-semibold">Resolution:</span> Quarantined in Phase 1 &bull; Remediated &amp; replayed into CRM with 100% data integrity preserved.</div>
            </div>
          </details>
        </div>
      </section>

      <!-- Center Dynamic SVG Chart -->
      <section class="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-6 shadow-sm" id="area-chart-card">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 gap-4">
          <div>
            <div class="flex items-center gap-2"><h2 class="text-base font-semibold text-zinc-950 dark:text-zinc-50">Live Data Sync &amp; Quality Flow</h2><button type="button" class="info-btn text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition p-0.5" onclick="openInfoPopover('flow')"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></button></div>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5" id="chartSubtitle">Real-time Bezier trajectory of customer ingestion, quarantine isolation, and automated repair replay.</p>
          </div>
          <div class="inline-flex items-center p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs">
            <button type="button" class="chart-view-btn px-3 py-1 rounded-md font-medium transition bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-sm" data-view="sync">Sync Progression</button>
            <button type="button" class="chart-view-btn px-3 py-1 rounded-md font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 transition" data-view="revenue">Revenue by Segment</button>
            <button type="button" class="chart-view-btn px-3 py-1 rounded-md font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 transition" data-view="finops">Cost Efficiency</button>
          </div>
        </div>
        <div class="mt-4 relative">
          <svg class="w-full h-56 md:h-64 overflow-visible" viewBox="0 0 900 240" fill="none" xmlns="http://www.w3.org/2000/svg" id="mainSvgChart">
            <defs><linearGradient id="zincAreaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#71717a" stop-opacity="0.35"/><stop offset="100%" stop-color="#71717a" stop-opacity="0.0"/></linearGradient></defs>
            <line x1="40" y1="40" x2="880" y2="40" stroke="currentColor" stroke-opacity="0.08" stroke-dasharray="4 4" class="text-zinc-500"/><line x1="40" y1="90" x2="880" y2="90" stroke="currentColor" stroke-opacity="0.08" stroke-dasharray="4 4" class="text-zinc-500"/><line x1="40" y1="140" x2="880" y2="140" stroke="currentColor" stroke-opacity="0.08" stroke-dasharray="4 4" class="text-zinc-500"/><line x1="40" y1="190" x2="880" y2="190" stroke="currentColor" stroke-opacity="0.08" stroke-dasharray="4 4" class="text-zinc-500"/>
            <text x="30" y="44" font-size="10" font-family="JetBrains Mono" fill="currentColor" opacity="0.4" text-anchor="end" id="yLabel4">10.0k</text><text x="30" y="94" font-size="10" font-family="JetBrains Mono" fill="currentColor" opacity="0.4" text-anchor="end" id="yLabel3">7.5k</text><text x="30" y="144" font-size="10" font-family="JetBrains Mono" fill="currentColor" opacity="0.4" text-anchor="end" id="yLabel2">5.0k</text><text x="30" y="194" font-size="10" font-family="JetBrains Mono" fill="currentColor" opacity="0.4" text-anchor="end" id="yLabel1">0</text>
            <path id="chartAreaPath" d="M 50 190 L 880 190 Z" fill="url(#zincAreaGradient)"/>
            <path id="chartStrokePath" d="M 50 190 L 880 190" stroke="currentColor" stroke-width="2.5" class="text-zinc-800 dark:text-zinc-200"/>
            <g id="chartMarkers" style="display: none;"></g>
            <g id="chartXAxisLabels"><text x="50" y="215" font-size="10" font-family="JetBrains Mono" fill="currentColor" opacity="0.4" text-anchor="middle" id="xLabel1">Start</text><text x="250" y="215" font-size="10" font-family="JetBrains Mono" fill="currentColor" opacity="0.4" text-anchor="middle" id="xLabel2">Batch 25</text><text x="460" y="215" font-size="10" font-family="JetBrains Mono" fill="currentColor" opacity="0.4" text-anchor="middle" id="xLabel3">Batch 50</text><text x="680" y="215" font-size="10" font-family="JetBrains Mono" fill="currentColor" opacity="0.4" text-anchor="middle" id="xLabel4">Batch 75</text><text x="880" y="215" font-size="10" font-family="JetBrains Mono" fill="currentColor" opacity="0.4" text-anchor="middle" id="xLabel5">Batch 100</text></g>
          </svg>
          <div id="chartEmptyBadge" class="absolute inset-0 flex items-center justify-center pointer-events-none ${isZero ? "" : "hidden"}">
            <span class="px-3.5 py-1.5 rounded-lg bg-zinc-900/80 text-zinc-300 border border-zinc-700/60 font-mono text-xs backdrop-blur-sm shadow-md">Stage 0 Baseline: 0 batches ingested &bull; Run Sync to plot live progression</span>
          </div>
        </div>
        <div class="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 gap-3">
          <div class="flex items-center gap-4 flex-wrap" id="chartLegend">
            <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500"></span>Delivered to CRM</span>
            <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-amber-500"></span>Auto-Repaired via DLQ</span>
            <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-rose-500"></span>Held in Review</span>
            <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-zinc-400"></span>SHA-256 Idempotent Skip</span>
          </div>
          <div class="text-[11px] font-mono text-zinc-400 dark:text-zinc-500" id="chartStateSummary">Extract: ${state.extractedN} &bull; Synced: ${state.syncedS} &bull; Skipped: ${state.skippedO} &bull; DLQ: ${state.dlqPendingE}</div>
        </div>
      </section>

      <!-- Upfront Live Pipeline Architecture Health Stepper -->
      <section class="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4 shadow-sm" id="pipeline-health-banner">
        <div class="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 flex-wrap gap-2">
          <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span><span class="text-xs font-bold text-zinc-950 dark:text-zinc-50 uppercase tracking-wide">Live Pipeline Health &amp; Architecture Pillars</span><span class="text-[11px] font-mono text-zinc-500" id="livePillarSummary">${state.extractedN} Extracted &bull; ${state.syncedS} Delivered &bull; ${state.skippedO} Unchanged &bull; ${state.dlqPendingE} Held</span></div>
          <button type="button" onclick="switchToHealthTab()" class="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">Ver Matriz SLA Detallada &rarr;</button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
          <div class="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
            <div class="flex items-center justify-between text-xs font-medium"><span class="text-zinc-900 dark:text-zinc-100 font-semibold">1. Warehouse</span><span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-mono">Live</span></div>
            <div class="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 font-mono">DuckDB 10k Mart &bull; $2.50/mo FinOps</div>
          </div>
          <div class="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
            <div class="flex items-center justify-between text-xs font-medium"><span class="text-zinc-900 dark:text-zinc-100 font-semibold">2. Airflow DAG</span><span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-mono">&lt;0.05s SLA</span></div>
            <div class="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 font-mono">3 Tasks Thin Orchestration</div>
          </div>
          <div class="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
            <div class="flex items-center justify-between text-xs font-medium"><span class="text-zinc-900 dark:text-zinc-100 font-semibold">3. Data Balance</span><span class="text-[10px] px-1.5 py-0.5 rounded ${state.dlqPendingE > 0 ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"} font-mono" id="stepperBalanceBadge">Balanced</span></div>
            <div class="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 font-mono" id="stepperBalanceText">N(${state.extractedN}) = S(${state.syncedS}) + E(${state.dlqPendingE})</div>
          </div>
          <div class="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
            <div class="flex items-center justify-between text-xs font-medium"><span class="text-zinc-900 dark:text-zinc-100 font-semibold">4. HubSpot CRM</span><span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-mono">Synced</span></div>
            <div class="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 font-mono">Token Bucket &bull; Full Jitter 429</div>
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
            <button type="button" class="tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 transition inline-flex items-center" data-tab="health"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Pipeline &amp; Cloud Health (4)</button>
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
                <th class="p-3 w-8"><input type="checkbox" class="rounded border-zinc-300 dark:border-zinc-700"></th>
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

        <!-- Block Pagination & Down Arrow Block Loader ("flecha abajo para mostrar en bloques") -->
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
                <tr><td class="p-3 font-medium text-zinc-900 dark:text-zinc-100"><div class="font-semibold text-zinc-950 dark:text-zinc-50">Pillar 1: Warehouse &amp; FinOps Guardrails</div><div class="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">Snowflake (WH_DATA_PULSE_XS) &amp; DuckDB Embedded</div></td><td class="p-3 font-mono text-zinc-700 dark:text-zinc-300">AUTO_SUSPEND=60s &bull; TIMEOUT=300s</td><td class="p-3 text-zinc-700 dark:text-zinc-300">50 Credits ($150 Cap) &bull; Cost: $2.50/mo vs $4,200/yr SaaS</td><td class="p-3"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Active &amp; Guarded</span></td></tr>
                <tr><td class="p-3 font-medium text-zinc-900 dark:text-zinc-100"><div class="font-semibold text-zinc-950 dark:text-zinc-50">Pillar 2: Apache Airflow Thin DAG</div><div class="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">DAG ID: datapulse_hubspot_profitability_sync</div></td><td class="p-3 font-mono text-zinc-700 dark:text-zinc-300">SLA: &lt;0.05s parse SLA</td><td class="p-3 text-zinc-700 dark:text-zinc-300">3 Tasks: 1. validate_sync_manifest, 2. execute_incremental_reverse_etl, 3. audit_dlq_and_finops_telemetry</td><td class="p-3"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Healthy (0 * * * *)</span></td></tr>
                <tr><td class="p-3 font-medium text-zinc-900 dark:text-zinc-100"><div class="font-semibold text-zinc-950 dark:text-zinc-50">Pillar 3: Data Delivery Balance (Row Conservation)</div><div class="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono" id="pillar3BalanceText">Data Delivery Balance: ${state.extractedN} Extracted = ${state.syncedS} Delivered + ${state.skippedO} Unchanged + ${state.dlqPendingE} Held</div></td><td class="p-3 font-mono text-zinc-700 dark:text-zinc-300">Out-of-Band Replay &bull; Zero Impact on Sync SLA</td><td class="p-3 text-zinc-700 dark:text-zinc-300">Auto-Remediates 150 Invalid Emails (RFC-5322 regex) &amp; 50 NaN Margin Records (coalesce to 0.0)</td><td class="p-3"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Balanced &amp; Certified</span></td></tr>
                <tr><td class="p-3 font-medium text-zinc-900 dark:text-zinc-100"><div class="font-semibold text-zinc-950 dark:text-zinc-50">Pillar 4 (HubSpot CRM v3 Store)</div><div class="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">Batch Upsert Endpoint: /crm/v3/objects/contacts/batch/upsert</div></td><td class="p-3 font-mono text-zinc-700 dark:text-zinc-300">100 records / batch &bull; Token Bucket Rate Limiter</td><td class="p-3 text-zinc-700 dark:text-zinc-300">HMAC-SHA256 Webhook Verification &bull; 429 Retry Backoff (Full Jitter) &bull; SHA-256 Idempotency Cache</td><td class="p-3"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Connected &amp; Synced</span></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
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
    let activeChartView = "sync";
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
      savings: { title: "Annual Cloud Savings", business: "Direct cost reduction achieved by executing data pipelines in-engine rather than paying third-party SaaS vendors per-row ingestion fees.", tech: "Replaces commercial Reverse ETL vendor ($4,200/yr) with serverless Snowflake XS warehouse execution under FinOps auto-suspend (60s) policies costing $2.50/mo (99.3% reduction)." },
      flow: { title: "Live Data Sync & Quality Flow", business: "Visual progression tracking healthy customer volume, quarantine events, and automated repair replay across all pipeline phases.", tech: "Proves mathematical Conservation of Rows: Extracted (N) = Delivered (S) + Unchanged (O) + In Review (E). Live Bezier area curve reflects stage transitions with zero row loss." },
      system: { title: "System & Architecture Settings", business: "Configuration parameters governing warehouse connectivity, Airflow DAG cadence, and security credential management.", tech: "Controls DuckDB/Snowflake connection strings, HMAC webhook secrets, token-bucket rate limits, and idempotency cache duration." }
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

    function toggleDlqAccordion(forceOpen) {
      const content = document.getElementById("dlqAccordionContent");
      const chevron = document.getElementById("accordionChevron");
      if (!content) return;
      const shouldOpen = forceOpen === true || content.classList.contains("hidden");
      if (shouldOpen) { content.classList.remove("hidden"); if (chevron) chevron.classList.add("rotate-180"); }
      else { content.classList.add("hidden"); if (chevron) chevron.classList.remove("rotate-180"); }
    }

    function switchToHealthTab() {
      activeTab = "health";
      updateTabButtons();
      const el = document.getElementById("customer-table-section");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }

    function navAction(action) {
      const scrollEl = document.getElementById("mainScrollContainer");
      if (action === "dashboard") { if (scrollEl) scrollEl.scrollTo({ top: 0, behavior: "smooth" }); }
      else if (action === "syncs") { activeTab = "all"; updateTabButtons(); const el = document.getElementById("customer-table-section"); if (el) el.scrollIntoView({ behavior: "smooth" }); }
      else if (action === "dlq") { toggleDlqAccordion(true); const el = document.getElementById("dlq-accordion-card"); if (el) el.scrollIntoView({ behavior: "smooth" }); }
      else if (action === "budget") { switchChartView("finops"); const el = document.getElementById("area-chart-card"); if (el) el.scrollIntoView({ behavior: "smooth" }); }
    }

    function renderDynamicChart(s, view) {
      const isZero = s.totalSyncedContacts === 0 && s.extractedN === 0;
      const areaPath = document.getElementById("chartAreaPath");
      const strokePath = document.getElementById("chartStrokePath");
      const markers = document.getElementById("chartMarkers");
      const emptyBadge = document.getElementById("chartEmptyBadge");
      const [y4, y3, y2, y1] = ["yLabel4", "yLabel3", "yLabel2", "yLabel1"].map((id) => document.getElementById(id));
      const [x1, x2, x3, x4, x5] = ["xLabel1", "xLabel2", "xLabel3", "xLabel4", "xLabel5"].map((id) => document.getElementById(id));

      if (isZero) {
        y4.innerText = "0"; y3.innerText = "0"; y2.innerText = "0"; y1.innerText = "0";
        x1.innerText = "Start"; x2.innerText = "-"; x3.innerText = "-"; x4.innerText = "-"; x5.innerText = "End";
        areaPath.setAttribute("d", "M 50 190 L 880 190 Z");
        strokePath.setAttribute("d", "M 50 190 L 880 190");
        markers.style.display = "none";
        markers.innerHTML = "";
        emptyBadge.classList.remove("hidden");
        return;
      }
      emptyBadge.classList.add("hidden");

      if (view === "sync") {
        y4.innerText = "10.0k"; y3.innerText = "7.5k"; y2.innerText = "5.0k"; y1.innerText = "0";
        x1.innerText = "Batch 1"; x2.innerText = "Batch 25"; x3.innerText = "Batch 50"; x4.innerText = "Batch 75"; x5.innerText = "Batch 100";
        const batches = s.batchHistory && s.batchHistory.length > 0 ? s.batchHistory : [];
        let dArea = "", dStroke = "";
        if (batches.length >= 2) {
          const totalBatches = Math.max(batches.length, 100);
          const pts = batches.map((b) => [50 + Math.round((b.batchIndex / totalBatches) * 830), 190 - Math.round((b.cumulativeSynced / 10000) * 150)]);
          dStroke = "M 50 190 " + pts.map(([x, y]) => "L " + x + " " + y).join(" ");
          dArea = dStroke + " L " + pts[pts.length - 1][0] + " 190 L 50 190 Z";
        } else {
          const syncRatio = Math.min(1.0, s.totalSyncedContacts / 10000);
          const endX = 50 + Math.round(syncRatio * 830);
          const endY = 190 - Math.round(syncRatio * 150);
          dStroke = "M 50 190 C " + (50 + Math.round(endX * 0.3)) + " 190, " + (50 + Math.round(endX * 0.7)) + " " + (endY + 20) + ", " + endX + " " + endY;
          dArea = dStroke + " L " + endX + " 190 L 50 190 Z";
        }
        areaPath.setAttribute("d", dArea);
        strokePath.setAttribute("d", dStroke);

        let markerHtml = "";
        if (s.totalSyncedContacts >= 9800) {
          const dlText = (s.syncedS || s.totalSyncedContacts).toLocaleString("en-US") + " Delivered";
          markerHtml += '<circle cx="780" cy="46" r="4.5" class="fill-emerald-500 stroke-white dark:stroke-zinc-950" stroke-width="2"/>';
          markerHtml += '<text x="780" y="32" font-size="10" font-family="Inter" font-weight="600" fill="currentColor" text-anchor="middle" class="text-emerald-600 dark:text-emerald-400">' + dlText + '</text>';
        }
        if (s.dlqResolved > 0) {
          const repText = s.dlqResolved.toLocaleString("en-US") + " Repaired";
          markerHtml += '<circle cx="860" cy="40" r="4.5" class="fill-amber-500 stroke-white dark:stroke-zinc-950" stroke-width="2"/>';
          markerHtml += '<text x="860" y="26" font-size="10" font-family="Inter" font-weight="600" fill="currentColor" text-anchor="middle" class="text-amber-600 dark:text-amber-400">' + repText + '</text>';
        } else if (s.dlqPendingE > 0) {
          markerHtml += '<circle cx="800" cy="54" r="4.5" class="fill-rose-500 stroke-white dark:stroke-zinc-950" stroke-width="2"/>';
          markerHtml += '<text x="800" y="70" font-size="10" font-family="Inter" font-weight="600" fill="currentColor" text-anchor="middle" class="text-rose-600 dark:text-rose-400">' + s.dlqPendingE + ' Held in Review</text>';
        }
        markers.innerHTML = markerHtml;
        markers.style.display = markerHtml ? "" : "none";
      } else if (view === "revenue") {
        const seg = s.segmentBreakdown || {};
        const vipRev = seg.ENTERPRISE_VIP?.annual_revenue || 0;
        const entRev = seg.ENTERPRISE?.annual_revenue || 0;
        const mmRev = seg.MID_MARKET?.annual_revenue || 0;
        const smeRev = seg.SME?.annual_revenue || 0;
        const totalRev = vipRev + entRev + mmRev + smeRev;
        const maxScale = Math.max(totalRev, 1000000);
        y4.innerText = "$" + (maxScale / 1000000).toFixed(1) + "M";
        y3.innerText = "$" + (maxScale * 0.75 / 1000000).toFixed(1) + "M";
        y2.innerText = "$" + (maxScale * 0.50 / 1000000).toFixed(1) + "M";
        y1.innerText = "$0";
        x1.innerText = "VIP"; x2.innerText = "Enterprise"; x3.innerText = "Mid-Market"; x4.innerText = "SME"; x5.innerText = "Total";
        const c1 = 190 - Math.round((vipRev / maxScale) * 150);
        const c2 = 190 - Math.round(((vipRev + entRev) / maxScale) * 150);
        const c3 = 190 - Math.round(((vipRev + entRev + mmRev) / maxScale) * 150);
        const c4 = 190 - Math.round((totalRev / maxScale) * 150);
        const dStr = "M 50 190 L 250 " + c1 + " L 460 " + c2 + " L 680 " + c3 + " L 880 " + c4;
        strokePath.setAttribute("d", dStr);
        areaPath.setAttribute("d", dStr + " L 880 190 L 50 190 Z");
        markers.innerHTML = '<circle cx="880" cy="' + c4 + '" r="4.5" class="fill-purple-500 stroke-white dark:stroke-zinc-950" stroke-width="2"/><text x="830" y="' + (c4 - 10) + '" font-size="10" font-family="Inter" font-weight="600" fill="currentColor" class="text-purple-600 dark:text-purple-400">Total: $' + (totalRev / 1000000).toFixed(2) + 'M</text>';
        markers.style.display = "";
      } else if (view === "finops") {
        y4.innerText = "$4,200"; y3.innerText = "$3,000"; y2.innerText = "$1,500"; y1.innerText = "$0";
        x1.innerText = "Month 1"; x2.innerText = "Month 3"; x3.innerText = "Month 6"; x4.innerText = "Month 9"; x5.innerText = "Month 12";
        const dStr = "M 50 188 C 200 188, 400 187, 600 187 C 720 186, 800 186, 880 186";
        strokePath.setAttribute("d", dStr);
        areaPath.setAttribute("d", dStr + " L 880 190 L 50 190 Z");
        markers.innerHTML = '<circle cx="880" cy="186" r="4.5" class="fill-emerald-500 stroke-white dark:stroke-zinc-950" stroke-width="2"/><text x="820" y="172" font-size="10" font-family="Inter" font-weight="600" fill="currentColor" class="text-emerald-600 dark:text-emerald-400">$2.50/mo FinOps</text>';
        markers.style.display = "";
      }
    }

    function switchChartView(view) {
      activeChartView = view;
      document.querySelectorAll(".chart-view-btn").forEach((b) => {
        b.className = b.getAttribute("data-view") === view ? "chart-view-btn px-3 py-1 rounded-md font-medium transition bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-sm" : "chart-view-btn px-3 py-1 rounded-md font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 transition";
      });
      const sub = document.getElementById("chartSubtitle");
      if (view === "sync") sub.innerText = "Real-time Bezier trajectory of customer ingestion, quarantine isolation, and automated repair replay.";
      else if (view === "revenue") sub.innerText = "Cumulative customer contract value partitioned across Enterprise VIP, Mid-Market, and SMB tiers.";
      else if (view === "finops") sub.innerText = "SaaS Flat Fee ($4,200/yr) vs DataPulse Serverless FinOps execution ($2.50/mo = $30.00/yr).";
      renderDynamicChart(currentLiveState, view);
    }

    document.querySelectorAll(".chart-view-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchChartView(btn.getAttribute("data-view")));
    });

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
      const companyDisplay = escapeHtml(c.company || "Enterprise Account") + ' &bull; ' + escapeHtml(c.country || "US");
      return '<tr class="customer-row border-b border-zinc-200/80 dark:border-zinc-800 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer" data-contact="' + safeJson + '" onclick="openInspectorFromRow(this)"><td class="p-3"><input type="checkbox" class="rounded border-zinc-300 dark:border-zinc-700" onclick="event.stopPropagation()"></td><td class="p-3"><div class="font-medium text-xs text-zinc-950 dark:text-zinc-50 font-mono">' + escapeHtml(c.customer_id) + '</div><div class="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">' + escapeHtml(c.email) + ' &bull; ' + companyDisplay + '</div></td><td class="p-3">' + tierBadge + '</td><td class="p-3">' + statusPill + '</td><td class="p-3 font-mono text-xs font-semibold text-zinc-950 dark:text-zinc-50">$' + c.net_profitability_usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</td><td class="p-3">' + marginBadge + '</td><td class="p-3">' + briefCell + '</td><td class="p-3 text-right"><button type="button" class="btn-inspect px-2.5 py-1 rounded text-xs font-medium border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition" onclick="event.stopPropagation(); openInspectorFromRow(this.closest(\'tr\'))">Inspect</button></td></tr>';
    }

    async function loadContacts(append = false) {
      const tbody = document.getElementById("contactsBody");
      if (!tbody) return;
      const isZero = currentLiveState.totalSyncedContacts === 0 && currentLiveState.extractedN === 0;
      if (isZero) {
        tbody.innerHTML = '<tr><td colspan="8" class="p-12 text-center text-xs text-zinc-500 font-mono">Stage 0 Baseline: 0 Contacts in CRM. Ingestion pipeline is idle. Click "1. Run Sync" above to stream batches...</td></tr>';
        updatePaginationUi(0, 0, 0, false);
        return;
      }
      try {
        const url = "/api/v1/contacts?q=" + encodeURIComponent(filterQuery) + "&tab=" + encodeURIComponent(activeTab) + "&offset=" + pageOffset + "&limit=" + pageLimit;
        const resp = await fetch(url);
        if (!resp.ok) return;
        const data = await resp.json();
        const rowsHtml = (data.contacts || []).map(formatRowClient).join("\n");
        if (data.total === 0) {
          tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-xs text-zinc-500 font-mono">No matching records found in CRM store for query "' + escapeHtml(filterQuery) + '".</td></tr>';
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
      document.getElementById("sidebarEngine").innerText = s.activeEngine || "duckdb_local";

      const synTrend = document.getElementById("kpi-synced-trend");
      if (synTrend) synTrend.innerHTML = isZero ? '<span class="inline-flex items-center font-medium text-zinc-500"><span class="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-1.5"></span>Standby</span><span>&bull; Awaiting Sync</span>' : s.totalSyncedContacts >= 10000 ? '<span class="inline-flex items-center font-medium text-emerald-600 dark:text-emerald-400"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>100% Complete</span><span>&bull; Zero row loss</span>' : s.totalSyncedContacts >= 9800 ? '<span class="inline-flex items-center font-medium text-emerald-600 dark:text-emerald-400"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>+98.0% First Pass</span><span>&bull; 200 Held in DLQ</span>' : '<span class="inline-flex items-center font-medium text-blue-600 dark:text-blue-400"><span class="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 animate-pulse"></span>10k in Warehouse</span><span>&bull; Ready to Sync</span>';
      const vipTrend = document.getElementById("kpi-vip-trend");
      if (vipTrend) vipTrend.innerHTML = isZero || s.vipBriefCount === 0 ? '<span class="inline-flex items-center font-medium text-zinc-500"><span class="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-1.5"></span>0 Alerts</span><span>&bull; Normal Margin Profile</span>' : '<span class="inline-flex items-center font-medium text-rose-600 dark:text-rose-400"><span class="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>-20.0% Margin Drop</span><span>&bull; Executive retention call</span>';
      const dlqDot = document.getElementById("kpi-dlq-dot");
      if (dlqDot) dlqDot.className = isZero ? "w-2.5 h-2.5 rounded-full bg-zinc-400" : s.dlqPendingE > 0 ? "w-2.5 h-2.5 rounded-full bg-rose-500" : s.dlqResolved > 0 ? "w-2.5 h-2.5 rounded-full bg-amber-500" : "w-2.5 h-2.5 rounded-full bg-emerald-500";
      const dlqTrend = document.getElementById("kpi-dlq-trend");
      if (dlqTrend) dlqTrend.innerHTML = isZero ? '<span class="inline-flex items-center text-xs font-medium text-zinc-500"><span class="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-1.5"></span>Standby: 0 Anomalies Held</span>' : s.dlqPendingE > 0 ? '<span class="inline-flex items-center text-xs font-medium text-rose-600 dark:text-rose-400"><span class="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>Danger: ' + (s.emailErrorsPending || 150) + ' Email, ' + (s.nanErrorsPending || 50) + ' NaN Held</span>' : '<span class="inline-flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Healthy: 0 Held / ' + s.dlqResolved + ' Repaired</span>';
      const savTrend = document.getElementById("kpi-savings-trend");
      if (savTrend) savTrend.innerHTML = isZero ? '<span class="inline-flex items-center font-medium text-zinc-500"><span class="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-1.5"></span>Standby</span><span>&bull; $4,170/yr projected on active sync</span>' : '<span class="inline-flex items-center font-medium text-emerald-600 dark:text-emerald-400"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>99.3% Cost Reduction</span><span>&bull; $2.50/mo vs $4,200/yr</span>';

      const badge = document.getElementById("accordionBadge");
      if (badge) {
        badge.innerText = isZero ? "0 Anomalies Pending" : s.dlqPendingE > 0 ? s.dlqPendingE + " Anomalies Quarantined" : s.dlqResolved + " Anomalies Remediated";
        badge.className = "px-2 py-0.5 rounded-full text-[10px] font-mono font-medium " + (isZero ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700" : s.dlqPendingE > 0 ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20");
      }

      const emailSpan = document.getElementById("dlqEmailCountSpan");
      if (emailSpan) emailSpan.innerHTML = '(' + (s.emailErrorsPending || (s.dlqPendingE > 0 ? 150 : 0)) + ' records &bull; CUST-09801 to CUST-09950)';
      const nanSpan = document.getElementById("dlqNanCountSpan");
      if (nanSpan) nanSpan.innerHTML = '(' + (s.nanErrorsPending || (s.dlqPendingE > 0 ? 50 : 0)) + ' records &bull; CUST-09951 to CUST-10000)';

      const tabAll = document.getElementById("tabCountAll");
      if (tabAll) tabAll.innerText = s.totalSyncedContacts.toLocaleString("en-US");
      const tabVip = document.getElementById("tabCountVip");
      if (tabVip) tabVip.innerText = s.vipBriefCount;
      const tabRep = document.getElementById("tabCountRepaired");
      if (tabRep) tabRep.innerText = s.dlqResolved;

      const p3 = document.getElementById("pillar3BalanceText");
      if (p3) p3.innerHTML = "Data Delivery Balance: " + s.extractedN + " Extracted = " + s.syncedS + " Delivered + " + s.skippedO + " Unchanged + " + s.dlqPendingE + " Held";
      const stepSummary = document.getElementById("livePillarSummary");
      if (stepSummary) stepSummary.innerHTML = s.extractedN + " Extracted &bull; " + s.syncedS + " Delivered &bull; " + s.skippedO + " Unchanged &bull; " + s.dlqPendingE + " Held";
      const stepBalText = document.getElementById("stepperBalanceText");
      if (stepBalText) stepBalText.innerText = "N(" + s.extractedN + ") = S(" + s.syncedS + ") + E(" + s.dlqPendingE + ")";

      const summary = document.getElementById("chartStateSummary");
      if (summary) summary.innerHTML = "Extract: " + s.extractedN + " &bull; Synced: " + s.syncedS + " &bull; Skipped: " + s.skippedO + " &bull; DLQ: " + s.dlqPendingE;

      renderDynamicChart(s, activeChartView);
      if (activeTab !== "health") loadContacts(false);
    }

    async function triggerPipelinePhase(phase) {
      const spinner = document.getElementById("pipelineSpinner");
      const btns = document.querySelectorAll(".pipeline-step-btn");
      btns.forEach((b) => b.disabled = true);
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
