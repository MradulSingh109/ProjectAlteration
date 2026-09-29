"""Validated data structures emitted by the information extraction stage."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone

from .taxonomy import EVENT_TYPES, SEVERITY_LEVELS


@dataclass
class ExtractedEvent:
    """A normalized event with its source provenance."""

    event_id: str
    well_id: str | None
    event_type: str
    depth_md: int | float | None
    depth_tvd: int | float | None
    formation: str | None
    severity: str | None
    description: str
    cause: str | None
    mitigation: str | None
    outcome: str | None
    source_document: str
    source_page: int | None
    confidence: float
    npt_hours: float | None = None
    source_section: str | None = None
    extraction_model: str = "nwis-rules-baseline-v1"
    extraction_timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(timespec="seconds")
    )
    evidence: list[dict] = field(default_factory=list)

    def __post_init__(self) -> None:
        if self.event_type not in EVENT_TYPES:
            raise ValueError(f"Unsupported event type: {self.event_type}")
        if self.severity is not None and self.severity not in SEVERITY_LEVELS:
            raise ValueError(f"Unsupported severity: {self.severity}")
        if self.npt_hours is not None and self.npt_hours < 0:
            raise ValueError("NPT duration cannot be negative")

    def to_dict(self) -> dict:
        """Convert the event to a JSON-serializable dictionary."""
        return asdict(self)
