"""HTTP destination connector client and in-memory loopback mock connector."""

import hashlib
import hmac
import json
import os
import threading
import urllib.error
import urllib.request
from typing import Any

from datapulse.domain.manifest import DestinationConfig
from datapulse.domain.ports import BatchUpsertResult, DestinationConnectorPort


class HttpDestinationConnector(DestinationConnectorPort):
    """HTTP client dispatching HMAC-signed batches to the TypeScript Connector / HubSpot API."""

    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        hmac_secret: str | None = None,
        timeout_seconds: float = 10.0,
    ) -> None:
        self._base_url = (
            base_url or os.environ.get("HUBSPOT_API_BASE_URL", "http://localhost:3000")
        ).rstrip("/")
        self._api_key = api_key or os.environ.get("HUBSPOT_API_KEY", "")
        self._hmac_secret = hmac_secret or os.environ.get(
            "WEBHOOK_HMAC_SECRET", "default-hmac-secret"
        )
        self._timeout = timeout_seconds

    def _compute_hmac_signature(self, body_bytes: bytes) -> str:
        """Compute HMAC-SHA256 hex signature for zero-trust webhook verification."""
        return hmac.new(
            self._hmac_secret.encode("utf-8"), body_bytes, hashlib.sha256
        ).hexdigest()

    def send_batch(
        self,
        sync_id: str,
        records: list[dict[str, Any]],
        destination_config: DestinationConfig,
    ) -> BatchUpsertResult:
        """POST a batch of records to /crm/v3/objects/contacts/batch/upsert."""
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

        req = urllib.request.Request(
            url=endpoint,
            data=body_bytes,
            headers={
                "Content-Type": "application/json; charset=utf-8",
                "Authorization": f"Bearer {self._api_key}",
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
                retries = int(resp_data.get("retries_triggered", 0))
                return BatchUpsertResult(
                    accepted_ids=accepted,
                    failed_records=failed,
                    http_requests_made=1,
                    retries_triggered=retries,
                )
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            return BatchUpsertResult(
                accepted_ids=[],
                failed_records=[
                    {**r, "error": f"HTTP transport failure: {exc}"} for r in records
                ],
                http_requests_made=1,
                retries_triggered=0,
            )


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

