"""Text cleaning and normalization for OCR and PDF-extracted content.

This module is the next stage after extraction. It removes noisy artifacts from
PDF text and OCR output so the downstream information-extraction steps receive
cleaner, more structured text.
"""

from __future__ import annotations

import re
import unicodedata


class TextCleaner:
    """Simple text cleaning pipeline for PDF/OCR output."""

    def __init__(self) -> None:
        self.page_break_patterns = [
            r"\n{3,}",
            r"\r\n",
            r"\n+",
        ]

    def normalize_unicode(self, text: str) -> str:
        """Normalize Unicode characters to a more predictable ASCII-friendly form."""
        return unicodedata.normalize("NFKC", text)

    def normalize_whitespace(self, text: str) -> str:
        """Collapse repeated whitespace and normalize newlines."""
        text = self.normalize_unicode(text)
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        text = text.replace("\u00a0", " ")
        text = re.sub(r"\t+", " ", text)
        text = re.sub(r"[ \t]+\n", "\n", text)
        text = re.sub(r"\n[ \t]+", "\n", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    def remove_noise(self, text: str) -> str:
        """Remove PDF/OCR artifacts such as repeated page numbers and broken separators."""
        cleaned = text

        # Remove page markers such as "Page 1 of 3".
        cleaned = re.sub(r"(?im)^\s*page\s*\d+\s*(?:of\s*\d+)?\s*$", "", cleaned)

        # Remove repeated separators or filler lines.
        cleaned = re.sub(r"(?im)^\s*[-_=]{3,}\s*$", "", cleaned)

        # Remove odd date-like or range artifacts that are not useful in prose.
        cleaned = re.sub(r"\b\d{1,3}\s*[-|/]\s*\d{1,3}\b", " ", cleaned)

        # Collapse repeated spaces while keeping paragraph breaks.
        cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
        return cleaned.strip()

    def clean(self, text: str) -> str:
        """Apply the full cleaning pipeline."""
        if text is None:
            return ""

        text = self.normalize_whitespace(text)
        text = self.remove_noise(text)
        return text.strip()


def clean_text(text: str) -> str:
    """Convenience function to clean and normalize text."""
    cleaner = TextCleaner()
    return cleaner.clean(text)


if __name__ == "__main__":
    sample = """
    Mud Losses       observed   while drilling.\n\nPage 1 of 3\n\nWell: OIL-102\n\n"""
    print(clean_text(sample))
