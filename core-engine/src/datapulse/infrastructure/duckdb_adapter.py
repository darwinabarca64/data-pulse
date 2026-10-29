"""DuckDB local warehouse adapter implementing WarehouseAdapterPort."""

import json
from collections.abc import Iterator
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import duckdb

from datapulse.domain.models import CustomerProfitabilityRecord, DLQRecord
from datapulse.domain.ports import WarehouseAdapterPort
from datapulse.infrastructure.seeder import ensure_source_table, seed_duckdb_warehouse

CUSTOMER_COLUMNS = (
    "customer_id", "email", "company_name", "country_code", "currency_code",
    "annual_revenue", "annual_cost", "net_profitability_usd",
    "profit_margin_pct", "customer_tier", "updated_at",
)


def normalize_duckdb_table_name(target_table: str) -> str:
    """Translate 3-part Snowflake table names (db.schema.table) to 2-part DuckDB names."""
    parts = [p.strip() for p in target_table.split(".") if p.strip()]
    return f"{parts[1]}.{parts[2]}" if len(parts) == 3 else target_table.strip()


def _to_naive_utc(dt: datetime) -> datetime:
    """Convert a datetime to naive UTC for DuckDB TIMESTAMP storage without pytz."""
    return dt.astimezone(timezone.utc).replace(tzinfo=None) if dt.tzinfo is not None else dt


def _to_aware_utc(dt: datetime) -> datetime:
    """Attach UTC tzinfo to a naive DuckDB TIMESTAMP."""
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


