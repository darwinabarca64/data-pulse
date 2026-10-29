# ADR-003: Dual Warehouse Adapter Pattern and Deterministic 10,000-Row Seeding

## Status
Accepted

## Context
Evaluating an enterprise Reverse ETL engine should not require reviewers to provision a live Snowflake account or pay cloud compute credits. However, the local development engine must exercise the exact same SQL extraction contracts, `O(1)` memory batching (`fetchmany`), high-watermark state, and DLQ quarantine paths as production Snowflake.

## Decision
We define an abstract `WarehouseAdapterPort` in the domain layer with two interchangeable infrastructure implementations selected via `SOURCE_ENGINE`: `DuckDBWarehouseAdapter` (`duckdb_local`) and `SnowflakeWarehouseAdapter` (`snowflake`). Local initialization runs a deterministic (`random.Random(42)`) 10,000-record seeder containing 9,800 valid records (98.0%), 150 malformed email records (1.5%), and 50 IEEE-754 `NaN` margin records (0.5%).

## Consequences
Engineers and CI pipelines can run full 10,000-row Reverse ETL and DLQ quarantine benchmarks locally in under 1 second with zero cloud cost, while production deployments switch to Snowflake RSA Key-Pair execution via a single environment variable.

