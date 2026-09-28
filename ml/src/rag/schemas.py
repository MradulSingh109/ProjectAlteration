"""Data contracts and schemas for RAG Knowledge Assistant (Roadmap Section 4.4)."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class RAGSourceReference:
    """Provenance citation matching Roadmap contract Section 4.4."""

    document_id: str
    page: int
    well_id: str | None = None
    section: str | None = None
    formation: str | None = None
    depth_md: float | None = None
    quote: str = ""

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "document_id": self.document_id,
            "page": self.page,
        }
        if self.well_id:
            d["well_id"] = self.well_id
        if self.section:
            d["section"] = self.section
        if self.depth_md is not None:
            d["depth_md"] = self.depth_md
        if self.formation:
            d["formation"] = self.formation
        if self.quote:
            d["quote"] = self.quote
        return d


@dataclass
class RAGChunk:
    """Enriched textual chunk with domain metadata for filtering and retrieval."""

    chunk_id: str
    text: str
    document_id: str
    page: int
    well_id: str | None = None
    section: str | None = None
    formation: str | None = None
    depth_min: float | None = None
    depth_max: float | None = None
    event_types: list[str] = field(default_factory=list)


@dataclass
class RAGQueryFilter:
    """Metadata filters for targeted retrieval."""

    well_id: str | None = None
    formation: str | None = None
    event_type: str | None = None
    min_depth: float | None = None
    max_depth: float | None = None
    nearby_well_id: str | None = None
    max_distance_km: float | None = None


@dataclass
class RAGResponse:
    """Standardized RAG output schema matching Roadmap Section 4.4."""

    answer: str
    sources: list[RAGSourceReference] = field(default_factory=list)
    query: str = ""
    total_retrieved_chunks: int = 0

    def to_dict(self) -> dict[str, Any]:
        """Convert response to JSON dictionary conforming to Roadmap 4.4."""
        return {
            "query": self.query,
            "answer": self.answer,
            "sources": [s.to_dict() for s in self.sources],
            "total_retrieved_chunks": self.total_retrieved_chunks,
        }
