"""Declarative YAML sync manifest domain models for DataPulse Reverse ETL."""

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SourceConfig(BaseModel):
    """Warehouse extraction configuration and high-watermark window parameters."""

    model_config = ConfigDict(extra="forbid")

    engine_env: str = Field(..., min_length=1)
    target_table: str = Field(..., min_length=1)
    watermark_column: str = Field(..., min_length=1)
    lookback_window_minutes: int = Field(default=15, ge=0)
    primary_key: str = Field(..., min_length=1)
    batch_size: int = Field(default=1000, ge=1, le=10000)


class AIEnrichmentConfig(BaseModel):
    """Configuration for out-of-band AI executive brief and DLQ triage rules."""

    model_config = ConfigDict(extra="forbid")

    enabled: bool = Field(default=True)
    executive_brief_threshold_margin_drop_pct: float = Field(default=-10.0)
    dlq_auto_triage: bool = Field(default=True)


class RateLimitConfig(BaseModel):
    """Token-bucket rate limit bounds for downstream SaaS API connectors."""

    model_config = ConfigDict(extra="forbid")

    max_requests: int = Field(default=100, gt=0)
    per_seconds: int = Field(default=10, gt=0)


class DestinationConfig(BaseModel):
    """Downstream SaaS destination connector and field mapping contract."""

    model_config = ConfigDict(extra="forbid")

    connector: str = Field(..., min_length=1)
    object_type: str = Field(..., min_length=1)
    operation: str = Field(..., min_length=1)
    idempotency_match_key: str = Field(..., min_length=1)
    rate_limit: RateLimitConfig = Field(default_factory=RateLimitConfig)
    field_mapping: dict[str, str]

    @field_validator("field_mapping")
    @classmethod
    def validate_non_empty_mapping(cls, value: dict[str, str]) -> dict[str, str]:
        """Ensure at least one source-to-destination field mapping is declared."""
        if not value:
            raise ValueError("field_mapping must contain at least one column mapping")
        for src_col, dst_prop in value.items():
            if not src_col.strip() or not dst_prop.strip():
                raise ValueError("field_mapping keys and values must be non-empty strings")
        return value


class SyncManifest(BaseModel):
    """Top-level declarative Reverse ETL sync contract loaded from syncs/*.yml."""

    model_config = ConfigDict(extra="forbid")

    version: str = Field(..., min_length=1)
    sync_id: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    schedule: str = Field(..., min_length=1)
    source: SourceConfig
    ai_enrichment: AIEnrichmentConfig = Field(default_factory=AIEnrichmentConfig)
    destination: DestinationConfig

