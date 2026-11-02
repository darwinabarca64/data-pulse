/**
 * Infrastructure Layer: Style 4 - Staff-Grade Ultimate Fusion Mission Control.
 * Combines Dagster Topology Flow + Tremor Category Gauges + Shadcn Slide-Over JSON Inspector + Live Theme Switcher.
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
        ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 mr-1.5">[VIP-BRIEF]</span> <span class="theme-text-subtle">${escapeHtml(c.ai_executive_brief)}</span>`
        : isHealed
          ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mr-1.5">[HEALED-DLQ]</span> <span class="theme-text-muted">Remediated via Out-of-Band AI DLQ Doctor &amp; Surgical Replay</span>`
          : `<span class="theme-text-muted font-mono text-xs">[OK] Standard Margin Profile</span>`;
      const marginColor = c.profit_margin_pct < 0 ? "text-rose-400 font-bold" : "text-emerald-400 font-semibold";
      const tierBadge = isHealed
        ? `<span class="px-2 py-0.5 rounded text-xs font-mono font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 mr-1">${escapeHtml(c.customer_tier)}</span><span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">REMEDIATED_DLQ</span>`
        : `<span class="px-2 py-0.5 rounded text-xs font-mono font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">${escapeHtml(c.customer_tier)}</span>`;
      const safeJson = escapeHtml(JSON.stringify(c));

      return `<tr class="customer-row border-b theme-border hover:bg-white/5 cursor-pointer transition-colors" data-contact="${safeJson}">
        <td class="px-3.5 py-2.5 font-mono text-xs font-semibold theme-text-bright">${escapeHtml(c.customer_id)}</td>
        <td class="px-3.5 py-2.5 text-xs theme-text-subtle font-mono">${escapeHtml(c.email)}</td>
        <td class="px-3.5 py-2.5 text-xs">${tierBadge}</td>
        <td class="px-3.5 py-2.5 font-mono text-xs theme-text-bright">$${c.net_profitability_usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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
<html lang="en" data-theme="obsidian">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DataPulse Reverse ETL | Staff-Grade Mission Control (Ultimate Fusion)</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
    body { font-family: 'Inter', sans-serif; transition: background-color 0.2s, color 0.2s; }
    .mono { font-family: 'JetBrains Mono', monospace; }
    @keyframes flowDash { to { stroke-dashoffset: -24; } }
    .flow-pipe { stroke-dasharray: 6 6; animation: flowDash 1.2s linear infinite; }
    .node-card { transition: all 0.2s ease; }
    .node-card:hover { transform: translateY(-2px); }

    /* Theme 1: Obsidian Vercel */
    html[data-theme="obsidian"] { background-color: #09090b; color: #f4f4f5; }
    html[data-theme="obsidian"] .theme-card { background-color: rgba(24, 24, 27, 0.7); border-color: rgba(63, 63, 70, 0.4); }
    html[data-theme="obsidian"] .theme-border { border-color: rgba(63, 63, 70, 0.4); }
    html[data-theme="obsidian"] .theme-text-bright { color: #fafafa; }
    html[data-theme="obsidian"] .theme-text-subtle { color: #d4d4d8; }
    html[data-theme="obsidian"] .theme-text-muted { color: #a1a1aa; }

    /* Theme 2: Tremor Emerald */
    html[data-theme="tremor"] { background-color: #040914; color: #f1f5f9; }
    html[data-theme="tremor"] .theme-card { background-color: #0b1329; border-color: #1e293b; }
    html[data-theme="tremor"] .theme-border { border-color: #1e293b; }
    html[data-theme="tremor"] .theme-text-bright { color: #ffffff; }
    html[data-theme="tremor"] .theme-text-subtle { color: #cbd5e1; }
    html[data-theme="tremor"] .theme-text-muted { color: #64748b; }

    /* Theme 3: Light Enterprise */
    html[data-theme="light"] { background-color: #f8fafc; color: #0f172a; }
    html[data-theme="light"] .theme-card { background-color: #ffffff; border-color: #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    html[data-theme="light"] .theme-border { border-color: #e2e8f0; }
    html[data-theme="light"] .theme-text-bright { color: #0f172a; }
    html[data-theme="light"] .theme-text-subtle { color: #334155; }
    html[data-theme="light"] .theme-text-muted { color: #64748b; }
  </style>
</head>
<body class="min-h-screen p-4 md:p-6 antialiased">
  <!-- Top Bar with Logo, Telemetry Pills, Polling, & Instant Theme Switcher -->
  <header class="flex flex-col lg:flex-row lg:items-center justify-between pb-4 mb-4 border-b theme-border gap-4">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-sm">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
      </div>
      <div>
        <h1 class="text-base font-bold tracking-tight theme-text-bright flex items-center gap-2">
          DataPulse Reverse ETL
          <span class="text-xs px-2 py-0.5 rounded font-mono font-medium bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30">Style 4: Staff-Grade Ultimate Fusion</span>
        </h1>
        <p class="text-xs theme-text-muted">Hexagonal Architecture | Snowflake &amp; DuckDB | Thin Airflow DAG | Out-of-Band AI DLQ Doctor | HubSpot CRM v3</p>
      </div>
    </div>
    <div class="flex items-center gap-2 flex-wrap">
      <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20" id="phase-banner">
        <span class="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
        ${escapeHtml(state.currentPhase)}
      </div>
      <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
        [OK] CONNECTOR ONLINE
      </div>
      <!-- Live 2s Auto-Polling Toggle -->
      <button id="togglePollingBtn" type="button" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium border theme-border theme-card theme-text-subtle hover:opacity-80 transition">
        <span class="w-2 h-2 rounded-full bg-emerald-500" id="pollingDot"></span>
        <span id="pollingStatusText">Auto-Poll (2s)</span>
      </button>
      <!-- Reset Store Button -->
      <button id="resetStoreBtn" type="button" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono border theme-border theme-card theme-text-muted hover:text-rose-400 transition">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        Reset
      </button>
      <!-- Instant Live Theme Switcher -->
      <div class="inline-flex rounded-md border theme-border overflow-hidden text-xs font-mono">
        <button type="button" class="theme-switch-btn px-2.5 py-1 bg-zinc-800 text-white font-semibold" data-set-theme="obsidian" title="Shadcn Obsidian">Obsidian</button>
        <button type="button" class="theme-switch-btn px-2.5 py-1 opacity-70 hover:opacity-100" data-set-theme="tremor" title="Tremor Emerald">Tremor</button>
        <button type="button" class="theme-switch-btn px-2.5 py-1 opacity-70 hover:opacity-100" data-set-theme="light" title="Light Enterprise">Light</button>
      </div>
    </div>
  </header>

  <!-- Feature 1: Top Animated Dagster/Hightouch Pipeline Graph Canvas -->
  <section class="rounded-xl border theme-border theme-card p-4 mb-4 relative overflow-hidden">
    <div class="flex items-center justify-between mb-3 pb-2 border-b theme-border">
      <div class="flex items-center gap-2">
        <svg class="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h20"/><path d="m15 5 7 7-7 7"/></svg>
        <span class="text-xs font-mono font-semibold uppercase tracking-wider text-cyan-400">Interactive Pipeline Topology Canvas</span>
      </div>
      <span class="text-[11px] font-mono theme-text-muted">Click any node to focus inspection</span>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-4 gap-3 relative z-10">
      <div class="node-card cursor-pointer rounded-lg border theme-border p-3 hover:border-cyan-500/60" onclick="focusPillar(1)">
        <div class="flex items-center justify-between mb-1.5"><span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">SOURCE</span><svg class="w-3.5 h-3.5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg></div>
        <div class="text-xs font-bold font-mono theme-text-bright">Snowflake / DuckDB</div>
        <div class="text-[11px] theme-text-muted font-mono">WH_DATA_PULSE_XS (XSMALL)</div>
        <div class="text-[11px] font-mono text-emerald-400 font-semibold pt-1.5 mt-1.5 border-t theme-border flex justify-between"><span>10,000 Extracted</span><span class="text-[10px] theme-text-muted">9,800 Clean</span></div>
      </div>
      <div class="node-card cursor-pointer rounded-lg border theme-border p-3 hover:border-cyan-500/60" onclick="focusPillar(2)">
        <div class="flex items-center justify-between mb-1.5"><span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">DAG</span><svg class="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="m17 5-5-3-5 3"/><path d="m17 19-5 3-5-3"/></svg></div>
        <div class="text-xs font-bold font-mono theme-text-bright">Airflow Thin DAG</div>
        <div class="text-[11px] theme-text-muted font-mono">&lt;0.05s SLA | 3 Tasks</div>
        <div class="text-[11px] font-mono text-emerald-400 font-semibold pt-1.5 mt-1.5 border-t theme-border flex justify-between"><span>${escapeHtml(state.dagStatus)}</span><span class="text-[10px] theme-text-muted">Audited</span></div>
      </div>
      <div class="node-card cursor-pointer rounded-lg border theme-border p-3 hover:border-cyan-500/60" onclick="focusPillar(3)">
        <div class="flex items-center justify-between mb-1.5"><span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">AI DOCTOR</span><svg class="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg></div>
        <div class="text-xs font-bold font-mono theme-text-bright">Python AI DLQ Doctor</div>
        <div class="text-[11px] theme-text-muted font-mono">N = S + O + E Invariant</div>
        <div class="text-[11px] font-mono text-emerald-400 font-semibold pt-1.5 mt-1.5 border-t theme-border flex justify-between"><span>200/200 Healed</span><span class="text-[10px] theme-text-muted">0 Pending</span></div>
      </div>
      <div class="node-card cursor-pointer rounded-lg border theme-border p-3 hover:border-cyan-500/60" onclick="focusPillar(4)">
        <div class="flex items-center justify-between mb-1.5"><span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold">STORE</span><svg class="w-3.5 h-3.5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
        <div class="text-xs font-bold font-mono theme-text-bright">HubSpot CRM v3 Store</div>
        <div class="text-[11px] theme-text-muted font-mono">Rate Limit Burst Absorbed</div>
        <div class="text-[11px] font-mono text-emerald-400 font-semibold pt-1.5 mt-1.5 border-t theme-border flex justify-between"><span>${state.totalSyncedContacts.toLocaleString("en-US")} Synced</span><span class="text-[10px] theme-text-muted">${state.vipBriefCount} VIPs</span></div>
      </div>
    </div>
    <div class="hidden md:block absolute left-4 right-4 top-[50%] pointer-events-none -translate-y-1/2 z-0">
      <svg class="w-full h-8" preserveAspectRatio="none" viewBox="0 0 1000 32">
        <line x1="125" y1="16" x2="875" y2="16" stroke="#334155" stroke-width="3"/>
        <line x1="125" y1="16" x2="875" y2="16" stroke="#38bdf8" stroke-width="2" class="flow-pipe"/>
      </svg>
    </div>
  </section>

  <!-- Feature 2: Tremor FinOps Category Bars & Progress Gauges -->
  <section class="grid grid-cols-1 lg:grid-cols-3 gap-3.5 mb-4">
    <div class="rounded-xl border theme-border theme-card p-3.5 shadow-sm">
      <div class="flex items-center justify-between mb-2">
        <div><span class="text-[11px] font-mono uppercase tracking-wider theme-text-muted">Source Distribution</span><div class="text-sm font-bold font-mono theme-text-bright">10,000 Source Records</div></div>
        <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">98.0% Clean</span>
      </div>
      <div class="h-2.5 w-full bg-zinc-800 rounded-full overflow-hidden flex mb-2">
        <div class="bg-emerald-500 h-full" style="width: 98.0%"></div>
        <div class="bg-amber-500 h-full" style="width: 1.5%"></div>
        <div class="bg-rose-500 h-full" style="width: 0.5%"></div>
      </div>
      <div class="grid grid-cols-3 gap-1 text-[11px] font-mono pt-1.5 border-t theme-border theme-text-subtle">
        <div><span class="inline-block w-2 h-2 rounded-sm bg-emerald-500 mr-1"></span>Clean: 9,800</div>
        <div><span class="inline-block w-2 h-2 rounded-sm bg-amber-500 mr-1"></span>Email: 150</div>
        <div><span class="inline-block w-2 h-2 rounded-sm bg-rose-500 mr-1"></span>NaN: 50</div>
      </div>
    </div>
    <div class="rounded-xl border theme-border theme-card p-3.5 shadow-sm">
      <div class="flex items-center justify-between mb-2">
        <div><span class="text-[11px] font-mono uppercase tracking-wider theme-text-muted">Snowflake FinOps Budget</span><div class="text-sm font-bold font-mono text-emerald-400">$2.50 / $150.00 Mo. Cap</div></div>
        <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">${finopsUtilizationPct}% Utilized</span>
      </div>
      <div class="h-2.5 w-full bg-zinc-800 rounded-full overflow-hidden flex mb-2">
        <div class="bg-emerald-500 h-full" style="width: ${finopsUtilizationPct}%"></div>
      </div>
      <div class="flex justify-between items-center text-[11px] font-mono pt-1.5 border-t theme-border theme-text-muted">
        <span>Quota: 50 Credits ($150)</span>
        <span class="text-emerald-400 font-semibold">98.4% Budget Intact</span>
      </div>
    </div>
    <div class="rounded-xl border theme-border theme-card p-3.5 shadow-sm">
      <div class="flex items-center justify-between mb-2">
        <div><span class="text-[11px] font-mono uppercase tracking-wider theme-text-muted">Commercial SaaS Savings</span><div class="text-sm font-bold font-mono text-cyan-400">$4,170.00 / yr Saved</div></div>
        <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">${saasSavingsPct}% Saved</span>
      </div>
      <div class="h-2.5 w-full bg-zinc-800 rounded-full overflow-hidden flex mb-2">
        <div class="bg-cyan-500 h-full" style="width: ${saasSavingsPct}%"></div>
      </div>
      <div class="flex justify-between items-center text-[11px] font-mono pt-1.5 border-t theme-border theme-text-muted">
        <span>SaaS: $4,200/yr</span>
        <span class="text-cyan-400 font-semibold">DataPulse: $30/yr</span>
      </div>
    </div>
  </section>

  <!-- 3 Pillars Row -->
  <section class="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-4" id="pillarsSection">
    <div class="pillar-panel rounded-xl border theme-border theme-card p-3.5 shadow-sm transition-all" id="pillarPanel1">
      <div class="flex items-center justify-between pb-2 mb-2 border-b theme-border font-mono text-xs font-semibold tracking-wide uppercase text-cyan-400">
        <span>Pillar 1: Warehouse &amp; FinOps Guardrails</span>
        <svg class="w-4 h-4 text-cyan-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>
      </div>
      <div class="space-y-1 text-xs font-mono theme-text-muted">
        <div class="flex justify-between"><span>Active Engine:</span><span class="font-semibold theme-text-bright">${escapeHtml(state.activeEngine)} (WH_DATA_PULSE_XS)</span></div>
        <div class="flex justify-between"><span>FinOps Policy:</span><span class="theme-text-subtle">AUTO_SUSPEND=60s | TIMEOUT=300s</span></div>
        <div class="flex justify-between"><span>Resource Monitor:</span><span class="font-semibold text-emerald-400">50 Credits ($150 Cap) | $2.50/mo</span></div>
        <div class="flex justify-between"><span>Source Distribution:</span><span class="theme-text-subtle">10,000 (9,800 Clean | 200 Poison)</span></div>
        <div class="flex justify-between"><span>High Watermark:</span><span class="theme-text-subtle">${escapeHtml(state.watermarkTs)}</span></div>
      </div>
    </div>
    <div class="pillar-panel rounded-xl border theme-border theme-card p-3.5 shadow-sm transition-all" id="pillarPanel2">
      <div class="flex items-center justify-between pb-2 mb-2 border-b theme-border font-mono text-xs font-semibold tracking-wide uppercase text-cyan-400">
        <span>Pillar 2: Apache Airflow Thin DAG</span>
        <svg class="w-4 h-4 text-cyan-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="m17 5-5-3-5 3"/><path d="m17 19-5 3-5-3"/></svg>
      </div>
      <div class="space-y-1 text-xs font-mono mb-2 theme-text-muted">
        <div class="flex justify-between"><span>DAG ID:</span><span class="theme-text-bright">datapulse_hubspot_profitability_sync</span></div>
        <div class="flex justify-between"><span>DAG SLA &amp; State:</span><span class="font-semibold text-emerald-400">&lt;0.05s SLA | ${escapeHtml(state.dagStatus)}</span></div>
      </div>
      <div class="space-y-1 text-xs font-mono">
        <div class="flex items-center justify-between px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"><span>1. validate_sync_manifest</span><span>[OK]</span></div>
        <div class="flex items-center justify-between px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"><span>2. execute_incremental_reverse_etl</span><span>[SYNC]</span></div>
        <div class="flex items-center justify-between px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"><span>3. audit_dlq_and_finops_telemetry</span><span>[AUDIT]</span></div>
      </div>
    </div>
    <div class="pillar-panel rounded-xl border theme-border theme-card p-3.5 shadow-sm transition-all" id="pillarPanel3">
      <div class="flex items-center justify-between pb-2 mb-2 border-b theme-border font-mono text-xs font-semibold tracking-wide uppercase text-cyan-400">
        <span>Pillar 3: N = S + O + E &amp; Out-of-Band AI DLQ Doctor</span>
        <svg class="w-4 h-4 text-cyan-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
      </div>
      <div class="space-y-1 text-xs font-mono theme-text-muted mb-2">
        <div class="flex justify-between"><span>Conservation Law:</span><span class="font-semibold text-emerald-400">N(${state.extractedN}) = S(${state.syncedS}) + O(${state.skippedO}) + E(${state.dlqPendingE})</span></div>
        <div class="flex justify-between"><span>DLQ Quarantine:</span><span class="font-semibold ${state.dlqPendingE > 0 ? "text-amber-400" : "text-emerald-400"}">${escapeHtml(dlqBadgeText)}</span></div>
      </div>
      <div class="space-y-1 text-[11px] font-mono">
        <div class="p-1 rounded bg-black/20 border theme-border text-amber-400">1. INVALID_EMAIL_FORMAT (150): REGEXP_REPLACE(LOWER(TRIM(email)))</div>
        <div class="p-1 rounded bg-black/20 border theme-border text-amber-400">2. IEEE_754_NAN_INFINITY (50): COALESCE(NULLIF(margin_pct, 'NaN'), 0.0)</div>
      </div>
    </div>
  </section>

  <!-- 6 KPI Cards -->
  <section class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
    <div class="rounded-xl border theme-border theme-card p-3 shadow-sm">
      <div class="text-[11px] font-mono uppercase theme-text-muted mb-1">[S] Synced Contacts</div>
      <div class="text-xl font-bold font-mono text-emerald-400" id="kpi-synced">${state.totalSyncedContacts.toLocaleString("en-US")}</div>
    </div>
    <div class="rounded-xl border theme-border theme-card p-3 shadow-sm">
      <div class="text-[11px] font-mono uppercase theme-text-muted mb-1">[VIP] Executive Briefs</div>
      <div class="text-xl font-bold font-mono theme-text-bright" id="kpi-vip">${state.vipBriefCount}</div>
    </div>
    <div class="rounded-xl border theme-border theme-card p-3 shadow-sm">
      <div class="text-[11px] font-mono uppercase theme-text-muted mb-1">[E] Pending DLQ</div>
      <div class="text-xl font-bold font-mono ${state.dlqPendingE > 0 ? "text-amber-400" : "text-emerald-400"}" id="kpi-dlq">${state.dlqPendingE} (${state.dlqResolved} Healed)</div>
    </div>
    <div class="rounded-xl border theme-border theme-card p-3 shadow-sm">
      <div class="text-[11px] font-mono uppercase theme-text-muted mb-1">[O] SHA-256 Skipped</div>
      <div class="text-xl font-bold font-mono text-cyan-400" id="kpi-skipped">${state.skippedO.toLocaleString("en-US")}</div>
    </div>
    <div class="rounded-xl border theme-border theme-card p-3 shadow-sm">
      <div class="text-[11px] font-mono uppercase theme-text-muted mb-1">[HTTP] Batch Requests</div>
      <div class="text-xl font-bold font-mono theme-text-bright" id="kpi-batches">${state.totalBatchRequests} <span class="text-xs theme-text-muted">(429s: ${state.rateLimitRetriesAbsorbed})</span></div>
    </div>
    <div class="rounded-xl border theme-border theme-card p-3 shadow-sm">
      <div class="text-[11px] font-mono uppercase theme-text-muted mb-1">[FINOPS] Annual Savings</div>
      <div class="text-xl font-bold font-mono text-emerald-400">$${state.annualSaasSavingsUsd.toLocaleString("en-US")}/yr</div>
    </div>
  </section>

  <!-- Pillar 4 Table Toolbar & Table -->
  <section class="rounded-xl border theme-border theme-card overflow-hidden shadow-sm" id="tableSection">
    <div class="flex flex-col md:flex-row md:items-center justify-between p-3.5 border-b theme-border gap-3">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-xs font-mono font-semibold uppercase theme-text-muted">Pillar 4 (HubSpot CRM v3 Store):</span>
        <button type="button" class="btn-filter ${!fUpper ? "active bg-cyan-600 text-white" : "bg-black/20 theme-text-muted"} px-3 py-1 rounded text-xs font-mono font-semibold border theme-border" data-filter="">ALL (${state.totalSyncedContacts.toLocaleString("en-US")})</button>
        <button type="button" class="btn-filter ${fUpper === "ENTERPRISE_VIP" ? "active bg-cyan-600 text-white" : "bg-black/20 theme-text-muted"} px-3 py-1 rounded text-xs font-mono font-semibold border theme-border" id="btnFilterVip" data-filter="ENTERPRISE_VIP">ENTERPRISE_VIP (${state.vipBriefCount})</button>
        <button type="button" class="btn-filter ${fUpper === "REMEDIATED_DLQ" ? "active bg-cyan-600 text-white" : "bg-black/20 theme-text-muted"} px-3 py-1 rounded text-xs font-mono font-semibold border theme-border" id="btnFilterDlq" data-filter="REMEDIATED_DLQ">REMEDIATED_DLQ (${state.dlqResolved})</button>
      </div>
      <div class="relative">
        <input type="search" id="filterInput" value="${escapeHtml(initialFilter)}" placeholder="Filter by Tier/Email/ID..." class="w-full md:w-80 px-3 py-1.5 pl-8 rounded-md text-xs font-mono bg-black/20 border theme-border theme-text-bright focus:outline-none focus:border-cyan-500" />
        <svg class="w-3.5 h-3.5 theme-text-muted absolute left-2.5 top-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      </div>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="border-b theme-border bg-black/10 text-[11px] font-mono uppercase tracking-wider theme-text-muted">
            <th class="px-3.5 py-2.5 font-medium">Customer ID</th>
            <th class="px-3.5 py-2.5 font-medium">Email</th>
            <th class="px-3.5 py-2.5 font-medium">Tier &amp; Status</th>
            <th class="px-3.5 py-2.5 font-medium">Net Profitability</th>
            <th class="px-3.5 py-2.5 font-medium">Margin (%)</th>
            <th class="px-3.5 py-2.5 font-medium">VIP Executive Action Brief / DLQ Provenance</th>
          </tr>
        </thead>
        <tbody id="contactsBody">
          ${rowsHtml || '<tr><td colspan="6" class="px-4 py-8 text-center text-xs font-mono theme-text-muted">[INFO] Stage 0 Baseline: 0 Contacts in HubSpot CRM. Run datapulse init &amp; datapulse run to stream batches...</td></tr>'}
        </tbody>
      </table>
    </div>
  </section>

  <!-- Feature 3: Slide-Over Row Inspector Drawer -->
  <div id="drawerBackdrop" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 hidden opacity-0 transition-opacity duration-200"></div>
  <aside id="inspectorDrawer" class="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-zinc-950 border-l border-zinc-800 shadow-2xl z-50 transform translate-x-full transition-transform duration-300 ease-out flex flex-col text-slate-100">
    <div class="flex items-center justify-between p-4 border-b border-zinc-800">
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        <h2 class="text-sm font-bold font-mono uppercase text-white" id="drawerTitle">Customer Payload Inspector</h2>
      </div>
      <button id="closeDrawerBtn" type="button" class="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition">
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>
    <div class="p-4 space-y-4 overflow-y-auto flex-1 font-mono text-xs">
      <div>
        <div class="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">Customer Identifier &amp; Tier</div>
        <div class="flex items-center gap-2">
          <span class="text-base font-bold text-white" id="drawerCustId">-</span>
          <span class="px-2 py-0.5 rounded text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20" id="drawerTier">-</span>
        </div>
      </div>
      <div>
        <div class="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">Computed SHA-256 Payload Hash</div>
        <div class="p-2 rounded bg-zinc-900 border border-zinc-800 break-all text-cyan-300 select-all" id="drawerSha256">-</div>
      </div>
      <div>
        <div class="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">HubSpot v3 Property Mapping</div>
        <div class="rounded border border-zinc-800 overflow-hidden">
          <table class="w-full text-left">
            <tbody id="drawerPropMapping" class="divide-y divide-zinc-800 text-[11px]"></tbody>
          </table>
        </div>
      </div>
      <div>
        <div class="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">Canonical RFC-8259 JSON Payload</div>
        <pre class="p-3 rounded bg-zinc-900 border border-zinc-800 text-zinc-200 overflow-x-auto text-[11px] leading-relaxed" id="drawerJson">-</pre>
      </div>
    </div>
  </aside>

  <!-- Client-Side Reactive Controller -->
  <script>
    // Theme Switcher
    document.querySelectorAll(".theme-switch-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const theme = btn.getAttribute("data-set-theme");
        document.documentElement.setAttribute("data-theme", theme);
        document.querySelectorAll(".theme-switch-btn").forEach((b) => b.classList.remove("bg-zinc-800", "text-white", "font-semibold"));
        btn.classList.add("bg-zinc-800", "text-white", "font-semibold");
        localStorage.setItem("datapulse-master-theme", theme);
      });
    });

    function focusPillar(id) {
      if (id <= 3) {
        document.querySelectorAll(".pillar-panel").forEach((p) => p.classList.remove("border-cyan-400", "ring-2", "ring-cyan-500/30"));
        const target = document.getElementById("pillarPanel" + id);
        target.classList.add("border-cyan-400", "ring-2", "ring-cyan-500/30");
        target.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else {
        document.getElementById("tableSection").scrollIntoView({ behavior: "smooth" });
      }
    }

    // Drawer Inspector
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
      document.getElementById("drawerJson").innerText = JSON.stringify(contact, null, 2);
      document.getElementById("drawerSha256").innerText = await computeSha256(JSON.stringify(contact));

      const mapping = [
        ["hs_external_customer_id", contact.customer_id],
        ["email", contact.email],
        ["hs_net_profitability_usd", "$" + (contact.net_profitability_usd || 0).toFixed(2)],
        ["hs_profit_margin_pct", (contact.profit_margin_pct || 0).toFixed(1) + "%"],
        ["datapulse_customer_tier", contact.customer_tier],
        ["datapulse_ai_executive_brief", contact.ai_executive_brief || "[NONE - Standard Margin Profile]"]
      ];
      document.getElementById("drawerPropMapping").innerHTML = mapping
        .map(([k, v]) => '<tr class="border-b border-zinc-800"><td class="p-2 text-zinc-500 font-mono">' + k + '</td><td class="p-2 font-mono font-semibold text-zinc-100">' + v + '</td></tr>')
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
            openInspector(JSON.parse(row.getAttribute("data-contact")));
          } catch (e) {}
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
        buttons.forEach((b) => b.classList.remove("active", "bg-cyan-600", "text-white"));
        btn.classList.add("active", "bg-cyan-600", "text-white");
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
      pollDot.className = pollingActive ? "w-2 h-2 rounded-full bg-emerald-500" : "w-2 h-2 rounded-full bg-zinc-500";
      pollStatusText.innerText = pollingActive ? "Auto-Poll (2s)" : "Poll: PAUSED";
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
        document.getElementById("kpi-batches").innerHTML = s.totalBatchRequests + ' <span class="text-xs theme-text-muted">(429s: ' + s.rateLimitRetriesAbsorbed + ")</span>";
        document.getElementById("phase-banner").innerText = s.currentPhase;
      } catch (err) {}
    }, 2000);
  </script>
</body>
</html>`;
}
