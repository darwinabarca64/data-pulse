# ADR-000: Local Container Resource Governance on Windows WSL2 Hosts

## Status
Accepted

## Context
Running the DataPulse stack (Apache Airflow, PostgreSQL, DuckDB Python Engine, and TypeScript Connectors) inside Docker Desktop on Windows 10 WSL2 without explicit resource bounds causes `vmmem` to consume up to 80% of host physical RAM and expands sparse virtual disks (`ext4.vhdx`) on the primary `C:` volume until host OS exhaustion occurs.

## Decision
We enforce strict host-level WSL2 resource caps via `.wslconfig` (`memory=6GB` to `8GB`, `processors=4`, `swap=2GB`) and mandate an automated pre-flight hardware and disk volume audit prior to stack initialization. When `C:` free capacity falls below 25 GB, Docker Desktop virtual disk storage must be relocated to a secondary non-system volume (`D:\DockerData` or `E:\DockerData`).

## Consequences
Host OS stability is preserved during heavy Reverse ETL batch runs and Airflow DAG execution. Container memory over-allocation fails fast with deterministic OOM signals rather than degrading the Windows host kernel or exhausting primary system drive storage.

