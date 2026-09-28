"""Extract well identity and coordinate metadata from processed report text."""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass

from .entity_extractor import EntityExtractor


@dataclass
class WellRecord:
    """Well-level fields kept separately from incident records."""

    well_id: str | None
    field: str | None
    latitude: float | None
    longitude: float | None
    source_document: str
    source_page: int | None

    def to_dict(self) -> dict:
        return asdict(self)


class WellExtractor:
    """Extract well identifiers, fields, and labeled coordinates from text."""

    NUMBER = r"[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?"
    FIELD_LABELS = {"well", "well id", "field", "rig", "latitude", "longitude", "lat", "lon"}

    def __init__(self) -> None:
        self.entities = EntityExtractor()

    def _coordinate(self, text: str, label: str, valid_hemispheres: str, limit: float) -> float | None:
        pattern = rf"\b(?:{label})\b\s*[:=]?\s*({self.NUMBER})\s*°?\s*([NSEW])?\b"
        match = re.search(pattern, text or "", flags=re.IGNORECASE)
        if not match:
            return None

        value = float(match.group(1).replace(",", ""))
        hemisphere = (match.group(2) or "").upper()
        if hemisphere and hemisphere not in valid_hemispheres:
            return None
        if hemisphere in {"S", "W"}:
            value = -abs(value)
        elif hemisphere in {"N", "E"}:
            value = abs(value)

        return value if abs(value) <= limit else None

    def _field(self, text: str) -> str | None:
        lines = text.splitlines()
        for index, line in enumerate(lines):
            label, separator, inline_value = line.strip().partition(":")
            normalized_label = label.strip().lower()
            if normalized_label != "field":
                continue
            if separator and inline_value.strip():
                return inline_value.strip()
            if index + 1 < len(lines):
                candidate = lines[index + 1].strip()
                if candidate and candidate.lower() not in self.FIELD_LABELS:
                    return candidate
        return None

    def extract(
        self,
        text: str,
        source_document: str,
        page_count: int = 1,
    ) -> WellRecord:
        """Create a well record and validate coordinate ranges."""
        return WellRecord(
            well_id=self.entities.extract_well_id(text),
            field=self._field(text),
            latitude=self._coordinate(text, r"latitude|lat", "NS", 90.0),
            longitude=self._coordinate(text, r"longitude|lon", "EW", 180.0),
            source_document=source_document,
            source_page=1 if page_count == 1 else None,
        )


def extract_well(text: str, source_document: str, page_count: int = 1) -> dict:
    """Convenience wrapper that returns a well record as a dictionary."""
    return WellExtractor().extract(text, source_document, page_count).to_dict()
