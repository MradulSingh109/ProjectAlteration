"""Hybrid metadata-filtered retriever for NWIS RAG."""

from __future__ import annotations

import re
from typing import Any
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from .schemas import RAGChunk, RAGQueryFilter
from ..similarity.well_similarity import WellSimilarityEngine


class RAGRetriever:
    """Hybrid lexical-semantic retrieval index with drilling domain metadata filtering."""

    def __init__(
        self,
        chunks: list[RAGChunk],
        similarity_engine: WellSimilarityEngine | None = None,
    ) -> None:
        self.chunks = chunks
        self.similarity_engine = similarity_engine

        self.vectorizer = TfidfVectorizer(
            stop_words="english",
            ngram_range=(1, 2),
            sublinear_tf=True,
            max_features=2500,
        )

        self._build_index()

    def _build_index(self) -> None:
        """Build searchable TF-IDF vector matrix across all chunks."""
        if not self.chunks:
            self.tfidf_matrix = None
            return

        corpus = [f"{c.document_id} {c.section or ''} {c.formation or ''} {' '.join(c.event_types)} {c.text}" for c in self.chunks]
        self.tfidf_matrix = self.vectorizer.fit_transform(corpus)

    def retrieve(
        self,
        query: str,
        filters: RAGQueryFilter | None = None,
        top_k: int = 5,
    ) -> list[tuple[RAGChunk, float]]:
        """Retrieve top-K most relevant chunks matching query and optional metadata filters."""
        if not self.chunks or self.tfidf_matrix is None:
            return []

        # 1. Filter candidates by metadata
        candidate_indices = []
        allowed_wells: set[str] | None = None

        if filters and filters.nearby_well_id and self.similarity_engine:
            # Proximity filtering using Step 9 Similarity Engine
            sim_resp = self.similarity_engine.find_similar_wells(
                active_well_id=filters.nearby_well_id,
                max_radius_km=filters.max_distance_km or 25.0,
                top_k=20,
            )
            allowed_wells = {filters.nearby_well_id}.union({m.well_id for m in sim_resp.similar_wells})

        for idx, chunk in enumerate(self.chunks):
            if filters:
                if filters.well_id and chunk.well_id:
                    if filters.well_id.lower() not in chunk.well_id.lower() and chunk.well_id.lower() not in filters.well_id.lower():
                        continue
                if allowed_wells is not None and chunk.well_id and chunk.well_id not in allowed_wells:
                    continue
                if filters.formation and chunk.formation:
                    if filters.formation.lower() not in chunk.formation.lower():
                        continue
                if filters.event_type:
                    if not any(filters.event_type.lower() in et.lower() for et in chunk.event_types):
                        continue
                if filters.min_depth is not None and chunk.depth_max is not None:
                    if chunk.depth_max < filters.min_depth:
                        continue
                if filters.max_depth is not None and chunk.depth_min is not None:
                    if chunk.depth_min > filters.max_depth:
                        continue

            candidate_indices.append(idx)

        if not candidate_indices:
            # Fallback to all chunks if filters were too restrictive
            candidate_indices = list(range(len(self.chunks)))

        # 2. Vector scoring
        query_vec = self.vectorizer.transform([query])
        sub_matrix = self.tfidf_matrix[candidate_indices]
        sim_scores = cosine_similarity(query_vec, sub_matrix).flatten()

        # 3. Apply keyword & entity bonus
        q_lower = query.lower()
        scored_candidates: list[tuple[RAGChunk, float]] = []

        for sub_idx, chunk_idx in enumerate(candidate_indices):
            chunk = self.chunks[chunk_idx]
            base_score = float(sim_scores[sub_idx])

            # Keyword matching bonus
            bonus = 0.0
            if chunk.formation and chunk.formation.lower() in q_lower:
                bonus += 0.15
            if chunk.well_id and chunk.well_id.lower() in q_lower:
                bonus += 0.20
            for et in chunk.event_types:
                if et.lower().replace("_", " ") in q_lower:
                    bonus += 0.15

            total_score = round(base_score + bonus, 4)
            scored_candidates.append((chunk, total_score))

        # Sort descending by score
        scored_candidates.sort(key=lambda x: x[1], reverse=True)
        return scored_candidates[:top_k]
