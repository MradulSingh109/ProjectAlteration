"""Unit tests for the Risk Prediction Dataset Generator (Step 11)."""

from pathlib import Path
import unittest

import pandas as pd

BASE_DIR = Path(__file__).resolve().parent.parent
WELLS_CSV = BASE_DIR / "data/processed/good_data_processed/historical_dataset/wells.csv"
EVENTS_CSV = BASE_DIR / "data/processed/good_data_processed/historical_dataset/events.csv"

try:
    from ml.src.features.risk_dataset_generator import RiskDatasetGenerator
    from ml.src.features.stratigraphy import get_formation_for_depth
except ModuleNotFoundError:
    import sys
    sys.path.insert(0, str(BASE_DIR))
    from src.features.risk_dataset_generator import RiskDatasetGenerator
    from src.features.stratigraphy import get_formation_for_depth


class TestRiskDataset(unittest.TestCase):
    def setUp(self) -> None:
        self.wells_df = pd.read_csv(WELLS_CSV)
        self.events_df = pd.read_csv(EVENTS_CSV)
        self.generator = RiskDatasetGenerator(
            wells_df=self.wells_df,
            events_df=self.events_df,
            depth_step_m=20.0,
            random_seed=42,
        )

    def test_stratigraphy_lookup(self) -> None:
        fmt_tipam = get_formation_for_depth(2400.0)
        self.assertIn("Tipam", fmt_tipam.name)

        fmt_barail = get_formation_for_depth(3000.0)
        self.assertIn("Barail", fmt_barail.name)

        fmt_sylhet = get_formation_for_depth(3900.0)
        self.assertIn("Sylhet", fmt_sylhet.name)

    def test_well_trajectory_generation(self) -> None:
        well_df = self.generator.generate_well_trajectory(
            well_id="DLJ-18",
            start_depth_md=2800.0,
            target_depth_md=3100.0,
        )
        self.assertFalse(well_df.empty)
        self.assertEqual(well_df["well_id"].iloc[0], "DLJ-18")
        self.assertIn("rop_mhr", well_df.columns)
        self.assertIn("torque_kftlb", well_df.columns)
        self.assertIn("offset_mud_loss_count", well_df.columns)
        self.assertIn("is_mud_loss", well_df.columns)

    def test_well_wise_split_no_leakage(self) -> None:
        dataset = self.generator.generate_full_risk_dataset()
        self.assertFalse(dataset.empty)
        self.assertIn("split_group", dataset.columns)

        train_wells = set(dataset[dataset["split_group"] == "train"]["well_id"].unique())
        val_wells = set(dataset[dataset["split_group"] == "val"]["well_id"].unique())
        test_wells = set(dataset[dataset["split_group"] == "test"]["well_id"].unique())

        # Assert no overlap between train, val, and test wells (Strict Zero-Leakage)
        self.assertEqual(len(train_wells.intersection(val_wells)), 0)
        self.assertEqual(len(train_wells.intersection(test_wells)), 0)
        self.assertEqual(len(val_wells.intersection(test_wells)), 0)

    def test_both_classes_present(self) -> None:
        dataset = self.generator.generate_full_risk_dataset()
        # Assert both positive (hazard) and negative (normal drilling) examples exist
        self.assertGreater(dataset["is_mud_loss"].sum(), 0)
        self.assertGreater((dataset["is_mud_loss"] == 0).sum(), 100)


if __name__ == "__main__":
    unittest.main()
