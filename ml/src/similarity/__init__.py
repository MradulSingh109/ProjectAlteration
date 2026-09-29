"""Similarity module for NWIS."""

from .schemas import (
    OffsetEventSummary,
    SimilarityWeights,
    SimilarWellMatch,
    WellSimilarityResponse,
)
from .well_similarity import WellSimilarityEngine, haversine_distance_km

__all__ = [
    "OffsetEventSummary",
    "SimilarityWeights",
    "SimilarWellMatch",
    "WellSimilarityResponse",
    "WellSimilarityEngine",
    "haversine_distance_km",
]
