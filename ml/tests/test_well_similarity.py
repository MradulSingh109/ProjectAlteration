"""Unit tests for the Well Similarity Engine (Step 9)."""

from pathlib import Path
import unittest

BASE_DIR = Path(__file__).resolve().parent.parent
WELLS_CSV = BASE_DIR / "data/processed/good_data_processed/historical_dataset/wells.csv"
EVENTS_CSV = BASE_DIR / "data/processed/good_data_processed/historical_dataset/events.csv"

try:
    from ml.src.similarity.schemas import SimilarityWeights
    from ml.src.similarity.well_similarity import WellSimilarityEngine, haversine_distance_km
except ModuleNotFoundError:
    import sys
    sys.path.insert(0, str(BASE_DIR))
    from src.similarity.schemas import SimilarityWeights
    from src.similarity.well_similarity import WellSimilarityEngine, haversine_distance_km


class TestWellSimilarity(unittest.TestCase):
    def test_haversine_distance_accuracy(self) -> None:
        # DLJ-07 (27.5072, 95.0751) to DLJ-12 (27.5130, 95.1486) ~ 7.3 km
        dist = haversine_distance_km(27.5072, 95.0751, 27.5130, 95.1486)
        self.assertTrue(7.0 < dist < 7.6)

    def test_similarity_weights_validation(self) -> None:
        with self.assertRaises(ValueError):
            SimilarityWeights(geo_weight=0.5, formation_weight=0.5, depth_weight=0.5, event_weight=0.5)

    def test_engine_initialization(self) -> None:
        engine = WellSimilarityEngine(wells_csv_path=WELLS_CSV, events_csv_path=EVENTS_CSV)
        known_wells = engine.get_known_well_ids()
        self.assertIn("DLJ-18", known_wells)
        self.assertIn("DLJ-12", known_wells)
        self.assertGreaterEqual(len(known_wells), 10)

    def test_find_similar_wells_for_dlj18(self) -> None:
        engine = WellSimilarityEngine(wells_csv_path=WELLS_CSV, events_csv_path=EVENTS_CSV)
        response = engine.find_similar_wells(active_well_id="DLJ-18", depth_md=2950.0, top_k=3)

        self.assertEqual(response.active_well, "DLJ-18")
        self.assertEqual(len(response.similar_wells), 3)

        top_match = response.similar_wells[0]
        self.assertEqual(top_match.well_id, "DLJ-12")
        self.assertGreater(top_match.overall_similarity, 0.5)
        self.assertIsNotNone(top_match.distance_km)
        self.assertGreaterEqual(top_match.matched_events_count, 1)

    def test_adhoc_coordinate_and_depth_query(self) -> None:
        engine = WellSimilarityEngine(wells_csv_path=WELLS_CSV, events_csv_path=EVENTS_CSV)
        response = engine.find_similar_wells(
            latitude=27.46,
            longitude=95.06,
            depth_md=2940.0,
            formation="Barail",
            top_k=5,
        )

        self.assertEqual(response.active_well, "ADHOC_QUERY")
        self.assertGreater(len(response.similar_wells), 0)
        top_ids = [m.well_id for m in response.similar_wells]
        self.assertTrue("DLJ-12" in top_ids or "DLJ-18" in top_ids)

    def test_max_radius_filter(self) -> None:
        engine = WellSimilarityEngine(wells_csv_path=WELLS_CSV, events_csv_path=EVENTS_CSV)
        response = engine.find_similar_wells(
            active_well_id="DLJ-18",
            max_radius_km=5.0,
            top_k=5,
        )
        returned_ids = [m.well_id for m in response.similar_wells]
        self.assertNotIn("DLJ-12", returned_ids)

    def test_batch_similarity_matrix(self) -> None:
        engine = WellSimilarityEngine(wells_csv_path=WELLS_CSV, events_csv_path=EVENTS_CSV)
        matrix = engine.compute_similarity_matrix()

        self.assertFalse(matrix.empty)
        self.assertIn("DLJ-18", matrix.index)
        self.assertIn("DLJ-18", matrix.columns)
        self.assertEqual(matrix.loc["DLJ-18", "DLJ-18"], 1.0)


if __name__ == "__main__":
    unittest.main()
