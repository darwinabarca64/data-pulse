/**
 * Infrastructure Layer: Mock HubSpot CRM v3 HTTP Server & Live Executive Monitor.
 */

import http, { IncomingMessage, Server, ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import { BatchUpsertResponse } from "../application/resilience.js";
import {
  NormalizedCrmContact,
  validateBatchRecordsGranular,
  verifyHmacSignature,
} from "../domain/contracts.js";
import { CrmStoreState, renderLiveDashboardHtml } from "./dashboard_view.js";

export interface ConnectorServerOptions {
  hmacSecret?: string;
  enforceHmac?: boolean;
}

export class CrmMemoryStore {
  private readonly contactsById = new Map<string, NormalizedCrmContact>();
  private readonly idempotencyCache = new Map<string, BatchUpsertResponse>();
  private readonly simulated429Keys = new Set<string>();
  public totalBatchRequests = 0;
  public rateLimitRetriesAbsorbed = 0;
  public rejectedRecordCount = 0;

  public upsertContacts(contacts: NormalizedCrmContact[]): string[] {
    const acceptedIds: string[] = [];
    for (const contact of contacts) {
      this.contactsById.set(contact.customer_id, contact);
      acceptedIds.push(contact.customer_id);
    }
    return acceptedIds;
  }

  public getCachedResponse(key: string): BatchUpsertResponse | undefined {
    return this.idempotencyCache.get(key);
  }

  public setCachedResponse(key: string, response: BatchUpsertResponse): void {
    this.idempotencyCache.set(key, response);
  }

  public shouldTriggerSimulated429(idempotencyKey: string): boolean {
    if (this.simulated429Keys.has(idempotencyKey)) {
      return false;
    }
    this.simulated429Keys.add(idempotencyKey);
    this.rateLimitRetriesAbsorbed += 1;
    return true;
  }

  public getState(): CrmStoreState {
    const allContacts = Array.from(this.contactsById.values());
    const vipCount = allContacts.filter((c) => Boolean(c.ai_executive_brief)).length;
    return {
      totalSyncedContacts: allContacts.length,
      vipBriefCount: vipCount,
      totalBatchRequests: this.totalBatchRequests,
      rateLimitRetriesAbsorbed: this.rateLimitRetriesAbsorbed,
      rejectedRecordCount: this.rejectedRecordCount,
      annualSaasSavingsUsd: 4170,
      contacts: allContacts,
    };
  }
}

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body, "utf-8"),
  });
  res.end(body);
}

export function createConnectorServer(options: ConnectorServerOptions = {}): {
  server: Server;
  store: CrmMemoryStore;
} {
  const store = new CrmMemoryStore();
  const hmacSecret =
    options.hmacSecret ?? process.env.WEBHOOK_HMAC_SECRET ?? "default-hmac-secret";
  const enforceHmac = options.enforceHmac ?? false;

  const server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const method = req.method ?? "GET";
    const urlObj = new URL(req.url ?? "/", "http://localhost");
    const pathname = urlObj.pathname;

    if (method === "GET" && pathname === "/") {
      const html = renderLiveDashboardHtml(store.getState());
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (method === "GET" && pathname === "/health") {
      sendJson(res, 200, { status: "[OK]", service: "datapulse-connectors-ts" });
      return;
    }

    if (method === "GET" && pathname === "/api/v1/state") {
      sendJson(res, 200, store.getState());
      return;
    }

    if (
      method === "POST" &&
      (pathname === "/crm/v3/objects/contacts/batch/upsert" ||
        pathname === "/api/v1/dispatch")
    ) {
      const rawBody = await readRequestBody(req);
      const sigHeader = req.headers["x-datapulse-signature"] as string | undefined;

      if (enforceHmac && !verifyHmacSignature(hmacSecret, rawBody, sigHeader)) {
        sendJson(res, 401, {
          status: "[ERROR]",
          message: "Invalid HMAC-SHA256 webhook signature",
        });
        return;
      }

      const idempotencyKey =
        (req.headers["idempotency-key"] as string | undefined) ?? "";
      const simulate429 =
        req.headers["x-simulate-rate-limit-429"] === "true" ||
        urlObj.searchParams.get("simulate429") === "true";

      if (simulate429 && store.shouldTriggerSimulated429(idempotencyKey || rawBody)) {
        sendJson(res, 429, {
          status: "[RATE-LIMIT]",
          message: "HTTP 429 Too Many Requests: HubSpot 10-second burst limit reached",
        });
        return;
      }

      if (idempotencyKey) {
        const cached = store.getCachedResponse(idempotencyKey);
        if (cached) {
          sendJson(res, 200, cached);
          return;
        }
      }

      let parsedBody: Record<string, unknown>;
      try {
        parsedBody = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        sendJson(res, 400, { status: "[ERROR]", message: "Malformed JSON body" });
        return;
      }

      const rawRecords = Array.isArray(parsedBody.inputs)
        ? parsedBody.inputs
        : Array.isArray(parsedBody.records)
          ? parsedBody.records
          : null;

      if (!rawRecords || rawRecords.length === 0 || rawRecords.length > 100) {
        sendJson(res, 400, {
          status: "[ERROR]",
          message: "Batch payload must contain between 1 and 100 records",
        });
        return;
      }

      store.totalBatchRequests += 1;
      const { validRecords, rejectedRecords } = validateBatchRecordsGranular(rawRecords);
      store.rejectedRecordCount += rejectedRecords.length;
      const acceptedIds = store.upsertContacts(validRecords);

      const responsePayload: BatchUpsertResponse = {
        accepted_ids: acceptedIds,
        failed_records: rejectedRecords,
        http_requests_made: 1,
        retries_triggered: 0,
      };

      if (idempotencyKey) {
        store.setCachedResponse(idempotencyKey, responsePayload);
      }
      sendJson(res, 200, responsePayload);
      return;
    }

    sendJson(res, 404, { status: "[ERROR]", message: "Endpoint not found" });
  });

  return { server, store };
}

const isMainModule =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  const port = Number(process.env.PORT ?? 3000);
  const { server } = createConnectorServer();
  server.listen(port, () => {
    console.log(
      `[OK] DataPulse TypeScript Connector & Live Monitor listening on http://localhost:${port}`
    );
  });
}

