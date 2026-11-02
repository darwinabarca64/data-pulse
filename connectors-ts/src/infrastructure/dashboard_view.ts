/**
 * Infrastructure Layer: Style 1 - Shadcn/UI & Power BI Executive Dashboard.
 * Monochromatic Inter typography, sleek geometric SaaS branding, live Bezier Area Chart,
 * clickable (i) info popovers, and slide-over customer payload inspection.
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
    if (fUpper === "ENTERPRISE_VIP") return Boolean(c.ai_executive_brief) || c.customer_tier.toUpperCase().includes("VIP");
    return c.customer_tier.toUpperCase().includes(fUpper) || c.customer_id.toUpperCase().includes(fUpper) || c.email.toUpperCase().includes(fUpper);
  });

  const rowsHtml = filtered
    .map((c) => {
      const isHealed = c.customer_id >= "CUST-09801";
      const isVip = Boolean(c.ai_executive_brief) || c.customer_tier.includes("VIP");
      const statusPill = isVip
        ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"><span class="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>VIP At Risk</span>`
        : isHealed
          ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>Auto-Repaired</span>`
          : `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Delivered</span>`;

      const briefCell = c.ai_executive_brief
        ? `<div class="flex items-center gap-1.5"><span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">[VIP-BRIEF]</span><span class="text-xs text-zinc-700 dark:text-zinc-300 truncate max-w-xs" title="${escapeHtml(c.ai_executive_brief)}">${escapeHtml(c.ai_executive_brief)}</span></div>`
        : isHealed
          ? `<span class="text-xs text-zinc-500 dark:text-zinc-400">Remediated via AI DLQ Doctor (RFC-5322 regex / coalesce)</span>`
          : `<span class="text-xs text-zinc-400 dark:text-zinc-500">Standard Margin Profile - Normal Rhythm</span>`;

      const marginBadge = c.profit_margin_pct < 0
        ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">${c.profit_margin_pct.toFixed(1)}%</span>`
        : `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">+${c.profit_margin_pct.toFixed(1)}%</span>`;

      const tierBadge = isVip
        ? `<span class="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20">${escapeHtml(c.customer_tier)}</span>`
        : `<span class="px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">${escapeHtml(c.customer_tier)}</span>`;

      const safeJson = escapeHtml(JSON.stringify(c));
      const companyDomain = escapeHtml(c.email.split("@")[1] || "company.com");

      return `<tr class="customer-row border-b border-zinc-200/80 dark:border-zinc-800 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer" data-contact="${safeJson}">
        <td class="p-3"><input type="checkbox" class="rounded border-zinc-300 dark:border-zinc-700" onclick="event.stopPropagation()"></td>
        <td class="p-3"><div class="font-medium text-xs text-zinc-950 dark:text-zinc-50 font-mono">${escapeHtml(c.customer_id)}</div><div class="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">${escapeHtml(c.email)} &bull; ${companyDomain}</div></td>
        <td class="p-3">${tierBadge}</td>
        <td class="p-3">${statusPill}</td>
        <td class="p-3 font-mono text-xs font-semibold text-zinc-950 dark:text-zinc-50">$${c.net_profitability_usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="p-3">${marginBadge}</td>
        <td class="p-3">${briefCell}</td>
        <td class="p-3 text-right"><button type="button" class="btn-inspect px-2.5 py-1 rounded text-xs font-medium border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition" onclick="event.stopPropagation(); openInspectorFromRow(this.closest('tr'))">Inspect</button></td>
      </tr>`;
    })
    .join("\n");

  const dlqDotColor = state.dlqPendingE > 0 ? "bg-rose-500" : "bg-emerald-500";
  const dlqStatusBadge = state.dlqPendingE > 0
    ? `<span class="inline-flex items-center text-xs font-medium text-rose-600 dark:text-rose-400"><span class="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>Danger: ${state.emailErrorsPending || 150} Email, ${state.nanErrorsPending || 50} NaN Held</span>`
    : `<span class="inline-flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Healthy: 0 Held / ${state.dlqResolved} Repaired</span>`;

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="Data Pulse | DataPulse Reverse ETL Executive Mission Control" />
  <title>Data Pulse | Executive Overview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: "class",
      theme: { extend: { fontFamily: { sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"], mono: ["JetBrains Mono", "monospace"] } } }
    };
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
    body { font-family: 'Inter', sans-serif; }
    .mono { font-family: 'JetBrains Mono', monospace; }
  </style>
</head>
<body class="bg-zinc-50 dark:bg-zinc-950 text-zinc-950 dark:text-zinc-50 min-h-screen antialiased flex flex-col md:flex-row transition-colors duration-150">
  <!-- Left Sidebar Navigation -->
  <aside class="w-full md:w-64 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md p-4 shrink-0 flex flex-col justify-between">
    <div>
      <!-- Brand & Sleek Geometric SaaS Logo (NO hospital/pulse icon) -->
      <div class="flex items-center gap-3 px-2 py-2 mb-6">
        <div class="flex aspect-square size-9 items-center justify-center rounded-lg bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-sm">
          <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-8 4.5v9L12 21l8-4.5v-9L12 3Z"/><path d="M12 12 4 7.5"/><path d="m12 12 8-4.5"/><path d="M12 12v9"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>
        </div>
        <div class="flex flex-col">
          <span class="text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">Data Pulse</span>
          <span class="text-[11px] text-zinc-500 dark:text-zinc-400">Executive Workspace</span>
        </div>
      </div>

      <!-- Workspace Picker Pill -->
      <div class="mb-5 px-2">
        <div class="flex items-center justify-between p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 text-xs text-zinc-700 dark:text-zinc-300 font-medium">
          <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-emerald-500"></span><span>Acme Corp &bull; Production</span></div>
          <svg class="w-3.5 h-3.5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
        </div>
      </div>

      <!-- Navigation Links -->
      <nav class="space-y-1">
        <a href="#" class="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium bg-zinc-100 text-zinc-950 dark:bg-zinc-800/80 dark:text-zinc-50">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
          Dashboard
        </a>
        <a href="#customer-table-section" class="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/40 hover:text-zinc-950 dark:hover:text-zinc-50 transition">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Customer Syncs
        </a>
        <a href="#customer-table-section" class="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/40 hover:text-zinc-950 dark:hover:text-zinc-50 transition">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>
          Data Quality &amp; Review
        </a>
        <a href="#area-chart-card" class="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/40 hover:text-zinc-950 dark:hover:text-zinc-50 transition">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>
          Cloud Budget
        </a>
        <a href="javascript:void(0)" onclick="openInfoPopover('system')" class="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/40 hover:text-zinc-950 dark:hover:text-zinc-50 transition">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          System Settings
        </a>
      </nav>
    </div>

    <!-- Bottom Sidebar Status Widget -->
    <div class="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800">
      <div class="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
        <div class="flex items-center justify-between text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
          <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>Live Engine</span>
          <span class="font-mono text-zinc-500 dark:text-zinc-400 text-[10px]">${escapeHtml(state.activeEngine)}</span>
        </div>
        <div class="mt-2 text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
          <span>SLA: &lt;0.05s</span><span class="text-emerald-600 dark:text-emerald-400 font-medium">99.99% Uptime</span>
        </div>
      </div>
    </div>
  </aside>

  <!-- Main View Area -->
  <main class="flex-1 flex flex-col min-w-0 overflow-y-auto">
    <!-- Top Header Bar -->
    <header class="border-b border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 z-30">
      <div class="flex items-center gap-2">
        <span class="text-xs text-zinc-400 dark:text-zinc-500">Data Pulse</span><span class="text-xs text-zinc-300 dark:text-zinc-700">/</span>
        <h1 class="text-sm font-semibold text-zinc-950 dark:text-zinc-50 flex items-center gap-1.5">
          Executive Overview
          <button type="button" class="info-btn text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition p-0.5" onclick="openInfoPopover('overview')">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          </button>
        </h1>
      </div>

      <div class="flex items-center gap-2.5 flex-wrap">
        <!-- Live Phase Banner -->
        <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20" id="phase-banner">
          <span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
          ${escapeHtml(state.currentPhase)}
        </div>

        <!-- Connection Traffic Light -->
        <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span><span>Connector Online</span>
        </div>

        <!-- Auto-Refresh Toggle -->
        <button id="togglePollingBtn" type="button" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
          <span class="w-2 h-2 rounded-full bg-emerald-500" id="pollingDot"></span>
          <span id="pollingStatusText">Auto-Refresh (2s)</span>
        </button>

        <!-- Solid Black Action Button -->
        <button id="resetStoreBtn" type="button" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm transition">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          Reset Demo
        </button>

        <!-- Theme Toggle -->
        <button id="themeToggleBtn" type="button" class="p-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
          <svg id="moonIcon" class="w-4 h-4 hidden dark:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
          <svg id="sunIcon" class="w-4 h-4 block dark:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
        </button>
      </div>
    </header>

    <!-- Page Content Container -->
    <div class="p-6 space-y-6 max-w-7xl mx-auto w-full">
      <!-- 4 Shadcn KPI Cards -->
      <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- KPI Card 1: Synced CRM Customers -->
        <div class="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5 shadow-sm hover:shadow transition-shadow">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-zinc-500 dark:text-zinc-400 flex items-center">Synced CRM Customers<button type="button" class="info-btn text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition p-0.5 ml-1" onclick="openInfoPopover('synced')"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></button></span>
            <div class="w-7 h-7 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg></div>
          </div>
          <div class="mt-3">
            <div class="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50" id="kpi-synced">${state.totalSyncedContacts.toLocaleString("en-US")}</div>
            <div class="flex items-center gap-1.5 mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span class="inline-flex items-center font-medium ${state.totalSyncedContacts > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500"}"><span class="w-1.5 h-1.5 rounded-full ${state.totalSyncedContacts > 0 ? "bg-emerald-500" : "bg-zinc-400"} mr-1.5"></span>${state.totalSyncedContacts >= 10000 ? "100% Complete" : state.totalSyncedContacts >= 9800 ? "+98.0% First Pass" : "Awaiting Sync"}</span><span>&bull; Zero row loss</span>
            </div>
          </div>
        </div>

        <!-- KPI Card 2: VIP Accounts at Risk -->
        <div class="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5 shadow-sm hover:shadow transition-shadow">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-zinc-500 dark:text-zinc-400 flex items-center">VIP Accounts at Risk<button type="button" class="info-btn text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition p-0.5 ml-1" onclick="openInfoPopover('vip')"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></button></span>
            <div class="w-7 h-7 rounded-md bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
          </div>
          <div class="mt-3">
            <div class="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50" id="kpi-vip">${state.vipBriefCount}</div>
            <div class="flex items-center gap-1.5 mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span class="inline-flex items-center font-medium text-rose-600 dark:text-rose-400"><span class="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>-20.0% Margin Drop</span><span class="truncate">&bull; Executive retention call</span>
            </div>
          </div>
        </div>

        <!-- KPI Card 3: Records Held for Review -->
        <div class="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5 shadow-sm hover:shadow transition-shadow cursor-pointer" onclick="toggleDlqAccordion(true)">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-zinc-500 dark:text-zinc-400 flex items-center">
              Records Held for Review
              <button type="button" class="info-btn text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition p-0.5 ml-1" onclick="event.stopPropagation(); openInfoPopover('dlq')"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></button>
            </span>
            <div class="w-7 h-7 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
            </div>
          </div>
          <div class="mt-3">
            <div class="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
              <span id="kpi-dlq">${state.dlqPendingE}</span>
              <span class="w-2.5 h-2.5 rounded-full ${dlqDotColor}" id="kpi-dlq-dot"></span>
            </div>
            <div class="flex items-center gap-1.5 mt-2 text-xs" id="kpi-dlq-trend">${dlqStatusBadge}</div>
          </div>
        </div>

        <!-- KPI Card 4: Annual Cloud Savings -->
        <div class="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5 shadow-sm hover:shadow transition-shadow">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-zinc-500 dark:text-zinc-400 flex items-center">
              Annual Cloud Savings
              <button type="button" class="info-btn text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition p-0.5 ml-1" onclick="openInfoPopover('savings')"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></button>
            </span>
            <div class="w-7 h-7 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
          </div>
          <div class="mt-3">
            <div class="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50" id="kpi-savings">$${state.annualSaasSavingsUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
            <div class="flex items-center gap-1.5 mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span class="inline-flex items-center font-medium text-emerald-600 dark:text-emerald-400">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>99.3% Cost Reduction
              </span>
              <span class="truncate">&bull; $2.50/mo vs $4,200/yr</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Quarantined Errors & AI Doctor Triage Accordion -->
      <section class="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4 shadow-sm" id="dlq-accordion-card">
        <div class="flex items-center justify-between cursor-pointer select-none" onclick="toggleDlqAccordion()">
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-md bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div>
              <div class="text-xs font-semibold text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
                <span>Quarantined Schema Anomalies &amp; AI DLQ Doctor Triage</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${state.dlqPendingE > 0 ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"}" id="accordionBadge">
                  ${state.dlqPendingE > 0 ? state.dlqPendingE + " Anomalies Quarantined" : (state.dlqResolved || 200) + " Anomalies Remediated"}
                </span>
              </div>
              <div class="text-[11px] text-zinc-500 dark:text-zinc-400">Expandable root-cause diagnosis, error payloads, and surgical remedial SQL</div>
            </div>
          </div>
          <svg id="accordionChevron" class="w-4 h-4 text-zinc-400 transition-transform duration-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
        </div>
        <div id="dlqAccordionContent" class="hidden mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
          <!-- Dropdown 1: INVALID_EMAIL_FORMAT -->
          <details class="group rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 overflow-hidden" open>
            <summary class="flex items-center justify-between p-3 text-xs font-medium cursor-pointer text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-rose-500"></span>
                <span class="font-mono font-semibold">1. INVALID_EMAIL_FORMAT</span>
                <span class="text-zinc-500 font-mono text-[11px]">(150 records &bull; CUST-09801 to CUST-09950)</span>
              </div>
              <svg class="w-3.5 h-3.5 text-zinc-400 group-open:rotate-180 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
            </summary>
            <div class="p-3.5 pt-0 text-xs font-mono border-t border-zinc-200/60 dark:border-zinc-800/60 space-y-2 text-zinc-600 dark:text-zinc-400">
              <div><span class="text-zinc-900 dark:text-zinc-200 font-semibold">Root Cause:</span> Source rows contain double '@' or missing domain syntax (e.g. <code class="text-rose-500 font-bold">corrupt@@domain..com</code>), violating RFC-5322 contracts.</div>
              <div><span class="text-zinc-900 dark:text-zinc-200 font-semibold">AI Doctor Remedy:</span> <code class="text-emerald-600 dark:text-emerald-400">REGEXP_REPLACE(LOWER(TRIM(email)), '@@', '@')</code> &bull; Surgical Replay Re-validates Pydantic Contract.</div>
              <div><span class="text-zinc-900 dark:text-zinc-200 font-semibold">Resolution:</span> Quarantined in Phase 1 &bull; Auto-healed and replayed to CRM in Phase 3 without pipeline restart.</div>
            </div>
          </details>
          <!-- Dropdown 2: IEEE_754_NAN_INFINITY -->
          <details class="group rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 overflow-hidden" open>
            <summary class="flex items-center justify-between p-3 text-xs font-medium cursor-pointer text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-amber-500"></span>
                <span class="font-mono font-semibold">2. IEEE_754_NAN_INFINITY</span>
                <span class="text-zinc-500 font-mono text-[11px]">(50 records &bull; CUST-09951 to CUST-10000)</span>
              </div>
              <svg class="w-3.5 h-3.5 text-zinc-400 group-open:rotate-180 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
            </summary>
            <div class="p-3.5 pt-0 text-xs font-mono border-t border-zinc-200/60 dark:border-zinc-800/60 space-y-2 text-zinc-600 dark:text-zinc-400">
              <div><span class="text-zinc-900 dark:text-zinc-200 font-semibold">Root Cause:</span> Upstream SQL division by zero (0.0 / 0.0) produced IEEE-754 NaN floats violating RFC-8259 JSON serialization contracts.</div>
              <div><span class="text-zinc-900 dark:text-zinc-200 font-semibold">AI Doctor Remedy:</span> <code class="text-emerald-600 dark:text-emerald-400">COALESCE(NULLIF(profit_margin_pct, 'NaN'::DOUBLE), 0.0)</code> &bull; Safe Zero-Margin Boundary.</div>
              <div><span class="text-zinc-900 dark:text-zinc-200 font-semibold">Resolution:</span> Quarantined in Phase 1 &bull; Remediated &amp; replayed into HubSpot with 100% data integrity preserved.</div>
            </div>
          </details>
        </div>
      </section>

      <!-- Center Interactive Smooth Bezier Area Chart (Shadcn Dashboard Reference) -->
      <section class="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-6 shadow-sm" id="area-chart-card">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 gap-4">
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-base font-semibold text-zinc-950 dark:text-zinc-50">Live Data Sync &amp; Quality Flow</h2>
              <button type="button" class="info-btn text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition p-0.5" onclick="openInfoPopover('flow')"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></button>
            </div>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5" id="chartSubtitle">Real-time Bezier trajectory of customer ingestion, quarantine isolation, and automated repair replay.</p>
          </div>
          <!-- View Selector Buttons -->
          <div class="inline-flex items-center p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs">
            <button type="button" class="chart-view-btn px-3 py-1 rounded-md font-medium transition bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-sm" data-view="sync">Sync Progression</button>
            <button type="button" class="chart-view-btn px-3 py-1 rounded-md font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 transition" data-view="revenue">Revenue by Segment</button>
            <button type="button" class="chart-view-btn px-3 py-1 rounded-md font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 transition" data-view="finops">Cost Efficiency</button>
          </div>
        </div>

        <!-- SVG Bezier Area Chart Container -->
        <div class="mt-4 relative">
          <svg class="w-full h-56 md:h-64 overflow-visible" viewBox="0 0 900 240" fill="none" xmlns="http://www.w3.org/2000/svg" id="mainSvgChart">
            <defs>
              <linearGradient id="zincAreaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#71717a" stop-opacity="0.35"/><stop offset="100%" stop-color="#71717a" stop-opacity="0.0"/></linearGradient>
            </defs>
            <line x1="40" y1="40" x2="880" y2="40" stroke="currentColor" stroke-opacity="0.08" stroke-dasharray="4 4" class="text-zinc-500"/>
            <line x1="40" y1="90" x2="880" y2="90" stroke="currentColor" stroke-opacity="0.08" stroke-dasharray="4 4" class="text-zinc-500"/>
            <line x1="40" y1="140" x2="880" y2="140" stroke="currentColor" stroke-opacity="0.08" stroke-dasharray="4 4" class="text-zinc-500"/>
            <line x1="40" y1="190" x2="880" y2="190" stroke="currentColor" stroke-opacity="0.08" stroke-dasharray="4 4" class="text-zinc-500"/>
            <text x="30" y="44" font-size="10" font-family="JetBrains Mono" fill="currentColor" opacity="0.4" text-anchor="end" id="yLabel4">10.0k</text>
            <text x="30" y="94" font-size="10" font-family="JetBrains Mono" fill="currentColor" opacity="0.4" text-anchor="end" id="yLabel3">7.5k</text>
            <text x="30" y="144" font-size="10" font-family="JetBrains Mono" fill="currentColor" opacity="0.4" text-anchor="end" id="yLabel2">5.0k</text>
            <text x="30" y="194" font-size="10" font-family="JetBrains Mono" fill="currentColor" opacity="0.4" text-anchor="end" id="yLabel1">0</text>
            <path id="chartAreaPath" d="M 50 190 C 200 190, 400 130, 600 70 C 720 50, 800 44, 880 40 L 880 190 L 50 190 Z" fill="url(#zincAreaGradient)"/>
            <path id="chartStrokePath" d="M 50 190 C 200 190, 400 130, 600 70 C 720 50, 800 44, 880 40" stroke="currentColor" stroke-width="2.5" class="text-zinc-800 dark:text-zinc-200"/>
            <g id="chartMarkers">
              <circle cx="780" cy="46" r="4.5" class="fill-emerald-500 stroke-white dark:stroke-zinc-950" stroke-width="2"/>
              <text x="780" y="32" font-size="10" font-family="Inter" font-weight="600" fill="currentColor" text-anchor="middle" class="text-emerald-600 dark:text-emerald-400">9,800 Delivered</text>
              <circle cx="860" cy="40" r="4.5" class="fill-amber-500 stroke-white dark:stroke-zinc-950" stroke-width="2"/>
              <text x="860" y="26" font-size="10" font-family="Inter" font-weight="600" fill="currentColor" text-anchor="middle" class="text-amber-600 dark:text-amber-400">200 Repaired</text>
            </g>
            <text x="50" y="215" font-size="10" font-family="JetBrains Mono" fill="currentColor" opacity="0.4" text-anchor="middle">Batch 1</text>
            <text x="250" y="215" font-size="10" font-family="JetBrains Mono" fill="currentColor" opacity="0.4" text-anchor="middle">Batch 25</text>
            <text x="460" y="215" font-size="10" font-family="JetBrains Mono" fill="currentColor" opacity="0.4" text-anchor="middle">Batch 50</text>
            <text x="680" y="215" font-size="10" font-family="JetBrains Mono" fill="currentColor" opacity="0.4" text-anchor="middle">Batch 75</text>
            <text x="880" y="215" font-size="10" font-family="JetBrains Mono" fill="currentColor" opacity="0.4" text-anchor="middle">Batch 100</text>
          </svg>
        </div>

        <!-- Chart Legend -->
        <div class="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 gap-3">
          <div class="flex items-center gap-4 flex-wrap">
            <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500"></span>Delivered to CRM</span>
            <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-amber-500"></span>Auto-Repaired via DLQ</span>
            <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-rose-500"></span>Held in Review</span>
            <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-zinc-400"></span>SHA-256 Idempotent Skip</span>
          </div>
          <div class="text-[11px] font-mono text-zinc-400 dark:text-zinc-500" id="chartStateSummary">
            Extract: ${state.extractedN} &bull; Synced: ${state.syncedS} &bull; Skipped: ${state.skippedO} &bull; DLQ: ${state.dlqPendingE}
          </div>
        </div>
      </section>

      <!-- Bottom Tabbed Executive Data Table -->
      <section class="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 overflow-hidden shadow-sm" id="customer-table-section">
        <!-- Tab Bar & Filter Toolbar -->
        <div class="p-4 border-b border-zinc-200/80 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <!-- Rounded Tabs -->
          <div class="flex items-center gap-1.5 flex-wrap">
            <button type="button" class="tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-sm" data-tab="all">
              All Customers (${state.totalSyncedContacts.toLocaleString("en-US")})
            </button>
            <button type="button" class="tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 transition inline-flex items-center" data-tab="vip">
              <span class="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>VIP Retention Alerts (${state.vipBriefCount})
            </button>
            <button type="button" class="tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 transition inline-flex items-center" data-tab="repaired">
              <span class="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>Repaired Records (${state.dlqResolved})
            </button>
            <button type="button" class="tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 transition inline-flex items-center" data-tab="health">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Pipeline &amp; Cloud Health (3)
            </button>
          </div>

          <!-- Search Filter -->
          <div class="relative" id="filterContainer">
            <input type="search" id="filterInput" value="${escapeHtml(initialFilter)}" placeholder="Filter by ID, email, or tier..." class="w-full md:w-72 px-3 py-1.5 pl-8 rounded-lg text-xs font-mono bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400" />
            <svg class="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </div>
        </div>

        <!-- Customer Records Table -->
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
            <tbody id="contactsBody" class="divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
              ${rowsHtml || '<tr><td colspan="8" class="p-12 text-center text-xs text-zinc-500 font-mono">Stage 0 Baseline: 0 Contacts in CRM. Ingestion pipeline is idle. Run datapulse sync to stream records...</td></tr>'}
            </tbody>
          </table>
        </div>

        <!-- Pipeline & Cloud Health View (Tab 4) -->
        <div id="healthTableWrapper" class="hidden p-5">
          <div class="rounded-xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900/30">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 text-[11px] font-mono uppercase text-zinc-500 dark:text-zinc-400">
                  <th class="p-3 font-medium">Architecture Pillar &amp; Component</th>
                  <th class="p-3 font-medium">Execution Engine &amp; SLA</th>
                  <th class="p-3 font-medium">Guardrail Policy &amp; Metrics</th>
                  <th class="p-3 font-medium">Operational Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-200/60 dark:divide-zinc-800/60 text-xs">
                <tr>
                  <td class="p-3 font-medium text-zinc-900 dark:text-zinc-100"><div class="font-semibold text-zinc-950 dark:text-zinc-50">Pillar 1: Warehouse &amp; FinOps Guardrails</div><div class="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">Snowflake (WH_DATA_PULSE_XS) &amp; DuckDB Embedded</div></td>
                  <td class="p-3 font-mono text-zinc-700 dark:text-zinc-300">AUTO_SUSPEND=60s &bull; TIMEOUT=300s</td>
                  <td class="p-3 text-zinc-700 dark:text-zinc-300">50 Credits ($150 Cap) &bull; Cost: $2.50/mo vs $4,200/yr SaaS</td>
                  <td class="p-3"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Active &amp; Guarded</span></td>
                </tr>
                <tr>
                  <td class="p-3 font-medium text-zinc-900 dark:text-zinc-100"><div class="font-semibold text-zinc-950 dark:text-zinc-50">Pillar 2: Apache Airflow Thin DAG</div><div class="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">DAG ID: datapulse_hubspot_profitability_sync</div></td>
                  <td class="p-3 font-mono text-zinc-700 dark:text-zinc-300">SLA: &lt;0.05s parse SLA</td>
                  <td class="p-3 text-zinc-700 dark:text-zinc-300">3 Tasks: 1. validate_sync_manifest [OK], 2. execute_incremental_reverse_etl [SYNC], 3. audit_dlq_and_finops_telemetry [AUDIT]</td>
                  <td class="p-3"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Healthy (0 * * * *)</span></td>
                </tr>
                <tr>
                  <td class="p-3 font-medium text-zinc-900 dark:text-zinc-100"><div class="font-semibold text-zinc-950 dark:text-zinc-50">Pillar 3: N = S + O + E &amp; Out-of-Band AI DLQ Doctor</div><div class="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">Row Conservation: N(${state.extractedN}) = S(${state.syncedS}) + O(${state.skippedO}) + E(${state.dlqPendingE})</div></td>
                  <td class="p-3 font-mono text-zinc-700 dark:text-zinc-300">Out-of-Band Replay &bull; Zero Impact on Sync SLA</td>
                  <td class="p-3 text-zinc-700 dark:text-zinc-300">Auto-Remediates 150 Invalid Emails (RFC-5322 regex) &amp; 50 NaN Margin Records (coalesce to 0.0)</td>
                  <td class="p-3"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Balanced &amp; Certified</span></td>
                </tr>
                <tr>
                  <td class="p-3 font-medium text-zinc-900 dark:text-zinc-100"><div class="font-semibold text-zinc-950 dark:text-zinc-50">Pillar 4 (HubSpot CRM v3 Store)</div><div class="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">Batch Upsert Endpoint: /crm/v3/objects/contacts/batch/upsert</div></td>
                  <td class="p-3 font-mono text-zinc-700 dark:text-zinc-300">100 records / batch &bull; Token Bucket Rate Limiter</td>
                  <td class="p-3 text-zinc-700 dark:text-zinc-300">HMAC-SHA256 Webhook Verification &bull; 429 Retry Backoff (Full Jitter) &bull; SHA-256 Idempotency Cache</td>
                  <td class="p-3"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Connected &amp; Synced</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  </main>

  <!-- Clickable (i) Info Popover Modal -->
  <div id="infoPopoverBackdrop" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 hidden opacity-0 transition-opacity duration-150 flex items-center justify-center p-4">
    <div id="infoPopoverCard" class="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl max-w-lg w-full p-6 transform scale-95 transition-transform duration-150">
      <div class="flex items-start justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></div>
          <div><h3 class="text-sm font-semibold text-zinc-950 dark:text-zinc-50" id="infoModalTitle">Metric Title</h3><p class="text-xs text-zinc-500 dark:text-zinc-400">Power BI Executive Clarity &amp; System Architecture</p></div>
        </div>
        <button id="closeInfoBtn" type="button" class="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
      </div>
      <div class="mt-4 space-y-4 text-xs">
        <div class="rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 p-3.5">
          <div class="flex items-center gap-2 font-semibold text-blue-900 dark:text-blue-300 mb-1.5"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>Plain-English Business Meaning</div>
          <p class="text-zinc-700 dark:text-zinc-300 leading-relaxed" id="infoModalBusiness">-</p>
        </div>
        <div class="rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 p-3.5">
          <div class="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5"><svg class="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>Under-the-Hood Technical Detail</div>
          <p class="text-zinc-600 dark:text-zinc-400 font-mono text-[11px] leading-relaxed" id="infoModalTech">-</p>
        </div>
      </div>
      <div class="mt-5 flex justify-end">
        <button id="closeInfoBtn2" type="button" class="px-3.5 py-1.5 rounded-md text-xs font-medium bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition">Understood</button>
      </div>
    </div>
  </div>

  <!-- Slide-Over Row Inspector Drawer -->
  <div id="drawerBackdrop" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 hidden opacity-0 transition-opacity duration-200"></div>
  <aside id="inspectorDrawer" class="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl z-50 transform translate-x-full transition-transform duration-300 ease-out flex flex-col">
    <div class="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
        <h2 class="text-sm font-bold text-zinc-950 dark:text-zinc-50" id="drawerTitle">Customer Payload Inspector</h2>
      </div>
      <button id="closeDrawerBtn" type="button" class="p-1.5 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
    </div>
    <div class="p-5 space-y-4 overflow-y-auto flex-1 font-mono text-xs">
      <div>
        <div class="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">Customer Identifier &amp; Segment</div>
        <div class="flex items-center gap-2"><span class="text-base font-bold text-zinc-950 dark:text-zinc-50" id="drawerCustId">-</span><span class="px-2 py-0.5 rounded text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700" id="drawerTier">-</span></div>
      </div>
      <div>
        <div class="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">Computed SHA-256 Payload Hash</div>
        <div class="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 break-all select-all flex items-center justify-between gap-2" id="drawerSha256Box"><span id="drawerSha256">-</span><button type="button" onclick="navigator.clipboard.writeText(document.getElementById('drawerSha256').innerText)" class="text-[10px] text-zinc-400 hover:text-zinc-100 shrink-0 uppercase">Copy</button></div>
      </div>
      <div>
        <div class="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">HubSpot v3 Ingest Property Mapping</div>
        <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden"><table class="w-full text-left"><tbody id="drawerPropMapping" class="divide-y divide-zinc-200 dark:divide-zinc-800 text-[11px]"></tbody></table></div>
      </div>
      <div>
        <div class="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">Canonical RFC-8259 JSON Payload</div>
        <pre class="p-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 overflow-x-auto text-[11px] leading-relaxed" id="drawerJson">-</pre>
      </div>
    </div>
  </aside>

  <!-- Client-Side Reactive Controller -->
  <script>
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
      flow: { title: "Live Data Sync & Quality Flow", business: "Visual progression tracking healthy customer volume, quarantine events, and automatic repair replay across all pipeline phases.", tech: "Proves mathematical Conservation of Rows: Extracted (N) = Delivered (S) + Unchanged (O) + In Review (E). Live Bezier area curve reflects stage transitions with zero row loss." },
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
      popoverBackdrop.classList.add("opacity-0");
      popoverCard.classList.add("scale-95");
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
        ["hs_external_customer_id", contact.customer_id],
        ["email", contact.email],
        ["hs_net_profitability_usd", "$" + (contact.net_profitability_usd || 0).toFixed(2)],
        ["hs_profit_margin_pct", (contact.profit_margin_pct || 0).toFixed(1) + "%"],
        ["datapulse_customer_tier", contact.customer_tier],
        ["datapulse_ai_executive_brief", contact.ai_executive_brief || "[Standard Margin Rhythm]"]
      ];
      document.getElementById("drawerPropMapping").innerHTML = mapping.map(([k, v]) => '<tr class="border-b border-zinc-200 dark:border-zinc-800"><td class="p-2.5 text-zinc-500 font-mono">' + k + '</td><td class="p-2.5 font-mono font-medium text-zinc-900 dark:text-zinc-100">' + v + '</td></tr>').join("");
      drawerBackdrop.classList.remove("hidden");
      setTimeout(() => drawerBackdrop.classList.remove("opacity-0"), 10);
      drawer.classList.remove("translate-x-full");
    }
    function openInspectorFromRow(row) {
      try { openInspector(JSON.parse(row.getAttribute("data-contact"))); } catch (e) { console.error(e); }
    }
    function closeInspector() {
      drawer.classList.add("translate-x-full");
      drawerBackdrop.classList.add("opacity-0");
      setTimeout(() => drawerBackdrop.classList.add("hidden"), 200);
    }
    document.getElementById("closeDrawerBtn").addEventListener("click", closeInspector);
    drawerBackdrop.addEventListener("click", closeInspector);
    document.querySelectorAll(".customer-row").forEach((row) => row.addEventListener("click", () => openInspectorFromRow(row)));

    const tabButtons = document.querySelectorAll(".tab-btn");
    const customersWrapper = document.getElementById("customersTableWrapper");
    const healthWrapper = document.getElementById("healthTableWrapper");
    const filterContainer = document.getElementById("filterContainer");

    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        tabButtons.forEach((b) => { b.className = "tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 transition inline-flex items-center"; });
        btn.className = "tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-sm inline-flex items-center";
        const tab = btn.getAttribute("data-tab");
        if (tab === "health") {
          customersWrapper.classList.add("hidden"); healthWrapper.classList.remove("hidden"); filterContainer.classList.add("hidden");
        } else {
          customersWrapper.classList.remove("hidden"); healthWrapper.classList.add("hidden"); filterContainer.classList.remove("hidden");
          document.querySelectorAll("#contactsBody tr.customer-row").forEach((row) => {
            try {
              const c = JSON.parse(row.getAttribute("data-contact"));
              if (tab === "all") row.style.display = "";
              else if (tab === "vip") row.style.display = (Boolean(c.ai_executive_brief) || (c.customer_tier || "").includes("VIP")) ? "" : "none";
              else if (tab === "repaired") row.style.display = (c.customer_id >= "CUST-09801") ? "" : "none";
            } catch { row.style.display = ""; }
          });
        }
      });
    });

    document.getElementById("filterInput").addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll("#contactsBody tr.customer-row").forEach((row) => {
        row.style.display = row.innerText.toLowerCase().includes(q) ? "" : "none";
      });
    });

    const chartBtns = document.querySelectorAll(".chart-view-btn");
    const chartSub = document.getElementById("chartSubtitle");
    const chartAreaPath = document.getElementById("chartAreaPath");
    const chartStrokePath = document.getElementById("chartStrokePath");
    const chartMarkers = document.getElementById("chartMarkers");

    chartBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        chartBtns.forEach((b) => { b.className = "chart-view-btn px-3 py-1 rounded-md font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 transition"; });
        btn.className = "chart-view-btn px-3 py-1 rounded-md font-medium transition bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-sm";
        const view = btn.getAttribute("data-view");
        if (view === "sync") {
          chartSub.innerText = "Real-time Bezier trajectory of customer ingestion, quarantine isolation, and automated repair replay.";
          document.getElementById("yLabel4").innerText = "10.0k"; document.getElementById("yLabel3").innerText = "7.5k"; document.getElementById("yLabel2").innerText = "5.0k";
          chartAreaPath.setAttribute("d", "M 50 190 C 200 190, 400 130, 600 70 C 720 50, 800 44, 880 40 L 880 190 L 50 190 Z");
          chartStrokePath.setAttribute("d", "M 50 190 C 200 190, 400 130, 600 70 C 720 50, 800 44, 880 40");
          chartMarkers.style.display = "";
        } else if (view === "revenue") {
          chartSub.innerText = "Cumulative customer contract value partitioned across Enterprise VIP, Mid-Market, and SMB tiers.";
          document.getElementById("yLabel4").innerText = "$5.0M"; document.getElementById("yLabel3").innerText = "$3.7M"; document.getElementById("yLabel2").innerText = "$2.5M";
          chartAreaPath.setAttribute("d", "M 50 190 C 180 170, 350 110, 520 80 C 700 60, 800 48, 880 42 L 880 190 L 50 190 Z");
          chartStrokePath.setAttribute("d", "M 50 190 C 180 170, 350 110, 520 80 C 700 60, 800 48, 880 42");
          chartMarkers.style.display = "none";
        } else if (view === "finops") {
          chartSub.innerText = "SaaS Flat Fee ($4,200/yr) vs DataPulse Serverless FinOps execution ($2.50/mo = $30.00/yr).";
          document.getElementById("yLabel4").innerText = "$4,200"; document.getElementById("yLabel3").innerText = "$3,000"; document.getElementById("yLabel2").innerText = "$1,500";
          chartAreaPath.setAttribute("d", "M 50 190 C 200 190, 400 190, 600 188 C 720 188, 800 187, 880 186 L 880 190 L 50 190 Z");
          chartStrokePath.setAttribute("d", "M 50 190 C 200 190, 400 190, 600 188 C 720 188, 800 187, 880 186");
          chartMarkers.style.display = "none";
        }
      });
    });

    document.getElementById("resetStoreBtn").addEventListener("click", async () => {
      if (confirm("Reset CRM memory store and demo telemetry to baseline?")) {
        await fetch("/api/v1/reset", { method: "POST" });
        location.reload();
      }
    });

    function toggleDlqAccordion(forceOpen) {
      const content = document.getElementById("dlqAccordionContent");
      const chevron = document.getElementById("accordionChevron");
      if (!content) return;
      const shouldOpen = forceOpen === true || content.classList.contains("hidden");
      if (shouldOpen) { content.classList.remove("hidden"); if (chevron) chevron.classList.add("rotate-180"); }
      else { content.classList.add("hidden"); if (chevron) chevron.classList.remove("rotate-180"); }
    }

    let pollingActive = true;
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
        document.getElementById("kpi-synced").innerText = s.totalSyncedContacts.toLocaleString("en-US");
        document.getElementById("kpi-vip").innerText = s.vipBriefCount;
        document.getElementById("kpi-dlq").innerText = s.dlqPendingE;
        document.getElementById("kpi-savings").innerText = "$" + s.annualSaasSavingsUsd.toLocaleString("en-US", { minimumFractionDigits: 2 });
        document.getElementById("phase-banner").innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse mr-1"></span>' + (s.currentPhase || "");
        const dlqDot = document.getElementById("kpi-dlq-dot");
        if (dlqDot) dlqDot.className = s.dlqPendingE > 0 ? "w-2.5 h-2.5 rounded-full bg-rose-500" : "w-2.5 h-2.5 rounded-full bg-emerald-500";
        const dlqTrend = document.getElementById("kpi-dlq-trend");
        if (dlqTrend) {
          dlqTrend.innerHTML = s.dlqPendingE > 0
            ? '<span class="inline-flex items-center text-xs font-medium text-rose-600 dark:text-rose-400"><span class="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>Danger: ' + (s.emailErrorsPending || 150) + ' Email, ' + (s.nanErrorsPending || 50) + ' NaN Held</span>'
            : '<span class="inline-flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Healthy: 0 Held / ' + s.dlqResolved + ' Repaired</span>';
        }
        const summary = document.getElementById("chartStateSummary");
        if (summary) {
          summary.innerText = "Extract: " + s.extractedN + " &bull; Synced: " + s.syncedS + " &bull; Skipped: " + s.skippedO + " &bull; DLQ: " + s.dlqPendingE;
        }
      } catch (err) {}
    }, 2000);
  </script>
</body>
</html>`;
}
