/**
 * Application Layer: Token Bucket Rate Limiter, Full Jitter Backoff, and Resilient Dispatcher.
 */

import {
  computeHmacSha256,
  computeIdempotencyKey,
  RejectedBatchRecord,
} from "../domain/contracts.js";

const RETRYABLE_HTTP_STATUSES = new Set<number>([429, 502, 503, 504]);

export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_HTTP_STATUSES.has(status);
}

export function calculateFullJitterBackoffMs(
  attempt: number,
  baseDelayMs: number = 200,
  maxDelayMs: number = 10000,
  randomFn: () => number = Math.random
): number {
  const safeAttempt = Math.max(0, Math.floor(attempt));
  const exponentialCap = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, safeAttempt));
  return randomFn() * exponentialCap;
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Math.ceil(ms))));
}

export class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefillTimestampMs: number;
  private readonly maxTokens: number;
  private readonly refillRatePerMs: number;

  constructor(maxRequests: number = 100, perSeconds: number = 10) {
    if (maxRequests <= 0 || perSeconds <= 0) {
      throw new Error("[ERROR] TokenBucketRateLimiter bounds must be > 0");
    }
    this.maxTokens = maxRequests;
    this.tokens = maxRequests;
    this.refillRatePerMs = maxRequests / (perSeconds * 1000);
    this.lastRefillTimestampMs = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsedMs = Math.max(0, now - this.lastRefillTimestampMs);
    if (elapsedMs > 0) {
      this.tokens = Math.min(
        this.maxTokens,
        this.tokens + elapsedMs * this.refillRatePerMs
      );
      this.lastRefillTimestampMs = now;
    }
  }

  public async acquireToken(): Promise<void> {
    this.refill();
    while (this.tokens < 1) {
      const deficit = 1 - this.tokens;
      const waitTimeMs = Math.ceil(deficit / this.refillRatePerMs);
      await sleepMs(Math.max(5, waitTimeMs));
      this.refill();
    }
    this.tokens -= 1;
  }

  public getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }
}

export interface BatchUpsertResponse {
  accepted_ids: string[];
  failed_records: RejectedBatchRecord[];
  http_requests_made: number;
  retries_triggered: number;
}

export interface ResilientDispatcherOptions {
  targetUrl: string;
  hmacSecret: string;
  rateLimiter?: TokenBucketRateLimiter;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  simulateRateLimit429FirstAttempt?: boolean;
}

export class ResilientCrmDispatcher {
  private readonly targetUrl: string;
  private readonly hmacSecret: string;
  private readonly rateLimiter: TokenBucketRateLimiter;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly simulate429: boolean;

  constructor(options: ResilientDispatcherOptions) {
    this.targetUrl = options.targetUrl;
    this.hmacSecret = options.hmacSecret;
    this.rateLimiter = options.rateLimiter ?? new TokenBucketRateLimiter(100, 10);
    this.maxRetries = options.maxRetries ?? 3;
    this.baseDelayMs = options.baseDelayMs ?? 50;
    this.maxDelayMs = options.maxDelayMs ?? 2000;
    this.simulate429 = options.simulateRateLimit429FirstAttempt ?? false;
  }

  public async dispatchBatch(
    syncId: string,
    records: unknown[]
  ): Promise<BatchUpsertResponse> {
    const idempotencyKey = computeIdempotencyKey(syncId, records);
    const bodyText = JSON.stringify({ sync_id: syncId, records });
    const signature = computeHmacSha256(this.hmacSecret, bodyText);

    let httpRequestsMade = 0;
    let retriesTriggered = 0;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      await this.rateLimiter.acquireToken();
      httpRequestsMade += 1;

      const headers: Record<string, string> = {
        "Content-Type": "application/json; charset=utf-8",
        "Idempotency-Key": idempotencyKey,
        "X-DataPulse-Signature": `sha256=${signature}`,
        "X-DataPulse-Sync-Id": syncId,
      };
      if (this.simulate429 && attempt === 0) {
        headers["X-Simulate-Rate-Limit-429"] = "true";
      }

      const response = await fetch(this.targetUrl, {
        method: "POST",
        headers,
        body: bodyText,
      });

      if (response.ok) {
        const parsed = (await response.json()) as BatchUpsertResponse;
        return {
          accepted_ids: parsed.accepted_ids ?? [],
          failed_records: parsed.failed_records ?? [],
          http_requests_made: httpRequestsMade,
          retries_triggered: retriesTriggered,
        };
      }

      if (isRetryableStatus(response.status) && attempt < this.maxRetries) {
        retriesTriggered += 1;
        const backoffMs = calculateFullJitterBackoffMs(
          attempt,
          this.baseDelayMs,
          this.maxDelayMs
        );
        await sleepMs(backoffMs);
        continue;
      }

      const errorBody = await response.text();
      throw new Error(
        `[ERROR] Permanent CRM HTTP ${response.status} failure after ${httpRequestsMade} requests: ${errorBody}`
      );
    }

    throw new Error("[ERROR] Exhausted max retry attempts in ResilientCrmDispatcher");
  }
}

