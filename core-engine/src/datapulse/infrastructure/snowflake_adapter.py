"""Snowflake Cloud warehouse adapter with 2048-bit RSA Key-Pair authentication."""

import json
import os
from collections.abc import Iterator
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from datapulse.domain.models import CustomerProfitabilityRecord, DLQRecord
from datapulse.domain.ports import WarehouseAdapterPort
from datapulse.infrastructure.duckdb_adapter import CUSTOMER_COLUMNS


class SnowflakeWarehouseAdapter(WarehouseAdapterPort):
    """Production Snowflake adapter enforcing RSA key-pair auth and O(1) cursor batching."""

    def __init__(self, config_overrides: dict[str, str] | None = None) -> None:
        cfg = {**os.environ, **(config_overrides or {})}
        self._account = cfg.get("SNOWFLAKE_ACCOUNT", "")
        self._user = cfg.get("SNOWFLAKE_USER", "SVC_DATA_PULSE")
        self._role = cfg.get("SNOWFLAKE_ROLE", "ROLE_DATA_PULSE_SERVICE")
        self._warehouse = cfg.get("SNOWFLAKE_WAREHOUSE", "WH_DATA_PULSE_XS")
        self._database = cfg.get("SNOWFLAKE_DATABASE", "ANALYTICS_PROD")
        self._schema = cfg.get("SNOWFLAKE_SCHEMA", "MARTS")
        self._key_path = Path(cfg.get("SNOWFLAKE_PRIVATE_KEY_PATH", "infra/keys/rsa_key.p8"))
        self._passphrase = cfg.get("SNOWFLAKE_PRIVATE_KEY_PASSPHRASE", "")
        self._conn: Any = None

    def _load_private_key_bytes(self) -> bytes:
        """Load PKCS#8 RSA private key DER bytes for passwordless authentication."""
        if not self._key_path.is_file():
            raise FileNotFoundError(f"[ERROR] RSA private key not found: {self._key_path}")
        from cryptography.hazmat.backends import default_backend
        from cryptography.hazmat.primitives import serialization

        pem = self._key_path.read_text(encoding="utf-8").encode("utf-8")
        pwd = self._passphrase.encode("utf-8") if self._passphrase else None
        p_key = serialization.load_pem_private_key(pem, password=pwd, backend=default_backend())
        return p_key.private_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )

    def _require_conn(self) -> Any:
        if self._conn is None:
            raise RuntimeError("[ERROR] Snowflake connection is not open. Call connect() first.")
        return self._conn

    def connect(self) -> None:
        """Open authenticated Snowflake session via lazy-loaded snowflake.connector."""
        try:
            import snowflake.connector  # type: ignore[import-not-found]
        except ImportError as exc:
            raise RuntimeError("[ERROR] 'snowflake-connector-python' is required.") from exc
        self._conn = snowflake.connector.connect(
            account=self._account, user=self._user, private_key=self._load_private_key_bytes(),
            role=self._role, warehouse=self._warehouse, database=self._database, schema=self._schema,
        )

    def close(self) -> None:
        if self._conn is not None:
            self._conn.close()
            self._conn = None

    def _exec(self, sql: str, params: tuple[Any, ...] = ()) -> list[Any]:
        cur = self._require_conn().cursor()
        try:
            cur.execute(sql, params)
            return list(cur.fetchall()) if cur.description else []
        finally:
            cur.close()

    def ensure_governance_tables(self) -> None:
        db = self._database
        self._exec(
            f"CREATE TABLE IF NOT EXISTS {db}.AUDIT.DATA_PULSE_WATERMARKS ("
            "SYNC_ID VARCHAR(128) PRIMARY KEY, WATERMARK_TS TIMESTAMP_NTZ NOT NULL, "
            "RECORDS_PROCESSED NUMBER NOT NULL, UPDATED_AT TIMESTAMP_NTZ NOT NULL);"
        )
        self._exec(
            f"CREATE TABLE IF NOT EXISTS {db}.AUDIT.DATA_PULSE_STATE_HASHES ("
            "SYNC_ID VARCHAR(128) NOT NULL, RECORD_ID VARCHAR(64) NOT NULL, "
            "PAYLOAD_HASH VARCHAR(64) NOT NULL, UPDATED_AT TIMESTAMP_NTZ NOT NULL, "
            "PRIMARY KEY (SYNC_ID, RECORD_ID));"
        )
        self._exec(
            f"CREATE TABLE IF NOT EXISTS {db}.AUDIT.DATA_PULSE_DLQ ("
            "SYNC_ID VARCHAR(128) NOT NULL, RECORD_ID VARCHAR(64) NOT NULL, "
            "FAILED_AT TIMESTAMP_NTZ NOT NULL, STAGE VARCHAR(64) NOT NULL, "
            "ERROR_CODE VARCHAR(64) NOT NULL, ERROR_MESSAGE VARCHAR(1024) NOT NULL, "
            "RAW_PAYLOAD VARIANT NOT NULL, STATUS VARCHAR(32) NOT NULL, "
            "PRIMARY KEY (SYNC_ID, RECORD_ID));"
        )

    def get_high_watermark(self, sync_id: str) -> datetime | None:
        rows = self._exec(
            f"SELECT WATERMARK_TS FROM {self._database}.AUDIT.DATA_PULSE_WATERMARKS WHERE SYNC_ID = %s;",
            (sync_id,),
        )
        return rows[0][0] if rows else None

    def set_high_watermark(self, sync_id: str, watermark_ts: datetime, records_processed: int) -> None:
        now_utc = datetime.now(timezone.utc)
        self._exec(
            f"MERGE INTO {self._database}.AUDIT.DATA_PULSE_WATERMARKS t "
            "USING (SELECT %s AS s, %s AS w, %s AS r, %s AS u) src ON t.SYNC_ID = src.s "
            "WHEN MATCHED THEN UPDATE SET WATERMARK_TS = src.w, RECORDS_PROCESSED = src.r, UPDATED_AT = src.u "
            "WHEN NOT MATCHED THEN INSERT (SYNC_ID, WATERMARK_TS, RECORDS_PROCESSED, UPDATED_AT) "
            "VALUES (src.s, src.w, src.r, src.u);",
            (sync_id, watermark_ts, records_processed, now_utc),
        )

    def fetch_incremental_batches(
        self, target_table: str, watermark_column: str,
        effective_watermark: datetime | None, batch_size: int,
    ) -> Iterator[list[dict[str, Any]]]:
        cols = ", ".join(CUSTOMER_COLUMNS)
        cur = self._require_conn().cursor()
        try:
            if effective_watermark is not None:
                cur.execute(
                    f"SELECT {cols} FROM {target_table} WHERE {watermark_column} >= %s "
                    f"ORDER BY {watermark_column} ASC, customer_id ASC;",
                    (effective_watermark,),
                )
            else:
                cur.execute(f"SELECT {cols} FROM {target_table} ORDER BY {watermark_column} ASC, customer_id ASC;")
            while True:
                chunk = cur.fetchmany(batch_size)
                if not chunk:
                    break
                yield [dict(zip(CUSTOMER_COLUMNS, row)) for row in chunk]
        finally:
            cur.close()

    def get_stored_payload_hashes(self, sync_id: str, record_ids: list[str]) -> dict[str, str]:
        if not record_ids:
            return {}
        marks = ", ".join(["%s"] * len(record_ids))
        rows = self._exec(
            f"SELECT RECORD_ID, PAYLOAD_HASH FROM {self._database}.AUDIT.DATA_PULSE_STATE_HASHES "
            f"WHERE SYNC_ID = %s AND RECORD_ID IN ({marks});",
            (sync_id, *record_ids),
        )
        return {str(r[0]): str(r[1]) for r in rows}

    def upsert_payload_hashes(self, sync_id: str, hashes: dict[str, str]) -> None:
        if not hashes:
            return
        now_utc = datetime.now(timezone.utc)
        cur = self._require_conn().cursor()
        try:
            cur.executemany(
                f"MERGE INTO {self._database}.AUDIT.DATA_PULSE_STATE_HASHES t "
                "USING (SELECT %s AS s, %s AS r, %s AS h, %s AS u) src "
                "ON t.SYNC_ID = src.s AND t.RECORD_ID = src.r "
                "WHEN MATCHED THEN UPDATE SET PAYLOAD_HASH = src.h, UPDATED_AT = src.u "
                "WHEN NOT MATCHED THEN INSERT (SYNC_ID, RECORD_ID, PAYLOAD_HASH, UPDATED_AT) "
                "VALUES (src.s, src.r, src.h, src.u);",
                [(sync_id, rid, digest, now_utc) for rid, digest in hashes.items()],
            )
        finally:
            cur.close()

    def insert_dlq_records(self, records: list[DLQRecord]) -> None:
        if not records:
            return
        cur = self._require_conn().cursor()
        try:
            cur.executemany(
                f"INSERT INTO {self._database}.AUDIT.DATA_PULSE_DLQ "
                "(SYNC_ID, RECORD_ID, FAILED_AT, STAGE, ERROR_CODE, ERROR_MESSAGE, RAW_PAYLOAD, STATUS) "
                "VALUES (%s, %s, %s, %s, %s, %s, PARSE_JSON(%s), %s);",
                [(r.sync_id, r.record_id, r.failed_at, r.stage, r.error_code,
                  r.error_message, json.dumps(r.raw_payload, default=str), r.status) for r in records],
            )
        finally:
            cur.close()

    def fetch_pending_dlq_records(self, sync_id: str) -> list[DLQRecord]:
        rows = self._exec(
            f"SELECT SYNC_ID, RECORD_ID, FAILED_AT, STAGE, ERROR_CODE, ERROR_MESSAGE, RAW_PAYLOAD, STATUS "
            f"FROM {self._database}.AUDIT.DATA_PULSE_DLQ WHERE SYNC_ID = %s AND STATUS = 'PENDING' ORDER BY RECORD_ID ASC;",
            (sync_id,),
        )
        return [
            DLQRecord(
                sync_id=r[0], record_id=r[1], failed_at=r[2], stage=r[3],
                error_code=r[4], error_message=r[5],
                raw_payload=json.loads(r[6]) if isinstance(r[6], str) else dict(r[6]),
                status=r[7],
            )
            for r in rows
        ]

    def mark_dlq_resolved(self, sync_id: str, record_ids: list[str]) -> None:
        if not record_ids:
            return
        marks = ", ".join(["%s"] * len(record_ids))
        self._exec(
            f"UPDATE {self._database}.AUDIT.DATA_PULSE_DLQ SET STATUS = 'RESOLVED' "
            f"WHERE SYNC_ID = %s AND RECORD_ID IN ({marks});",
            (sync_id, *record_ids),
        )

    def apply_remediated_source_records(
        self, records: list[CustomerProfitabilityRecord]
    ) -> None:
        """No-op in Snowflake to preserve strict Principle of Least Privilege (read-only MARTS)."""
        return None
