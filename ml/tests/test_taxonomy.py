"""Tests for the shared event taxonomy contract."""

import json
import unittest
from pathlib import Path

from ml.src.information_extraction.event_classifier import EventClassifier
from ml.src.information_extraction.taxonomy import EVENT_TYPES, SEVERITY_LEVELS


class TaxonomyContractTests(unittest.TestCase):
    def test_python_labels_match_shared_json_contract(self):
        contract_path = Path(__file__).resolve().parents[1] / "contracts" / "event_taxonomy.json"
        contract = json.loads(contract_path.read_text(encoding="utf-8"))

        self.assertEqual(tuple(contract["event_types"]), EVENT_TYPES)
        self.assertEqual(tuple(contract["severity_levels"]), SEVERITY_LEVELS)
        self.assertEqual(len(EVENT_TYPES), len(set(EVENT_TYPES)))
        self.assertEqual(len(SEVERITY_LEVELS), len(set(SEVERITY_LEVELS)))

    def test_classifier_covers_exactly_the_shared_event_types(self):
        self.assertEqual(set(EventClassifier.EVENT_PATTERNS), set(EVENT_TYPES))


if __name__ == "__main__":
    unittest.main()
