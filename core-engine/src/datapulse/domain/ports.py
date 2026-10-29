"""Abstract output ports defining Clean Architecture boundaries for DataPulse."""

from abc import ABC, abstractmethod
from collections.abc import Iterator
from datetime import datetime
from types import TracebackType
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from datapulse.domain.manifest import DestinationConfig
from datapulse.domain.models import DLQRecord


class BatchUpsertResult(BaseModel):
    """Result contract returned by a DestinationConnectorPort batch dispatch."""

    model_config = ConfigDict(extra="forbid")

    accepted_ids: list[str] = Field(default_factory=list)
    failed_records: list[dict[str, Any]] = Field(default_factory=list)
    http_requests_made: int = Field(default=0, ge=0)
    retries_triggered: int = Field(default=0, ge=0)


class WarehouseAdapterPort(ABC):
    """Port interface for analytical warehouse extraction and governance state."""

    def __enter__(self) -> "WarehouseAdapterPort":
        """Enter context manager and open warehouse connection."""
        self.connect()
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        """Exit context manager and close warehouse connection deterministically."""
        self.close()

    @abstractmethod
    def connect(self) -> None:
        """Establish a connection to the underlying analytical warehouse."""

    @abstractmethod
    def close(self) -> None:
        """Close the active warehouse connection and release resources."""

    @abstractmethod
    def ensure_governance_tables(self) -> None:
        """Provision source schemas/tables (if local) and the 3 audit governance tables."""

    @abstractmethod
    def get_high_watermark(self, sync_id: str) -> datetime | None:
        """Retrieve the last committed high-watermark timestamp for a sync_id."""

    @abstractmethod
    def set_high_watermark(
        self, sync_id: str, watermark_ts: datetime, records_processed: int
    ) -> None:
        """Upsert the high-watermark timestamp and processed count after a batch run."""

    @abstractmethod
    def fetch_incremental_batches(
        self,
        target_table: str,
        watermark_column: str,
        effective_watermark: datetime | None,
        batch_size: int,
    ) -> Iterator[list[dict[str, Any]]]:
        """Stream rows where watermark_column >= effective_watermark via fetchmany(batch_size)."""

    @abstractmethod
    def get_stored_payload_hashes(
        self, sync_id: str, record_ids: list[str]
    ) -> dict[str, str]:
        """Fetch previously committed SHA-256 payload hashes for the given record_ids."""

    @abstractmethod
    def upsert_payload_hashes(self, sync_id: str, hashes: dict[str, str]) -> None:
        """Upsert SHA-256 payload hashes after successful downstream delivery."""

    @abstractmethod
    def insert_dlq_records(self, records: list[DLQRecord]) -> None:
        """Persist quarantined DLQRecord entries into audit.data_pulse_dlq."""

    @abstractmethod
    def fetch_pending_dlq_records(self, sync_id: str) -> list[DLQRecord]:
        """Fetch all DLQRecord entries with status = 'PENDING' for a sync_id."""

    @abstractmethod
    def mark_dlq_resolved(self, sync_id: str, record_ids: list[str]) -> None:
        """Transition specified DLQ records from 'PENDING' to 'RESOLVED'."""


class DestinationConnectorPort(ABC):
    """Port interface for dispatching validated batches to downstream SaaS APIs."""

    @abstractmethod
    def send_batch(
        self,
        sync_id: str,
        records: list[dict[str, Any]],
        destination_config: DestinationConfig,
    ) -> BatchUpsertResult:
        """Send a bounded sub-batch of records to the destination connector."""


class AlertDispatcherPort(ABC):
    """Port interface for multi-channel operational and FinOps alerting."""

    @abstractmethod
    def dispatch_sync_report(self, report_text: str, payload: dict[str, Any]) -> bool:
        """Dispatch structured sync reconciliation and DLQ summary to alert channel."""
