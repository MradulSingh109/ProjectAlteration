"""Pipeline script for real-time and trajectory Mud Loss risk prediction (Step 12 & 14).

Usage:
  # Single depth query:
  python pipelines/predict_risk.py --well-id DLJ-18 --depth 2950 --formation Barail

  # Full well trajectory prediction:
  python pipelines/predict_risk.py --trajectory-well W-087
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

import pandas as pd

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from src.features.risk_dataset_generator import RiskDatasetGenerator
from src.features.stratigraphy import get_formation_for_depth
from src.risk.mud_loss_model import MudLossRiskModel
from src.risk.schemas import RiskPredictionRequest


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="NWIS Risk Prediction Inference")
    parser.add_argument("--well-id", type=str, default="DLJ-18", help="Active well identifier")
    parser.add_argument("--depth", type=float, default=2950.0, help="Measured depth (m MD)")
    parser.add_argument("--formation", type=str, help="Geological formation (default: auto-lookup)")
    parser.add_argument("--rop", type=float, default=10.0, help="Rate of Penetration (m/hr)")
    parser.add_argument("--wob", type=float, default=22.0, help="Weight on Bit (klbs)")
    parser.add_argument("--rpm", type=float, default=110.0, help="RPM")
    parser.add_argument("--torque", type=float, default=9.5, help="Torque (kft-lb)")
    parser.add_argument("--spp", type=float, default=2400.0, help="Standpipe pressure (psi)")
    parser.add_argument("--flow", type=float, default=500.0, help="Flow rate (gpm)")
    parser.add_argument("--mw", type=float, default=10.5, help="Mud weight (ppg)")
    parser.add_argument("--ecd", type=float, default=10.9, help="ECD (ppg)")
    parser.add_argument(
        "--model-path",
        type=str,
        default=str(BASE_DIR / "models/trained/mud_loss_random_forest.joblib"),
        help="Path to trained model artifact",
    )
    parser.add_argument("--trajectory-well", type=str, help="Run full depth risk profile for given well ID")
    parser.add_argument("--output-json", type=str, help="Save prediction JSON to file")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    model_file = Path(args.model_path)
    if not model_file.exists():
        print(f"[ERROR] Trained model not found at: {model_file}. Train model first with pipelines/train_risk_model.py")
        sys.exit(1)

    model = MudLossRiskModel.load(model_file)

    # Mode 1: Full well trajectory risk profile
    if args.trajectory_well:
        dataset_csv = BASE_DIR / "data/processed/risk_prediction_dataset.csv"
        if not dataset_csv.exists():
            print(f"[ERROR] Dataset not found: {dataset_csv}")
            sys.exit(1)

        full_df = pd.read_csv(dataset_csv)
        well_df = full_df[full_df["well_id"] == args.trajectory_well]
        if well_df.empty:
            print(f"[ERROR] Well {args.trajectory_well} not found in dataset.")
            sys.exit(1)

        preds = model.predict_trajectory(well_df)
        print(f"\n================ RISK TRAJECTORY PROFILE: {args.trajectory_well} ================")
        print(f"{'Depth (m)':<10} | {'Formation':<20} | {'Prob':<8} | {'Risk Level':<10} | {'Actual Hazard'}")
        print("-" * 75)

        high_risk_count = 0
        for _, row in preds.iterrows():
            prob = row["mud_loss_probability"]
            level = row["predicted_risk_level"]
            actual = row.get("hazard_event_type", "NONE")
            if prob >= 0.40 or actual != "NONE":
                high_risk_count += 1
                flag = f"[{actual}]" if actual != "NONE" else ""
                print(f"{row['depth_md']:<10.1f} | {row['formation'][:20]:<20} | {prob*100:5.1f}%  | {level:<10} | {flag}")

        print("---------------------------------------------------------------------------")
        print(f"Total intervals evaluated: {len(preds)} | Flagged elevated risk depths: {high_risk_count}")
        print("===========================================================================\n")
        return

    # Mode 2: Single point real-time prediction
    fmt_info = get_formation_for_depth(args.depth, preferred_name=args.formation)

    req = RiskPredictionRequest(
        well_id=args.well_id,
        depth_md=args.depth,
        formation=fmt_info.name,
        lithology=fmt_info.primary_lithology,
        rop_mhr=args.rop,
        wob_klbs=args.wob,
        rpm=args.rpm,
        torque_kftlb=args.torque,
        spp_psi=args.spp,
        flow_rate_gpm=args.flow,
        mud_weight_ppg=args.mw,
        ecd_ppg=args.ecd,
    )

    result = model.predict_one(req)
    res_dict = result.to_dict()

    print("\n================ NWIS REAL-TIME DRILLING RISK PREDICTION ================")
    print(f"Active Well   : {result.well_id}")
    print(f"Current Depth : {result.depth_md} m MD ({fmt_info.name})")
    print(f"Risk Type     : {result.risk_type}")
    print(f"Probability   : {result.probability * 100:.1f}%")
    print(f"Risk Level    : [{result.level}]")
    print(f"Model Version : {result.model_version}")
    print("------------------------------------------------------------------------")
    print(f"Recommendation:\n  {result.mitigation_recommendation}")
    print("\nTop Contributing Risk Factors:")
    for feat in result.top_contributing_features:
        print(f"  - {feat['feature']:<30} (importance: {feat['importance']*100:4.1f}%)")
    print("========================================================================\n")

    if args.output_json:
        out_p = Path(args.output_json)
        out_p.parent.mkdir(parents=True, exist_ok=True)
        with open(out_p, "w", encoding="utf-8") as f:
            json.dump(res_dict, f, indent=2)
        print(f"[OK] Prediction JSON output saved to: {out_p}")


if __name__ == "__main__":
    main()
