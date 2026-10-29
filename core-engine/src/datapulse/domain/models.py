"""Domain entities, Pydantic v2 data contracts, SHA-256 hash diffing, and DLQ models."""

import hashlib
import json
import math
from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

ALLOWED_CURRENCIES = {"USD", "EUR", "GBP"}


class CustomerTier(str, Enum):
    """Enterprise customer segmentation tiers."""

    SME = "SME"
    MID_MARKET = "MID_MARKET"
    ENTERPRISE = "ENTERPRISE"
    ENTERPRISE_VIP = "ENTERPRISE_VIP"


class DLQStage(str, Enum):
    """Pipeline execution stages where a record can be routed to the DLQ."""

    EXTRACTION = "EXTRACTION"
    CONTRACT_VALIDATION = "CONTRACT_VALIDATION"
    TRANSFORMATION = "TRANSFORMATION"
    DESTINATION_DISPATCH = "DESTINATION_DISPATCH"


class CustomerProfitabilityRecord(BaseModel):
    """Validated analytical customer profitability contract for Reverse ETL syncs."""

    model_config = ConfigDict(extra="forbid", validate_default=True)

    customer_id: str = Field(..., min_length=1)
    email: str = Field(..., min_length=3)
    company_name: str = Field(..., min_length=1)
    country_code: str = Field(..., min_length=2, max_length=2)
    currency_code: str = Field(..., min_length=3, max_length=3)
    annual_revenue: float
    annual_cost: float
    net_profitability_usd: float
    profit_margin_pct: float
    customer_tier: CustomerTier
    updated_at: datetime
    ai_executive_brief: str | None = None

    @field_validator(
        "annual_revenue",
        "annual_cost",
        "net_profitability_usd",
        "profit_margin_pct",
        mode="before",
    )
    @classmethod
    def reject_nan_and_infinity(cls, value: Any) -> float:
        """Reject IEEE-754 NaN and Infinity floats that violate RFC-8259 JSON."""
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError("Financial metric must be a valid numeric value")
        numeric_val = float(value)
        if math.isnan(numeric_val) or math.isinf(numeric_val):
            raise ValueError(
                "IEEE-754 NaN/Infinity values are forbidden by RFC-8259 JSON contract"
            )
        return numeric_val

    @field_validator("email")
    @classmethod
    def validate_email_rfc(cls, value: str) -> str:
        """Deterministically validate email structure without external regex engines."""
        cleaned = value.strip()
        if " " in cleaned or cleaned.count("@") != 1:
            raise ValueError("Invalid RFC email format")
        local_part, domain_part = cleaned.split("@")
        if not local_part or not domain_part or "." not in domain_part:
            raise ValueError("Invalid RFC email format")
        if domain_part.startswith(".") or domain_part.endswith(".") or ".." in cleaned:
            raise ValueError("Invalid RFC email format")
        return cleaned

    @field_validator("country_code")
    @classmethod
    def validate_country_code(cls, value: str) -> str:
        """Ensure 2-letter uppercase ISO-3166 alpha-2 country code."""
        code = value.strip()
        if len(code) != 2 or not code.isalpha() or not code.isupper():
            raise ValueError("country_code must be a 2-letter uppercase ISO-3166 code")
        return code

    @field_validator("currency_code")
    @classmethod
    def validate_currency_code(cls, value: str) -> str:
        """Ensure 3-letter uppercase ISO-4217 currency code in supported set."""
        code = value.strip()
        if code not in ALLOWED_CURRENCIES:
            raise ValueError(f"currency_code must be one of {sorted(ALLOWED_CURRENCIES)}")
        return code

    @field_validator("customer_id", "company_name")
    @classmethod
    def validate_non_blank_strings(cls, value: str) -> str:
        """Reject whitespace-only identifiers or company names."""
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Field cannot be empty or whitespace")
        return cleaned

    def compute_payload_hash(self) -> str:
        """Compute deterministic SHA-256 hex digest of canonical business payload."""
        canonical_payload = {
            "currency_code": self.currency_code,
            "customer_id": self.customer_id,
            "customer_tier": self.customer_tier.value,
            "email": self.email.lower(),
            "net_profitability_usd": round(self.net_profitability_usd, 4),
            "profit_margin_pct": round(self.profit_margin_pct, 4),
        }
        serialized = json.dumps(
            canonical_payload,
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
        )
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


class DLQRecord(BaseModel):
    """Dead-Letter Queue entity isolating a failed record without halting the batch."""

    model_config = ConfigDict(extra="forbid")

    sync_id: str = Field(..., min_length=1)
    record_id: str = Field(..., min_length=1)
    failed_at: datetime
    stage: str = Field(..., min_length=1)
    error_code: str = Field(..., min_length=1)
    error_message: str = Field(..., min_length=1)
    raw_payload: dict[str, Any]
    status: str = Field(default="PENDING", min_length=1)

