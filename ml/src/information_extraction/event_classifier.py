"""Transparent rule-based classification of common drilling events."""

from __future__ import annotations

import re

from .taxonomy import EVENT_TYPES


class EventClassifier:
    """Map event phrases and report codes to canonical event types."""

    EVENT_PATTERNS = {
        "MUD_LOSS": (r"\bmud\s+loss(?:es)?\b", r"\bMUD_LOSS\b"),
        "KICK": (r"\bkick\b", r"\binflux\b"),
        "TORQUE_SPIKE": (r"\btorque\s+(?:spike|increase|increased|increasing)\b", r"\bTORQUE_SPIKE\b"),
        "STUCK_PIPE": (
            r"\bstuck pipe\b",
            r"\bpipe stuck\b",
            r"\bdifferential(?:\s+pipe)? sticking\b",
            r"\bpipe sticking\b",
        ),
        "FISHING": (r"\bfishing operation\b", r"\bfishing job\b", r"\bfishing tools?\b"),
        "PRESSURE_SPIKE": (r"\bpressure\s+(?:spike|increase|increased|increasing)\b",),
        "OVERPRESSURE": (r"\boverpressure\b", r"\bpressure above (?:the )?limit\b"),
        "LOST_CIRCULATION": (r"\bloss of circulation\b", r"\bcirculation loss\b", r"\bLOST_CIRCULATION\b"),
        "CEMENTING_FAILURE": (r"\bcement returns? delayed\b", r"\bdelayed cement returns?\b", r"\bcement(?:ing)? failure\b", r"\bcement job failed\b"),
        "CASING_PROBLEM": (r"\bcasing (?:problem|failure|leak|collapse)\b",),
        "NPT": (r"\bNPT\b", r"\bnon[- ]productive time\b"),
        "FORMATION_CHANGE": (r"\bformation (?:change|changed|transition)\b",),
        "WELL_CONTROL": (r"\bwell control\b",),
    }

    if set(EVENT_PATTERNS) != set(EVENT_TYPES):
        raise ValueError("Event patterns must define every canonical event type exactly once")

    def classify(self, text: str) -> str | None:
        """Return the first matching event type, or None if no rule matches."""
        heading = (text or "").split("|", maxsplit=1)[0]
        normalized = heading.lower().replace("_", " ")
        for event_type, patterns in self.EVENT_PATTERNS.items():
            if any(re.search(pattern, normalized, flags=re.IGNORECASE) for pattern in patterns):
                return event_type
        return None
