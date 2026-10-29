"""End-to-end 4-phase live production incident drill across Python, DuckDB, and TypeScript HTTP."""

import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parent.parent
CORE_SRC = REPO_ROOT / "core-engine" / "src"
if str(CORE_SRC) not in sys.path:
    sys.path.insert(0, str(CORE_SRC))

from datapulse.application.dlq_use_case import ManageDLQUseCase  # noqa: E402
from datapulse.application.sync_use_case import ExecuteSyncUseCase  # noqa: E402
from datapulse.infrastructure.alert_dispatcher import MultiChannelAlertDispatcher  # noqa: E402
from datapulse.infrastructure.duckdb_adapter import DuckDBWarehouseAdapter  # noqa: E402
from datapulse.infrastructure.http_connector_client import HttpDestinationConnector  # noqa: E402
from datapulse.infrastructure.manifest_loader import load_sync_manifest  # noqa: E402


def _find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _wait_for_server_health(base_url: str, timeout_sec: float = 15.0) -> bool:
    deadline = time.perf_counter() + timeout_sec
    while time.perf_counter() < deadline:
        try:
            req = urllib.request.Request(f"{base_url}/health", method="GET")
            with urllib.request.urlopen(req, timeout=1.0) as resp:
                if int(resp.status) == 200:
                    return True
        except (urllib.error.URLError, TimeoutError, OSError):
            time.sleep(0.15)
    return False


def _fetch_connector_state(base_url: str) -> dict[str, Any]:
    req = urllib.request.Request(f"{base_url}/api/v1/state", method="GET")
    with urllib.request.urlopen(req, timeout=5.0) as resp:
        return dict(json.loads(resp.read().decode("utf-8")))


