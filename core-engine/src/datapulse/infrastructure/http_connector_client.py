"""HTTP destination connector client and in-memory loopback mock connector."""

import hashlib
import hmac
import json
import os
import random
import threading
import time
import urllib.error
import urllib.request
from typing import Any

from datapulse.domain.manifest import DestinationConfig
from datapulse.domain.ports import BatchUpsertResult, DestinationConnectorPort

RETRYABLE_HTTP_CODES = {429, 502, 503, 504}


class HttpDestinationConnector(DestinationConnectorPort):
    """HTTP client dispatching HMAC-signed batches with Idempotency-Key & Full-Jitter retry."""

    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        hmac_secret: str | None = None,
        timeout_seconds: float = 10.0,
        max_retries: int | None = None,
    ) -> None:
        self._base_url = (
            base_url or os.environ.get("HUBSPOT_API_BASE_URL", "http://localhost:3000")
        ).rstrip("/")
        self._api_key = api_key or os.environ.get("HUBSPOT_API_KEY", "")
        self._hmac_secret = hmac_secret or os.environ.get(
            "WEBHOOK_HMAC_SECRET", "default-hmac-secret"
        )
        self._timeout = timeout_seconds
        self._max_retries = (
            max_retries
            if max_retries is not None
            else int(os.environ.get("MAX_RETRY_ATTEMPTS", "3"))
        )

    def _compute_hmac_signature(self, body_bytes: bytes) -> str:
        """Compute HMAC-SHA256 hex signature for zero-trust webhook verification."""
        return hmac.new(
            self._hmac_secret.encode("utf-8"), body_bytes, hashlib.sha256
        ).hexdigest()

    def _compute_idempotency_key(self, sync_id: str, records: list[dict[str, Any]]) -> str:
        """Compute deterministic SHA-256 Idempotency-Key for batch deduplication."""
        ids = [str(r.get("customer_id", "")) for r in records]
        raw = json.dumps({"sync_id": sync_id, "record_ids": ids}, sort_keys=True)
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def send_batch(
        self,
        sync_id: str,
        records: list[dict[str, Any]],
        destination_config: DestinationConfig,
    ) -> BatchUpsertResult:
        """POST a batch of records with Full-Jitter Exponential Backoff on HTTP 429/5xx."""
        if not records:
            return BatchUpsertResult()

        endpoint = f"{self._base_url}/crm/v3/objects/{destination_config.object_type}/batch/upsert"
        payload = {
            "sync_id": sync_id,
            "idProperty": destination_config.idempotency_match_key,
            "inputs": [
                {
                    "id": str(r.get(destination_config.idempotency_match_key, "")),
                    "customer_id": str(r.get("customer_id", "")),
                    "properties": r.get("properties", r),
                }
                for r in records
            ],
        }
        body_bytes = json.dumps(payload).encode("utf-8")
        signature = self._compute_hmac_signature(body_bytes)
        idempotency_key = self._compute_idempotency_key(sync_id, records)

        http_requests_made = 0
        retries_triggered = 0

        for attempt in range(self._max_retries + 1):
            http_requests_made += 1
            req = urllib.request.Request(
                url=endpoint,
                data=body_bytes,
                headers={
                    "Content-Type": "application/json; charset=utf-8",
                    "Authorization": f"Bearer {self._api_key}",
                    "Idempotency-Key": idempotency_key,
                    "X-DataPulse-Signature": f"sha256={signature}",
                    "X-DataPulse-Sync-Id": sync_id,
                },
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=self._timeout) as resp:
                    resp_data = json.loads(resp.read().decode("utf-8"))
                    accepted = resp_data.get(
                        "accepted_ids", [str(r["customer_id"]) for r in records]
                    )
                    failed = resp_data.get("failed_records", [])
                    downstream_retries = int(resp_data.get("retries_triggered", 0))
                    return BatchUpsertResult(
                        accepted_ids=accepted,
                        failed_records=failed,
                        http_requests_made=http_requests_made,
                        retries_triggered=retries_triggered + downstream_retries,
                    )
            except urllib.error.HTTPError as exc:
                if exc.code in RETRYABLE_HTTP_CODES and attempt < self._max_retries:
                    retries_triggered += 1
                    sleep_sec = random.random() * min(2.0, 0.05 * (2**attempt))
                    time.sleep(sleep_sec)
                    continue
                return BatchUpsertResult(
                    accepted_ids=[],
                    failed_records=[
                        {**r, "error": f"HTTP {exc.code} rejection: {exc.reason}"}
                        for r in records
                    ],
                    http_requests_made=http_requests_made,
                    retries_triggered=retries_triggered,
                )
            except (urllib.error.URLError, TimeoutError, OSError) as exc:
                if attempt < self._max_retries:
                    retries_triggered += 1
                    sleep_sec = random.random() * min(2.0, 0.05 * (2**attempt))
                    time.sleep(sleep_sec)
                    continue
                return BatchUpsertResult(
                    accepted_ids=[],
                    failed_records=[
                        {**r, "error": f"HTTP transport failure: {exc}"} for r in records
                    ],
                    http_requests_made=http_requests_made,
                    retries_triggered=retries_triggered,
                )

        return BatchUpsertResult()


class InMemoryMockDestinationConnector(DestinationConnectorPort):
    """Thread-safe in-memory destination connector for fast isolated testing."""

    def __init__(self, fail_customer_ids: set[str] | None = None) -> None:
        self._fail_ids = fail_customer_ids or set()
        self._lock = threading.Lock()
        self.upserted_store: dict[str, dict[str, Any]] = {}
        self.total_http_calls: int = 0

    def send_batch(
        self,
        sync_id: str,
        records: list[dict[str, Any]],
        destination_config: DestinationConfig,
    ) -> BatchUpsertResult:
        """Simulate HubSpot CRM v3 batch upsert in memory with thread safety."""
        if not records:
            return BatchUpsertResult()

        accepted: list[str] = []
        failed: list[dict[str, Any]] = []

        with self._lock:
            self.total_http_calls += 1
            for rec in records:
                cid = str(rec.get("customer_id", "UNKNOWN"))
                if cid in self._fail_ids:
                    failed.append({**rec, "error": "Simulated downstream 422 rejection"})
                else:
                    self.upserted_store[cid] = rec
                    accepted.append(cid)

        return BatchUpsertResult(
            accepted_ids=accepted,
            failed_records=failed,
            http_requests_made=1,
            retries_triggered=0,
        )
