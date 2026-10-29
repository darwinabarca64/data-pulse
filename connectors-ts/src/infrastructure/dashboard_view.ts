/**
 * Infrastructure Layer: Live No-Code Executive HTML/CSS Web Monitor Renderer.
 */

import { NormalizedCrmContact } from "../domain/contracts.js";

export interface CrmStoreState {
  totalSyncedContacts: number;
  vipBriefCount: number;
  totalBatchRequests: number;
  rateLimitRetriesAbsorbed: number;
  rejectedRecordCount: number;
  annualSaasSavingsUsd: number;
  contacts: NormalizedCrmContact[];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderLiveDashboardHtml(state: CrmStoreState): string {
  const rowsHtml = state.contacts
    .slice(0, 50)
    .map((c) => {
      const briefCell = c.ai_executive_brief
        ? `<span class="badge-vip">[VIP-BRIEF]</span> ${escapeHtml(c.ai_executive_brief)}`
        : `<span class="muted">[OK] Standard Margin Profile</span>`;
      const marginClass = c.profit_margin_pct < 0 ? "neg" : "pos";
      return `<tr>
        <td class="mono">${escapeHtml(c.customer_id)}</td>
        <td>${escapeHtml(c.email)}</td>
        <td><span class="tier">${escapeHtml(c.customer_tier)}</span></td>
        <td class="mono">${c.net_profitability_usd.toFixed(2)} ${escapeHtml(c.currency_code)}</td>
        <td class="mono ${marginClass}">${c.profit_margin_pct.toFixed(1)}%</td>
        <td>${briefCell}</td>
      </tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DataPulse | Executive HubSpot CRM &amp; FinOps Live Monitor</title>
  <style>
    :root {
      --bg: #0b0f19; --panel: #111827; --border: #1f2937;
      --text: #f3f4f6; --muted: #9ca3af; --accent: #38bdf8;
      --ok: #10b981; --warn: #f59e0b; --danger: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: system-ui, -apple-system, sans-serif; padding: 24px; }
    header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 16px; margin-bottom: 24px; }
    h1 { font-size: 1.25rem; letter-spacing: 0.04em; text-transform: uppercase; color: var(--accent); }
    .status-tag { font-family: monospace; background: #064e3b; color: #34d399; padding: 6px 12px; border-radius: 4px; font-size: 0.85rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { background: var(--panel); border: 1px solid var(--border); border-radius: 6px; padding: 16px; }
    .card-label { font-size: 0.75rem; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; font-family: monospace; }
    .card-val { font-size: 1.65rem; font-weight: 700; font-family: monospace; }
    .toolbar { display: flex; justify-content: space-between; margin-bottom: 12px; align-items: center; }
    input[type="search"] { background: var(--panel); border: 1px solid var(--border); color: var(--text); padding: 8px 12px; border-radius: 4px; width: 320px; }
    table { width: 100%; border-collapse: collapse; background: var(--panel); border: 1px solid var(--border); font-size: 0.88rem; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border); }
    th { background: #1e293b; color: var(--muted); font-family: monospace; text-transform: uppercase; font-size: 0.75rem; }
    .mono { font-family: monospace; }
    .pos { color: var(--ok); }
    .neg { color: var(--danger); font-weight: 600; }
    .tier { background: #1e3a8a; color: #93c5fd; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 0.75rem; }
    .badge-vip { background: #7c2d12; color: #fdba74; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 0.75rem; }
    .muted { color: var(--muted); font-family: monospace; font-size: 0.8rem; }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>DataPulse Reverse ETL | HubSpot CRM v3 &amp; FinOps Monitor</h1>
      <p class="muted">Zero-Trust HMAC-SHA256 Receiver | Token-Bucket &amp; Full-Jitter Backoff Active</p>
    </div>
    <div class="status-tag">[OK] CONNECTOR ONLINE</div>
  </header>
  <section class="grid">
    <div class="card">
      <div class="card-label">[OK] Synced HubSpot Contacts (S)</div>
      <div class="card-val" id="kpi-synced">${state.totalSyncedContacts}</div>
    </div>
    <div class="card">
      <div class="card-label">[VIP-BRIEF] Executive Retention Alerts</div>
      <div class="card-val" id="kpi-vip">${state.vipBriefCount}</div>
    </div>
    <div class="card">
      <div class="card-label">[OK] Batch Requests Processed</div>
      <div class="card-val" id="kpi-batches">${state.totalBatchRequests}</div>
    </div>
    <div class="card">
      <div class="card-label">[RATE-LIMIT] HTTP 429 Retries Absorbed</div>
      <div class="card-val" id="kpi-retries">${state.rateLimitRetriesAbsorbed}</div>
    </div>
    <div class="card">
      <div class="card-label">[FINOPS] Annual Savings vs Hightouch</div>
      <div class="card-val pos">$${state.annualSaasSavingsUsd.toLocaleString("en-US")}/yr</div>
    </div>
  </section>
  <div class="toolbar">
    <span class="muted">Showing latest synced HubSpot CRM contacts (Idempotent Key: email / customer_id)</span>
    <input type="search" id="filterInput" placeholder="Filter by Customer ID, Email, or Tier..." />
  </div>
  <table>
    <thead>
      <tr>
        <th>Customer ID</th>
        <th>Email</th>
        <th>Tier</th>
        <th>Net Profitability</th>
        <th>Margin (%)</th>
        <th>VIP Executive Action Brief</th>
      </tr>
    </thead>
    <tbody id="contactsBody">
      ${rowsHtml || '<tr><td colspan="6" class="muted">[INFO] Waiting for Reverse ETL sync batches...</td></tr>'}
    </tbody>
  </table>
  <script>
    const input = document.getElementById("filterInput");
    input.addEventListener("input", () => {
      const q = input.value.toLowerCase();
      for (const row of document.querySelectorAll("#contactsBody tr")) {
        row.style.display = row.innerText.toLowerCase().includes(q) ? "" : "none";
      }
    });
  </script>
</body>
</html>`;
}

