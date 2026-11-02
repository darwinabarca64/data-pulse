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
  it("validates batch records granularly, isolating NaN and invalid email rows", () => {
    const batch = [
      {
        hs_external_customer_id: "CUST-00001",
        email: "vip.cfo@corp-alpha.com",
        hs_net_profitability_usd: -80000.0,
        hs_profit_margin_pct: -20.0,
        datapulse_customer_tier: "ENTERPRISE_VIP",
        datapulse_ai_executive_brief:
          "Action required for VIP account CUST-00001: operating margin dropped to -20.0%",
      },
      {
        hs_external_customer_id: "CUST-09801",
        email: "corrupt@@domain..com",
        hs_net_profitability_usd: 15000.0,
        hs_profit_margin_pct: 12.5,
      },
      {
        hs_external_customer_id: "CUST-09951",
        email: "valid.nan@corp-alpha.com",
        hs_net_profitability_usd: 0.0,
        hs_profit_margin_pct: Number.NaN,
      },
    ];

    const result = validateBatchRecordsGranular(batch);
    expect(result.validRecords).toHaveLength(1);
    expect(result.validRecords[0]?.customer_id).toBe("CUST-00001");
    expect(result.rejectedRecords).toHaveLength(2);
    expect(result.rejectedRecords[0]?.error_code).toBe("INVALID_EMAIL_FORMAT");
    expect(result.rejectedRecords[1]?.error_code).toBe("IEEE_754_NAN_INFINITY");
  });

  it("enforces Full Jitter exponential backoff bounds and retryable HTTP status rules", () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(502)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(504)).toBe(true);
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(401)).toBe(false);
    expect(isRetryableStatus(403)).toBe(false);
    expect(isRetryableStatus(422)).toBe(false);

    // Full Jitter formula: randomFn() * min(maxDelayMs, baseDelayMs * 2^attempt)
    const minDelay = calculateFullJitterBackoffMs(2, 200, 10000, () => 0.0);
    const midDelay = calculateFullJitterBackoffMs(2, 200, 10000, () => 0.5);
    const maxDelay = calculateFullJitterBackoffMs(2, 200, 10000, () => 1.0);
    const cappedDelay = calculateFullJitterBackoffMs(10, 200, 5000, () => 1.0);

    expect(minDelay).toBe(0);
    expect(midDelay).toBe(400); // 0.5 * (200 * 2^2 = 800)
    expect(maxDelay).toBe(800);
    expect(cappedDelay).toBe(5000);
  });

  it("verifies HMAC-SHA256 webhook signatures and deterministic idempotency keys", () => {
    const secret = "super-secret-hmac-key-256";
    const payload = JSON.stringify({ sync_id: "hubspot_sync", records: [{ id: 1 }] });
    const sig = computeHmacSha256(secret, payload);

    expect(verifyHmacSignature(secret, payload, `sha256=${sig}`)).toBe(true);
    expect(verifyHmacSignature(secret, payload, sig)).toBe(true);
    expect(verifyHmacSignature("wrong-secret", payload, `sha256=${sig}`)).toBe(false);
    expect(verifyHmacSignature(secret, payload, undefined)).toBe(false);

    const keyA = computeIdempotencyKey("sync_1", [{ a: 1 }]);
    const keyB = computeIdempotencyKey("sync_1", [{ a: 1 }]);
    expect(keyA).toHaveLength(64);
    expect(keyA).toBe(keyB);
  });

  it("absorbs HTTP 429 rate limits via ResilientCrmDispatcher and serves Live Dashboard", async () => {
    const secret = "test-webhook-secret";
    const { server, store } = createConnectorServer({
      hmacSecret: secret,
      enforceHmac: true,
    });

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

      const batchRecords = [
        {
          customer_id: "CUST-00001",
          email: "vip1@enterprise.io",
          datapulse_net_profitability_usd: -80000,
          datapulse_profit_margin_pct: -20.0,
          datapulse_customer_tier: "ENTERPRISE_VIP",
          datapulse_ai_executive_brief:
            "Action required for VIP account CUST-00001: operating margin dropped to -20.0%",
        },
        {
          customer_id: "CUST-09801",
          email: "bad@@email..com",
          datapulse_net_profitability_usd: 5000,
          datapulse_profit_margin_pct: 10.0,
        },
      ];

      const res = await dispatcher.dispatchBatch(
        "hubspot_customer_profitability",
        batchRecords
      );

      expect(res.accepted_ids).toEqual(["CUST-00001"]);
      expect(res.failed_records).toHaveLength(1);
      expect(res.http_requests_made).toBe(2); // Attempt 1 -> 429, Attempt 2 -> 200 OK
      expect(res.retries_triggered).toBe(1);
      expect(store.rateLimitRetriesAbsorbed).toBe(1);
      expect(store.getState().totalSyncedContacts).toBe(1);

      const telResp = await fetch(`${baseUrl}/api/v1/telemetry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPhase: "PHASE 4: SHA-256 IDEMPOTENCY VERIFIED", skippedO: 10000 }),
      });
      expect(telResp.status).toBe(200);

      const dashResp = await fetch(`${baseUrl}/`);
      expect(dashResp.status).toBe(200);
      const html = await dashResp.text();
      expect(html).toContain("DataPulse Reverse ETL");
      expect(html).toContain("Pillar 1: Warehouse &amp; FinOps Guardrails");
      expect(html).toContain("Pillar 2: Apache Airflow Thin DAG");
      expect(html).toContain("Pillar 3: Data Delivery Balance");
      expect(html).toContain("Pillar 4 (HubSpot CRM v3 Store)");
      expect(html).toContain("PHASE 4: SHA-256 IDEMPOTENCY VERIFIED");
      expect(html).toContain("[VIP-BRIEF]");
      expect(html).toContain("CUST-00001");
      expect(EMOJI_REGEX.test(html)).toBe(false);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      );
    }
  });
it("enforces Honest Zero Baseline when state is 0", () => {
    const { store } = createConnectorServer();
    const state = store.getState();
    expect(state.totalSyncedContacts).toBe(0);
    expect(state.dlqResolved).toBe(0);
    expect(state.annualSaasSavingsUsd).toBe(0);
    expect(state.extractedN).toBe(0);

    const html = renderLiveDashboardHtml(state);
    expect(html).toContain("Stage 0 Baseline");
    expect(html).not.toContain("9,800 Delivered");
    expect(html).not.toContain("200 Repaired");
    expect(html).toContain('d="M 50 190 L 880 190"');
    expect(EMOJI_REGEX.test(html)).toBe(false);
  });

  it("preserves all 11 columns and computes segment sums accurately", () => {
    const { store } = createConnectorServer();
    store.upsertBatch([
      {
        customer_id: "CUST-00001",
        email: "vip@corp.com",
        company_name: "MegaCorp",
        country_code: "US",
        annual_revenue: 120000,
        annual_cost: 150000,
        net_profitability_usd: -30000,
        profit_margin_pct: -25.0,
        customer_tier: "ENTERPRISE_VIP",
        remediated_from_dlq: false,
        ai_executive_brief: "VIP margin dropped",
      },
      {
        customer_id: "CUST-09801",
        email: "fixed@corp.com",
        company_name: "FixCo",
        country_code: "DE",
        annual_revenue: 80000,
        annual_cost: 40000,
        net_profitability_usd: 40000,
        profit_margin_pct: 50.0,
        customer_tier: "ENTERPRISE",
        remediated_from_dlq: true,
      },
    ]);

    const state = store.getState();
    expect(state.totalSyncedContacts).toBe(2);
    expect(state.vipBriefCount).toBe(1);
    expect(state.remediatedContactCount).toBe(1);

    const vip = state.contacts.find((c) => c.customer_id === "CUST-00001");
    expect(vip?.company).toBe("MegaCorp");
    expect(vip?.country).toBe("US");
    expect(vip?.annual_revenue).toBe(120000);
    expect(vip?.remediated_from_dlq).toBe(false);

    const healed = state.contacts.find((c) => c.customer_id === "CUST-09801");
    expect(healed?.company).toBe("FixCo");
    expect(healed?.country).toBe("DE");
    expect(healed?.remediated_from_dlq).toBe(true);

    expect(state.segmentBreakdown.ENTERPRISE_VIP.annual_revenue).toBe(120000);
    expect(state.segmentBreakdown.ENTERPRISE.annual_revenue).toBe(80000);
  });
});
