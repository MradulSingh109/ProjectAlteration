"""Canonical event and severity labels loaded from the shared JSON contract."""

import json
from pathlib import Path


CONTRACT_PATH = Path(__file__).resolve().parents[2] / "contracts" / "event_taxonomy.json"
TAXONOMY = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))

EVENT_TYPES = tuple(TAXONOMY["event_types"])
SEVERITY_LEVELS = tuple(TAXONOMY["severity_levels"])
