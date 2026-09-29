"""Pipeline script to train, evaluate, and save the Mud Loss Random Forest Risk Model (Step 12).

Usage:
  python pipelines/train_risk_model.py
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

from src.risk.mud_loss_model import MudLossRiskModel


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="NWIS Mud Loss Random Forest Training")
    parser.add_argument(
        "--dataset-csv",
        type=str,
        default=str(BASE_DIR / "data/processed/risk_prediction_dataset.csv"),
        help="Path to risk prediction dataset CSV",
    )
    parser.add_argument(
        "--model-output",
        type=str,
        default=str(BASE_DIR / "models/trained/mud_loss_random_forest.joblib"),
        help="Path to save trained joblib artifact",
    )
    parser.add_argument(
        "--metrics-output",
        type=str,
        default=str(BASE_DIR / "models/trained/model_metrics.json"),
        help="Path to save evaluation metrics JSON",
    )
    parser.add_argument("--n-estimators", type=int, default=150, help="Number of trees")
    parser.add_argument("--max-depth", type=int, default=8, help="Max tree depth")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    data_path = Path(args.dataset_csv)
    if not data_path.exists():
        print(f"[ERROR] Dataset not found at: {data_path}. Run pipelines/build_risk_dataset.py first.")
        sys.exit(1)

    df = pd.read_csv(data_path)
    print(f"[INFO] Loaded dataset with {len(df)} total intervals across {df['well_id'].nunique()} wells.")

    train_df = df[df["split_group"] == "train"]
    val_df = df[df["split_group"] == "val"]
    test_df = df[df["split_group"] == "test"]

    print(f"[INFO] Train intervals: {len(train_df)} | Val: {len(val_df)} | Test: {len(test_df)}")

    # Initialize and Train
    model = MudLossRiskModel(
        n_estimators=args.n_estimators,
        max_depth=args.max_depth,
        random_state=42,
    )

    print("[INFO] Training Random Forest with balanced class weights...")
    model.fit(train_df, target_col="is_mud_loss")

    # Evaluate
    train_metrics = model.evaluate(train_df, target_col="is_mud_loss")
    val_metrics = model.evaluate(val_df, target_col="is_mud_loss")
    test_metrics = model.evaluate(test_df, target_col="is_mud_loss")

    # Top Feature Importances
    clf = model.pipeline.named_steps["classifier"]
    importances = clf.feature_importances_
    sorted_features = sorted(zip(model.feature_names_, importances), key=lambda x: x[1], reverse=True)

    print("\n================ NWIS RISK MODEL EVALUATION ================")
    print(f"{'Split':<10} | {'ROC-AUC':<8} | {'PR-AUC':<8} | {'Precision':<10} | {'Recall':<8} | {'F1':<8}")
    print("-" * 62)
    print(f"{'Train':<10} | {train_metrics['roc_auc']:<8.4f} | {train_metrics['pr_auc']:<8.4f} | {train_metrics['precision']:<10.4f} | {train_metrics['recall']:<8.4f} | {train_metrics['f1_score']:<8.4f}")
    print(f"{'Validation':<10} | {val_metrics['roc_auc']:<8.4f} | {val_metrics['pr_auc']:<8.4f} | {val_metrics['precision']:<10.4f} | {val_metrics['recall']:<8.4f} | {val_metrics['f1_score']:<8.4f}")
    print(f"{'Test':<10} | {test_metrics['roc_auc']:<8.4f} | {test_metrics['pr_auc']:<8.4f} | {test_metrics['precision']:<10.4f} | {test_metrics['recall']:<8.4f} | {test_metrics['f1_score']:<8.4f}")
    print("------------------------------------------------------------")

    print("\nTop 5 Most Predictive Risk Factors:")
    for rank, (feat, imp) in enumerate(sorted_features[:5], 1):
        print(f"  {rank}. {feat:<30} (importance: {imp*100:5.2f}%)")

    # Save Model Artifacts
    model_out = Path(args.model_output)
    model.save(model_out)
    print(f"\n[OK] Model artifact saved to: {model_out}")

    metrics_out = Path(args.metrics_output)
    metrics_out.parent.mkdir(parents=True, exist_ok=True)
    all_metrics = {
        "model_version": MudLossRiskModel.MODEL_VERSION,
        "algorithm": "RandomForestClassifier",
        "n_estimators": args.n_estimators,
        "max_depth": args.max_depth,
        "train_metrics": train_metrics,
        "val_metrics": val_metrics,
        "test_metrics": test_metrics,
        "top_features": [{"feature": f, "importance": round(float(i), 4)} for f, i in sorted_features[:10]],
    }
    with open(metrics_out, "w", encoding="utf-8") as f:
        json.dump(all_metrics, f, indent=2)
    print(f"[OK] Metrics report saved to: {metrics_out}")
    print("============================================================\n")


if __name__ == "__main__":
    main()
