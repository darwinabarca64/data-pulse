/**
 * Domain Layer: Zod runtime contracts, granular batch validation, and HMAC-SHA256 security.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const finiteNumberSchema = z.preprocess(
  (val) => (typeof val === "string" && val.trim() !== "" ? Number(val) : val),
  z.number().refine((n) => Number.isFinite(n), {
    message: "IEEE-754 NaN/Infinity values are forbidden by RFC-8259 JSON contract",
  })
);

export const HubSpotContactPropertiesSchema = z
  .object({
    email: z.string().trim().email("Invalid RFC email format"),
    hs_external_customer_id: z.string().trim().min(1).optional(),
    datapulse_customer_id: z.string().trim().min(1).optional(),
    customer_id: z.string().trim().min(1).optional(),
    hs_net_profitability_usd: finiteNumberSchema.optional(),
    datapulse_net_profitability_usd: finiteNumberSchema.optional(),
    net_profitability_usd: finiteNumberSchema.optional(),
    hs_profit_margin_pct: finiteNumberSchema.optional(),
    datapulse_profit_margin_pct: finiteNumberSchema.optional(),
    profit_margin_pct: finiteNumberSchema.optional(),
    company: z.string().optional(),
    country: z.string().optional(),
    hs_currency_code: z.string().optional(),
    datapulse_customer_tier: z.string().optional(),
    customer_tier: z.string().optional(),
    datapulse_ai_executive_brief: z.string().nullable().optional(),
    ai_executive_brief: z.string().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    const cid = data.hs_external_customer_id ?? data.datapulse_customer_id ?? data.customer_id;
    if (!cid || cid.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Missing required customer identifier (hs_external_customer_id)",
        path: ["hs_external_customer_id"],
      });
    }
    const netProf =
      data.hs_net_profitability_usd ?? data.datapulse_net_profitability_usd ?? data.net_profitability_usd;
    if (netProf === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Missing required net profitability metric",
        path: ["hs_net_profitability_usd"],
      });
    }
    const margin =
      data.hs_profit_margin_pct ?? data.datapulse_profit_margin_pct ?? data.profit_margin_pct;
    if (margin === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Missing required profit margin percentage",
        path: ["hs_profit_margin_pct"],
      });
    }
  });

export interface NormalizedCrmContact {
  customer_id: string;
  email: string;
  company: string;
  country: string;
  currency_code: string;
  net_profitability_usd: number;
  profit_margin_pct: number;
  customer_tier: string;
  ai_executive_brief: string | null;
  synced_at: string;
}

export interface RejectedBatchRecord {
  customer_id: string;
  error_code: string;
  error: string;
  raw_record: unknown;
}

export interface GranularValidationResult {
  validRecords: NormalizedCrmContact[];
  rejectedRecords: RejectedBatchRecord[];
}

export const DispatchBatchPayloadSchema = z.object({
  sync_id: z.string().trim().min(1),
  records: z.array(z.unknown()).min(1).max(100).optional(),
  inputs: z.array(z.unknown()).min(1).max(100).optional(),
});

function extractCandidateProps(item: unknown): Record<string, unknown> {
  if (typeof item !== "object" || item === null) return {};
  const obj = item as Record<string, unknown>;
  if (typeof obj.properties === "object" && obj.properties !== null) {
    return { ...obj, ...(obj.properties as Record<string, unknown>) };
  }
  return obj;
}

export function validateBatchRecordsGranular(records: unknown[]): GranularValidationResult {
  const validRecords: NormalizedCrmContact[] = [];
  const rejectedRecords: RejectedBatchRecord[] = [];
  const nowIso = new Date().toISOString();

  for (const rawItem of records) {
    const candidate = extractCandidateProps(rawItem);
    const fallbackId = String(
      candidate.hs_external_customer_id ?? candidate.datapulse_customer_id ?? candidate.customer_id ?? "UNKNOWN"
    );

    const parsed = HubSpotContactPropertiesSchema.safeParse(candidate);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message ?? "Contract validation failed";
      const errorCode = firstIssue.includes("email")
        ? "INVALID_EMAIL_FORMAT"
        : firstIssue.includes("NaN/Infinity") || firstIssue.includes("Expected number")
          ? "IEEE_754_NAN_INFINITY"
          : "SCHEMA_VALIDATION_ERROR";
      rejectedRecords.push({ customer_id: fallbackId, error_code: errorCode, error: firstIssue, raw_record: rawItem });
      continue;
    }

    const d = parsed.data;
    validRecords.push({
      customer_id: String(d.hs_external_customer_id ?? d.datapulse_customer_id ?? d.customer_id),
      email: d.email,
      company: d.company ?? "Enterprise Account",
      country: d.country ?? "US",
      currency_code: d.hs_currency_code ?? "USD",
      net_profitability_usd: Number(
        d.hs_net_profitability_usd ?? d.datapulse_net_profitability_usd ?? d.net_profitability_usd
      ),
      profit_margin_pct: Number(
        d.hs_profit_margin_pct ?? d.datapulse_profit_margin_pct ?? d.profit_margin_pct
      ),
      customer_tier: d.datapulse_customer_tier ?? d.customer_tier ?? "ENTERPRISE",
      ai_executive_brief: d.datapulse_ai_executive_brief ?? d.ai_executive_brief ?? null,
      synced_at: nowIso,
    });
  }

  return { validRecords, rejectedRecords };
}

export function computeHmacSha256(secret: string, body: string): string {
  return createHmac("sha256", Buffer.from(secret, "utf-8")).update(body, "utf-8").digest("hex");
}

export function verifyHmacSignature(secret: string, body: string, signatureHeader?: string): boolean {
  if (!signatureHeader) return false;
  const cleanSig = signatureHeader.startsWith("sha256=") ? signatureHeader.slice(7) : signatureHeader;
  const expectedHex = computeHmacSha256(secret, body);
  const sigBuf = Buffer.from(cleanSig, "utf-8");
  const expBuf = Buffer.from(expectedHex, "utf-8");
  if (sigBuf.length !== expBuf.length) return false;
  return timingSafeEqual(sigBuf, expBuf);
}

export function computeIdempotencyKey(syncId: string, records: unknown[]): string {
  return createHash("sha256").update(JSON.stringify({ syncId, records }), "utf-8").digest("hex");
}
