"""Spatial and offset well feature extractor for risk prediction."""

from __future__ import annotations

from typing import Any
import pandas as pd

from ..similarity.well_similarity import WellSimilarityEngine


class SpatialOffsetFeatureExtractor:
    """Computes spatial offset risk indicators for an active well and depth."""

    def __init__(self, similarity_engine: WellSimilarityEngine) -> None:
        self.engine = similarity_engine

    def extract_offset_features(
        self,
        well_id: str,
        depth_md: float,
        formation: str,
        radius_km: float = 25.0,
    ) -> dict[str, Any]:
        """Compute offset risk features using the similarity engine."""
        resp = self.engine.find_similar_wells(
            active_well_id=well_id,
            depth_md=depth_md,
            formation=formation,
            max_radius_km=radius_km,
            top_k=5,
        )

        offset_matches = resp.similar_wells
        total_similar_wells = len(offset_matches)

        mud_loss_count = 0
        stuck_pipe_count = 0
        kick_count = 0
        torque_spike_count = 0
        nearest_hazard_dist_km: float | None = None
        max_similarity_score = 0.0
        weighted_hazard_density = 0.0

        for match in offset_matches:
            max_similarity_score = max(max_similarity_score, match.overall_similarity)

            for ev in match.matched_events:
                ev_type = ev.event_type.upper()
                if ev_type == "MUD_LOSS":
                    mud_loss_count += 1
                elif ev_type == "STUCK_PIPE":
                    stuck_pipe_count += 1
                elif ev_type == "KICK":
                    kick_count += 1
                elif ev_type == "TORQUE_SPIKE":
                    torque_spike_count += 1

                if match.distance_km is not None:
                    if nearest_hazard_dist_km is None or match.distance_km < nearest_hazard_dist_km:
                        nearest_hazard_dist_km = match.distance_km

                # Accumulate distance/similarity-weighted hazard density
                weighted_hazard_density += match.overall_similarity

        return {
            "offset_wells_count_in_radius": total_similar_wells,
            "max_offset_similarity": round(max_similarity_score, 4),
            "offset_mud_loss_count": mud_loss_count,
            "offset_stuck_pipe_count": stuck_pipe_count,
            "offset_kick_count": kick_count,
            "offset_torque_spike_count": torque_spike_count,
            "nearest_hazard_distance_km": round(nearest_hazard_dist_km, 2) if nearest_hazard_dist_km is not None else 999.0,
            "offset_hazard_density": round(weighted_hazard_density, 4),
        }
