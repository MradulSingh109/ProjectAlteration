"""Pipeline script to build the depth-aligned risk prediction dataset (Step 11).

Usage:
  python pipelines/build_risk_dataset.py
  python pipelines/build_risk_dataset.py --depth-step 5.0 --output-csv data/processed/risk_prediction_dataset.csv
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

import pandas as pd
import yaml

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from src.features.risk_dataset_generator import RiskDatasetGenerator


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="NWIS Risk Prediction Dataset Builder")
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
        default=str(BASE_DIR / "configs/risk_models.yaml"),
        help="Path to risk_models.yaml",
    )
    parser.add_argument(
        "--depth-step",
        type=float,
        default=10.0,
        help="Depth step resolution in meters (default: 10.0m)",
    )
    parser.add_argument(
        "--output-csv",
        type=str,
        default=str(BASE_DIR / "data/processed/risk_prediction_dataset.csv"),
        help="Output CSV path",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    wells_path = Path(args.wells_csv)
    events_path = Path(args.events_csv)

    if not wells_path.exists() or not events_path.exists():
        print(f"[ERROR] Input files not found: {wells_path} or {events_path}")
        sys.exit(1)

    wells_df = pd.read_csv(wells_path)
    events_df = pd.read_csv(events_path)

    print(f"[INFO] Loaded {len(wells_df)} wells and {len(events_df)} historical events.")
    print(f"[INFO] Generating depth-aligned trajectories at {args.depth_step}m resolution...")

    generator = RiskDatasetGenerator(
        wells_df=wells_df,
        events_df=events_df,
        depth_step_m=args.depth_step,
        random_seed=42,
    )

    dataset_df = generator.generate_full_risk_dataset()

    # Save to CSV
    out_csv = Path(args.output_csv)
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    dataset_df.to_csv(out_csv, index=False)
    print(f"[OK] Saved risk prediction dataset to: {out_csv}")

    # Summary Statistics
    total_rows = len(dataset_df)
    train_rows = len(dataset_df[dataset_df["split_group"] == "train"])
    val_rows = len(dataset_df[dataset_df["split_group"] == "val"])
    test_rows = len(dataset_df[dataset_df["split_group"] == "test"])

    mud_loss_pos = int(dataset_df["is_mud_loss"].sum())
    stuck_pipe_pos = int(dataset_df["is_stuck_pipe"].sum())
    kick_pos = int(dataset_df["is_kick"].sum())

    summary = {
        "total_intervals": total_rows,
        "depth_step_m": args.depth_step,
        "unique_wells": int(dataset_df["well_id"].nunique()),
        "splits": {
            "train_intervals": train_rows,
            "val_intervals": val_rows,
            "test_intervals": test_rows,
        },
        "hazard_counts": {
            "mud_loss_intervals": mud_loss_pos,
            "stuck_pipe_intervals": stuck_pipe_pos,
            "kick_intervals": kick_pos,
            "normal_intervals": total_rows - (mud_loss_pos + stuck_pipe_pos + kick_pos),
        },
        "features_list": [c for c in dataset_df.columns if c not in ["well_id", "split_group", "hazard_event_type", "risk_level", "is_mud_loss", "is_stuck_pipe", "is_kick"]],
    }

    summary_path = out_csv.parent / "risk_dataset_summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print("\n================ NWIS RISK PREDICTION DATASET SUMMARY ================")
    print(f"Total Depth Intervals : {total_rows}")
    print(f"Wells Included        : {dataset_df['well_id'].nunique()} wells")
    print(f"Train / Val / Test    : {train_rows} / {val_rows} / {test_rows} intervals")
    print("Hazard Class Balance  :")
    print(f"  - Normal (No Hazard): {total_rows - (mud_loss_pos + stuck_pipe_pos + kick_pos):<5} ({((total_rows - (mud_loss_pos + stuck_pipe_pos + kick_pos))/total_rows)*100:.1f}%)")
    print(f"  - Mud Loss Intervals: {mud_loss_pos:<5} ({(mud_loss_pos/total_rows)*100:.1f}%)")
    print(f"  - Stuck Pipe Interv.: {stuck_pipe_pos:<5} ({(stuck_pipe_pos/total_rows)*100:.1f}%)")
    print(f"  - Kick Intervals    : {kick_pos:<5} ({(kick_pos/total_rows)*100:.1f}%)")
    print(f"Summary JSON saved to : {summary_path}")
    print("======================================================================\n")


if __name__ == "__main__":
    main()
