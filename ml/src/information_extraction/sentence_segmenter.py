"""Split extracted report text into sentence-like units."""

from __future__ import annotations

import re


def split_sentences(text: str) -> list[str]:
    """Split on line breaks and sentence-ending punctuation."""
    if not text:
        return []

    segments = re.split(r"(?:\r?\n)+|(?<=[.!?])\s+(?=[A-Z0-9])", text)
    return [segment.strip() for segment in segments if segment.strip()]