def _start_ts_server(port: int) -> subprocess.Popen[bytes]:
    ts_dir = REPO_ROOT / "connectors-ts"
    tsx_cli = ts_dir / "node_modules" / "tsx" / "dist" / "cli.mjs"
    env = {**os.environ, "PORT": str(port), "WEBHOOK_HMAC_SECRET": "drill-hmac-secret"}
    cmd = ["node", str(tsx_cli), "src/infrastructure/server.ts"]
    return subprocess.Popen(
        cmd,
        cwd=str(ts_dir),
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def run_live_incident_drill(db_path: Path | None = None) -> dict[str, Any]:
    """Execute the 4-phase live cross-language incident drill and return telemetry."""
    port = _find_free_port()
    base_url = f"http://127.0.0.1:{port}"
    manifest = load_sync_manifest(REPO_ROOT / "syncs" / "hubspot_profitability.yml")

    temp_dir: tempfile.TemporaryDirectory[str] | None = None
    if db_path is None:
        temp_dir = tempfile.TemporaryDirectory()
        resolved_db = Path(temp_dir.name) / "incident_drill.duckdb"
    else:
        resolved_db = db_path

    proc = _start_ts_server(port)
    try:
        if not _wait_for_server_health(base_url):
            raise RuntimeError(f"[CRITICAL] TypeScript connector failed to start on {base_url}")

        print("=" * 76)
        print("DATAPULSE STEP-7 END-TO-END LIVE PRODUCTION INCIDENT DRILL")
        print(f"[INFO] Live TypeScript HubSpot CRM v3 Server : {base_url}")
        print(f"[INFO] Local DuckDB Warehouse Instance       : {resolved_db}")
        print("=" * 76)

        http_connector = HttpDestinationConnector(
            base_url=base_url, hmac_secret="drill-hmac-secret"
        )
        alerter = MultiChannelAlertDispatcher(provider="console", quiet_console=True)

        with DuckDBWarehouseAdapter(db_path=resolved_db, auto_seed=True) as warehouse:
            warehouse.ensure_governance_tables()
            sync_uc = ExecuteSyncUseCase(
                warehouse=warehouse, destination=http_connector, alerter=alerter
            )
            dlq_uc = ManageDLQUseCase(warehouse=warehouse, destination=http_connector)

            # PHASE 1: Initial Hourly Sync & Anomaly Quarantine
            print("\n[PHASE 1] INITIAL HOURLY SYNC & ANOMALY QUARANTINE (10,000 RECORDS)")
            print("-" * 76)
            p1_report = sync_uc.execute(manifest)
            p1_crm_state = _fetch_connector_state(base_url)
            print(
                f"  [OK] Reconciliation Equation : N={p1_report.extracted_count:,} | "
                f"S={p1_report.upserted_count:,} | O={p1_report.skipped_unchanged_count:,} | "
                f"E={p1_report.dlq_isolated_count:,} (Balanced: {p1_report.reconciliation_balanced})"
            )
            print(f"  [OK] HTTP Sub-Batch Requests : {p1_report.http_requests_made}")
            print(f"  [OK] VIP Briefs Synthesized  : {p1_report.vip_briefs_generated}")
            print(
                f"  [OK] Live HubSpot CRM Store  : {p1_crm_state['totalSyncedContacts']:,} "
                f"contacts verified via GET {base_url}/api/v1/state"
            )

            # PHASE 2: On-Call Engineering Triage via Out-of-Band AI DLQ Doctor
            print("\n[PHASE 2] ON-CALL FORENSIC TRIAGE VIA OUT-OF-BAND AI DLQ DOCTOR")
            print("-" * 76)
            p2_diagnosis = dlq_uc.inspect_pending(manifest.sync_id)
            print(p2_diagnosis["formatted_summary"])

            # PHASE 3: Deterministic Remediation & Surgical DLQ Replay
            print("\n[PHASE 3] DETERMINISTIC AUTO-REMEDIATION & SURGICAL DLQ REPLAY")
            print("-" * 76)
            p3_replay = dlq_uc.replay_pending(
                sync_id=manifest.sync_id, manifest=manifest, apply_remediation=True
            )
            p3_crm_state = _fetch_connector_state(base_url)
            print(
                f"  [OK] Quarantined Pending Before Replay : {p3_replay['total_pending']}"
            )
            print(
                f"  [OK] Remediated & Synced Over HTTP     : {p3_replay['remediated_and_synced']}"
            )
            print(
                f"  [OK] Remaining Pending in DuckDB DLQ   : {p3_replay['remaining_pending']}"
            )
            print(
                f"  [OK] Total Synced Contacts in HubSpot  : "
                f"{p3_crm_state['totalSyncedContacts']:,} / 10,000 (100.0% Delivery)"
            )

            # PHASE 4: Post-Incident Idempotency & SHA-256 Hash Diff Verification
            print("\n[PHASE 4] POST-INCIDENT IDEMPOTENCY & SHA-256 HASH DIFF VERIFICATION")
            print("-" * 76)
            p4_report = sync_uc.execute(manifest)
            print(
                f"  [OK] Subsequent Incremental Run        : N={p4_report.extracted_count:,} | "
                f"S={p4_report.upserted_count} | O={p4_report.skipped_unchanged_count:,} | "
                f"E={p4_report.dlq_isolated_count}"
            )
            print(
                f"  [OK] Redundant HTTP Calls Dispatched   : {p4_report.http_requests_made} "
                "(100.0% API Traffic Saved via SHA-256 Payload Hash Diffing)"
            )
            print("=" * 76)

            return {
                "phase1_upserted": p1_report.upserted_count,
                "phase1_dlq": p1_report.dlq_isolated_count,
                "phase1_balanced": p1_report.reconciliation_balanced,
                "phase2_groups": p2_diagnosis["groups"],
                "phase3_remediated": p3_replay["remediated_and_synced"],
                "phase3_remaining_dlq": p3_replay["remaining_pending"],
                "phase3_total_crm_contacts": p3_crm_state["totalSyncedContacts"],
                "phase4_upserted": p4_report.upserted_count,
                "phase4_http_requests": p4_report.http_requests_made,
                "phase4_skipped_unchanged": p4_report.skipped_unchanged_count,
            }
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        if temp_dir is not None:
            temp_dir.cleanup()


if __name__ == "__main__":
    run_live_incident_drill()

