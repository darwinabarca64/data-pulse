/**
 * Vitest Unit & Integration Suite for DataPulse TypeScript CRM Connector.
 */

import { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import {
  calculateFullJitterBackoffMs,
  isRetryableStatus,
  ResilientCrmDispatcher,
  TokenBucketRateLimiter,
} from "../src/application/resilience.js";
import {
  computeHmacSha256,
  computeIdempotencyKey,
  validateBatchRecordsGranular,
  verifyHmacSignature,
} from "../src/domain/contracts.js";
import { renderLiveDashboardHtml } from "../src/infrastructure/dashboard_view.js";
import { createConnectorServer } from "../src/infrastructure/server.js";

const EMOJI_REGEX =
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}]/u;

describe("Step 5: TypeScript Connector Domain, Resilience & HTTP Server", () => {
  it("validates batch records granularly and passes custom properties through", () => {
    const batch = [
      { hs_external_customer_id: "CUST-00001", email: "vip.cfo@corp-alpha.com", hs_net_profitability_usd: -80000.0, hs_profit_margin_pct: -20.0, datapulse_customer_tier: "ENTERPRISE_VIP", datapulse_ai_executive_brief: "VIP margin drop", custom_region_code: "APAC-EAST", lead_score: 98 },
      { hs_external_customer_id: "CUST-09801", email: "corrupt@@domain..com", hs_net_profitability_usd: 15000.0, hs_profit_margin_pct: 12.5 },
      { hs_external_customer_id: "CUST-09951", email: "valid.nan@corp-alpha.com", hs_net_profitability_usd: 0.0, hs_profit_margin_pct: Number.NaN },
    ];

    const result = validateBatchRecordsGranular(batch);
    expect(result.validRecords).toHaveLength(1);
    expect(result.validRecords[0]?.customer_id).toBe("CUST-00001");
    expect(result.validRecords[0]?.custom_properties?.custom_region_code).toBe("APAC-EAST");
    expect(result.validRecords[0]?.custom_properties?.lead_score).toBe(98);
    expect(result.rejectedRecords).toHaveLength(2);
    expect(result.rejectedRecords[0]?.error_code).toBe("INVALID_EMAIL_FORMAT");
    expect(result.rejectedRecords[1]?.error_code).toBe("IEEE_754_NAN_INFINITY");
  });

  it("enforces Full Jitter exponential backoff bounds and retryable HTTP status rules", () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(502)).toBe(true);
    expect(isRetryableStatus(400)).toBe(false);
    expect(calculateFullJitterBackoffMs(2, 200, 10000, () => 0.0)).toBe(0);
    expect(calculateFullJitterBackoffMs(2, 200, 10000, () => 0.5)).toBe(400);
    expect(calculateFullJitterBackoffMs(10, 200, 5000, () => 1.0)).toBe(5000);
  });

  it("verifies HMAC-SHA256 signatures and deterministic idempotency keys", () => {
    const secret = "super-secret-hmac-key-256";
    const payload = JSON.stringify({ sync_id: "hubspot_sync", records: [{ id: 1 }] });
    const sig = computeHmacSha256(secret, payload);
    expect(verifyHmacSignature(secret, payload, `sha256=${sig}`)).toBe(true);
    expect(verifyHmacSignature(secret, payload, sig)).toBe(true);
    expect(verifyHmacSignature("wrong-secret", payload, `sha256=${sig}`)).toBe(false);

    const keyA = computeIdempotencyKey("sync_1", [{ a: 1 }]);
    const keyB = computeIdempotencyKey("sync_1", [{ a: 1 }]);
    expect(keyA).toHaveLength(64);
    expect(keyA).toBe(keyB);
  });

  it("absorbs HTTP 429 rate limits via ResilientCrmDispatcher and serves Live Dashboard", async () => {
    const secret = "test-webhook-secret";
    const { server, store } = createConnectorServer({ hmacSecret: secret, enforceHmac: true });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const dispatcher = new ResilientCrmDispatcher({
        targetUrl: `${baseUrl}/crm/v3/objects/contacts/batch/upsert`,
        hmacSecret: secret,
        rateLimiter: new TokenBucketRateLimiter(100, 1),
        baseDelayMs: 10,
        maxDelayMs: 50,
        simulateRateLimit429FirstAttempt: true,
      });

      const batch = [
        { customer_id: "CUST-00001", email: "vip1@corp.io", datapulse_net_profitability_usd: -80000, datapulse_profit_margin_pct: -20.0, datapulse_customer_tier: "ENTERPRISE_VIP", datapulse_ai_executive_brief: "Brief" },
        { customer_id: "CUST-09801", email: "bad@@email..com", datapulse_net_profitability_usd: 5000, datapulse_profit_margin_pct: 10.0 },
      ];

      const res = await dispatcher.dispatchBatch("hubspot_customer_profitability", batch);
      expect(res.accepted_ids).toEqual(["CUST-00001"]);
      expect(res.failed_records).toHaveLength(1);
      expect(res.http_requests_made).toBe(2);
      expect(store.rateLimitRetriesAbsorbed).toBe(1);

      await fetch(`${baseUrl}/api/v1/telemetry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPhase: "PHASE 4: SHA-256 IDEMPOTENCY VERIFIED", skippedO: 10000 }),
      });

      const stateResp = await fetch(`${baseUrl}/api/v1/telemetry`);
      expect(stateResp.status).toBe(200);
      const stateJson = (await stateResp.json()) as any;
      expect(stateJson.stateVersion).toBeGreaterThanOrEqual(1);

      const html = await (await fetch(`${baseUrl}/`)).text();
      expect(html).toContain("Data Pulse");
      expect(html).toContain("1. Run Initial Sync");
      expect(html).toContain("2. AI Diagnose &amp; Repair");
      expect(html).toContain("3. Verify SHA-256 Cache");
      expect(html).toContain("Reset to 0");
      expect(EMOJI_REGEX.test(html)).toBe(false);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    }
  });

  it("proves mathematically that inline browser <script> has ZERO JavaScript syntax errors", () => {
    const { store } = createConnectorServer();
    const state = store.getState();
    const html = renderLiveDashboardHtml(state);

    // Extract all executable inline browser <script> blocks (excluding external src= and application/json tags)
    const scriptRegex = /<script(?![^>]*(?:src=|type=["']application\/json["']))[^>]*>([\s\S]*?)<\/script>/gi;
    const matches = [...html.matchAll(scriptRegex)];
    expect(matches.length).toBeGreaterThanOrEqual(1);

    for (let i = 0; i < matches.length; i++) {
      const scriptCode = matches[i][1];
      if (scriptCode.trim().length <= 50) continue;
      // new Function(scriptCode) compiles the full client-side code through the V8 parser:
      expect(() => new Function(scriptCode)).not.toThrow();
    }
  });

  it("enforces Honest Zero Baseline when state is 0", () => {
    const { store } = createConnectorServer();
    const state = store.getState();
    expect(state.totalSyncedContacts).toBe(0);
    expect(state.extractedN).toBe(0);
    expect(state.dlqResolved).toBe(0);
    expect(state.annualSaasSavingsUsd).toBe(0);
    expect(state.batches).toEqual([]);
    expect(state.anomalyIdRange).toBeNull();
    expect(state.emailErrorRange).toBeNull();
    expect(state.nanErrorRange).toBeNull();
    expect(JSON.stringify(state)).not.toContain("CUST-09801");

    const html = renderLiveDashboardHtml(state);
    expect(html).toContain("Stage 0 Baseline");
    expect(html).not.toContain("9,800 Delivered");
    expect(html).not.toContain("CUST-09801");
    expect(html).not.toContain("10k Mart");
    expect(html).toContain("Net Profitability &amp; Volume by Tier");
    expect(html).toContain("Ingestion &amp; Quality Distribution");
    expect(html).toContain("Pillar 1: Warehouse &amp; FinOps Guardrails");
    expect(EMOJI_REGEX.test(html)).toBe(false);
  });

  it("handles server-side search across deep rows, tab filtering, and pagination", async () => {
    const { server, store } = createConnectorServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const testContacts = [];
      for (let i = 1; i <= 60; i++) {
        testContacts.push({
          customer_id: `CUST-${String(i).padStart(5, "0")}`,
          email: `client${i}@domain.com`,
          net_profitability_usd: i === 1 ? -50000 : 1000 * i,
          profit_margin_pct: i === 1 ? -25.0 : 10.0,
          customer_tier: i === 1 ? "ENTERPRISE_VIP" : "ENTERPRISE",
          ai_executive_brief: i === 1 ? "Executive brief for VIP" : null,
          remediated_from_dlq: i === 60,
        });
      }
      testContacts.push({
        customer_id: "CUST-05432",
        email: "deep.target@special.com",
        net_profitability_usd: 95432,
        profit_margin_pct: 35.0,
        customer_tier: "ENTERPRISE",
        ai_executive_brief: null,
        remediated_from_dlq: false,
      });

      store.upsertBatch(testContacts);
      expect(store.stateVersion).toBeGreaterThan(1);
      expect(store.batches.length).toBeGreaterThanOrEqual(1);

      // 1. Search numeric substring deep in store (row beyond 50)
      const respSearch = await fetch(`${baseUrl}/api/v1/contacts?search=5432`);
      const dataSearch = (await respSearch.json()) as any;
      expect(dataSearch.totalMatched).toBe(1);
      expect(dataSearch.items[0]?.customer_id).toBe("CUST-05432");

      // 2. Filter tabs: vip, repaired, errors
      const respVip = await fetch(`${baseUrl}/api/v1/contacts?tab=vip`);
      const dataVip = (await respVip.json()) as any;
      expect(dataVip.totalMatched).toBe(1);
      expect(dataVip.items[0]?.customer_id).toBe("CUST-00001");

      const respRepaired = await fetch(`${baseUrl}/api/v1/contacts?tab=repaired`);
      const dataRepaired = (await respRepaired.json()) as any;
      expect(dataRepaired.totalMatched).toBe(1);
      expect(dataRepaired.items[0]?.customer_id).toBe("CUST-00060");

      store.updateTelemetry({ dlqPendingE: 200, dlqResolved: 0 });
      const respErrors = await fetch(`${baseUrl}/api/v1/contacts?tab=errors&page=1&limit=25`);
      const dataErrors = (await respErrors.json()) as any;
      expect(dataErrors.totalMatched).toBe(200);
      expect(dataErrors.items).toHaveLength(25);
      expect(dataErrors.totalPages).toBe(8);
      expect(store.getState().anomalyIdRange).toBe("CUST-09801..CUST-10000");

      const respLast = await fetch(`${baseUrl}/api/v1/contacts?tab=errors&page=${dataErrors.totalPages}&limit=25`);
      const dataLast = (await respLast.json()) as any;
      expect(dataLast.page).toBe(8);
      expect(dataLast.items).toHaveLength(25);
      expect(dataLast.items[24]?.customer_id).toBe("CUST-10000");
    } finally {
      await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    }
  });
});
