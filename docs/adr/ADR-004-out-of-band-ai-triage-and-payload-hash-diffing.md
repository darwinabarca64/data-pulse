# ADR-004: Out-of-Band AI DLQ Triage and SHA-256 Payload Hash Diffing

## Status
Accepted

## Context
Invoking external LLM APIs inside hot Reverse ETL batch ingestion loops introduces non-deterministic latency (500ms-2s per row), token cost explosion, and rate-limit failures. Additionally, full dbt table rebuilds advance `updated_at` timestamps across all rows, causing naive watermark pipelines to re-dispatch unchanged records to SaaS CRM APIs.

## Decision
We prohibit external LLM calls inside the ingestion loop. VIP Executive Action Briefs (`ENTERPRISE_VIP` with margin `<= -10.0%`) are synthesized deterministically in memory (`< 0.01ms`). Validated records are compared against stored SHA-256 canonical digests (`audit.data_pulse_state_hashes`) to skip unchanged rows before HTTP dispatch. `AIDLQDoctor` runs strictly out-of-band over aggregated error groups (1 anonymized sample per `error_code`).

## Consequences
Batch ingestion remains `O(1)` in memory and deterministic in latency. SHA-256 payload diffing eliminates up to 100% of redundant HTTP API calls on unchanged lookback windows, while out-of-band DLQ triage produces actionable SQL fixes without exposing PII.

