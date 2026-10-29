# ADR-002: Declarative YAML Sync Manifests and Pydantic v2 Payload Hash Diffing

## Status
Accepted

## Context
Hardcoding Reverse ETL source-to-destination field mappings inside Python pipelines tightly couples infrastructure to SaaS schemas. Furthermore, analytical warehouse marts frequently contain IEEE-754 `NaN`/`Infinity` floats or malformed emails that trigger HTTP 400 batch rejections downstream, and re-sending unchanged rows wastes SaaS API rate limits.

## Decision
We externalize all sync topologies into declarative YAML manifests (`syncs/*.yml`) validated via Pydantic v2 (`SyncManifest`). Every extracted row is validated through `CustomerProfitabilityRecord`, which strictly rejects `NaN`/`Infinity` and malformed emails, routing invalid records to `DLQRecord` without halting the batch. Valid records compute a canonical SHA-256 digest (`compute_payload_hash()`) to skip redundant downstream HTTP dispatches.

## Consequences
Adding or modifying a sync contract requires zero Python code changes. Corrupt warehouse records are deterministically quarantined prior to network I/O, and SHA-256 payload hash diffing eliminates redundant SaaS API calls across incremental runs.

