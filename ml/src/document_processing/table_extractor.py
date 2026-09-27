"""Table extraction support for PDF document processing.

This module is designed to extract tabular content from PDFs that include data
stored in tables, such as well survey tables or drilling summary tables.

The initial implementation is intentionally lightweight and focuses on the
common cases needed in this project: rows separated by whitespace and simple
text-based tabular layouts.
"""

from __future__ import annotations

import re


class TableExtractor:
    """Extract tabular sections from cleaned PDF or OCR text."""

    COLUMN_HEADERS = {
        "actual", "average", "azimuth", "bottom md", "cause", "date",
        "depth", "depth end", "depth md", "depth start", "description",
        "dogleg", "event", "formation", "inclination", "lead density",
        "lithology", "maximum", "md", "mitigation", "mud weight",
        "observation", "parameter", "planned", "rop", "rpm", "severity",
        "setting depth", "spp", "tail density", "time", "top md", "tvd",
        "volume", "well", "well id", "wob",
    }

    def _is_column_header(self, line: str) -> bool:
        return line.strip().lower() in self.COLUMN_HEADERS

    def _extract_vertical_tables(self, lines: list[str]) -> list[list[str]]:
        """Group tables whose PDF text lays out each cell on a separate line."""
        rows: list[list[str]] = []
        index = 0

        while index < len(lines):
            if not self._is_column_header(lines[index]):
                index += 1
                continue

            headers = []
            header_end = index
            while header_end < len(lines) and self._is_column_header(lines[header_end]):
                headers.append(lines[header_end].strip())
                header_end += 1

            if len(headers) < 2:
                index += 1
                continue

            data_rows = []
            data_index = header_end
            width = len(headers)
            while data_index + width <= len(lines):
                cells = [cell.strip() for cell in lines[data_index:data_index + width]]
                if any(not cell for cell in cells):
                    break

                numeric_count = sum(bool(re.search(r"\d", cell)) for cell in cells)
                if not (re.search(r"\d", cells[0]) or numeric_count >= width - 1):
                    break

                data_rows.append(cells)
                data_index += width

            if data_rows:
                rows.append(headers)
                rows.extend(data_rows)
                index = data_index
            else:
                index += len(headers)

        return rows

    def _is_table_like_row(self, line: str) -> bool:
        """Heuristic: table rows usually contain several tokens and at least one number."""
        stripped = line.strip()
        if not stripped:
            return False

        parts = re.split(r"\s{2,}|\t+", stripped)
        parts = [part.strip() for part in parts if part.strip()]

        if len(parts) < 2:
            return False

        return any(re.search(r"\d", part) for part in parts)

    def extract_tables_from_text(self, text: str) -> list[list[str]]:
        """Extract tables in either whitespace-separated or vertical-cell layouts."""
        if not text:
            return []

        lines = [line.strip() for line in text.splitlines()]
        table_rows = self._extract_vertical_tables(lines)

        for line in lines:
            if not self._is_table_like_row(line):
                continue

            parts = re.split(r"\s{2,}|\t+", line.strip())
            row = [part.strip() for part in parts if part.strip()]
            if row:
                table_rows.append(row)

        return table_rows

    def find_table_sections(self, text: str) -> list[str]:
        """Return raw table-like blocks from the text."""
        blocks: list[str] = []
        current_block: list[str] = []

        for line in text.splitlines():
            candidate = line.strip()
            if not candidate:
                if current_block:
                    blocks.append("\n".join(current_block))
                    current_block = []
                continue

            if self._is_table_like_row(candidate):
                current_block.append(candidate)
            elif current_block:
                blocks.append("\n".join(current_block))
                current_block = []

        if current_block:
            blocks.append("\n".join(current_block))

        return blocks


def extract_tables(text: str) -> list[list[str]]:
    """Convenience function for table extraction."""
    extractor = TableExtractor()
    return extractor.extract_tables_from_text(text)


if __name__ == "__main__":
    sample_text = """
    Depth   Formation   Description
    2845   Limestone   Mud loss observed
    2880   Sandstone   Formation change
    """
    print(extract_tables(sample_text))
