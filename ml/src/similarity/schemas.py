"""Data contracts and schemas for the Well Similarity Engine."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class SimilarityWeights:
    """Configurable weights for multi-factor well similarity calculation."""

    geo_weight: float = 0.35
    formation_weight: float = 0.25
    depth_weight: float = 0.20
    event_weight: float = 0.20
    geo_decay_km: float = 10.0
    depth_tolerance_m: float = 150.0

    def __post_init__(self) -> None:
        total = self.geo_weight + self.formation_weight + self.depth_weight + self.event_weight
        if abs(total - 1.0) > 1e-4:
            raise ValueError(f"Similarity weights must sum to 1.0 (got {total:.4f})")


@dataclass
class OffsetEventSummary:
    """Summary of a relevant historical drilling event on an offset well."""

    event_id: str
    event_type: str
    depth_md: float | None
    formation: str | None
    severity: str | None
    description: str
    mitigation: str | None
    source_document: str
    source_page: int | None
    confidence: float


@dataclass
class SimilarWellMatch:
    """Similarity ranking result for a single candidate offset well."""

    well_id: str
    field_name: str | None
    latitude: float | None
    longitude: float | None
    distance_km: float | None
    overall_similarity: float
    geo_similarity: float
    formation_similarity: float
    depth_similarity: float
    event_similarity: float
    matched_events_count: int
    matched_events: list[OffsetEventSummary] = field(default_factory=list)
    risk_summary: str = ""

    def to_dict(self) -> dict[str, Any]:
        """Convert result to a JSON-serializable dictionary."""
        return asdict(self)


@dataclass
class WellSimilarityResponse:
    """Standardized API / ML contract response for well similarity queries."""

    active_well: str
    query_latitude: float | None = None
    query_longitude: float | None = None
    query_depth_md: float | None = None
    query_formation: str | None = None
    max_radius_km: float | None = None
    total_candidates_evaluated: int = 0
    similar_wells: list[SimilarWellMatch] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Convert entire response to JSON-serializable dictionary."""
        return asdict(self)
