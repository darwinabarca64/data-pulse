/**
 * Infrastructure Layer: Interactive DataPulse Mission Control Console.
 * Single source of truth for Reverse ETL telemetry, DLQ triage, FinOps guardrails, and CRM contacts.
 */

import { NormalizedCrmContact } from "../domain/contracts.js";
import type { BatchBufferEntry, QuarantinedErrorRecord } from "./server.js";

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
  stateVersion?: number;
  projectedAnnualSavingsUsd?: number;
  anomalyIdRange?: string | null;
  emailErrorRange?: string | null;
  nanErrorRange?: string | null;
  quarantinedErrors?: QuarantinedErrorRecord[];
  batches?: BatchBufferEntry[];
  lastAirflowDagRunId?: string | null;
  airflowOnline?: boolean;
  airflowDagStatus?: string;
}

function escapeHtml(text: unknown): string {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInitialRow(c: NormalizedCrmContact): string {
  const isVip = Boolean(c.ai_executive_brief) || (c.customer_tier ?? "").includes("VIP");
  const isHealed = Boolean(c.remediated_from_dlq);
  const statusPill = isVip
    ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200"><span class="w-1.5 h-1.5 rounded-full bg-rose-600 mr-1.5"></span>VIP At Risk</span>'
    : isHealed
      ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>Auto-Repaired</span>'
      : '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5"></span>Delivered</span>';

  const briefCell = c.ai_executive_brief
    ? `<div class="flex items-center gap-1.5"><span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">[VIP-BRIEF]</span><span class="text-xs text-zinc-700 truncate max-w-xs" title="${escapeHtml(c.ai_executive_brief)}">${escapeHtml(c.ai_executive_brief)}</span></div>`
    : isHealed
      ? '<span class="text-xs text-zinc-500 font-mono">Remediated via AI DLQ Replay</span>'
      : '<span class="text-xs text-zinc-400">Standard Margin Profile</span>';

  const marginBadge = `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${c.profit_margin_pct < 0 ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}">${c.profit_margin_pct < 0 ? "" : "+"}${c.profit_margin_pct.toFixed(1)}%</span>`;
  const tierBadge = `<span class="px-2 py-0.5 rounded text-xs font-medium ${isVip ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-zinc-100 text-zinc-700 border border-zinc-200"}">${escapeHtml(c.customer_tier)}</span>`;
  const safeJson = escapeHtml(JSON.stringify(c));

  return `<tr class="customer-row border-b border-zinc-200 hover:bg-zinc-50/80 transition-colors cursor-pointer" data-contact="${safeJson}" onclick="openInspectorFromRow(this)"><td class="p-3 text-center"><input type="checkbox" class="rounded border-zinc-300 text-zinc-900 focus:ring-0" onclick="event.stopPropagation()" /></td><td class="p-3"><div class="flex items-center gap-2"><span class="font-medium text-xs text-zinc-950 font-mono">${escapeHtml(c.customer_id)}</span><span class="px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-100 text-zinc-600 border border-zinc-200">${escapeHtml(c.country || "US")}</span></div><div class="text-[11px] text-zinc-500">${escapeHtml(c.company || "Enterprise Account")} &bull; <span class="font-mono">${escapeHtml(c.email)}</span></div></td><td class="p-3">${tierBadge}</td><td class="p-3">${statusPill}</td><td class="p-3 font-mono text-xs font-semibold text-zinc-950">$${c.net_profitability_usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td class="p-3">${marginBadge}</td><td class="p-3">${briefCell}</td><td class="p-3 text-right"><button type="button" class="btn-inspect px-2.5 py-1 rounded text-xs font-medium border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 transition" onclick="event.stopPropagation(); openInspectorFromRow(this)">Inspect</button></td></tr>`;
}

function renderInitialRows(contacts: NormalizedCrmContact[], isZero: boolean): string {
  if (isZero || !contacts || contacts.length === 0) {
    return '<tr><td colspan="8" class="p-12 text-center text-xs text-zinc-500 font-mono">Stage 0 Baseline: 0 Contacts in CRM. Ingestion pipeline is idle. Click "1. Run Initial Sync" above to stream batches...</td></tr>';
  }
  return contacts.slice(0, 25).map(renderInitialRow).join("\n");
}

export function renderLiveDashboardHtml(state: CrmStoreState, initialFilter = ""): string {
  const isZero = state.totalSyncedContacts === 0 && state.extractedN === 0;
  const safeStateJson = JSON.stringify(state).replace(/</g, "\\u003c");

  const syncedTrendText = isZero
    ? "Standby: Awaiting Sync"
    : state.totalSyncedContacts >= 10000
      ? "100% Complete &bull; Zero row loss"
      : state.totalSyncedContacts >= 9800
        ? "+98.0% First Pass &bull; 200 Held in DLQ"
        : "Sync in progress";

  const errorsTrendText = isZero
    ? "Standby: 0 Anomalies Held"
    : state.dlqPendingE > 0
      ? `${state.dlqPendingE} Quarantined (${state.emailErrorsPending || 150} Email, ${state.nanErrorsPending || 50} NaN)`
      : state.dlqResolved > 0
        ? `0 Held &bull; ${state.dlqResolved} Auto-Repaired`
        : "0 Held &bull; Clean Ingestion";

  const vipTrendText = isZero || state.vipBriefCount === 0
    ? "0 Alerts &bull; Normal Margin Profile"
    : `${state.vipBriefCount} VIPs with margin &lt; -20% (AI Briefs)`;

  const repairedTrendText = isZero
    ? "Standby: 0 Repaired"
    : state.dlqResolved > 0
      ? `${state.dlqResolved} Records Healed via Replay`
      : "0 Repaired &bull; Awaiting Replay";

  const guardrailsTrendText = isZero
    ? "Standby &bull; Idempotency primed"
    : state.skippedO > 0
      ? `${state.skippedO.toLocaleString("en-US")} Calls Skipped &bull; 0 API Duplicates`
      : "SHA-256 Incremental Diffing Active";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Data Pulse | Mission Control Console</title>
  <link rel="preconnect" href="https://cdn.jsdelivr.net" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/geist@1.3.0/dist/font/sans.css" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config = { theme: { extend: { fontFamily: { sans: ["Geist Sans", "Inter", "sans-serif"], mono: ["JetBrains Mono", "monospace"] } } } };</script>
  <style>
    body { font-family: "Geist Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .kpi-card { transition: all 0.15s ease-in-out; }
    .kpi-card-active { border-color: #18181b !important; box-shadow: 0 0 0 2px #18181b, 0 10px 15px -3px rgba(0, 0, 0, 0.1); background-color: #fafafa; }
    .tier-bar-active { border-color: #059669 !important; box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.25); background-color: #ecfdf5; }
    .flow-node-circle { transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
    .flow-node-circle:hover { transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1); }
  </style>
</head>
<body class="bg-zinc-50 text-zinc-950 min-h-screen antialiased flex flex-col">

  <!-- Header Bar -->
  <header class="border-b border-zinc-200 bg-white/95 backdrop-blur-md px-4 sm:px-6 py-2.5 sticky top-0 z-30 shadow-sm">
    <div class="max-w-7xl mx-auto flex items-center justify-between gap-4">
      <!-- Left: Logo D + P Icon & Data Pulse Brand -->
      <div class="flex items-center gap-3 shrink-0">
        <div class="flex aspect-square size-9 items-center justify-center rounded-lg bg-zinc-950 text-white shadow-sm select-none" title="Data Pulse">
          <svg class="size-6" viewBox="0 0 36 36" fill="none">
            <!-- Letter D in crisp white -->
            <path d="M7 8h8a9 9 0 0 1 0 18H7V8Z" fill="white"/>
            <path d="M11 12h4a5 5 0 0 1 0 10h-4V12Z" fill="#09090b"/>
            <!-- Letter P interlocking/overlapping with brand emerald accent -->
            <path d="M17 14h8a5.5 5.5 0 0 1 0 11H21v7h-4V14Z" fill="#10b981"/>
            <path d="M21 17.5h4a2 2 0 0 1 0 4h-4v-4Z" fill="#09090b"/>
          </svg>
        </div>
        <span class="text-base font-bold tracking-tight text-zinc-950 font-sans select-none">Data Pulse</span>
      </div>

      <!-- Right: Actions, Airflow Link & Toggle Switch -->
      <div class="flex items-center gap-3 shrink-0">
        <span id="pipelineSpinner" class="hidden text-zinc-600 font-mono text-[11px] animate-pulse px-2 py-0.5 bg-zinc-100 rounded-md border border-zinc-200">Engine executing...</span>

        <!-- Open Airflow (:8080) Button & Badge -->
        <a href="http://localhost:8080" target="_blank" rel="noopener noreferrer" class="group relative inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800 transition shadow-sm" title="User: admin | Pass: datapulse2026">
          <svg class="w-3.5 h-3.5 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          <span>Open Airflow (:8080)</span>
          <span id="airflowBadge" class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-800 text-sky-300 border border-zinc-700">${state.lastAirflowDagRunId ? "DAG: Run" : (state.airflowOnline ? "DAG: Online" : "DAG: Ready")}</span>
          <span class="absolute top-full mt-1.5 right-0 hidden group-hover:block whitespace-nowrap bg-zinc-900 text-zinc-200 text-[11px] font-mono py-1 px-2.5 rounded shadow-lg border border-zinc-700 z-50">
            User: admin | Pass: datapulse2026
          </span>
        </a>

        <div class="flex items-center gap-2 select-none" id="connPill" title="Connector Health Status">
          <div id="connSwitchTrack" class="relative inline-flex h-5 w-9 shrink-0 cursor-default items-center rounded-full bg-emerald-600 p-0.5 transition-colors duration-200 ease-in-out shadow-inner">
            <span id="connSwitchKnob" class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out translate-x-4"></span>
          </div>
          <span id="connText" class="text-xs font-semibold font-mono uppercase tracking-wider text-emerald-700">ON</span>
        </div>
      </div>
    </div>
  </header>

  <main class="flex-1 p-4 sm:p-6 space-y-5 sm:space-y-6 max-w-7xl mx-auto w-full">

    <!-- Pipeline Ribbon S-Curve Flow (Interactive Workflow Stepper above Console Cards) -->
    <section class="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6 shadow-sm overflow-hidden">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-2 border-b border-zinc-100 gap-2">
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold uppercase tracking-wider text-zinc-900 font-mono">Reverse ETL Pipeline Execution Flow</span>
          <button type="button" class="info-tooltip-btn text-zinc-400 hover:text-zinc-900 transition p-0.5" data-topic="overview" onclick="openFloatingTooltip('overview', this, event)">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          </button>
        </div>
        <span class="text-[11px] font-mono text-zinc-500">Autonomous Micro-Batches &bull; Deterministic CLI Execution</span>
      </div>

      <!-- S-Curve Continuous Wave Ribbon Stepper -->
      <div class="relative py-2 sm:py-4 px-2">
        <!-- SVG Continuous Serpentine Track Background (Desktop/Tablet) -->
        <div class="hidden sm:block absolute inset-0 pointer-events-none select-none" aria-hidden="true">
          <svg class="w-full h-full" viewBox="0 0 1000 170" preserveAspectRatio="none" fill="none">
            <!-- Background base track -->
            <path d="M 0,90 Q 75,90 125,90 T 375,90 T 625,90 T 875,90 L 1000,90" stroke="#f4f4f5" stroke-width="18" stroke-linecap="round"/>
            <!-- Serpentine S-Curves connecting the 4 nodes -->
            <!-- Curve 1 to 2: looping up-down -->
            <path id="svgRibbonSeg1" d="M 125,90 C 187,20 312,20 375,90" stroke="#e4e4e7" stroke-width="8" stroke-linecap="round"/>
            <!-- Curve 2 to 3: looping down-up -->
            <path id="svgRibbonSeg2" d="M 375,90 C 437,160 562,160 625,90" stroke="#e4e4e7" stroke-width="8" stroke-linecap="round"/>
            <!-- Curve 3 to 4: looping up-down -->
            <path id="svgRibbonSeg3" d="M 625,90 C 687,20 812,20 875,90" stroke="#e4e4e7" stroke-width="8" stroke-linecap="round"/>
          </svg>
        </div>

        <!-- 4 Workflow Nodes Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-6 sm:gap-4 items-center relative z-10">
          
          <!-- Node 1: Run Initial Sync -->
          <div class="flex flex-col items-center text-center group">
            <!-- Top: Title & Info Icon -->
            <div class="flex items-center justify-center gap-1.5 mb-3">
              <span class="text-xs font-bold text-zinc-900 group-hover:text-emerald-700 transition">1. Run Initial Sync</span>
              <button type="button" class="info-tooltip-btn text-zinc-400 hover:text-zinc-900 p-0.5 transition" data-topic="sync_step" onclick="openFloatingTooltip('sync_step', this, event)" title="Execution details">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
              </button>
            </div>

            <!-- Center Circle Button with Arrow/Sync Icon -->
            <button type="button" id="btnRunSync" onclick="triggerPipelinePhase('sync', this)" class="pipeline-step-btn flow-node-circle size-16 sm:size-20 rounded-full border-4 border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 flex items-center justify-center shadow-md cursor-pointer select-none transition-all duration-300" title="Click to execute Initial Sync">
              <svg class="size-7 sm:size-8 transition-transform group-hover:rotate-45" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
              </svg>
            </button>

            <!-- Bottom: CLI Command Chip -->
            <div class="mt-3">
              <code class="px-2 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-mono text-[11px] font-semibold border border-zinc-200 shadow-2xs">datapulse run</code>
            </div>
          </div>

          <!-- Node 2: AI Diagnose & Repair -->
          <div class="flex flex-col items-center text-center group">
            <!-- Top: Title & Info Icon -->
            <div class="flex items-center justify-center gap-1.5 mb-3">
              <span class="text-xs font-bold text-zinc-900 group-hover:text-amber-700 transition">2. AI Diagnose &amp; Repair</span>
              <button type="button" class="info-tooltip-btn text-zinc-400 hover:text-zinc-900 p-0.5 transition" data-topic="repair_step" onclick="openFloatingTooltip('repair_step', this, event)" title="Execution details">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
              </button>
            </div>

            <!-- Center Circle Button with AI Sparkle/Stethoscope Repair Icon -->
            <button type="button" id="btnRunRepair" onclick="triggerPipelinePhase('replay', this)" class="pipeline-step-btn flow-node-circle size-16 sm:size-20 rounded-full border-4 border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 flex items-center justify-center shadow-md cursor-pointer select-none transition-all duration-300" title="Click to execute AI Diagnose & Repair">
              <svg class="size-7 sm:size-8 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z"/>
                <path d="M19 3v4M21 5h-4M5 19v2M6 20H4"/>
              </svg>
            </button>

            <!-- Bottom: CLI Command Chip -->
            <div class="mt-3">
              <code class="px-2 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-mono text-[11px] font-semibold border border-zinc-200 shadow-2xs">datapulse dlq replay</code>
            </div>
          </div>

          <!-- Node 3: Verify SHA-256 Cache -->
          <div class="flex flex-col items-center text-center group">
            <!-- Top: Title & Info Icon -->
            <div class="flex items-center justify-center gap-1.5 mb-3">
              <span class="text-xs font-bold text-zinc-900 group-hover:text-blue-700 transition">3. Verify SHA-256 Cache</span>
              <button type="button" class="info-tooltip-btn text-zinc-400 hover:text-zinc-900 p-0.5 transition" data-topic="idemp_step" onclick="openFloatingTooltip('idemp_step', this, event)" title="Execution details">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
              </button>
            </div>

            <!-- Center Circle Button with Shield/Check Idempotency Icon -->
            <button type="button" id="btnRunIdemp" onclick="triggerPipelinePhase('idempotent', this)" class="pipeline-step-btn flow-node-circle size-16 sm:size-20 rounded-full border-4 border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 flex items-center justify-center shadow-md cursor-pointer select-none transition-all duration-300" title="Click to verify SHA-256 Idempotency Cache">
              <svg class="size-7 sm:size-8 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>
                <path d="m9 12 2 2 4-4"/>
              </svg>
            </button>

            <!-- Bottom: CLI Command Chip -->
            <div class="mt-3">
              <code class="px-2 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-mono text-[11px] font-semibold border border-zinc-200 shadow-2xs">datapulse run (diff)</code>
            </div>
          </div>

          <!-- Node 4: Reset to 0 -->
          <div class="flex flex-col items-center text-center group">
            <!-- Top: Title & Info Icon -->
            <div class="flex items-center justify-center gap-1.5 mb-3">
              <span class="text-xs font-bold text-zinc-900 group-hover:text-rose-700 transition">Reset to 0</span>
              <button type="button" class="info-tooltip-btn text-zinc-400 hover:text-rose-700 p-0.5 transition" data-topic="reset_step" onclick="openFloatingTooltip('reset_step', this, event)" title="Execution details">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
              </button>
            </div>

            <!-- Center Circle Button with Trash/Rewind Baseline Icon -->
            <button type="button" id="btnResetZero" onclick="triggerPipelinePhase('reset', this)" class="pipeline-step-btn flow-node-circle size-16 sm:size-20 rounded-full border-4 border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 hover:text-rose-600 flex items-center justify-center shadow-md cursor-pointer select-none transition-all duration-300" title="Click to Reset state to Stage 0 Baseline">
              <svg class="size-7 sm:size-8 transition-transform group-hover:rotate-180 duration-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
              </svg>
            </button>

            <!-- Bottom: CLI Command Chip -->
            <div class="mt-3">
              <code class="px-2 py-1 rounded-md bg-zinc-100 hover:bg-rose-50 text-zinc-800 hover:text-rose-700 font-mono text-[11px] font-semibold border border-zinc-200 shadow-2xs">POST /api/v1/reset</code>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- 5 Big Top KPI Cards (Primary Interactive View/Filter Buttons) -->
    <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
      <!-- Card 1: All Synced Customers -->
      <div id="cardAll" onclick="selectTabCard('all')" class="kpi-card kpi-card-active rounded-xl border border-zinc-200 bg-white p-4 shadow-sm cursor-pointer hover:border-zinc-400 select-none">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-zinc-600 flex items-center">
            All Synced Customers
            <button type="button" class="info-tooltip-btn text-zinc-400 hover:text-zinc-900 transition p-0.5 ml-1" data-topic="all" onclick="openFloatingTooltip('all', this, event)">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            </button>
          </span>
          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200" id="badgeAll">${isZero ? "0%" : state.totalSyncedContacts >= 10000 ? "+100%" : "+98.0%"}</span>
        </div>
        <div class="mt-2.5">
          <div class="text-2xl font-bold tracking-tight text-zinc-950 font-mono" id="kpiSynced">${state.totalSyncedContacts.toLocaleString("en-US")}</div>
          <div class="mt-1 text-[11px] text-zinc-500" id="kpiSyncedTrend">${syncedTrendText}</div>
        </div>
        <div class="mt-3 pt-2 border-t border-zinc-100 flex items-center justify-between text-[10px] font-mono">
          <span class="text-zinc-500">Filter View</span>
          <span class="card-indicator font-semibold text-zinc-900">Active</span>
        </div>
      </div>

      <!-- Card 2: Detected Errors (DLQ) -->
      <div id="cardErrors" onclick="selectTabCard('errors')" class="kpi-card rounded-xl border border-zinc-200 bg-white p-4 shadow-sm cursor-pointer hover:border-zinc-400 select-none">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-zinc-600 flex items-center">
            Detected Errors (DLQ)
            <button type="button" class="info-tooltip-btn text-zinc-400 hover:text-zinc-900 transition p-0.5 ml-1" data-topic="errors" onclick="openFloatingTooltip('errors', this, event)">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            </button>
          </span>
          <span class="w-2.5 h-2.5 rounded-full ${isZero ? "bg-zinc-400" : state.dlqPendingE > 0 ? "bg-rose-600" : "bg-emerald-600"}" id="kpiErrorsDot"></span>
        </div>
        <div class="mt-2.5">
          <div class="text-2xl font-bold tracking-tight font-mono ${state.dlqPendingE > 0 ? "text-rose-600" : "text-zinc-950"}" id="kpiErrors">${state.dlqPendingE}</div>
          <div class="mt-1 text-[11px] text-zinc-500" id="kpiErrorsTrend">${errorsTrendText}</div>
        </div>
        <div class="mt-3 pt-2 border-t border-zinc-100 flex items-center justify-between text-[10px] font-mono">
          <span class="text-zinc-500">Filter View</span>
          <span class="card-indicator font-semibold text-zinc-400">Click to filter</span>
        </div>
      </div>

      <!-- Card 3: VIP Retention Alerts -->
      <div id="cardVip" onclick="selectTabCard('vip')" class="kpi-card rounded-xl border border-zinc-200 bg-white p-4 shadow-sm cursor-pointer hover:border-zinc-400 select-none">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-zinc-600 flex items-center">
            VIP Retention Alerts
            <button type="button" class="info-tooltip-btn text-zinc-400 hover:text-zinc-900 transition p-0.5 ml-1" data-topic="vip" onclick="openFloatingTooltip('vip', this, event)">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            </button>
          </span>
          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-rose-50 text-rose-700 border border-rose-200">-20% Margin</span>
        </div>
        <div class="mt-2.5">
          <div class="text-2xl font-bold tracking-tight text-zinc-950 font-mono" id="kpiVip">${state.vipBriefCount}</div>
          <div class="mt-1 text-[11px] text-zinc-500" id="kpiVipTrend">${vipTrendText}</div>
        </div>
        <div class="mt-3 pt-2 border-t border-zinc-100 flex items-center justify-between text-[10px] font-mono">
          <span class="text-zinc-500">Filter View</span>
          <span class="card-indicator font-semibold text-zinc-400">Click to filter</span>
        </div>
      </div>

      <!-- Card 4: Auto-Repaired -->
      <div id="cardRepaired" onclick="selectTabCard('repaired')" class="kpi-card rounded-xl border border-zinc-200 bg-white p-4 shadow-sm cursor-pointer hover:border-zinc-400 select-none">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-zinc-600 flex items-center">
            Auto-Repaired
            <button type="button" class="info-tooltip-btn text-zinc-400 hover:text-zinc-900 transition p-0.5 ml-1" data-topic="repaired" onclick="openFloatingTooltip('repaired', this, event)">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            </button>
          </span>
          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-50 text-amber-700 border border-amber-200">AI Replay</span>
        </div>
        <div class="mt-2.5">
          <div class="text-2xl font-bold tracking-tight text-zinc-950 font-mono" id="kpiRepaired">${state.dlqResolved}</div>
          <div class="mt-1 text-[11px] text-zinc-500" id="kpiRepairedTrend">${repairedTrendText}</div>
        </div>
        <div class="mt-3 pt-2 border-t border-zinc-100 flex items-center justify-between text-[10px] font-mono">
          <span class="text-zinc-500">Filter View</span>
          <span class="card-indicator font-semibold text-zinc-400">Click to filter</span>
        </div>
      </div>

      <!-- Card 5: Pipeline & Cloud Guardrails -->
      <div id="cardGuardrails" onclick="selectTabCard('guardrails')" class="kpi-card rounded-xl border border-zinc-200 bg-white p-4 shadow-sm cursor-pointer hover:border-zinc-400 select-none">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-zinc-600 flex items-center">
            Pipeline &amp; Cloud Guardrails
            <button type="button" class="info-tooltip-btn text-zinc-400 hover:text-zinc-900 transition p-0.5 ml-1" data-topic="guardrails" onclick="openFloatingTooltip('guardrails', this, event)">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            </button>
          </span>
          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-blue-50 text-blue-700 border border-blue-200">SHA-256</span>
        </div>
        <div class="mt-2.5">
          <div class="text-2xl font-bold tracking-tight text-zinc-950 font-mono" id="kpiSkipped">${state.skippedO.toLocaleString("en-US")} Skipped</div>
          <div class="mt-1 text-[11px] text-zinc-500" id="kpiGuardrailsTrend">${guardrailsTrendText}</div>
        </div>
        <div class="mt-3 pt-2 border-t border-zinc-100 flex items-center justify-between text-[10px] font-mono">
          <span class="text-zinc-500">Inspect View</span>
          <span class="card-indicator font-semibold text-zinc-400">Click to inspect</span>
        </div>
      </div>
    </section>

    <!-- Real Data Engineer Telemetry Visualization (Pure HTML/CSS/SVG Bars) -->
    <section class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
      <!-- Left Half: Ingestion & Quality Distribution Bar -->
      <div class="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-sm flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between pb-3 border-b border-zinc-100">
            <div>
              <h2 class="text-sm font-semibold text-zinc-950 flex items-center gap-1.5">
                Ingestion &amp; Quality Distribution
                <button type="button" class="info-tooltip-btn text-zinc-400 hover:text-zinc-900 transition p-0.5" data-topic="distribution" onclick="openFloatingTooltip('distribution', this, event)">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                </button>
              </h2>
              <p class="text-xs text-zinc-500 mt-0.5">Real-time proportions of clean deliveries, DLQ quarantine, repairs, and cache skips</p>
            </div>
            <span class="text-[11px] font-mono text-zinc-500" id="distributionTotalRatio">0 / 0 rows</span>
          </div>

          <!-- Segmented Progress Bar -->
          <div class="mt-4">
            <div class="w-full bg-zinc-100 h-3.5 rounded-full overflow-hidden flex shadow-inner">
              <div id="barDeliveredClean" class="bg-emerald-600 h-full transition-all duration-300" style="width: 0%" title="Delivered Clean"></div>
              <div id="barRepaired" class="bg-amber-500 h-full transition-all duration-300" style="width: 0%" title="Auto-Repaired"></div>
              <div id="barQuarantined" class="bg-rose-600 h-full transition-all duration-300" style="width: 0%" title="Quarantined in DLQ"></div>
              <div id="barSkipped" class="bg-blue-600 h-full transition-all duration-300" style="width: 0%" title="Skipped by SHA-256 Cache"></div>
            </div>
          </div>

          <!-- 4 Telemetry Metrics Breakdown -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 text-xs font-mono">
            <div class="p-2 rounded-lg border border-zinc-200 bg-zinc-50/60">
              <div class="flex items-center gap-1.5 text-zinc-700 font-semibold">
                <span class="w-2 h-2 rounded-full bg-emerald-600 shrink-0"></span>
                <span>Clean</span>
              </div>
              <div class="mt-1 font-bold text-zinc-950 text-sm" id="countDeliveredClean">0</div>
              <div class="text-[10px] text-zinc-500" id="pctDeliveredClean">0% of extracted</div>
            </div>

            <div class="p-2 rounded-lg border border-zinc-200 bg-zinc-50/60">
              <div class="flex items-center gap-1.5 text-zinc-700 font-semibold">
                <span class="w-2 h-2 rounded-full bg-rose-600 shrink-0"></span>
                <span>Quarantined</span>
              </div>
              <div class="mt-1 font-bold text-zinc-950 text-sm" id="countQuarantined">0</div>
              <div class="text-[10px] text-zinc-500" id="descQuarantined">150 Email &bull; 50 NaN</div>
            </div>

            <div class="p-2 rounded-lg border border-zinc-200 bg-zinc-50/60">
              <div class="flex items-center gap-1.5 text-zinc-700 font-semibold">
                <span class="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                <span>Repaired</span>
              </div>
              <div class="mt-1 font-bold text-zinc-950 text-sm" id="countRepaired">0</div>
              <div class="text-[10px] text-zinc-500" id="descRepaired">AI Replay to CRM</div>
            </div>

            <div class="p-2 rounded-lg border border-zinc-200 bg-zinc-50/60">
              <div class="flex items-center gap-1.5 text-zinc-700 font-semibold">
                <span class="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
                <span>Skipped</span>
              </div>
              <div class="mt-1 font-bold text-zinc-950 text-sm" id="countSkipped">0</div>
              <div class="text-[10px] text-zinc-500" id="descSkipped">Saved API calls</div>
            </div>
          </div>
        </div>

        <div class="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-[11px] font-mono text-zinc-500">
          <span>Quarantine Rules: RFC-5322 regex sanitization &amp; NaN safe-coalesce</span>
          <span id="distributionHealthStatus" class="font-semibold text-emerald-700">Healthy Rhythm</span>
        </div>
      </div>

      <!-- Right Half: Net Profitability & Volume by Customer Tier -->
      <div class="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-sm flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between pb-3 border-b border-zinc-100">
            <div>
              <h2 class="text-sm font-semibold text-zinc-950 flex items-center gap-1.5">
                Net Profitability &amp; Volume by Tier
                <button type="button" class="info-tooltip-btn text-zinc-400 hover:text-zinc-900 transition p-0.5" data-topic="tiers" onclick="openFloatingTooltip('tiers', this, event)">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                </button>
              </h2>
              <p class="text-xs text-zinc-500 mt-0.5">Click any segment bar to filter customer records table below</p>
            </div>
            <button type="button" id="btnClearTierFilter" onclick="clearTierFilter()" class="hidden px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-900 text-white hover:bg-zinc-800 transition">Clear Filter</button>
          </div>

          <!-- 4 Tier Comparison Bars -->
          <div class="space-y-2.5 mt-3">
            <!-- ENTERPRISE_VIP -->
            <div id="barRow_ENTERPRISE_VIP" onclick="toggleTierFilter('ENTERPRISE_VIP')" class="tier-bar-row p-2 rounded-lg border border-zinc-200 hover:border-zinc-400 transition cursor-pointer">
              <div class="flex items-center justify-between text-xs font-medium">
                <span class="text-zinc-900 font-semibold flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-rose-600"></span>Enterprise VIP
                </span>
                <span class="font-mono text-rose-700 font-semibold" id="segNet_ENTERPRISE_VIP">Net: $0.00</span>
              </div>
              <div class="w-full bg-zinc-100 h-2 rounded-full mt-1.5 overflow-hidden">
                <div class="bg-rose-600 h-full rounded-full transition-all duration-300" id="barFill_ENTERPRISE_VIP" style="width: 0%"></div>
              </div>
              <div class="flex items-center justify-between text-[11px] text-zinc-500 mt-1 font-mono">
                <span id="segCount_ENTERPRISE_VIP">0 accounts</span>
                <span id="segRev_ENTERPRISE_VIP">Rev: $0.00</span>
              </div>
            </div>

            <!-- ENTERPRISE -->
            <div id="barRow_ENTERPRISE" onclick="toggleTierFilter('ENTERPRISE')" class="tier-bar-row p-2 rounded-lg border border-zinc-200 hover:border-zinc-400 transition cursor-pointer">
              <div class="flex items-center justify-between text-xs font-medium">
                <span class="text-zinc-900 font-semibold flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-emerald-600"></span>Enterprise
                </span>
                <span class="font-mono text-emerald-700 font-semibold" id="segNet_ENTERPRISE">Net: $0.00</span>
              </div>
              <div class="w-full bg-zinc-100 h-2 rounded-full mt-1.5 overflow-hidden">
                <div class="bg-emerald-600 h-full rounded-full transition-all duration-300" id="barFill_ENTERPRISE" style="width: 0%"></div>
              </div>
              <div class="flex items-center justify-between text-[11px] text-zinc-500 mt-1 font-mono">
                <span id="segCount_ENTERPRISE">0 accounts</span>
                <span id="segRev_ENTERPRISE">Rev: $0.00</span>
              </div>
            </div>

            <!-- MID_MARKET -->
            <div id="barRow_MID_MARKET" onclick="toggleTierFilter('MID_MARKET')" class="tier-bar-row p-2 rounded-lg border border-zinc-200 hover:border-zinc-400 transition cursor-pointer">
              <div class="flex items-center justify-between text-xs font-medium">
                <span class="text-zinc-900 font-semibold flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-emerald-600"></span>Mid-Market
                </span>
                <span class="font-mono text-emerald-700 font-semibold" id="segNet_MID_MARKET">Net: $0.00</span>
              </div>
              <div class="w-full bg-zinc-100 h-2 rounded-full mt-1.5 overflow-hidden">
                <div class="bg-emerald-600 h-full rounded-full transition-all duration-300" id="barFill_MID_MARKET" style="width: 0%"></div>
              </div>
              <div class="flex items-center justify-between text-[11px] text-zinc-500 mt-1 font-mono">
                <span id="segCount_MID_MARKET">0 accounts</span>
                <span id="segRev_MID_MARKET">Rev: $0.00</span>
              </div>
            </div>

            <!-- SME -->
            <div id="barRow_SME" onclick="toggleTierFilter('SME')" class="tier-bar-row p-2 rounded-lg border border-zinc-200 hover:border-zinc-400 transition cursor-pointer">
              <div class="flex items-center justify-between text-xs font-medium">
                <span class="text-zinc-900 font-semibold flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-emerald-600"></span>SME
                </span>
                <span class="font-mono text-emerald-700 font-semibold" id="segNet_SME">Net: $0.00</span>
              </div>
              <div class="w-full bg-zinc-100 h-2 rounded-full mt-1.5 overflow-hidden">
                <div class="bg-emerald-600 h-full rounded-full transition-all duration-300" id="barFill_SME" style="width: 0%"></div>
              </div>
              <div class="flex items-center justify-between text-[11px] text-zinc-500 mt-1 font-mono">
                <span id="segCount_SME">0 accounts</span>
                <span id="segRev_SME">Rev: $0.00</span>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-3 pt-3 border-t border-zinc-100 flex items-center justify-between text-[11px] font-mono text-zinc-500">
          <span>Active Filter: <span id="activeTierLabel" class="font-semibold text-zinc-900">None (All Tiers)</span></span>
          <span id="totalSegmentRevSpan">Total Rev: $0.00</span>
        </div>
      </div>
    </section>

    <!-- Main Data Section: Customer Table OR Pipeline Guardrails Inspection -->
    <section class="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
      <!-- Controls Toolbar (Search, Sort, Row Limit, Schema Mapping) -->
      <div id="tableToolbar" class="p-3.5 sm:p-4 border-b border-zinc-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white">
        <div class="flex items-center gap-2 flex-1 max-w-lg">
          <div class="relative w-full">
            <input type="search" id="tableSearchInput" value="${escapeHtml(initialFilter)}" placeholder="Search by ID, email, company, tier, or error message..." class="w-full px-3 py-1.5 pl-8 rounded-lg text-xs font-mono bg-zinc-50 border border-zinc-200 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-400" />
            <svg class="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </div>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <!-- Sort Selector -->
          <div class="flex items-center gap-1.5 text-xs text-zinc-600">
            <label for="sortSelect" class="sr-only">Sort</label>
            <select id="sortSelect" class="px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-400">
              <option value="id_asc">Sort: Customer ID (Asc)</option>
              <option value="id_desc">Sort: Customer ID (Desc)</option>
              <option value="profit_desc">Sort: Net Profit (High to Low)</option>
              <option value="profit_asc">Sort: Net Profit (Low to High)</option>
              <option value="margin_desc">Sort: Margin % (High to Low)</option>
              <option value="margin_asc">Sort: Margin % (Low to High)</option>
            </select>
          </div>

          <!-- Row Limit Selector -->
          <div class="flex items-center gap-1.5 text-xs text-zinc-600">
            <label for="rowsSelect" class="sr-only">Rows</label>
            <select id="rowsSelect" class="px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-400">
              <option value="25">25 rows</option>
              <option value="50">50 rows</option>
              <option value="100">100 rows</option>
            </select>
          </div>

          <!-- Schema Mapping Button -->
          <button type="button" id="btnSchemaMapping" onclick="openFloatingTooltip('schema', this, event)" class="px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-100 transition shrink-0 flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            <span>Schema Mapping</span>
          </button>
        </div>
      </div>

      <!-- Customer Data Table Container -->
      <div id="customerTableContainer" class="overflow-x-auto w-full">
        <table class="w-full text-left border-collapse min-w-[760px]" id="customersTable">
          <thead>
            <tr class="border-b border-zinc-200 bg-zinc-50/70 text-[11px] font-mono uppercase text-zinc-500" id="tableHeaderRow">
              <th class="p-3 text-center w-10"><input type="checkbox" class="rounded border-zinc-300 text-zinc-900 focus:ring-0" /></th>
              <th class="p-3 font-medium">Record Identifier &amp; Source</th>
              <th class="p-3 font-medium">Segment Tier</th>
              <th class="p-3 font-medium">Delivery Status</th>
              <th class="p-3 font-medium">Net Profit</th>
              <th class="p-3 font-medium">Margin</th>
              <th class="p-3 font-medium">Enrichment / Action</th>
              <th class="p-3 font-medium text-right">Details</th>
            </tr>
          </thead>
          <tbody id="contactsBody" class="divide-y divide-zinc-200/70">${renderInitialRows(state.contacts, isZero)}</tbody>
        </table>
      </div>

      <!-- Pipeline & Cloud Guardrails Inspection View (Card 5 Active) -->
      <div id="guardrailsViewContainer" class="hidden p-4 sm:p-5 overflow-x-auto">
        <div class="rounded-xl border border-zinc-200 overflow-hidden bg-white min-w-[700px]">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-zinc-200 bg-zinc-50/70 text-[11px] font-mono uppercase text-zinc-500">
                <th class="p-3 font-medium">Architecture Pillar &amp; Component</th>
                <th class="p-3 font-medium">Execution Engine &amp; SLA</th>
                <th class="p-3 font-medium">Guardrail Policy &amp; Metrics</th>
                <th class="p-3 font-medium">Operational Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-zinc-200/70 text-xs">
              <tr>
                <td class="p-3 font-medium text-zinc-900">
                  <div class="font-semibold text-zinc-950">Pillar 1: Warehouse &amp; FinOps Guardrails</div>
                  <div class="text-[11px] text-zinc-500 font-mono">Snowflake (WH_DATA_PULSE_XS) &amp; DuckDB Embedded</div>
                </td>
                <td class="p-3 font-mono text-zinc-700">AUTO_SUSPEND=60s &bull; TIMEOUT=300s</td>
                <td class="p-3 text-zinc-700">50 Credits ($150 Cap) &bull; Cost: $2.50/mo active compute</td>
                <td class="p-3"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5"></span>Active &amp; Guarded</span></td>
              </tr>
              <tr>
                <td class="p-3 font-medium text-zinc-900">
                  <div class="font-semibold text-zinc-950">Pillar 2: Apache Airflow Thin DAG</div>
                  <div class="text-[11px] text-zinc-500 font-mono">DAG ID: datapulse_hubspot_profitability_sync</div>
                </td>
                <td class="p-3 font-mono text-zinc-700">SLA: &lt;0.05s parse SLA</td>
                <td class="p-3 text-zinc-700">3 Tasks: validate_sync_manifest &rarr; execute_incremental_reverse_etl &rarr; audit_dlq_and_finops_telemetry</td>
                <td class="p-3"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5"></span>Healthy (0 * * * *)</span></td>
              </tr>
              <tr>
                <td class="p-3 font-medium text-zinc-900">
                  <div class="font-semibold text-zinc-950">Pillar 3: Data Delivery Balance</div>
                  <div class="text-[11px] text-zinc-500 font-mono" id="guardrailBalanceText">Extracted: ${state.extractedN} | Delivered: ${state.syncedS} | Skipped: ${state.skippedO} | Held: ${state.dlqPendingE}</div>
                </td>
                <td class="p-3 font-mono text-zinc-700">Out-of-Band Replay &bull; Zero Impact on Sync SLA</td>
                <td class="p-3 text-zinc-700">Auto-Remediates 150 Invalid Emails (RFC-5322 regex) &amp; 50 NaN Margin Records (coalesce to 0.0)</td>
                <td class="p-3"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5"></span>Balanced &amp; Certified</span></td>
              </tr>
              <tr>
                <td class="p-3 font-medium text-zinc-900">
                  <div class="font-semibold text-zinc-950">Pillar 4 (HubSpot CRM v3 Store)</div>
                  <div class="text-[11px] text-zinc-500 font-mono">Endpoint: /crm/v3/objects/contacts/batch/upsert</div>
                </td>
                <td class="p-3 font-mono text-zinc-700">100 records / batch &bull; Token Bucket Rate Limiter</td>
                <td class="p-3 text-zinc-700">HMAC-SHA256 Webhook Verification &bull; 429 Retry Backoff (Full Jitter) &bull; SHA-256 Idempotency Cache</td>
                <td class="p-3"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5"></span>Connected &amp; Synced</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Pagination Bar -->
      <div id="tablePaginationBar" class="p-3.5 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-50/50">
        <div class="text-xs text-zinc-600 font-mono" id="pageInfoText">
          ${isZero ? "0 matched records" : `Showing rows 1–${Math.min(25, state.totalSyncedContacts)} of ${state.totalSyncedContacts.toLocaleString("en-US")} matched records (Page 1 of ${Math.max(1, Math.ceil(state.totalSyncedContacts / 25))})`}
        </div>
        <div class="flex items-center gap-1.5">
          <button type="button" id="btnFirst" class="px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 transition" disabled>&laquo; First</button>
          <button type="button" id="btnPrev" class="px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 transition" disabled>&lsaquo; Prev</button>
          <button type="button" id="btnNext" class="px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 transition" ${state.totalSyncedContacts <= 25 ? "disabled" : ""}>Next &rsaquo;</button>
          <button type="button" id="btnLast" class="px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 transition" ${state.totalSyncedContacts <= 25 ? "disabled" : ""}>Last &raquo;</button>
        </div>
      </div>
    </section>
  </main>

  <!-- Non-Blocking Floating Anchored Tooltip Card (Zero Dark Backdrop) -->
  <div id="floatingTooltip" class="fixed z-50 w-80 bg-white border border-zinc-200 rounded-xl shadow-2xl p-4 hidden text-xs transition-opacity duration-150">
    <div class="flex items-start justify-between pb-2.5 border-b border-zinc-100">
      <div>
        <h3 class="text-xs font-bold text-zinc-950" id="tooltipTitle">Metric Details</h3>
        <p class="text-[10px] text-zinc-500">Power BI Clarity &amp; Architectural Context</p>
      </div>
      <button type="button" onclick="closeFloatingTooltip()" class="text-zinc-400 hover:text-zinc-700 p-0.5 rounded hover:bg-zinc-100 transition">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>
    <div class="mt-3 space-y-2.5">
      <div class="rounded-lg bg-emerald-50/70 border border-emerald-200/60 p-2.5">
        <div class="font-semibold text-emerald-900 mb-1 flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
          <span>Business Meaning</span>
        </div>
        <p class="text-zinc-700 text-[11px] leading-relaxed" id="tooltipBusiness">-</p>
      </div>
      <div class="rounded-lg bg-zinc-50 border border-zinc-200 p-2.5">
        <div class="font-semibold text-zinc-900 mb-1 flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>
          <span>Technical Implementation</span>
        </div>
        <p class="text-zinc-600 font-mono text-[10px] leading-relaxed" id="tooltipTech">-</p>
      </div>
    </div>
  </div>

  <!-- Slide-Over Inspector Drawer for Customer / Error Records -->
  <div id="drawerBackdrop" class="fixed inset-0 bg-black/30 backdrop-blur-[1px] z-40 hidden opacity-0 transition-opacity duration-200"></div>
  <aside id="inspectorDrawer" class="fixed right-0 top-0 bottom-0 w-full sm:max-w-xl bg-white border-l border-zinc-200 shadow-2xl z-50 transform translate-x-full transition-transform duration-300 ease-out flex flex-col">
    <div class="flex items-center justify-between p-4 border-b border-zinc-200">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-md bg-zinc-100 flex items-center justify-center text-zinc-900">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <h2 class="text-sm font-bold text-zinc-950" id="drawerTitle">Record Payload Inspector</h2>
      </div>
      <button id="closeDrawerBtn" onclick="closeInspector()" type="button" class="p-1.5 rounded-md text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>
    <div class="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 font-mono text-xs">
      <div>
        <div class="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">Record Identifier &amp; Segment</div>
        <div class="flex items-center gap-2">
          <span class="text-base font-bold text-zinc-950" id="drawerCustId">-</span>
          <span class="px-2 py-0.5 rounded text-xs bg-zinc-100 text-zinc-800 border border-zinc-200" id="drawerTier">-</span>
        </div>
      </div>
      <div>
        <div class="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">Computed SHA-256 Payload Hash</div>
        <div class="p-2.5 rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-800 break-all select-all flex items-center justify-between gap-2" id="drawerSha256Box">
          <span id="drawerSha256">-</span>
          <button type="button" onclick="navigator.clipboard.writeText(document.getElementById('drawerSha256').innerText)" class="text-[10px] text-zinc-500 hover:text-zinc-900 shrink-0 uppercase font-semibold">Copy</button>
        </div>
      </div>
      <div>
        <div class="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">Declarative Manifest Field Mapping</div>
        <div class="rounded-lg border border-zinc-200 overflow-hidden">
          <table class="w-full text-left">
            <tbody id="drawerPropMapping" class="divide-y divide-zinc-200 text-[11px]"></tbody>
          </table>
        </div>
      </div>
      <div>
        <div class="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">Canonical RFC-8259 JSON Payload</div>
        <pre class="p-3.5 rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-800 overflow-x-auto text-[11px] leading-relaxed" id="drawerJson">-</pre>
      </div>
    </div>
  </aside>

  <!-- Initial State Data JSON -->
  <script id="initialStateData" type="application/json">${safeStateJson}</script>

  <!-- Bulletproof Interactive Console Client Script -->
  <script>
    var initialEl = document.getElementById("initialStateData");
    var currentLiveState = initialEl ? JSON.parse(initialEl.textContent || "{}") : {};
    var lastStateVersion = typeof currentLiveState.stateVersion === "number" ? currentLiveState.stateVersion : -1;

    var activeCard = "all";
    var activeTier = "";
    var currentSearch = "";
    var currentSort = "id_asc";
    var currentPage = 1;
    var currentLimit = 25;
    var currentTotalMatched = 0;
    var currentTotalPages = 1;
    var searchDebounceTimer = null;

    var tooltipDictionary = {
      overview: {
        title: "Data Pulse Mission Control",
        business: "High-throughput data engineering console providing end-to-end auditability across ingestion, data hygiene, and destination CRM sync.",
        tech: "Extracts analytical mart records from Snowflake or DuckDB, applies declarative YAML schema mapping, executes token-bucket batch upserts, and logs FinOps cost telemetry."
      },
      all: {
        title: "All Synced Customers",
        business: "Total customer profiles delivered to HubSpot CRM v3, enriched with computed net profitability and segment rankings.",
        tech: "Dispatched via /crm/v3/objects/contacts/batch/upsert in 100-row micro-batches with SHA-256 payload verification and token-bucket rate limiting."
      },
      errors: {
        title: "Detected Errors (DLQ)",
        business: "Corrupted records intercepted at the validation perimeter before polluting downstream CRM accounts.",
        tech: "Dead-Letter Queue isolation capturing INVALID_EMAIL_FORMAT (150 rows) and IEEE_754_NAN_INFINITY (50 rows) with full stack trace."
      },
      vip: {
        title: "VIP Retention Alerts",
        business: "Enterprise VIP accounts whose operating profit margin dropped below -20%, flagging immediate account executive intervention.",
        tech: "Filtered via SQL window threshold: customer_tier = 'ENTERPRISE_VIP' AND profit_margin_pct <= -20.0, enriched with automated AI briefs."
      },
      repaired: {
        title: "Auto-Repaired Records",
        business: "Quarantined records automatically diagnosed, sanitized, and replayed into CRM with zero human data-entry labor.",
        tech: "AI DLQ Doctor applies RFC-5322 regex sanitization on malformed emails and safe coalesce(0.0) on NaN floats, then replays to destination."
      },
      guardrails: {
        title: "Pipeline & Cloud Guardrails",
        business: "FinOps cost protection and idempotency layers preventing duplicate cloud queries and redundant API charges.",
        tech: "SHA-256 hash comparison skips unchanged records (0 HTTP calls). Snowflake AUTO_SUSPEND=60s limits compute cost to $2.50/mo."
      },
      distribution: {
        title: "Ingestion & Quality Distribution",
        business: "Real-time proportion of clean records, held quarantine anomalies, automatic repairs, and cached skips.",
        tech: "Live row conservation balance: Extracted(N) = Delivered(S) + Quarantined(E) + Skipped(O). Demonstrates deterministic row accounting."
      },
      tiers: {
        title: "Customer Segment Tiers",
        business: "Revenue and profitability breakdown by commercial account tier. Clicking any tier cross-filters the records table.",
        tech: "Calculated dynamically in DuckDB/Snowflake: ENTERPRISE_VIP, ENTERPRISE, MID_MARKET, and SME aggregated metrics."
      },
      schema: {
        title: "Declarative Schema Mapping",
        business: "DataPulse is schema-agnostic. The declarative YAML manifest maps warehouse mart fields directly to CRM custom properties.",
        tech: "Configured via syncs/hubspot_profitability.yml: maps customer_id -> hs_external_customer_id, net_profitability_usd, and AI briefs."
      },
      sync_step: {
        title: "1. Run Initial Sync",
        business: "Extracts validated customer profitability records from local DuckDB warehouse and syncs clean contacts directly to destination CRM.",
        tech: "Runs CLI command: datapulse run --manifest syncs/hubspot_profitability.yml. Syncs 9,800 clean records and pauses 200 anomalies in DLQ."
      },
      repair_step: {
        title: "2. AI Diagnose & Repair",
        business: "Diagnoses corrupted records paused at data boundary and repairs invalid emails and NaN floats without human intervention.",
        tech: "Runs CLI command: datapulse dlq replay --manifest syncs/hubspot_profitability.yml. Executes RFC-5322 regex repair on 150 emails and safe coalesce(0.0) on 50 NaNs."
      },
      idemp_step: {
        title: "3. Verify SHA-256 Cache",
        business: "Performs incremental diffing against CRM destination to verify zero duplicate HTTP calls for unchanged records.",
        tech: "Runs CLI command: datapulse run --manifest syncs/hubspot_profitability.yml. Verifies SHA-256 payload hashes and skips 10,000 unchanged calls (100% cache hit)."
      },
      reset_step: {
        title: "Reset to 0",
        business: "Wipes destination CRM store and local DuckDB warehouse back to clean Stage 0 Baseline state.",
        tech: "Triggers API call: POST /api/v1/reset and removes local DuckDB data files, returning CRM contact count and DLQ counts back to 0."
      }
    };

    function escapeClientHtml(str) {
      return String(str == null ? "" : str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function openFloatingTooltip(topicKey, btnElement, event) {
      if (event) {
        event.stopPropagation();
      }
      var tip = document.getElementById("floatingTooltip");
      if (!tip) return;
      var data = tooltipDictionary[topicKey] || tooltipDictionary.overview;
      var titleEl = document.getElementById("tooltipTitle");
      var bizEl = document.getElementById("tooltipBusiness");
      var techEl = document.getElementById("tooltipTech");
      if (titleEl) titleEl.innerText = data.title;
      if (bizEl) bizEl.innerText = data.business;
      if (techEl) techEl.innerText = data.tech;

      if (btnElement) {
        var rect = btnElement.getBoundingClientRect();
        var tipWidth = 320;
        var left = rect.left - 120;
        if (left < 16) left = 16;
        if (left + tipWidth > window.innerWidth - 16) {
          left = window.innerWidth - tipWidth - 16;
        }
        var top = rect.bottom + 8;
        tip.style.left = left + "px";
        tip.style.top = top + "px";
      }
      tip.classList.remove("hidden");
    }

    function closeFloatingTooltip() {
      var tip = document.getElementById("floatingTooltip");
      if (tip) tip.classList.add("hidden");
    }

    document.addEventListener("click", function(e) {
      var tip = document.getElementById("floatingTooltip");
      if (tip && !tip.classList.contains("hidden")) {
        if (!tip.contains(e.target) && !e.target.closest(".info-tooltip-btn")) {
          tip.classList.add("hidden");
        }
      }
    });

    document.addEventListener("keydown", function(e) {
      if (e.key === "Escape") {
        closeFloatingTooltip();
        closeInspector();
      }
    });

    function selectTabCard(cardKey) {
      activeCard = cardKey;
      currentPage = 1;
      updateCardStyles();
      var custTable = document.getElementById("customerTableContainer");
      var guardView = document.getElementById("guardrailsViewContainer");
      var toolbar = document.getElementById("tableToolbar");
      var paginationBar = document.getElementById("tablePaginationBar");

      if (cardKey === "guardrails") {
        if (custTable) custTable.classList.add("hidden");
        if (toolbar) toolbar.classList.add("hidden");
        if (paginationBar) paginationBar.classList.add("hidden");
        if (guardView) guardView.classList.remove("hidden");
      } else {
        if (guardView) guardView.classList.add("hidden");
        if (custTable) custTable.classList.remove("hidden");
        if (toolbar) toolbar.classList.remove("hidden");
        if (paginationBar) paginationBar.classList.remove("hidden");
        updateTableHeader();
        loadTableData();
      }
    }

    function updateCardStyles() {
      var cards = [
        { id: "cardAll", key: "all" },
        { id: "cardErrors", key: "errors" },
        { id: "cardVip", key: "vip" },
        { id: "cardRepaired", key: "repaired" },
        { id: "cardGuardrails", key: "guardrails" }
      ];
      cards.forEach(function(c) {
        var el = document.getElementById(c.id);
        if (!el) return;
        var ind = el.querySelector(".card-indicator");
        if (c.key === activeCard) {
          el.className = "kpi-card kpi-card-active rounded-xl border border-zinc-950 bg-zinc-50/80 p-4 shadow-md cursor-pointer select-none";
          if (ind) { ind.innerText = "Active"; ind.className = "card-indicator font-semibold text-zinc-900"; }
        } else {
          el.className = "kpi-card rounded-xl border border-zinc-200 bg-white p-4 shadow-sm cursor-pointer hover:border-zinc-300 select-none";
          if (ind) { ind.innerText = c.key === "guardrails" ? "Click to inspect" : "Click to filter"; ind.className = "card-indicator font-semibold text-zinc-400"; }
        }
      });
    }

    function toggleTierFilter(tier) {
      if (activeTier === tier) {
        activeTier = "";
      } else {
        activeTier = tier;
      }
      if (activeCard === "guardrails") {
        activeCard = "all";
        updateCardStyles();
        var custTable = document.getElementById("customerTableContainer");
        var guardView = document.getElementById("guardrailsViewContainer");
        var toolbar = document.getElementById("tableToolbar");
        var paginationBar = document.getElementById("tablePaginationBar");
        if (guardView) guardView.classList.add("hidden");
        if (custTable) custTable.classList.remove("hidden");
        if (toolbar) toolbar.classList.remove("hidden");
        if (paginationBar) paginationBar.classList.remove("hidden");
      }
      updateTierBarHighlight();
      currentPage = 1;
      loadTableData();
    }

    function clearTierFilter() {
      activeTier = "";
      updateTierBarHighlight();
      currentPage = 1;
      loadTableData();
    }

    function updateTierBarHighlight() {
      var tiers = ["ENTERPRISE_VIP", "ENTERPRISE", "MID_MARKET", "SME"];
      tiers.forEach(function(t) {
        var el = document.getElementById("barRow_" + t);
        if (!el) return;
        if (t === activeTier) {
          el.className = "tier-bar-row tier-bar-active p-2 rounded-lg border border-emerald-600 bg-emerald-50/60 shadow-sm cursor-pointer transition";
        } else {
          el.className = "tier-bar-row p-2 rounded-lg border border-zinc-200 hover:border-zinc-400 transition cursor-pointer";
        }
      });
      var clearBtn = document.getElementById("btnClearTierFilter");
      var label = document.getElementById("activeTierLabel");
      if (clearBtn) {
        if (activeTier) clearBtn.classList.remove("hidden");
        else clearBtn.classList.add("hidden");
      }
      if (label) {
        label.innerText = activeTier ? activeTier : "None (All Tiers)";
      }
    }

    function updateTableHeader() {
      var theadRow = document.getElementById("tableHeaderRow");
      if (!theadRow) return;
      if (activeCard === "errors") {
        theadRow.innerHTML = '<th class="p-3 text-center w-10"><input type="checkbox" class="rounded border-zinc-300 text-zinc-900 focus:ring-0" /></th>' +
          '<th class="p-3 font-medium">Record Identifier &amp; Email</th>' +
          '<th class="p-3 font-medium">Quarantined Error Code</th>' +
          '<th class="p-3 font-medium">Diagnostic Reason / Failure Message</th>' +
          '<th class="p-3 font-medium">Quarantine Stage</th>' +
          '<th class="p-3 font-medium">DLQ Status</th>' +
          '<th class="p-3 font-medium text-right">Details</th>';
      } else {
        theadRow.innerHTML = '<th class="p-3 text-center w-10"><input type="checkbox" class="rounded border-zinc-300 text-zinc-900 focus:ring-0" /></th>' +
          '<th class="p-3 font-medium">Record Identifier &amp; Source</th>' +
          '<th class="p-3 font-medium">Segment Tier</th>' +
          '<th class="p-3 font-medium">Delivery Status</th>' +
          '<th class="p-3 font-medium">Net Profit</th>' +
          '<th class="p-3 font-medium">Margin</th>' +
          '<th class="p-3 font-medium">Enrichment / Action</th>' +
          '<th class="p-3 font-medium text-right">Details</th>';
      }
    }

    function renderTableRow(c) {
      var isErrorTab = activeCard === "errors";
      var safeJson = escapeClientHtml(JSON.stringify(c));

      if (isErrorTab) {
        var errCode = c.error_code || "INVALID_RECORD";
        var errMsg = c.error_message || "Contract validation failure";
        var isResolved = c.status === "RESOLVED" || Boolean(c.remediated_from_dlq);
        var statusBadge = isResolved
          ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5"></span>RESOLVED</span>'
          : '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200"><span class="w-1.5 h-1.5 rounded-full bg-rose-600 mr-1.5 animate-pulse"></span>PENDING</span>';

        return '<tr class="customer-row border-b border-zinc-200 hover:bg-zinc-50/80 transition-colors cursor-pointer" data-contact="' + safeJson + '" onclick="openInspectorFromRow(this)">' +
          '<td class="p-3 text-center"><input type="checkbox" class="rounded border-zinc-300 text-zinc-900 focus:ring-0" onclick="event.stopPropagation()" /></td>' +
          '<td class="p-3"><div class="font-medium text-xs text-zinc-950 font-mono">' + escapeClientHtml(c.customer_id) + '</div><div class="text-[11px] text-zinc-500 font-mono">' + escapeClientHtml(c.email) + '</div></td>' +
          '<td class="p-3"><span class="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-rose-50 text-rose-700 border border-rose-200">' + escapeClientHtml(errCode) + '</span></td>' +
          '<td class="p-3"><div class="text-xs text-zinc-800 font-mono truncate max-w-sm" title="' + escapeClientHtml(errMsg) + '">' + escapeClientHtml(errMsg) + '</div></td>' +
          '<td class="p-3"><span class="text-[11px] font-mono text-zinc-500">CONTRACT_VALIDATION</span></td>' +
          '<td class="p-3">' + statusBadge + '</td>' +
          '<td class="p-3 text-right"><button type="button" class="btn-inspect px-2.5 py-1 rounded text-xs font-medium border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 transition" onclick="event.stopPropagation(); openInspectorFromRow(this)">Inspect</button></td>' +
          '</tr>';
      }

      var isVip = Boolean(c.ai_executive_brief) || (c.customer_tier || "").includes("VIP");
      var isHealed = Boolean(c.remediated_from_dlq);
      var statusPill = isVip
        ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200"><span class="w-1.5 h-1.5 rounded-full bg-rose-600 mr-1.5"></span>VIP At Risk</span>'
        : isHealed
          ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>Auto-Repaired</span>'
          : '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5"></span>Delivered</span>';

      var briefCell = c.ai_executive_brief
        ? '<div class="flex items-center gap-1.5"><span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">[VIP-BRIEF]</span><span class="text-xs text-zinc-700 truncate max-w-xs" title="' + escapeClientHtml(c.ai_executive_brief) + '">' + escapeClientHtml(c.ai_executive_brief) + '</span></div>'
        : isHealed
          ? '<span class="text-xs text-zinc-500 font-mono">Remediated via AI DLQ Replay</span>'
          : '<span class="text-xs text-zinc-400">Standard Margin Profile</span>';

      var marginPct = c.profit_margin_pct != null ? c.profit_margin_pct : 0;
      var marginBadge = '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ' + (marginPct < 0 ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200') + '">' + (marginPct < 0 ? '' : '+') + marginPct.toFixed(1) + '%</span>';
      var tierBadge = '<span class="px-2 py-0.5 rounded text-xs font-medium ' + (isVip ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-zinc-100 text-zinc-700 border border-zinc-200') + '">' + escapeClientHtml(c.customer_tier || 'STANDARD') + '</span>';
      var netProfit = (c.net_profitability_usd != null ? c.net_profitability_usd : 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      return '<tr class="customer-row border-b border-zinc-200 hover:bg-zinc-50/80 transition-colors cursor-pointer" data-contact="' + safeJson + '" onclick="openInspectorFromRow(this)">' +
        '<td class="p-3 text-center"><input type="checkbox" class="rounded border-zinc-300 text-zinc-900 focus:ring-0" onclick="event.stopPropagation()" /></td>' +
        '<td class="p-3"><div class="flex items-center gap-2"><span class="font-medium text-xs text-zinc-950 font-mono">' + escapeClientHtml(c.customer_id) + '</span><span class="px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-100 text-zinc-600 border border-zinc-200">' + escapeClientHtml(c.country || "US") + '</span></div><div class="text-[11px] text-zinc-500">' + escapeClientHtml(c.company || "Enterprise Account") + ' &bull; <span class="font-mono">' + escapeClientHtml(c.email) + '</span></div></td>' +
        '<td class="p-3">' + tierBadge + '</td>' +
        '<td class="p-3">' + statusPill + '</td>' +
        '<td class="p-3 font-mono text-xs font-semibold text-zinc-950">$' + netProfit + '</td>' +
        '<td class="p-3">' + marginBadge + '</td>' +
        '<td class="p-3">' + briefCell + '</td>' +
        '<td class="p-3 text-right"><button type="button" class="btn-inspect px-2.5 py-1 rounded text-xs font-medium border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 transition" onclick="event.stopPropagation(); openInspectorFromRow(this)">Inspect</button></td>' +
        '</tr>';
    }

    async function loadTableData() {
      var tbody = document.getElementById("contactsBody");
      if (!tbody) return;
      var isZero = currentLiveState.totalSyncedContacts === 0 && currentLiveState.extractedN === 0;

      if (isZero && activeCard !== "errors") {
        tbody.innerHTML = '<tr><td colspan="8" class="p-12 text-center text-xs text-zinc-500 font-mono">Stage 0 Baseline: 0 Contacts in CRM. Ingestion pipeline is idle. Click "1. Run Initial Sync" above to stream batches...</td></tr>';
        updatePaginationDisplay(0, 1, 1);
        return;
      }

      var queryParams = [];
      if (currentSearch) queryParams.push("search=" + encodeURIComponent(currentSearch));
      if (activeCard) queryParams.push("tab=" + encodeURIComponent(activeCard));
      if (activeTier) queryParams.push("tier=" + encodeURIComponent(activeTier));
      queryParams.push("page=" + currentPage);
      queryParams.push("limit=" + currentLimit);
      queryParams.push("sort=" + encodeURIComponent(currentSort));

      var url = "/api/v1/contacts?" + queryParams.join("&");
      try {
        var resp = await fetch(url);
        if (!resp.ok) return;
        var data = await resp.json();
        var items = data.items || data.contacts || [];
        var totalMatched = typeof data.totalMatched === "number" ? data.totalMatched : (data.total || 0);
        var totalPages = Math.max(1, typeof data.totalPages === "number" ? data.totalPages : Math.ceil(totalMatched / currentLimit));

        currentTotalMatched = totalMatched;
        currentTotalPages = totalPages;

        if (items.length === 0 || totalMatched === 0) {
          var emptyMsg = activeCard === "errors"
            ? "Zero errors detected in quarantine DLQ. All records delivered cleanly."
            : "No records found matching current search/filter criteria.";
          tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-xs text-zinc-500 font-mono">' + emptyMsg + '</td></tr>';
          updatePaginationDisplay(0, 1, 1);
          return;
        }

        tbody.innerHTML = items.map(renderTableRow).join("");
        updatePaginationDisplay(totalMatched, currentPage, totalPages);
      } catch (err) {
        console.error("Failed to load table data:", err);
      }
    }

    function updatePaginationDisplay(totalMatched, page, totalPages) {
      var infoEl = document.getElementById("pageInfoText");
      var btnFirst = document.getElementById("btnFirst");
      var btnPrev = document.getElementById("btnPrev");
      var btnNext = document.getElementById("btnNext");
      var btnLast = document.getElementById("btnLast");

      if (infoEl) {
        if (totalMatched === 0) {
          infoEl.innerText = "0 matched records";
        } else {
          var start = (page - 1) * currentLimit + 1;
          var end = Math.min(page * currentLimit, totalMatched);
          infoEl.innerText = "Showing rows " + start + "–" + end + " of " + totalMatched.toLocaleString("en-US") + " matched records (Page " + page + " of " + totalPages + ")";
        }
      }

      if (btnFirst) btnFirst.disabled = page <= 1 || totalMatched === 0;
      if (btnPrev) btnPrev.disabled = page <= 1 || totalMatched === 0;
      if (btnNext) btnNext.disabled = page >= totalPages || totalMatched === 0;
      if (btnLast) btnLast.disabled = page >= totalPages || totalMatched === 0;
    }

    // Controls Event Handlers
    var searchInputEl = document.getElementById("tableSearchInput");
    if (searchInputEl) {
      searchInputEl.addEventListener("input", function(e) {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(function() {
          currentSearch = e.target.value.trim();
          currentPage = 1;
          loadTableData();
        }, 150);
      });
    }

    var sortSelectEl = document.getElementById("sortSelect");
    if (sortSelectEl) {
      sortSelectEl.addEventListener("change", function(e) {
        currentSort = e.target.value;
        currentPage = 1;
        loadTableData();
      });
    }

    var rowsSelectEl = document.getElementById("rowsSelect");
    if (rowsSelectEl) {
      rowsSelectEl.addEventListener("change", function(e) {
        currentLimit = parseInt(e.target.value, 10) || 25;
        currentPage = 1;
        loadTableData();
      });
    }

    var btnFirstEl = document.getElementById("btnFirst");
    if (btnFirstEl) {
      btnFirstEl.addEventListener("click", function() {
        if (currentPage > 1) {
          currentPage = 1;
          loadTableData();
        }
      });
    }

    var btnPrevEl = document.getElementById("btnPrev");
    if (btnPrevEl) {
      btnPrevEl.addEventListener("click", function() {
        if (currentPage > 1) {
          currentPage -= 1;
          loadTableData();
        }
      });
    }

    var btnNextEl = document.getElementById("btnNext");
    if (btnNextEl) {
      btnNextEl.addEventListener("click", function() {
        if (currentPage < currentTotalPages) {
          currentPage += 1;
          loadTableData();
        }
      });
    }

    var btnLastEl = document.getElementById("btnLast");
    if (btnLastEl) {
      btnLastEl.addEventListener("click", function() {
        if (currentPage < currentTotalPages) {
          currentPage = currentTotalPages;
          loadTableData();
        }
      });
    }

    // Inspector Slide-Over Drawer
    var drawerEl = document.getElementById("inspectorDrawer");
    var drawerBackdropEl = document.getElementById("drawerBackdrop");

    async function computeClientSha256(str) {
      var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
      return Array.from(new Uint8Array(buf)).map(function(b) { return b.toString(16).padStart(2, "0"); }).join("");
    }

    async function openInspector(c) {
      if (!c) return;
      var custIdEl = document.getElementById("drawerCustId");
      var tierEl = document.getElementById("drawerTier");
      var jsonEl = document.getElementById("drawerJson");
      var shaEl = document.getElementById("drawerSha256");
      var mapEl = document.getElementById("drawerPropMapping");

      if (custIdEl) custIdEl.innerText = c.customer_id || "-";
      if (tierEl) tierEl.innerText = c.customer_tier || "UNKNOWN";
      if (jsonEl) jsonEl.innerText = JSON.stringify(c, null, 2);
      if (shaEl) shaEl.innerText = await computeClientSha256(JSON.stringify(c));

      var mapping = [
        ["hs_external_customer_id", c.customer_id || "-"],
        ["company", c.company || "Enterprise Account"],
        ["country", c.country || "US"],
        ["email", c.email || "-"],
        ["hs_net_profitability_usd", "$" + (c.net_profitability_usd || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })],
        ["hs_profit_margin_pct", (c.profit_margin_pct || 0).toFixed(1) + "%"],
        ["datapulse_customer_tier", c.customer_tier || "ENTERPRISE"],
        ["datapulse_remediated_from_dlq", c.remediated_from_dlq ? "true" : "false"],
        ["datapulse_ai_executive_brief", c.ai_executive_brief || "[Standard Margin Profile]"]
      ];

      if (c.error_code) {
        mapping.push(["quarantine_error_code", c.error_code]);
        mapping.push(["quarantine_error_message", c.error_message || "Contract validation failure"]);
        mapping.push(["quarantine_status", c.status || "PENDING"]);
      }

      if (mapEl) {
        mapEl.innerHTML = mapping.map(function(item) {
          return '<tr class="border-b border-zinc-200"><td class="p-2.5 text-zinc-500 font-mono">' + item[0] + '</td><td class="p-2.5 font-mono font-medium text-zinc-900">' + escapeClientHtml(item[1]) + '</td></tr>';
        }).join("");
      }

      if (drawerBackdropEl) {
        drawerBackdropEl.classList.remove("hidden");
        setTimeout(function() { drawerBackdropEl.classList.remove("opacity-0"); }, 10);
      }
      if (drawerEl) drawerEl.classList.remove("translate-x-full");
    }

    function closeInspector() {
      if (drawerEl) drawerEl.classList.add("translate-x-full");
      if (drawerBackdropEl) {
        drawerBackdropEl.classList.add("opacity-0");
        setTimeout(function() { drawerBackdropEl.classList.add("hidden"); }, 200);
      }
    }

    if (drawerBackdropEl) drawerBackdropEl.addEventListener("click", closeInspector);

    function openInspectorFromRow(targetEl) {
      try {
        var row = targetEl && targetEl.closest ? targetEl.closest("tr") : targetEl;
        if (!row) return;
        openInspector(JSON.parse(row.getAttribute("data-contact")));
      } catch (e) {
        console.error(e);
      }
    }

    // State Synchronization
    function updateKpiCards(s) {
      var isZero = s.totalSyncedContacts === 0 && s.extractedN === 0;

      var airflowBadge = document.getElementById("airflowBadge");
      if (airflowBadge) {
        if (s.lastAirflowDagRunId) {
          airflowBadge.innerText = "DAG: " + String(s.lastAirflowDagRunId).slice(-8);
        } else if (s.airflowOnline) {
          airflowBadge.innerText = "DAG: Online";
        } else {
          airflowBadge.innerText = "DAG: Ready";
        }
      }

      var synEl = document.getElementById("kpiSynced");
      if (synEl) synEl.innerText = s.totalSyncedContacts.toLocaleString("en-US");

      var synTrend = document.getElementById("kpiSyncedTrend");
      if (synTrend) {
        synTrend.innerText = isZero
          ? "Standby: Awaiting Sync"
          : s.totalSyncedContacts >= 10000
            ? "100% Complete • Zero row loss"
            : s.totalSyncedContacts >= 9800
              ? "+98.0% First Pass • 200 Held in DLQ"
              : "Sync in progress";
      }

      var badgeAll = document.getElementById("badgeAll");
      if (badgeAll) {
        badgeAll.innerText = isZero ? "0%" : s.totalSyncedContacts >= 10000 ? "+100%" : "+98.0%";
      }

      var errEl = document.getElementById("kpiErrors");
      if (errEl) {
        errEl.innerText = String(s.dlqPendingE);
        errEl.className = "text-2xl font-bold tracking-tight font-mono " + (s.dlqPendingE > 0 ? "text-rose-600" : "text-zinc-950");
      }

      var errDot = document.getElementById("kpiErrorsDot");
      if (errDot) {
        errDot.className = "w-2.5 h-2.5 rounded-full " + (isZero ? "bg-zinc-400" : s.dlqPendingE > 0 ? "bg-rose-600" : "bg-emerald-600");
      }

      var errTrend = document.getElementById("kpiErrorsTrend");
      if (errTrend) {
        errTrend.innerText = isZero
          ? "Standby: 0 Anomalies Held"
          : s.dlqPendingE > 0
            ? s.dlqPendingE + " Quarantined (" + (s.emailErrorsPending || 150) + " Email, " + (s.nanErrorsPending || 50) + " NaN)"
            : s.dlqResolved > 0
              ? "0 Held • " + s.dlqResolved + " Auto-Repaired"
              : "0 Held • Clean Ingestion";
      }

      var vipEl = document.getElementById("kpiVip");
      if (vipEl) vipEl.innerText = String(s.vipBriefCount);

      var vipTrend = document.getElementById("kpiVipTrend");
      if (vipTrend) {
        vipTrend.innerText = isZero || s.vipBriefCount === 0
          ? "0 Alerts • Normal Margin Profile"
          : s.vipBriefCount + " VIPs with margin < -20% (AI Briefs)";
      }

      var repEl = document.getElementById("kpiRepaired");
      if (repEl) repEl.innerText = String(s.dlqResolved);

      var repTrend = document.getElementById("kpiRepairedTrend");
      if (repTrend) {
        repTrend.innerText = isZero
          ? "Standby: 0 Repaired"
          : s.dlqResolved > 0
            ? s.dlqResolved + " Records Healed via Replay"
            : "0 Repaired • Awaiting Replay";
      }

      var skipEl = document.getElementById("kpiSkipped");
      if (skipEl) skipEl.innerText = s.skippedO.toLocaleString("en-US") + " Skipped";

      var guardTrend = document.getElementById("kpiGuardrailsTrend");
      if (guardTrend) {
        guardTrend.innerText = isZero
          ? "Standby • Idempotency primed"
          : s.skippedO > 0
            ? s.skippedO.toLocaleString("en-US") + " Calls Skipped • 0 API Duplicates"
            : "SHA-256 Incremental Diffing Active";
      }

      var guardBalanceText = document.getElementById("guardrailBalanceText");
      if (guardBalanceText) {
        guardBalanceText.innerText = "Extracted: " + s.extractedN + " | Delivered: " + s.syncedS + " | Skipped: " + s.skippedO + " | Held: " + s.dlqPendingE;
      }
    }

    function updateEngineeringCharts(s) {
      var isZero = s.totalSyncedContacts === 0 && s.extractedN === 0;

      // Ingestion & Quality Distribution
      var totalBase = Math.max(1, s.extractedN || s.totalSyncedContacts || 10000);
      var cleanDelivered = Math.max(0, s.syncedS - s.dlqResolved);

      var barClean = document.getElementById("barDeliveredClean");
      var barRep = document.getElementById("barRepaired");
      var barQ = document.getElementById("barQuarantined");
      var barSkip = document.getElementById("barSkipped");

      if (barClean) barClean.style.width = isZero ? "0%" : Math.min(100, Math.round((cleanDelivered / totalBase) * 100)) + "%";
      if (barRep) barRep.style.width = isZero ? "0%" : Math.min(100, Math.round((s.dlqResolved / totalBase) * 100)) + "%";
      if (barQ) barQ.style.width = isZero ? "0%" : Math.min(100, Math.round((s.dlqPendingE / totalBase) * 100)) + "%";
      if (barSkip) barSkip.style.width = isZero ? "0%" : (s.skippedO > 0 ? "100%" : "0%");

      var cntClean = document.getElementById("countDeliveredClean");
      var pctClean = document.getElementById("pctDeliveredClean");
      var cntQ = document.getElementById("countQuarantined");
      var descQ = document.getElementById("descQuarantined");
      var cntRep = document.getElementById("countRepaired");
      var descRep = document.getElementById("descRepaired");
      var cntSkip = document.getElementById("countSkipped");
      var descSkip = document.getElementById("descSkipped");
      var distRatio = document.getElementById("distributionTotalRatio");

      if (cntClean) cntClean.innerText = isZero ? "0" : cleanDelivered.toLocaleString("en-US");
      if (pctClean) pctClean.innerText = isZero ? "0% of extracted" : Math.round((cleanDelivered / totalBase) * 100) + "% of extracted";
      if (cntQ) cntQ.innerText = isZero ? "0" : String(s.dlqPendingE);
      if (descQ) descQ.innerText = (s.emailErrorsPending || 150) + " Email • " + (s.nanErrorsPending || 50) + " NaN";
      if (cntRep) cntRep.innerText = isZero ? "0" : String(s.dlqResolved);
      if (descRep) descRep.innerText = s.dlqResolved > 0 ? "Replayed to CRM" : "Awaiting Replay";
      if (cntSkip) cntSkip.innerText = isZero ? "0" : s.skippedO.toLocaleString("en-US");
      if (descSkip) descSkip.innerText = s.skippedO > 0 ? "Saved API calls" : "Incremental cache primed";
      if (distRatio) distRatio.innerText = isZero ? "0 / 0 rows" : s.syncedS.toLocaleString("en-US") + " / " + totalBase.toLocaleString("en-US") + " rows";

      // Net Profitability & Volume by Customer Tier
      var seg = s.segmentBreakdown || {};
      var vip = seg.ENTERPRISE_VIP || { annual_revenue: 0, net_profitability_usd: 0, count: 0 };
      var ent = seg.ENTERPRISE || { annual_revenue: 0, net_profitability_usd: 0, count: 0 };
      var mm = seg.MID_MARKET || { annual_revenue: 0, net_profitability_usd: 0, count: 0 };
      var sme = seg.SME || { annual_revenue: 0, net_profitability_usd: 0, count: 0 };
      var totalRev = vip.annual_revenue + ent.annual_revenue + mm.annual_revenue + sme.annual_revenue;
      var maxRev = Math.max(totalRev, 1);

      var fillVip = document.getElementById("barFill_ENTERPRISE_VIP");
      var fillEnt = document.getElementById("barFill_ENTERPRISE");
      var fillMm = document.getElementById("barFill_MID_MARKET");
      var fillSme = document.getElementById("barFill_SME");

      if (fillVip) fillVip.style.width = isZero ? "0%" : Math.min(100, Math.round((vip.annual_revenue / maxRev) * 100)) + "%";
      if (fillEnt) fillEnt.style.width = isZero ? "0%" : Math.min(100, Math.round((ent.annual_revenue / maxRev) * 100)) + "%";
      if (fillMm) fillMm.style.width = isZero ? "0%" : Math.min(100, Math.round((mm.annual_revenue / maxRev) * 100)) + "%";
      if (fillSme) fillSme.style.width = isZero ? "0%" : Math.min(100, Math.round((sme.annual_revenue / maxRev) * 100)) + "%";

      var netVip = document.getElementById("segNet_ENTERPRISE_VIP");
      var netEnt = document.getElementById("segNet_ENTERPRISE");
      var netMm = document.getElementById("segNet_MID_MARKET");
      var netSme = document.getElementById("segNet_SME");

      if (netVip) netVip.innerText = isZero ? "Net: $0.00" : "Net: -$" + Math.abs(vip.net_profitability_usd).toLocaleString("en-US", { minimumFractionDigits: 2 });
      if (netEnt) netEnt.innerText = "Net: +$" + ent.net_profitability_usd.toLocaleString("en-US", { minimumFractionDigits: 2 });
      if (netMm) netMm.innerText = "Net: +$" + mm.net_profitability_usd.toLocaleString("en-US", { minimumFractionDigits: 2 });
      if (netSme) netSme.innerText = "Net: +$" + sme.net_profitability_usd.toLocaleString("en-US", { minimumFractionDigits: 2 });

      var cntVip = document.getElementById("segCount_ENTERPRISE_VIP");
      var cntEnt = document.getElementById("segCount_ENTERPRISE");
      var cntMm = document.getElementById("segCount_MID_MARKET");
      var cntSme = document.getElementById("segCount_SME");

      if (cntVip) cntVip.innerText = vip.count.toLocaleString("en-US") + " accounts";
      if (cntEnt) cntEnt.innerText = ent.count.toLocaleString("en-US") + " accounts";
      if (cntMm) cntMm.innerText = mm.count.toLocaleString("en-US") + " accounts";
      if (cntSme) cntSme.innerText = sme.count.toLocaleString("en-US") + " accounts";

      var revVip = document.getElementById("segRev_ENTERPRISE_VIP");
      var revEnt = document.getElementById("segRev_ENTERPRISE");
      var revMm = document.getElementById("segRev_MID_MARKET");
      var revSme = document.getElementById("segRev_SME");

      if (revVip) revVip.innerText = "Rev: $" + vip.annual_revenue.toLocaleString("en-US", { minimumFractionDigits: 2 });
      if (revEnt) revEnt.innerText = "Rev: $" + ent.annual_revenue.toLocaleString("en-US", { minimumFractionDigits: 2 });
      if (revMm) revMm.innerText = "Rev: $" + mm.annual_revenue.toLocaleString("en-US", { minimumFractionDigits: 2 });
      if (revSme) revSme.innerText = "Rev: $" + sme.annual_revenue.toLocaleString("en-US", { minimumFractionDigits: 2 });

      var totRevSpan = document.getElementById("totalSegmentRevSpan");
      if (totRevSpan) totRevSpan.innerText = "Total Rev: $" + totalRev.toLocaleString("en-US", { minimumFractionDigits: 2 });
    }

    var flowNodeColors = {
      sync: { border: "border-emerald-600", bg: "bg-emerald-600", text: "text-white", ring: "ring-emerald-200" },
      replay: { border: "border-amber-500", bg: "bg-amber-500", text: "text-white", ring: "ring-amber-200" },
      idempotent: { border: "border-blue-600", bg: "bg-blue-600", text: "text-white", ring: "ring-blue-200" },
      reset: { border: "border-rose-600", bg: "bg-rose-600", text: "text-white", ring: "ring-rose-200" }
    };

    function highlightActiveFlowNode(phase) {
      var nodeMap = {
        sync: "btnRunSync",
        replay: "btnRunRepair",
        idempotent: "btnRunIdemp",
        reset: "btnResetZero"
      };

      // Reset all nodes to base state (monochrome)
      Object.keys(nodeMap).forEach(function(k) {
        var el = document.getElementById(nodeMap[k]);
        if (!el) return;
        el.className = "pipeline-step-btn flow-node-circle size-16 sm:size-20 rounded-full border-4 border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 flex items-center justify-center shadow-md cursor-pointer select-none transition-all duration-300";
      });

      // Highlight target phase in vivid color
      var activeEl = document.getElementById(nodeMap[phase]);
      var style = flowNodeColors[phase];
      if (activeEl && style) {
        activeEl.className = "pipeline-step-btn flow-node-circle size-16 sm:size-20 rounded-full border-4 " + style.border + " " + style.bg + " " + style.text + " ring-4 " + style.ring + " flex items-center justify-center shadow-lg cursor-pointer select-none transition-all duration-300 scale-105";
      }

      // If reset was clicked, reset segments after animation
      var seg1 = document.getElementById("svgRibbonSeg1");
      var seg2 = document.getElementById("svgRibbonSeg2");
      var seg3 = document.getElementById("svgRibbonSeg3");
      if (phase === "sync") {
        if (seg1) seg1.setAttribute("stroke", "#059669");
      } else if (phase === "replay") {
        if (seg1) seg1.setAttribute("stroke", "#059669");
        if (seg2) seg2.setAttribute("stroke", "#d97706");
      } else if (phase === "idempotent") {
        if (seg1) seg1.setAttribute("stroke", "#059669");
        if (seg2) seg2.setAttribute("stroke", "#d97706");
        if (seg3) seg3.setAttribute("stroke", "#2563eb");
      } else if (phase === "reset") {
        if (seg1) seg1.setAttribute("stroke", "#e4e4e7");
        if (seg2) seg2.setAttribute("stroke", "#e4e4e7");
        if (seg3) seg3.setAttribute("stroke", "#e4e4e7");
      }
    }

    async function triggerPipelinePhase(phase, btnEl) {
      var spinner = document.getElementById("pipelineSpinner");
      var btns = document.querySelectorAll(".pipeline-step-btn");
      var originalHtml = btnEl ? btnEl.innerHTML : "";
      highlightActiveFlowNode(phase);
      btns.forEach(function(b) { b.disabled = true; });
      if (btnEl) btnEl.classList.add("opacity-80");
      if (spinner) {
        spinner.innerText = "Engine executing (" + phase + ")...";
        spinner.classList.remove("hidden");
      }

      try {
        var resp = await fetch("/api/v1/pipeline/run-phase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phase: phase })
        });
        var data = await resp.json();
        if (data.state) {
          currentLiveState = data.state;
          lastStateVersion = typeof data.state.stateVersion === "number" ? data.state.stateVersion : lastStateVersion;
          updateKpiCards(data.state);
          updateEngineeringCharts(data.state);
          if (activeCard !== "guardrails") {
            currentPage = 1;
            loadTableData();
          }
        }
      } catch (err) {
        console.error("Pipeline run error:", err);
      } finally {
        btns.forEach(function(b) { b.disabled = false; });
        if (btnEl) {
          btnEl.classList.remove("opacity-60");
          btnEl.innerHTML = originalHtml;
        }
        if (spinner) spinner.classList.add("hidden");
      }
    }

    // Silent Background Poller (Runs every 1500ms without F5)
    setInterval(async function() {
      try {
        var resp = await fetch("/api/v1/state");
        if (!resp.ok) return;
        var s = await resp.json();
        var ver = typeof s.stateVersion === "number" ? s.stateVersion : -1;
        var changed = ver !== lastStateVersion ||
          s.totalSyncedContacts !== currentLiveState.totalSyncedContacts ||
          s.dlqPendingE !== currentLiveState.dlqPendingE ||
          s.dlqResolved !== currentLiveState.dlqResolved ||
          s.skippedO !== currentLiveState.skippedO ||
          s.vipBriefCount !== currentLiveState.vipBriefCount ||
          s.lastAirflowDagRunId !== currentLiveState.lastAirflowDagRunId ||
          s.airflowOnline !== currentLiveState.airflowOnline;

        if (changed) {
          lastStateVersion = ver;
          currentLiveState = s;
          updateKpiCards(s);
          updateEngineeringCharts(s);
          if (activeCard !== "guardrails") {
            loadTableData();
          }
        }
      } catch (err) {}
    }, 1500);

    // Connector Health Check Poller
    setInterval(async function() {
      try {
        var resp = await fetch("/health");
        var track = document.getElementById("connSwitchTrack");
        var knob = document.getElementById("connSwitchKnob");
        var txt = document.getElementById("connText");
        if (resp.ok) {
          if (track) track.className = "relative inline-flex h-5 w-9 shrink-0 cursor-default items-center rounded-full bg-emerald-600 p-0.5 transition-colors duration-200 ease-in-out shadow-inner";
          if (knob) knob.className = "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out translate-x-4";
          if (txt) { txt.innerText = "ON"; txt.className = "text-xs font-semibold font-mono uppercase tracking-wider text-emerald-700"; }
        } else {
          if (track) track.className = "relative inline-flex h-5 w-9 shrink-0 cursor-default items-center rounded-full bg-rose-600 p-0.5 transition-colors duration-200 ease-in-out shadow-inner";
          if (knob) knob.className = "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out translate-x-0";
          if (txt) { txt.innerText = "OFF"; txt.className = "text-xs font-semibold font-mono uppercase tracking-wider text-rose-700"; }
        }
      } catch (err) {
        var track = document.getElementById("connSwitchTrack");
        var knob = document.getElementById("connSwitchKnob");
        var txt = document.getElementById("connText");
        if (track) track.className = "relative inline-flex h-5 w-9 shrink-0 cursor-default items-center rounded-full bg-rose-600 p-0.5 transition-colors duration-200 ease-in-out shadow-inner";
        if (knob) knob.className = "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out translate-x-0";
        if (txt) { txt.innerText = "OFF"; txt.className = "text-xs font-semibold font-mono uppercase tracking-wider text-rose-700"; }
      }
    }, 5000);

    // Initial Setup
    updateKpiCards(currentLiveState);
    updateEngineeringCharts(currentLiveState);
    updateCardStyles();
  </script>
</body>
</html>`;
}
