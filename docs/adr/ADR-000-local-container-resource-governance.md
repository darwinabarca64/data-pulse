# ADR-000: Local Container & WSL2 Resource Governance

## Status
Accepted (2026-10-29) — Enforced via Automated Pre-Flight Hardware Audit (`scripts/preflight_hardware_audit.py`)

## Context
- Multi-container data engineering stacks (Apache Airflow 2.9, PostgreSQL 15, Python 3.12 Reverse-ETL Engine, and Node 20 TypeScript CRM Connector) on 8GB–16GB developer workstations frequently trigger host OS memory starvation.
- Unbounded WSL2 Linux kernels (`vmmem`) default to claiming up to 50% of host RAM (~8GB on a 16GB machine) for Linux page caches and expand sparse `ext4.vhdx` virtual disks on primary OS partitions (`C:`).

## Decision
We enforce a hard two-tier resource governance boundary before container orchestration:
1. **Host/WSL2 Boundary (`.wslconfig`):** Cap the WSL2 utility VM at `min(6GB, floor(Total_RAM * 0.40))` (`memory=6GB`, `processors=4`, `swap=2GB`, `localhostForwarding=true` on a 16GB/12-thread host).
2. **VHDX Disk Relocation:** Relocate Docker VHDX storage away from `C:` when secondary NVMe volumes (`D:`) have `>100GB` free space.
3. **Container Boundary (`docker-compose.yml`):** Enforce explicit `mem_limit` caps across all 4 services totaling `4.00GB` (`postgres: 512m`, `airflow-webserver: 1536m`, `airflow-scheduler: 1536m`, `connector-ts: 512m`), leaving a `2.00GB` kernel buffer inside the `6GB` WSL2 ceiling.
- **Rejected Alternatives:**
  - *Uncapped Docker Desktop defaults:* Rejected due to `vmmem` consuming >7.8GB RAM during Airflow DAG parsing.
  - *Local Kubernetes (`kind`/`minikube`):* Rejected for adding ~1.2GB control-plane overhead.

## Consequences
- **Positive:**
  - Guarantees >=10GB of physical RAM remains exclusively available to the host OS and IDE on a 16GB workstation, eliminating `OOMKilled` container crashes.
  - Cross-platform `scripts/preflight_hardware_audit.py` supports Win32 ctypes and POSIX (`/proc/meminfo`, `os.sysconf`) with `$USERPROFILE` and `$REPO_ROOT` path sanitization.
- **Negative / Operational Trade-offs:**
  - Concurrent heavy Spark/JVM workloads cannot run inside the same `6GB` WSL2 VM without raising `memory=` in `.wslconfig` and running `wsl --shutdown`.
  - Mitigated via Runbook `00` (`echo 3 > /proc/sys/vm/drop_caches` and `Optimize-VHD -Mode Full`).
