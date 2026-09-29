"""Behavior tests for well identity and coordinate extraction."""

import unittest

from ml.src.information_extraction.well_extractor import WellExtractor


class WellExtractorTests(unittest.TestCase):
    def setUp(self):
        self.extractor = WellExtractor()

    def test_extracts_coordinates_when_each_label_has_its_own_line(self):
        record = self.extractor.extract(
            "Well\nDLJ-12\nField\nDuliajan\nLatitude\n27.5130\nLongitude\n95.1486",
            source_document="DDR_DLJ-12.pdf",
            page_count=1,
        )

        self.assertEqual(record.well_id, "DLJ-12")
        self.assertEqual(record.field, "Duliajan")
        self.assertEqual(record.latitude, 27.513)
        self.assertEqual(record.longitude, 95.1486)
        self.assertEqual(record.source_page, 1)

    def test_extracts_inline_coordinates_and_validates_ranges(self):
        record = self.extractor.extract(
            "WELL ID: W-076 | Latitude: 27.4612 Longitude: 95.0595",
            source_document="CementingReport_W076.pdf",
        )
        invalid = self.extractor.extract(
            "Well: W-077 Latitude: 127.0 Longitude: 195.0",
            source_document="invalid_coordinates.pdf",
        )

        self.assertEqual(record.well_id, "W-076")
        self.assertEqual(record.latitude, 27.4612)
        self.assertEqual(record.longitude, 95.0595)
        self.assertIsNone(invalid.latitude)
        self.assertIsNone(invalid.longitude)

    def test_prefers_labeled_well_id_over_integrity_hash(self):
        record = self.extractor.extract(
            "SHA-256 INTEGRITY HASH: 44ff072bd8bc7a5dc7f981e2599b4537\nWELL ID: W-076",
            source_document="CementingReport_W076.pdf",
        )

        self.assertEqual(record.well_id, "W-076")


if __name__ == "__main__":
    unittest.main()
