# ADR-008: Four-Gate CI/CD Pipeline & Multi-Stage Immutable Container Publishing

## Status
Accepted (2026-10-29) — Enforced via `.github/workflows/ci-quality-gates.yml` & `infra/docker/Dockerfile.*`

## Context
- Polyglot data platforms combining Python 3.12 engines, TypeScript/Node 20 microservices, Snowflake SQL DDL, and operational runbooks frequently suffer from unverified cross-language HTTP contracts in CI.
- Single-stage Dockerfiles running as `root` with mutable `:latest`-only container tags risk container privilege escalation, `.env`/`.duckdb` artifact leakage, and non-deterministic production rollbacks.

## Decision
We enforce a 4-Gate GitHub Actions quality pipeline (`.github/workflows/ci-quality-gates.yml`) and multi-stage non-root container builds:
1. **Gate 1 (Python Quality, Static Types & Governance):** Enforces `ruff check` (`E,F,I,B,UP,S`), `mypy --strict core-engine/src`, and `pytest` across all 38 unit, FinOps, OPSEC, and documentation completeness tests.
2. **Gate 2 (TypeScript Strict Compilation & Vitest):** Enforces `npm --prefix connectors-ts run typecheck` (`tsc --noEmit`) and `npm --prefix connectors-ts test` (Zod contracts, HMAC-SHA256, Full-Jitter backoff).
3. **Gate 3 (Live Cross-Language Chaos Drill):** Executes `python -m pytest tests/test_step7_live_incident_drill.py -v`, spawning the real Node.js HTTP server and Python engine end-to-end across all 4 drill phases (`9,800 -> 200 DLQ -> 10,000 -> 0 HTTP requests`).
4. **Gate 4 (Immutable Dual-Tag Container Publishing):** Builds `Dockerfile.engine` (`python:3.12-slim`, non-root `datapulse:10001`) and `Dockerfile.connector` (`node:20-alpine`, non-root `node`), pushing both `:latest` and immutable `:sha-<git_commit>` tags to Docker Hub and GHCR (`if: github.event_name == 'push' && github.ref == 'refs/heads/main'`).
- **Rejected Alternatives:**
  - *Skipping live HTTP integration tests in CI:* Rejected because unit mocks miss cross-language serialization and HMAC drift.
  - *Single-stage `:latest`-only Docker images:* Rejected due to image bloat and lack of rollback tags.

## Consequences
- **Positive:**
  - Zero regressions can merge to `main` without passing static types, FinOps SQL checks, Zero-Kilometer OPSEC checks, and the 10,000-row live cross-language drill.
  - `:sha-<commit>` tags enable deterministic 1-command rollbacks documented in Runbook `08`.
- **Negative / Operational Trade-offs:**
  - Running Gate 3 spawns a real Node.js child process during CI (~12s total workflow test runtime).
  - Docker Hub publishing requires `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` repository secrets.
