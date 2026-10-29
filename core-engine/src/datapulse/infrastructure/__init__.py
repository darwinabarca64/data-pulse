"""Infrastructure Layer: Concrete adapters for DuckDB, Snowflake, HTTP, DLQ, and Alerting."""

from datapulse.infrastructure.adapter_factory import create_warehouse_adapter
from datapulse.infrastructure.duckdb_adapter import DuckDBWarehouseAdapter
from datapulse.infrastructure.manifest_loader import load_sync_manifest
from datapulse.infrastructure.seeder import seed_duckdb_warehouse
from datapulse.infrastructure.snowflake_adapter import SnowflakeWarehouseAdapter

__all__ = [
    "DuckDBWarehouseAdapter",
    "SnowflakeWarehouseAdapter",
    "create_warehouse_adapter",
    "load_sync_manifest",
    "seed_duckdb_warehouse",
]


