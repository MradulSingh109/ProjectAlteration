"""Pipeline script to calculate well similarity and nearby offset intelligence.

Usage:
  python pipelines/calculate_similarity.py --active-well DLJ-18 --depth 2950 --top-k 5
  python pipelines/calculate_similarity.py --lat 27.46 --lon 95.06 --depth 2900 --formation Barail
  python pipelines/calculate_similarity.py --batch-matrix
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

import yaml

# Add src to path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from src.similarity.schemas import SimilarityWeights
from src.similarity.well_similarity import WellSimilarityEngine


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="NWIS Well Similarity Engine")
    parser.add_argument("--active-well", type=str, help="Active well ID to rank against")
    parser.add_argument("--lat", type=float, help="Active query latitude")
    parser.add_argument("--lon", type=float, help="Active query longitude")
    parser.add_argument("--depth", type=float, help="Active drilling bit depth (MD in meters)")
    parser.add_argument("--formation", type=str, help="Target formation name (e.g. Barail, Tipam)")
    parser.add_argument("--radius-km", type=float, help="Max geographical radius in km")
    parser.add_argument("--top-k", type=int, default=5, help="Number of top similar offset wells to return")
    parser.add_argument(
        "--wells-csv",
        type=str,
        default=str(BASE_DIR / "data/processed/good_data_processed/historical_dataset/wells.csv"),
        help="Path to wells.csv",
    )
    parser.add_argument(
        "--events-csv",
        type=str,
        default=str(BASE_DIR / "data/processed/good_data_processed/historical_dataset/events.csv"),
        help="Path to events.csv",
    )
    parser.add_argument(
        "--config",
        type=str,
        default=str(BASE_DIR / "configs/similarity.yaml"),
        help="Path to similarity.yaml configuration",
    )
    parser.add_argument("--output-json", type=str, help="Optional output JSON path for results")
    parser.add_argument("--batch-matrix", action="store_true", help="Compute all-vs-all similarity matrix")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    # Load weights from config if available
    weights = SimilarityWeights()
    if args.config and Path(args.config).exists():
        with open(args.config, "r", encoding="utf-8") as f:
            cfg = yaml.safe_load(f)
            if "weights" in cfg:
                w_cfg = cfg["weights"]
                weights = SimilarityWeights(
                    geo_weight=w_cfg.get("geo_weight", 0.35),
                    formation_weight=w_cfg.get("formation_weight", 0.25),
                    depth_weight=w_cfg.get("depth_weight", 0.20),
                    event_weight=w_cfg.get("event_weight", 0.20),
                    geo_decay_km=w_cfg.get("geo_decay_km", 10.0),
                    depth_tolerance_m=w_cfg.get("depth_tolerance_m", 150.0),
                )

    engine = WellSimilarityEngine(
        wells_csv_path=args.wells_csv,
        events_csv_path=args.events_csv,
        weights=weights,
    )

    if args.batch_matrix:
        matrix = engine.compute_similarity_matrix()
        out_path = BASE_DIR / "data/processed/good_data_processed/similarity_matrix.csv"
        matrix.to_csv(out_path)
        print(f"[OK] Batch pairwise similarity matrix saved to: {out_path}")
        print(matrix.round(3))
        return

    # Query mode
    if not args.active_well and args.lat is None and args.depth is None:
        # Default to first known well if nothing specified
        known = engine.get_known_well_ids()
        args.active_well = known[0] if known else "DLJ-18"
        print(f"[INFO] No active well specified; defaulting to '{args.active_well}'")

    response = engine.find_similar_wells(
        active_well_id=args.active_well,
        latitude=args.lat,
        longitude=args.lon,
        depth_md=args.depth,
        formation=args.formation,
        max_radius_km=args.radius_km,
        top_k=args.top_k,
    )

    result_dict = response.to_dict()

    print("\n================ NWIS WELL SIMILARITY INTELLIGENCE ================")
    print(f"Active Reference : {response.active_well}")
    if response.query_depth_md is not None:
        print(f"Target Depth     : {response.query_depth_md} m MD")
    if response.query_formation is not None:
        print(f"Target Formation : {response.query_formation}")
    if response.query_latitude is not None and response.query_longitude is not None:
        print(f"Location         : ({response.query_latitude:.4f}, {response.query_longitude:.4f})")
    print(f"Total Evaluated  : {response.total_candidates_evaluated} offset wells")
    print("-------------------------------------------------------------------")

    for idx, match in enumerate(response.similar_wells, 1):
        dist_str = f"{match.distance_km} km" if match.distance_km is not None else "N/A"
        print(
            f"#{idx} Well: {match.well_id:<8} | Match: {match.overall_similarity*100:5.1f}% | "
            f"Dist: {dist_str:<8} | Geo: {match.geo_similarity:.2f} | Form: {match.formation_similarity:.2f} | "
            f"Depth: {match.depth_similarity:.2f} | Events: {match.matched_events_count}"
        )
        print(f"   Summary: {match.risk_summary}")
        if match.matched_events:
            for ev in match.matched_events[:2]:
                print(f"   - [{ev.event_type}] Depth: {ev.depth_md or 'N/A'}m | Sev: {ev.severity or 'N/A'} | Desc: {ev.description[:60]}")
        print()

    if args.output_json:
        out_p = Path(args.output_json)
        out_p.parent.mkdir(parents=True, exist_ok=True)
        with open(out_p, "w", encoding="utf-8") as f:
            json.dump(result_dict, f, indent=2)
        print(f"[OK] Full similarity JSON response written to: {out_p}")


if __name__ == "__main__":
    main()