class DuckDBWarehouseAdapter(WarehouseAdapterPort):
    """Local high-speed analytical warehouse adapter backed by DuckDB."""

    def __init__(
        self, db_path: str | Path = "data/local_warehouse.duckdb", auto_seed: bool = True
    ) -> None:
        self._db_path = Path(db_path)
        self._auto_seed = auto_seed
        self._conn: duckdb.DuckDBPyConnection | None = None

    def _require_conn(self) -> duckdb.DuckDBPyConnection:
        if self._conn is None:
            raise RuntimeError("[ERROR] DuckDB connection is not open. Call connect() first.")
        return self._conn

    @property
    def connection(self) -> duckdb.DuckDBPyConnection:
        """Expose underlying DuckDB connection for diagnostics and seeding."""
        return self._require_conn()

    def connect(self) -> None:
        """Open DuckDB database file and create parent directories if needed."""
        if str(self._db_path) != ":memory:":
            self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = duckdb.connect(str(self._db_path))

    def close(self) -> None:
        """Close active DuckDB connection."""
        if self._conn is not None:
            self._conn.close()
            self._conn = None

    def ensure_governance_tables(self) -> None:
        """Initialize marts schema, audit state tables, and optional 10,000-row seed."""
        conn = self._require_conn()
        ensure_source_table(conn)
        conn.execute(
            """
            CREATE SCHEMA IF NOT EXISTS audit;
            CREATE TABLE IF NOT EXISTS audit.data_pulse_watermarks (
                sync_id VARCHAR NOT NULL PRIMARY KEY,
                watermark_ts TIMESTAMP NOT NULL,
                records_processed INTEGER NOT NULL,
                updated_at TIMESTAMP NOT NULL
            );
            CREATE TABLE IF NOT EXISTS audit.data_pulse_state_hashes (
                sync_id VARCHAR NOT NULL,
                record_id VARCHAR NOT NULL,
                payload_hash VARCHAR NOT NULL,
                updated_at TIMESTAMP NOT NULL,
                PRIMARY KEY (sync_id, record_id)
            );
            CREATE TABLE IF NOT EXISTS audit.data_pulse_dlq (
                sync_id VARCHAR NOT NULL,
                record_id VARCHAR NOT NULL,
                failed_at TIMESTAMP NOT NULL,
                stage VARCHAR NOT NULL,
                error_code VARCHAR NOT NULL,
                error_message VARCHAR NOT NULL,
                raw_payload VARCHAR NOT NULL,
                status VARCHAR NOT NULL,
                PRIMARY KEY (sync_id, record_id)
            );
            """
        )
        if self._auto_seed:
            seed_duckdb_warehouse(conn)

    def get_high_watermark(self, sync_id: str) -> datetime | None:
        """Read last committed watermark_ts for sync_id as UTC datetime."""
        row = self._require_conn().execute(
            "SELECT watermark_ts FROM audit.data_pulse_watermarks WHERE sync_id = ?;", [sync_id]
        ).fetchone()
        return _to_aware_utc(row[0]) if row else None

    def set_high_watermark(
        self, sync_id: str, watermark_ts: datetime, records_processed: int
    ) -> None:
        """Upsert high watermark timestamp for sync_id."""
        now_utc = _to_naive_utc(datetime.now(timezone.utc))
        self._require_conn().execute(
            "INSERT OR REPLACE INTO audit.data_pulse_watermarks "
            "(sync_id, watermark_ts, records_processed, updated_at) VALUES (?, ?, ?, ?);",
            [sync_id, _to_naive_utc(watermark_ts), records_processed, now_utc],
        )

    def fetch_incremental_batches(
        self,
        target_table: str,
        watermark_column: str,
        effective_watermark: datetime | None,
        batch_size: int,
    ) -> Iterator[list[dict[str, Any]]]:
        """Stream incremental records in O(1) memory chunks via cursor.fetchmany."""
        table_ref = normalize_duckdb_table_name(target_table)
        cols_sql = ", ".join(CUSTOMER_COLUMNS)
        cursor = self._require_conn().cursor()
        if effective_watermark is not None:
            sql = (
                f"SELECT {cols_sql} FROM {table_ref} WHERE {watermark_column} >= ? "
                f"ORDER BY {watermark_column} ASC, customer_id ASC;"
            )
            cursor.execute(sql, [_to_naive_utc(effective_watermark)])
        else:
            cursor.execute(
                f"SELECT {cols_sql} FROM {table_ref} ORDER BY {watermark_column} ASC, customer_id ASC;"
            )

        while True:
            chunk = cursor.fetchmany(batch_size)
            if not chunk:
                break
            batch_dicts: list[dict[str, Any]] = []
            for row in chunk:
                record = dict(zip(CUSTOMER_COLUMNS, row))
                if isinstance(record.get("updated_at"), datetime):
                    record["updated_at"] = _to_aware_utc(record["updated_at"])
                batch_dicts.append(record)
            yield batch_dicts

    def get_stored_payload_hashes(self, sync_id: str, record_ids: list[str]) -> dict[str, str]:
        """Retrieve existing SHA-256 payload hashes for record_ids."""
        if not record_ids:
            return {}
        marks = ", ".join(["?"] * len(record_ids))
        sql = (
            f"SELECT record_id, payload_hash FROM audit.data_pulse_state_hashes "
            f"WHERE sync_id = ? AND record_id IN ({marks});"
        )
        rows = self._require_conn().execute(sql, [sync_id, *record_ids]).fetchall()
        return {str(r[0]): str(r[1]) for r in rows}

    def upsert_payload_hashes(self, sync_id: str, hashes: dict[str, str]) -> None:
        """Bulk upsert SHA-256 payload hashes via parameterized multi-row VALUES."""
        if not hashes:
            return
        now_utc = _to_naive_utc(datetime.now(timezone.utc))
        placeholders = ", ".join(["(?, ?, ?, ?)"] * len(hashes))
        flat_params: list[Any] = []
        for rid, digest in hashes.items():
            flat_params.extend([sync_id, rid, digest, now_utc])
        self._require_conn().execute(
            f"INSERT OR REPLACE INTO audit.data_pulse_state_hashes "
            f"(sync_id, record_id, payload_hash, updated_at) VALUES {placeholders};",
            flat_params,
        )

    def insert_dlq_records(self, records: list[DLQRecord]) -> None:
        """Persist quarantined DLQRecord objects via parameterized multi-row VALUES."""
        if not records:
            return
        placeholders = ", ".join(["(?, ?, ?, ?, ?, ?, ?, ?)"] * len(records))
        flat_params: list[Any] = []
        for r in records:
            flat_params.extend([
                r.sync_id, r.record_id, _to_naive_utc(r.failed_at), r.stage,
                r.error_code, r.error_message, json.dumps(r.raw_payload, default=str), r.status,
            ])
        self._require_conn().execute(
            f"INSERT OR REPLACE INTO audit.data_pulse_dlq "
            f"(sync_id, record_id, failed_at, stage, error_code, error_message, raw_payload, status) "
            f"VALUES {placeholders};",
            flat_params,
        )

    def fetch_pending_dlq_records(self, sync_id: str) -> list[DLQRecord]:
        """Fetch all PENDING DLQRecord entries for sync_id."""
        rows = self._require_conn().execute(
            "SELECT sync_id, record_id, failed_at, stage, error_code, "
            "error_message, raw_payload, status FROM audit.data_pulse_dlq "
            "WHERE sync_id = ? AND status = 'PENDING' ORDER BY record_id ASC;",
            [sync_id],
        ).fetchall()
        return [
            DLQRecord(
                sync_id=r[0], record_id=r[1], failed_at=_to_aware_utc(r[2]), stage=r[3],
                error_code=r[4], error_message=r[5], raw_payload=json.loads(r[6]), status=r[7],
            )
            for r in rows
        ]

    def mark_dlq_resolved(self, sync_id: str, record_ids: list[str]) -> None:
        """Transition DLQ records from PENDING to RESOLVED."""
        if not record_ids:
            return
        marks = ", ".join(["?"] * len(record_ids))
        self._require_conn().execute(
            f"UPDATE audit.data_pulse_dlq SET status = 'RESOLVED' "
            f"WHERE sync_id = ? AND record_id IN ({marks});",
            [sync_id, *record_ids],
        )

    def apply_remediated_source_records(
        self, records: list[CustomerProfitabilityRecord]
    ) -> None:
        """Update local DuckDB simulation source rows inside a single transaction."""
        if not records:
            return
        params = [(rec.email, float(rec.profit_margin_pct), rec.customer_id) for rec in records]
        conn = self._require_conn()
        conn.execute("BEGIN TRANSACTION;")
        try:
            conn.executemany(
                "UPDATE marts.fct_customer_profitability "
                "SET email = ?, profit_margin_pct = ? WHERE customer_id = ?;",
                params,
            )
            conn.execute("COMMIT;")
        except Exception:
            conn.execute("ROLLBACK;")
            raise
