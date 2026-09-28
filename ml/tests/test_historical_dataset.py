"""Behavior tests for the Step 7 historical dataset builder."""

import csv
import json
import tempfile
import unittest
from pathlib import Path

from ml.pipelines.build_historical_dataset import build_historical_dataset
from ml.src.information_extraction.schemas import ExtractedEvent


class HistoricalDatasetTests(unittest.TestCase):
    @staticmethod
    def _event(event_id: str, event_type: str, well_id: str) -> dict:
        return ExtractedEvent(
            event_id=event_id,
            well_id=well_id,
            event_type=event_type,
            depth_md=2845,
            depth_tvd=None,
            formation="Tipam Sandstone",
            severity="HIGH",
            description="Severe event in the formation.",
            cause="Fracture",
            mitigation=None,
            outcome=None,
            source_document=f"{well_id}.pdf",
            source_page=1,
            confidence=0.9,
        ).to_dict()

    def test_builds_csv_and_summary_from_multiple_document_folders(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            processed_root = Path(temp_dir) / "processed"
            (processed_root / "report_a").mkdir(parents=True)
            (processed_root / "report_b").mkdir()
            (processed_root / "report_a" / "events.json").write_text(
                json.dumps({"events": [self._event("a-1", "MUD_LOSS", "OIL-001")]}),
                encoding="utf-8",
            )
            (processed_root / "report_b" / "events.json").write_text(
                json.dumps({"events": [self._event("b-1", "STUCK_PIPE", "OIL-002")]}),
                encoding="utf-8",
            )
            (processed_root / "report_a" / "text.json").write_text(
                json.dumps({
                    "file_name": "report_a.pdf",
                    "cleaned_text": "Well\nOIL-001\nField\nNorth Ridge\nLatitude\n26.123\nLongitude\n94.123",
                }),
                encoding="utf-8",
            )
            (processed_root / "report_a" / "metadata.json").write_text(
                json.dumps({"page_count": 1}), encoding="utf-8"
            )
            (processed_root / "report_b" / "text.json").write_text(
                json.dumps({
                    "file_name": "report_b.pdf",
                    "cleaned_text": "Well\nOIL-002\nField\nSouth Ridge\nLatitude\n27.234\nLongitude\n95.234",
                }),
                encoding="utf-8",
            )
            (processed_root / "report_b" / "metadata.json").write_text(
                json.dumps({"page_count": 1}), encoding="utf-8"
            )
            repeated_well_dir = processed_root / "report_c"
            repeated_well_dir.mkdir()
            (repeated_well_dir / "events.json").write_text(
                json.dumps({"events": []}), encoding="utf-8"
            )
            (repeated_well_dir / "text.json").write_text(
                json.dumps({
                    "file_name": "report_c.pdf",
                    "cleaned_text": "Well\nOIL-001\nField\nNorth Ridge\nLatitude\n26.123\nLongitude\n94.123",
                }),
                encoding="utf-8",
            )
            (repeated_well_dir / "metadata.json").write_text(
                json.dumps({"page_count": 1}), encoding="utf-8"
            )

            summary = build_historical_dataset(processed_root)
            second_summary = build_historical_dataset(processed_root)
            output_dir = processed_root / "historical_dataset"
            with (output_dir / "events.csv").open(encoding="utf-8", newline="") as file:
                rows = list(csv.DictReader(file))
            with (output_dir / "wells.csv").open(encoding="utf-8", newline="") as file:
                well_rows = list(csv.DictReader(file))
            saved_summary = json.loads((output_dir / "dataset_summary.json").read_text(encoding="utf-8"))

            self.assertEqual([row["event_id"] for row in rows], ["a-1", "b-1"])
            self.assertEqual(rows[0]["well_id"], "OIL-001")
            self.assertEqual(rows[0]["depth_md"], "2845")
            self.assertEqual(summary["event_count"], 2)
            self.assertEqual(summary["document_count"], 3)
            self.assertEqual(len(well_rows), 2)
            self.assertEqual(well_rows[0]["well_id"], "OIL-001")
            self.assertEqual(well_rows[0]["latitude"], "26.123")
            self.assertEqual(well_rows[0]["longitude"], "94.123")
            self.assertIn("report_a.pdf", well_rows[0]["source_documents"])
            self.assertIn("report_c.pdf", well_rows[0]["source_documents"])
            self.assertEqual(saved_summary["event_type_counts"]["MUD_LOSS"], 1)
            self.assertEqual(saved_summary["event_type_counts"]["STUCK_PIPE"], 1)
            self.assertEqual(saved_summary["field_coverage"]["formation"]["present"], 2)
            self.assertEqual(saved_summary["field_coverage"]["mitigation"]["missing"], 2)
            self.assertEqual(second_summary["documents_without_events_json"], [])

    def test_rejects_events_outside_canonical_taxonomy(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            processed_root = Path(temp_dir) / "processed"
            folder = processed_root / "report"
            folder.mkdir(parents=True)
            event = self._event("bad-1", "MUD_LOSS", "OIL-001")
            event["event_type"] = "CUSTOM_EVENT"
            (folder / "events.json").write_text(json.dumps({"events": [event]}), encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "Unsupported event type"):
                build_historical_dataset(processed_root)

    def test_writes_evidence_as_json_in_event_csv(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            processed_root = Path(temp_dir) / "processed"
            folder = processed_root / "report"
            folder.mkdir(parents=True)
            event = self._event("evidence-1", "MUD_LOSS", "OIL-001")
            event["source_section"] = "4. EVENTS"
            event["evidence"] = [
                {
                    "field": "event_type",
                    "original_text": "Mud loss at 2845 m",
                    "source_document": "OIL-001.pdf",
                    "source_page": 1,
                    "source_section": "4. EVENTS",
                }
            ]
            (folder / "events.json").write_text(json.dumps({"events": [event]}), encoding="utf-8")

            build_historical_dataset(processed_root)
            with (processed_root / "historical_dataset" / "events.csv").open(encoding="utf-8", newline="") as file:
                row = next(csv.DictReader(file))

            self.assertEqual(json.loads(row["evidence"])[0]["source_page"], 1)


if __name__ == "__main__":
    unittest.main()
