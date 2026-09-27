"""Document classification for NWIS PDF files.

This module decides what kind of document a PDF appears to be before the rest of
processing continues. In this project, that matters because different document
classes (for example drilling reports vs. mud logs) may require different
extraction or OCR behavior.

The implementation is intentionally simple and explainable at first so it can be
expanded later with better rules or a trained classifier.
"""

from __future__ import annotations

import re
from pathlib import Path


class PdfClassifier:
    """Rule-based classifier for common NWIS document types."""

    def __init__(self) -> None:
        self.document_type_rules = {
            "well_completion_report": [
                "well completion report",
                "completion report",
                "wcr",
                "drilling report",
                "well report",
            ],
            "daily_drilling_report": [
                "daily drilling report",
                "ddr",
                "drilling daily",
                "daily report",
            ],
            "mudlog": [
                "mud log",
                "mudlog",
                "mud log report",
            ],
            "well_survey": [
                "well survey",
                "survey",
                "directional survey",
            ],
            "cementing_report": [
                "cementing",
                "cement job",
                "cement report",
            ],
        }

    def classify(self, file_path: str | Path, text: str | None = None) -> str:
        """Classify a PDF by filename and optionally by extracted text."""
        normalized_path = str(file_path).lower()
        normalized_text = (text or "").lower()

        for doc_type, keywords in self.document_type_rules.items():
            if any(keyword in normalized_path for keyword in keywords):
                return doc_type

        for doc_type, keywords in self.document_type_rules.items():
            if any(keyword in normalized_text for keyword in keywords):
                return doc_type

        # Heuristics for common well-document patterns when no keyword matches.
        if re.search(r"mud|loss|lithology|gas", normalized_text):
            return "mudlog"

        if re.search(r"completion|well report|casing|cement|perforat", normalized_text):
            return "well_completion_report"

        if re.search(r"survey|inclination|azimuth|md|tvd", normalized_text):
            return "well_survey"

        return "unknown"


def classify_pdf(file_path: str | Path, text: str | None = None) -> str:
    """Convenience wrapper around the classifier."""
    classifier = PdfClassifier()
    return classifier.classify(file_path, text)


if __name__ == "__main__":
    sample_paths = [
        "WCR_OIL102.pdf",
        "DDR_OIL102_2024_03_12.pdf",
        "MUDLOG_OIL087.pdf",
        "WELL_SURVEY_OIL102.pdf",
    ]

    for path in sample_paths:
        print(path, "->", classify_pdf(path))
