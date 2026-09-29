"""Unit tests for Random Forest Mud Loss Risk Model (Step 12)."""

from pathlib import Path
import unittest

import pandas as pd

BASE_DIR = Path(__file__).resolve().parent.parent
DATASET_CSV = BASE_DIR / "data/processed/risk_prediction_dataset.csv"
MODEL_PATH = BASE_DIR / "models/trained/mud_loss_random_forest.joblib"

try:
    from ml.src.risk.mud_loss_model import MudLossRiskModel
    from ml.src.risk.schemas import RiskPredictionRequest, RiskPredictionResult
except ModuleNotFoundError:
    import sys
    sys.path.insert(0, str(BASE_DIR))
    from src.risk.mud_loss_model import MudLossRiskModel
    from src.risk.schemas import RiskPredictionRequest, RiskPredictionResult


class TestRiskModel(unittest.TestCase):
    def setUp(self) -> None:
        self.df = pd.read_csv(DATASET_CSV)

    def test_model_training_and_evaluation(self) -> None:
        train_df = self.df[self.df["split_group"] == "train"]
        test_df = self.df[self.df["split_group"] == "test"]

        model = MudLossRiskModel(n_estimators=50, max_depth=6, random_state=42)
        model.fit(train_df, target_col="is_mud_loss")
        self.assertTrue(model.is_fitted)

        metrics = model.evaluate(test_df, target_col="is_mud_loss")
        self.assertIn("roc_auc", metrics)
        self.assertIn("precision", metrics)
        self.assertGreater(metrics["roc_auc"], 0.7)

    def test_single_prediction_schema(self) -> None:
        model = MudLossRiskModel.load(MODEL_PATH)
        req = RiskPredictionRequest(
            well_id="DLJ-18",
            depth_md=2950.0,
            formation="Barail",
            lithology="Coal / Shale / Sandstone Sequence",
            rop_mhr=5.0,
            wob_klbs=28.0,
            rpm=100.0,
            torque_kftlb=12.0,
            spp_psi=2100.0,
            flow_rate_gpm=420.0,
            mud_weight_ppg=10.6,
            ecd_ppg=11.0,
        )

        res = model.predict_one(req)
        self.assertIsInstance(res, RiskPredictionResult)
        self.assertEqual(res.well_id, "DLJ-18")
        self.assertEqual(res.risk_type, "MUD_LOSS")
        self.assertTrue(0.0 <= res.probability <= 1.0)
        self.assertIn(res.level, ["LOW", "MEDIUM", "HIGH", "CRITICAL"])
        self.assertGreater(len(res.top_contributing_features), 0)

    def test_trajectory_prediction(self) -> None:
        model = MudLossRiskModel.load(MODEL_PATH)
        well_df = self.df[self.df["well_id"] == "W-087"]
        pred_df = model.predict_trajectory(well_df)

        self.assertIn("mud_loss_probability", pred_df.columns)
        self.assertIn("predicted_risk_level", pred_df.columns)
        self.assertEqual(len(pred_df), len(well_df))


if __name__ == "__main__":
    unittest.main()
