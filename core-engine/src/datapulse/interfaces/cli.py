"""Universal CLI entrypoint for DataPulse Reverse ETL Engine."""

import argparse
import os
import sys
import urllib.error
import urllib.request
from collections.abc import Sequence
from pathlib import Path

from datapulse.application.dlq_use_case import ManageDLQUseCase
from datapulse.application.sync_use_case import ExecuteSyncUseCase
from datapulse.domain.ports import DestinationConnectorPort
from datapulse.infrastructure.adapter_factory import create_warehouse_adapter
from datapulse.infrastructure.alert_dispatcher import MultiChannelAlertDispatcher
from datapulse.infrastructure.duckdb_adapter import DuckDBWarehouseAdapter
from datapulse.infrastructure.http_connector_client import (
    HttpDestinationConnector,
    InMemoryMockDestinationConnector,
)
from datapulse.infrastructure.manifest_loader import load_sync_manifest
from datapulse.infrastructure.seeder import seed_duckdb_warehouse

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def _load_dotenv_if_present(dotenv_path: Path | None = None) -> None:
    """Load key=value pairs from .env into os.environ via setdefault (zero external deps)."""
    candidate = dotenv_path or Path(".env")
    if not candidate.is_file():
        return
    try:
        for raw_line in candidate.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            clean_key = key.strip()
            clean_val = val.strip().strip("'").strip('"')
            if clean_key:
                os.environ.setdefault(clean_key, clean_val)
    except OSError:
        return


def _is_demo_seed_enabled(no_seed_flag: bool = False) -> bool:
    """Return True only if --no-seed is not set and DEMO_SEED_ENABLED != 'false'."""
    if no_seed_flag:
        return False
    env_val = os.environ.get("DEMO_SEED_ENABLED", "true").strip().lower()
    return env_val not in ("false", "0", "no", "off")


