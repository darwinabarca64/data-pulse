/**
 * Infrastructure Layer: Style 3 - Hightouch & Dagster Animated Pipeline Topology Canvas.
 * Features Visual Data-Flow SVG Connector Pipes, Interactive Pipeline Graph, and Real-Time Telemetry.
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
        ? `<span class="px-2 py-0.5 rounded text-xs font-mono font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 mr-1">${escapeHtml(c.customer_tier)}</span><span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">REMEDIATED_DLQ</span>`
        : `<span class="px-2 py-0.5 rounded text-xs font-mono font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">${escapeHtml(c.customer_tier)}</span>`;

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

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DataPulse Reverse ETL | Dagster &amp; Hightouch Pipeline Graph</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: "class",
      theme: {
        extend: {
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
    body { font-family: 'Inter', sans-serif; background-color: #050814; }
    .mono { font-family: 'JetBrains Mono', monospace; }
    @keyframes flowLine {
      to { stroke-dashoffset: -24; }
    }
    .flow-pipe {
      stroke-dasharray: 6 6;
      animation: flowLine 1.2s linear infinite;
    }
    .node-card {
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .node-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 25px -5px rgba(56, 189, 248, 0.2);
    }
  </style>
</head>
<body class="text-slate-100 min-h-screen p-4 md:p-6 antialiased">
  <!-- Header -->
  <header class="flex flex-col md:flex-row md:items-center justify-between pb-4 mb-4 border-b border-slate-800 gap-4">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-sm">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
      </div>
      <div>
        <h1 class="text-base font-bold tracking-tight text-white flex items-center gap-2">
          DataPulse Reverse ETL
          <span class="text-xs px-2 py-0.5 rounded font-mono font-medium bg-cyan-950/60 text-cyan-400 border border-cyan-800/60">Style 3: Hightouch / Dagster Topology Graph</span>
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

  <!-- Interactive Visual Data-Flow Topology Canvas -->
  <section class="rounded-xl border border-slate-800 bg-[#090e1f] p-4 shadow-xl mb-5 relative overflow-hidden">
    <div class="flex items-center justify-between mb-3 pb-2 border-b border-slate-800/80">
      <div class="flex items-center gap-2">
        <svg class="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h20"/><path d="m15 5 7 7-7 7"/></svg>
        <span class="text-xs font-mono font-semibold uppercase tracking-wider text-cyan-400">Live Reverse ETL Data-Flow Topology Canvas</span>
      </div>
      <span class="text-[11px] font-mono text-slate-400">Click any node to focus pillar telemetry</span>
    </div>

    <!-- Node Grid with Connecting Animated SVG Pipes -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">
      <!-- Node 1 -->
      <div class="node-card cursor-pointer rounded-lg border border-slate-800 bg-[#0e172e] p-3.5 hover:border-cyan-500/60" id="topNode1" onclick="focusPillar(1)">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">SOURCE NODE</span>
          <svg class="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>
        </div>
        <div class="text-sm font-bold font-mono text-white mb-0.5">Snowflake / DuckDB</div>
        <div class="text-xs text-slate-400 font-mono mb-2">WH_DATA_PULSE_XS (XSMALL)</div>
        <div class="text-[11px] font-mono text-emerald-400 font-semibold flex items-center justify-between pt-2 border-t border-slate-800/80">
          <span>10,000 Extracted</span>
          <span class="text-[10px] text-slate-400">9,800 Clean</span>
        </div>
      </div>

      <!-- Node 2 -->
      <div class="node-card cursor-pointer rounded-lg border border-slate-800 bg-[#0e172e] p-3.5 hover:border-cyan-500/60" id="topNode2" onclick="focusPillar(2)">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">ORCHESTRATOR</span>
          <svg class="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="m17 5-5-3-5 3"/><path d="m17 19-5 3-5-3"/></svg>
        </div>
        <div class="text-sm font-bold font-mono text-white mb-0.5">Airflow Thin DAG</div>
        <div class="text-xs text-slate-400 font-mono mb-2">&lt;0.05s SLA | 3 Tasks</div>
        <div class="text-[11px] font-mono text-emerald-400 font-semibold flex items-center justify-between pt-2 border-t border-slate-800/80">
          <span>${escapeHtml(state.dagStatus)}</span>
          <span class="text-[10px] text-slate-400">State Verified</span>
        </div>
      </div>

      <!-- Node 3 -->
      <div class="node-card cursor-pointer rounded-lg border border-slate-800 bg-[#0e172e] p-3.5 hover:border-cyan-500/60" id="topNode3" onclick="focusPillar(3)">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">SELF-HEALING</span>
          <svg class="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
        </div>
        <div class="text-sm font-bold font-mono text-white mb-0.5">Python Engine + AI DLQ</div>
        <div class="text-xs text-slate-400 font-mono mb-2">N = S + O + E Invariant</div>
        <div class="text-[11px] font-mono text-emerald-400 font-semibold flex items-center justify-between pt-2 border-t border-slate-800/80">
          <span>200/200 Healed</span>
          <span class="text-[10px] text-slate-400">0 Quarantined</span>
        </div>
      </div>

      <!-- Node 4 -->
      <div class="node-card cursor-pointer rounded-lg border border-slate-800 bg-[#0e172e] p-3.5 hover:border-cyan-500/60" id="topNode4" onclick="focusPillar(4)">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold">DESTINATION</span>
          <svg class="w-4 h-4 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div class="text-sm font-bold font-mono text-white mb-0.5">HubSpot CRM v3 Store</div>
        <div class="text-xs text-slate-400 font-mono mb-2">100/sec Burst Rate Absorb</div>
        <div class="text-[11px] font-mono text-emerald-400 font-semibold flex items-center justify-between pt-2 border-t border-slate-800/80">
          <span>${state.totalSyncedContacts.toLocaleString("en-US")} Synced</span>
          <span class="text-[10px] text-slate-400">${state.vipBriefCount} VIPs</span>
        </div>
      </div>
    </div>

    <!-- Animated Data Flow SVG Connecting Line -->
    <div class="hidden md:block absolute left-4 right-4 top-[50%] pointer-events-none -translate-y-1/2 z-0">
      <svg class="w-full h-8" preserveAspectRatio="none" viewBox="0 0 1000 32">
        <line x1="125" y1="16" x2="875" y2="16" stroke="#1e293b" stroke-width="4"/>
        <line x1="125" y1="16" x2="875" y2="16" stroke="#38bdf8" stroke-width="2" class="flow-pipe"/>
      </svg>
    </div>
  </section>

  <!-- 3 Pillars Section -->
  <section class="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-5" id="pillarsSection">
    <!-- Pillar 1 -->
    <div class="pillar-panel rounded-xl border border-slate-800 bg-[#090e1f] p-4 shadow-md transition-all" id="pillarPanel1">
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
    <div class="pillar-panel rounded-xl border border-slate-800 bg-[#090e1f] p-4 shadow-md transition-all" id="pillarPanel2">
      <div class="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-800 font-mono text-xs font-semibold tracking-wide uppercase text-cyan-400">
        <span>Pillar 2: Apache Airflow Thin DAG</span>
        <svg class="w-4 h-4 text-cyan-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="m17 5-5-3-5 3"/><path d="m17 19-5 3-5-3"/></svg>
      </div>
      <div class="space-y-1.5 text-xs font-mono mb-2">
        <div class="flex justify-between text-slate-400"><span>DAG ID:</span><span class="text-slate-200">datapulse_hubspot_profitability_sync</span></div>
        <div class="flex justify-between text-slate-400"><span>DAG SLA &amp; State:</span><span class="font-semibold text-emerald-400">&lt;0.05s SLA | ${escapeHtml(state.dagStatus)}</span></div>
      </div>
      <div class="space-y-1 text-xs font-mono">
        <div class="flex items-center justify-between px-2.5 py-1 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"><span>1. validate_sync_manifest</span><span>[OK]</span></div>
        <div class="flex items-center justify-between px-2.5 py-1 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"><span>2. execute_incremental_reverse_etl</span><span>[SYNC]</span></div>
        <div class="flex items-center justify-between px-2.5 py-1 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"><span>3. audit_dlq_and_finops_telemetry</span><span>[AUDIT]</span></div>
      </div>
    </div>

    <!-- Pillar 3 -->
    <div class="pillar-panel rounded-xl border border-slate-800 bg-[#090e1f] p-4 shadow-md transition-all" id="pillarPanel3">
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

  <!-- 6 KPI Cards -->
  <section class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
    <div class="rounded-xl border border-slate-800 bg-[#090e1f] p-3 shadow-md">
      <div class="text-[11px] font-mono uppercase text-slate-400 mb-1">[S] Synced Contacts</div>
      <div class="text-xl font-bold font-mono text-emerald-400" id="kpi-synced">${state.totalSyncedContacts.toLocaleString("en-US")}</div>
    </div>
    <div class="rounded-xl border border-slate-800 bg-[#090e1f] p-3 shadow-md">
      <div class="text-[11px] font-mono uppercase text-slate-400 mb-1">[VIP] Executive Briefs</div>
      <div class="text-xl font-bold font-mono text-white" id="kpi-vip">${state.vipBriefCount}</div>
    </div>
    <div class="rounded-xl border border-slate-800 bg-[#090e1f] p-3 shadow-md">
      <div class="text-[11px] font-mono uppercase text-slate-400 mb-1">[E] Pending DLQ</div>
      <div class="text-xl font-bold font-mono ${state.dlqPendingE > 0 ? "text-amber-400" : "text-emerald-400"}" id="kpi-dlq">${state.dlqPendingE} (${state.dlqResolved} Healed)</div>
    </div>
    <div class="rounded-xl border border-slate-800 bg-[#090e1f] p-3 shadow-md">
      <div class="text-[11px] font-mono uppercase text-slate-400 mb-1">[O] SHA-256 Skipped</div>
      <div class="text-xl font-bold font-mono text-cyan-400" id="kpi-skipped">${state.skippedO.toLocaleString("en-US")}</div>
    </div>
    <div class="rounded-xl border border-slate-800 bg-[#090e1f] p-3 shadow-md">
      <div class="text-[11px] font-mono uppercase text-slate-400 mb-1">[HTTP] Batch Requests</div>
      <div class="text-xl font-bold font-mono text-white" id="kpi-batches">${state.totalBatchRequests} <span class="text-xs text-slate-500">(429s: ${state.rateLimitRetriesAbsorbed})</span></div>
    </div>
    <div class="rounded-xl border border-slate-800 bg-[#090e1f] p-3 shadow-md">
      <div class="text-[11px] font-mono uppercase text-slate-400 mb-1">[FINOPS] Annual Savings</div>
      <div class="text-xl font-bold font-mono text-emerald-400">$${state.annualSaasSavingsUsd.toLocaleString("en-US")}/yr</div>
    </div>
  </section>

  <!-- Pillar 4 Table Toolbar & Table -->
  <section class="rounded-xl border border-slate-800 bg-[#090e1f] overflow-hidden shadow-xl" id="tableSection">
    <div class="flex flex-col md:flex-row md:items-center justify-between p-3.5 border-b border-slate-800 gap-3">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-xs font-mono font-semibold uppercase text-slate-400">Pillar 4 (HubSpot CRM v3 Store):</span>
        <button type="button" class="btn-filter ${!fUpper ? "active bg-cyan-600 text-white" : "bg-slate-900 text-slate-400"} px-3 py-1 rounded text-xs font-mono font-semibold border border-slate-700" data-filter="">ALL (${state.totalSyncedContacts.toLocaleString("en-US")})</button>
        <button type="button" class="btn-filter ${fUpper === "ENTERPRISE_VIP" ? "active bg-cyan-600 text-white" : "bg-slate-900 text-slate-400"} px-3 py-1 rounded text-xs font-mono font-semibold border border-slate-700" id="btnFilterVip" data-filter="ENTERPRISE_VIP">ENTERPRISE_VIP (${state.vipBriefCount})</button>
        <button type="button" class="btn-filter ${fUpper === "REMEDIATED_DLQ" ? "active bg-cyan-600 text-white" : "bg-slate-900 text-slate-400"} px-3 py-1 rounded text-xs font-mono font-semibold border border-slate-700" id="btnFilterDlq" data-filter="REMEDIATED_DLQ">REMEDIATED_DLQ (${state.dlqResolved})</button>
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

  <!-- Interactive Topology Focus Logic -->
  <script>
    function focusPillar(id) {
      document.querySelectorAll(".node-card").forEach((n) => n.classList.remove("border-cyan-400", "ring-2", "ring-cyan-500/50"));
      document.getElementById("topNode" + id).classList.add("border-cyan-400", "ring-2", "ring-cyan-500/50");

      if (id <= 3) {
        document.querySelectorAll(".pillar-panel").forEach((p) => p.classList.remove("border-cyan-400", "ring-2", "ring-cyan-500/30"));
        const target = document.getElementById("pillarPanel" + id);
        target.classList.add("border-cyan-400", "ring-2", "ring-cyan-500/30");
        target.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else {
        document.getElementById("tableSection").scrollIntoView({ behavior: "smooth" });
      }
    }

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
        document.getElementById("kpi-dlq").innerText = s.dlqPendingE + " (" + s.dlqResolved + " Healed)";
        document.getElementById("kpi-skipped").innerText = s.skippedO.toLocaleString("en-US");
        document.getElementById("kpi-batches").innerHTML = s.totalBatchRequests + ' <span class="text-xs text-slate-500">(429s: ' + s.rateLimitRetriesAbsorbed + ")</span>";
        document.getElementById("phase-banner").innerText = s.currentPhase;
      } catch (err) {}
    }, 2000);
  </script>
</body>
</html>`;
}
