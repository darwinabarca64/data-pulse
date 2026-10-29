"""Factory for instantiating the configured WarehouseAdapterPort implementation."""

import os
from pathlib import Path

from datapulse.domain.ports import WarehouseAdapterPort
from datapulse.infrastructure.duckdb_adapter import DuckDBWarehouseAdapter
from datapulse.infrastructure.snowflake_adapter import SnowflakeWarehouseAdapter

SUPPORTED_ENGINES = {"duckdb_local", "snowflake"}


def create_warehouse_adapter(
    env_override: str | None = None,
    db_path: str | Path | None = None,
    auto_seed: bool = True,
) -> WarehouseAdapterPort:
    """Instantiate DuckDBWarehouseAdapter or SnowflakeWarehouseAdapter from SOURCE_ENGINE."""
    engine = (env_override or os.environ.get("SOURCE_ENGINE", "duckdb_local")).strip().lower()
    if engine not in SUPPORTED_ENGINES:
        raise ValueError(
            f"[ERROR] Unsupported SOURCE_ENGINE '{engine}'. "
            f"Allowed values: {sorted(SUPPORTED_ENGINES)}"
        )

    if engine == "duckdb_local":
        resolved_path = db_path or os.environ.get(
            "DUCKDB_DATABASE_PATH", "data/local_warehouse.duckdb"
        )
        return DuckDBWarehouseAdapter(db_path=resolved_path, auto_seed=auto_seed)

    return SnowflakeWarehouseAdapter()

