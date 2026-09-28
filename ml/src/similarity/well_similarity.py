"""Well Similarity Engine for Nearby Wells Intelligence System (NWIS).

Calculates multi-factor similarity across geographical proximity, geological formations,
drilling depths, and historical hazardous events.
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from .schemas import (
    OffsetEventSummary,
    SimilarityWeights,
    SimilarWellMatch,
    WellSimilarityResponse,
)


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate great-circle distance between two GPS coordinates in kilometers."""
    radius_earth_km = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return radius_earth_km * c


class WellSimilarityEngine:
    """Multi-factor similarity engine for ranking offset wells against an active well."""

    def __init__(
        self,
        wells_df: pd.DataFrame | None = None,
        events_df: pd.DataFrame | None = None,
        wells_csv_path: str | Path | None = None,
        events_csv_path: str | Path | None = None,
        weights: SimilarityWeights | None = None,
    ) -> None:
        self.weights = weights or SimilarityWeights()

        if wells_df is not None:
            self.wells_df = wells_df.copy()
        elif wells_csv_path is not None:
            self.wells_df = pd.read_csv(wells_csv_path)
        else:
            self.wells_df = pd.DataFrame()

        if events_df is not None:
            self.events_df = events_df.copy()
        elif events_csv_path is not None:
            self.events_df = pd.read_csv(events_csv_path)
        else:
            self.events_df = pd.DataFrame()

        self._preprocess_data()

    def _preprocess_data(self) -> None:
        """Standardize well and event profiles for fast matching."""
        self._well_meta_dict: dict[str, dict[str, Any]] = {}
        self._well_events_dict: dict[str, list[dict[str, Any]]] = {}
        self._well_formations_dict: dict[str, set[str]] = {}

        if not self.wells_df.empty:
            if "well_id" in self.wells_df.columns:
                self.wells_df["well_id"] = self.wells_df["well_id"].astype(str).str.strip()
            for col in ["latitude", "longitude"]:
                if col in self.wells_df.columns:
                    self.wells_df[col] = pd.to_numeric(self.wells_df[col], errors="coerce")
            for _, r in self.wells_df.iterrows():
                wid = str(r["well_id"]).strip()
                self._well_meta_dict[wid] = r.to_dict()

        if not self.events_df.empty:
            if "well_id" in self.events_df.columns:
                self.events_df["well_id"] = self.events_df["well_id"].astype(str).str.strip()
            if "depth_md" in self.events_df.columns:
                self.events_df["depth_md"] = pd.to_numeric(self.events_df["depth_md"], errors="coerce")
            if "confidence" in self.events_df.columns:
                self.events_df["confidence"] = pd.to_numeric(self.events_df["confidence"], errors="coerce").fillna(0.8)

            for _, ev in self.events_df.iterrows():
                wid = str(ev.get("well_id", "")).strip()
                if wid:
                    self._well_events_dict.setdefault(wid, []).append(ev.to_dict())
                    fmt = str(ev.get("formation", "")).strip().lower()
                    if fmt and fmt != "nan":
                        self._well_formations_dict.setdefault(wid, set()).add(fmt)

    def get_known_well_ids(self) -> list[str]:
        """Return list of all unique well identifiers in dataset."""
        known = set(self._well_meta_dict.keys()).union(set(self._well_events_dict.keys()))
        return sorted(list(known))

    def get_well_events(self, well_id: str) -> list[dict[str, Any]]:
        """Retrieve all recorded historical events for a specific well."""
        return self._well_events_dict.get(well_id, [])

    def get_well_formations(self, well_id: str) -> set[str]:
        """Get set of formations associated with a well from events or well metadata."""
        return self._well_formations_dict.get(well_id, set())

    def find_similar_wells(
        self,
        active_well_id: str | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
        depth_md: float | None = None,
        formation: str | None = None,
        max_radius_km: float | None = None,
        top_k: int = 5,
    ) -> WellSimilarityResponse:
        """Find and rank offset wells relative to an active well or coordinate/depth context."""
        query_lat = latitude
        query_lon = longitude
        query_field = None
        target_formations: set[str] = set()

        if formation:
            target_formations.add(formation.strip().lower())

        # Resolve active well parameters if well_id provided
        if active_well_id:
            active_events = self.get_well_events(active_well_id)
            target_formations.update(self.get_well_formations(active_well_id))

            if not self.wells_df.empty and "well_id" in self.wells_df.columns:
                well_rows = self.wells_df[self.wells_df["well_id"] == active_well_id]
                if not well_rows.empty:
                    row = well_rows.iloc[0]
                    if query_lat is None and pd.notna(row.get("latitude")):
                        query_lat = float(row["latitude"])
                    if query_lon is None and pd.notna(row.get("longitude")):
                        query_lon = float(row["longitude"])
                    if pd.notna(row.get("field")):
                        query_field = str(row["field"]).strip()

            if depth_md is None and active_events:
                depths = [e["depth_md"] for e in active_events if pd.notna(e.get("depth_md"))]
                if depths:
                    depth_md = float(np.median(depths))

        all_candidate_well_ids = self.get_known_well_ids()
        candidate_matches: list[SimilarWellMatch] = []

        for candidate_id in all_candidate_well_ids:
            if active_well_id and candidate_id == active_well_id:
                continue  # Skip active well itself

            cand_lat = None
            cand_lon = None
            cand_field = None

            if not self.wells_df.empty and "well_id" in self.wells_df.columns:
                cand_rows = self.wells_df[self.wells_df["well_id"] == candidate_id]
                if not cand_rows.empty:
                    c_row = cand_rows.iloc[0]
                    if pd.notna(c_row.get("latitude")):
                        cand_lat = float(c_row["latitude"])
                    if pd.notna(c_row.get("longitude")):
                        cand_lon = float(c_row["longitude"])
                    if pd.notna(c_row.get("field")):
                        cand_field = str(c_row["field"]).strip()

            # 1. Geographic distance & similarity
            dist_km = None
            if query_lat is not None and query_lon is not None and cand_lat is not None and cand_lon is not None:
                dist_km = haversine_distance_km(query_lat, query_lon, cand_lat, cand_lon)
                if max_radius_km is not None and dist_km > max_radius_km:
                    continue  # Filter out wells outside specified radius
                geo_sim = math.exp(-dist_km / self.weights.geo_decay_km)
            elif query_field and cand_field and query_field.lower() == cand_field.lower():
                geo_sim = 0.6  # Partial score for same field without exact coordinates
            else:
                geo_sim = 0.2  # Baseline prior when coordinates are unspecified

            # 2. Formation similarity
            cand_formations = self.get_well_formations(candidate_id)
            if target_formations and cand_formations:
                intersection = target_formations.intersection(cand_formations)
                union = target_formations.union(cand_formations)
                formation_sim = len(intersection) / len(union) if union else 0.0
            elif not target_formations and not cand_formations:
                formation_sim = 0.5
            else:
                formation_sim = 0.2

            # 3. Depth similarity and Historical Events
            cand_events = self.get_well_events(candidate_id)
            depth_scores: list[float] = []
            event_summaries: list[OffsetEventSummary] = []
            event_severity_weights = {"CRITICAL": 1.0, "HIGH": 0.8, "MEDIUM": 0.5, "LOW": 0.3}

            event_score_accum = 0.0
            for ev in cand_events:
                ev_depth = ev.get("depth_md")
                ev_formation = str(ev.get("formation", "")).strip() if pd.notna(ev.get("formation")) else None
                ev_severity = str(ev.get("severity", "")).strip() if pd.notna(ev.get("severity")) else "MEDIUM"
                ev_type = str(ev.get("event_type", "UNKNOWN"))

                if depth_md is not None and pd.notna(ev_depth):
                    delta_d = abs(float(depth_md) - float(ev_depth))
                    d_score = math.exp(-delta_d / self.weights.depth_tolerance_m)
                    depth_scores.append(d_score)

                # Event weight
                sev_weight = event_severity_weights.get(ev_severity.upper(), 0.5)
                conf = float(ev.get("confidence", 0.8)) if pd.notna(ev.get("confidence")) else 0.8
                event_score_accum += sev_weight * conf

                event_summaries.append(
                    OffsetEventSummary(
                        event_id=str(ev.get("event_id", "")),
                        event_type=ev_type,
                        depth_md=float(ev_depth) if pd.notna(ev_depth) else None,
                        formation=ev_formation,
                        severity=ev_severity,
                        description=str(ev.get("description", "")),
                        mitigation=str(ev.get("mitigation", "")) if pd.notna(ev.get("mitigation")) else None,
                        source_document=str(ev.get("source_document", "")),
                        source_page=int(ev["source_page"]) if pd.notna(ev.get("source_page")) else None,
                        confidence=conf,
                    )
                )

            depth_sim = max(depth_scores) if depth_scores else (0.5 if depth_md is None else 0.1)
            event_sim = min(1.0, event_score_accum / 2.0) if cand_events else 0.0

            # 4. Composite overall similarity score
            overall_sim = (
                self.weights.geo_weight * geo_sim
                + self.weights.formation_weight * formation_sim
                + self.weights.depth_weight * depth_sim
                + self.weights.event_weight * event_sim
            )
            overall_sim = round(float(np.clip(overall_sim, 0.0, 1.0)), 4)

            # Generate concise operational risk summary for engineers
            risk_summary = self._generate_risk_summary(event_summaries, dist_km, depth_sim)

            candidate_matches.append(
                SimilarWellMatch(
                    well_id=candidate_id,
                    field_name=cand_field,
                    latitude=cand_lat,
                    longitude=cand_lon,
                    distance_km=round(dist_km, 2) if dist_km is not None else None,
                    overall_similarity=overall_sim,
                    geo_similarity=round(geo_sim, 4),
                    formation_similarity=round(formation_sim, 4),
                    depth_similarity=round(depth_sim, 4),
                    event_similarity=round(event_sim, 4),
                    matched_events_count=len(event_summaries),
                    matched_events=event_summaries,
                    risk_summary=risk_summary,
                )
            )

        # Sort descending by overall similarity
        candidate_matches.sort(key=lambda m: m.overall_similarity, reverse=True)
        top_matches = candidate_matches[:top_k]

        return WellSimilarityResponse(
            active_well=active_well_id or "ADHOC_QUERY",
            query_latitude=query_lat,
            query_longitude=query_lon,
            query_depth_md=depth_md,
            query_formation=formation,
            max_radius_km=max_radius_km,
            total_candidates_evaluated=len(candidate_matches),
            similar_wells=top_matches,
        )

    def _generate_risk_summary(
        self,
        events: list[OffsetEventSummary],
        distance_km: float | None,
        depth_sim: float,
    ) -> str:
        """Generate a short human-readable warning summary for frontend cards."""
        if not events:
            if distance_km is not None:
                return f"Offset well {distance_km:.1f} km away with no recorded historical drilling hazards."
            return "Offset well with no recorded historical hazards."

        types = [e.event_type for e in events]
        type_str = ", ".join(sorted(set(types)))
        severities = [e.severity for e in events if e.severity]
        has_critical = any(s == "CRITICAL" for s in severities)
        has_high = any(s == "HIGH" for s in severities)

        severity_label = "CRITICAL" if has_critical else ("HIGH" if has_high else "MODERATE")
        loc_str = f" ({distance_km:.1f} km away)" if distance_km is not None else ""

        if depth_sim > 0.7:
            return f"[{severity_label} HAZARD MATCH{loc_str}] Encountered {type_str} at similar depth interval."
        return f"[{severity_label} HAZARD HISTORY{loc_str}] Recorded {len(events)} incident(s) including {type_str}."

    def compute_similarity_matrix(self) -> pd.DataFrame:
        """Compute an all-vs-all pairwise similarity matrix for all wells in the dataset."""
        well_ids = self.get_known_well_ids()
        matrix = pd.DataFrame(index=well_ids, columns=well_ids, dtype=float)

        for w1 in well_ids:
            resp = self.find_similar_wells(active_well_id=w1, top_k=len(well_ids))
            matrix.loc[w1, w1] = 1.0
            for match in resp.similar_wells:
                matrix.loc[w1, match.well_id] = match.overall_similarity

        return matrix.fillna(0.0)