def _resolve_destination_connector(force_mock: bool = False) -> DestinationConnectorPort:
    """Select live HttpDestinationConnector if reachable, or fallback to InMemoryMock."""
    if force_mock:
        return InMemoryMockDestinationConnector()
    base_url = os.environ.get("HUBSPOT_API_BASE_URL", "http://localhost:3000").rstrip("/")
    try:
        req = urllib.request.Request(f"{base_url}/health", method="GET")
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            if int(resp.status) == 200:
                return HttpDestinationConnector(base_url=base_url)
    except (urllib.error.URLError, TimeoutError, OSError):
        pass
    print(
        f"[WARN] Live HTTP connector unreachable at {base_url}; "
        "falling back to InMemoryMockDestinationConnector"
    )
    return InMemoryMockDestinationConnector()


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="datapulse",
        description="DataPulse Enterprise Reverse ETL & FinOps Governance CLI",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # 1. datapulse init
    p_init = subparsers.add_parser("init", help="Initialize warehouse schemas and seed data")
    p_init.add_argument("--rows", type=int, default=10000, help="Number of deterministic rows")
    p_init.add_argument(
        "--no-seed",
        action="store_true",
        help="Provision empty governance schemas only (zero synthetic customer data)",
    )
    p_init.add_argument("--db-path", type=str, default=None, help="Optional DuckDB file path")

    # 2. datapulse validate
    p_val = subparsers.add_parser("validate", help="Validate declarative YAML sync manifest")
    p_val.add_argument("--manifest", type=str, required=True, help="Path to sync YAML manifest")
    p_val.add_argument("--db-path", type=str, default=None, help="Optional DuckDB file path")

    # 3. datapulse run
    p_run = subparsers.add_parser("run", help="Execute incremental Reverse ETL sync run")
    p_run.add_argument("--manifest", type=str, required=True, help="Path to sync YAML manifest")
    p_run.add_argument(
        "--no-seed",
        action="store_true",
        help="Disable synthetic customer seeding during run initialization",
    )
    p_run.add_argument(
        "--use-mock-destination",
        action="store_true",
        help="Force in-memory destination connector instead of HTTP server",
    )
    p_run.add_argument("--db-path", type=str, default=None, help="Optional DuckDB file path")

    # 4. datapulse dlq (inspect | replay)
    p_dlq = subparsers.add_parser("dlq", help="Dead-Letter Queue inspection and replay")
    dlq_sub = p_dlq.add_subparsers(dest="dlq_action", required=True)

    p_inspect = dlq_sub.add_parser("inspect", help="Run AI DLQ Doctor root-cause inspection")
    p_inspect.add_argument("--sync-id", type=str, required=True, help="Sync ID to inspect")
    p_inspect.add_argument("--db-path", type=str, default=None, help="Optional DuckDB file path")

    p_replay = dlq_sub.add_parser("replay", help="Auto-remediate and replay pending DLQ rows")
    p_replay.add_argument("--manifest", type=str, required=True, help="Path to sync YAML manifest")
    p_replay.add_argument(
        "--no-remediate",
        action="store_true",
        help="Replay raw payloads without deterministic remediation",
    )
    p_replay.add_argument(
        "--use-mock-destination",
        action="store_true",
        help="Force in-memory destination connector",
    )
    p_replay.add_argument("--db-path", type=str, default=None, help="Optional DuckDB file path")

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    """Execute the DataPulse CLI command and return POSIX exit code."""
    _load_dotenv_if_present()
    parser = _build_parser()
    args = parser.parse_args(argv)

    if args.command == "init":
        should_seed = _is_demo_seed_enabled(no_seed_flag=args.no_seed)
        adapter = create_warehouse_adapter(db_path=args.db_path, auto_seed=False)
        with adapter:
            adapter.ensure_governance_tables()
            if isinstance(adapter, DuckDBWarehouseAdapter) and should_seed:
                summary = seed_duckdb_warehouse(adapter.connection, total_rows=args.rows)
                print(
                    f"[OK] Initialized local warehouse with {summary['total_rows']:,} records "
                    f"(Clean: {summary['clean_rows']:,}, Poison Emails: {summary['poison_email_rows']}, "
                    f"Poison NaNs: {summary['poison_nan_rows']})"
                )
            else:
                print(
                    "[OK] Initialized governance tables in production mode "
                    "(0 synthetic records seeded)."
                )
        return 0

    if args.command == "validate":
        manifest = load_sync_manifest(args.manifest)
        adapter = create_warehouse_adapter(db_path=args.db_path, auto_seed=False)
        with adapter:
            adapter.ensure_governance_tables()
        print(
            f"[OK] Validated sync manifest '{manifest.sync_id}' "
            f"(table={manifest.source.target_table}, connector={manifest.destination.connector})"
        )
        return 0

    if args.command == "run":
        manifest = load_sync_manifest(args.manifest)
        adapter = create_warehouse_adapter(
            db_path=args.db_path, auto_seed=_is_demo_seed_enabled(no_seed_flag=args.no_seed)
        )
        destination = _resolve_destination_connector(force_mock=args.use_mock_destination)
        alerter = MultiChannelAlertDispatcher()
        with adapter:
            adapter.ensure_governance_tables()
            use_case = ExecuteSyncUseCase(
                warehouse=adapter, destination=destination, alerter=alerter
            )
            use_case.execute(manifest)
        return 0

    if args.command == "dlq":
        adapter = create_warehouse_adapter(db_path=args.db_path, auto_seed=False)
        with adapter:
            adapter.ensure_governance_tables()
            if args.dlq_action == "inspect":
                dlq_uc = ManageDLQUseCase(warehouse=adapter)
                diag = dlq_uc.inspect_pending(args.sync_id)
                print("=" * 72)
                print(f"[AI-DOCTOR] DLQ INSPECTION REPORT ({args.sync_id})")
                print("=" * 72)
                print(diag["formatted_summary"])
                print("=" * 72)
                return 0

            if args.dlq_action == "replay":
                manifest = load_sync_manifest(args.manifest)
                destination = _resolve_destination_connector(
                    force_mock=args.use_mock_destination
                )
                dlq_uc = ManageDLQUseCase(warehouse=adapter, destination=destination)
                result = dlq_uc.replay_pending(
                    sync_id=manifest.sync_id,
                    manifest=manifest,
                    apply_remediation=not args.no_remediate,
                )
                print(
                    f"[OK] DLQ Replay Summary ({manifest.sync_id}): "
                    f"total_pending={result['total_pending']}, "
                    f"remediated_and_synced={result['remediated_and_synced']}, "
                    f"remaining_pending={result['remaining_pending']}"
                )
                return 0

    return 1


if __name__ == "__main__":
    sys.exit(main())
