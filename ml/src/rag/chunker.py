"""Document chunker and metadata enricher for NWIS RAG system."""

from __future__ import annotations

import json
from pathlib import Path
import re
from typing import Any

from .schemas import RAGChunk


class DocumentChunker:
    """Chunks processed drilling reports and enriches them with domain metadata."""

    def __init__(self, processed_data_dir: str | Path) -> None:
        self.processed_dir = Path(processed_data_dir)

    def load_all_chunks(self) -> list[RAGChunk]:
        """Traverse all processed document directories and generate enriched chunks."""
        chunks: list[RAGChunk] = []

        if not self.processed_dir.exists():
            return chunks

        for doc_dir in self.processed_dir.iterdir():
            if not doc_dir.is_dir() or doc_dir.name in ["historical_dataset"]:
                continue

            text_json_path = doc_dir / "text.json"
            events_json_path = doc_dir / "events.json"

            if not text_json_path.exists():
                continue

            with open(text_json_path, "r", encoding="utf-8") as f:
                text_data = json.load(f)

            events_data = []
            if events_json_path.exists():
                with open(events_json_path, "r", encoding="utf-8") as f:
                    raw_events = json.load(f)
                    if isinstance(raw_events, dict):
                        events_data = raw_events.get("events", [])
                    elif isinstance(raw_events, list):
                        events_data = raw_events

            doc_chunks = self._chunk_document(text_data, events_data, doc_dir.name)
            chunks.extend(doc_chunks)

        return chunks

    def _chunk_document(
        self,
        text_data: dict[str, Any],
        events_data: list[dict[str, Any]],
        doc_folder_name: str,
    ) -> list[RAGChunk]:
        """Chunk a single document by sections and pages."""
        file_name = text_data.get("file_name", f"{doc_folder_name}.pdf")
        page_texts = text_data.get("page_texts", [])
        if not page_texts and "cleaned_text" in text_data:
            page_texts = [text_data["cleaned_text"]]

        chunks: list[RAGChunk] = []
        chunk_idx = 0

        # Extract primary well_id from filename or text
        well_match = re.search(r"(?:DLJ|HGJ|NHK|NHR|W)-?\d+", file_name, re.IGNORECASE)
        default_well_id = well_match.group(0).upper() if well_match else None

        for page_num, page_content in enumerate(page_texts, 1):
            sections = self._split_into_sections(page_content)

            for sec_name, sec_text in sections:
                if len(sec_text.strip()) < 20:
                    continue

                # Extract domain entities from text or events
                formation = self._extract_formation(sec_text)
                depth_min, depth_max = self._extract_depths(sec_text)
                event_types = self._extract_event_types(sec_text, events_data)

                # If section matches an event record, enrich with exact event metadata
                well_id = default_well_id
                for ev in events_data:
                    if not isinstance(ev, dict):
                        continue
                    ev_sec = str(ev.get("source_section", "")).lower()
                    if ev_sec and (ev_sec in sec_name.lower() or sec_name.lower() in ev_sec):
                        if ev.get("well_id"):
                            well_id = str(ev["well_id"])
                        if ev.get("formation") and not formation:
                            formation = str(ev["formation"])
                        if ev.get("depth_md"):
                            try:
                                d_val = float(ev["depth_md"])
                                depth_min = d_val if depth_min is None else min(depth_min, d_val)
                                depth_max = d_val if depth_max is None else max(depth_max, d_val)
                            except (ValueError, TypeError):
                                pass

                chunk_idx += 1
                chunk_id = f"{file_name}:p{page_num}:c{chunk_idx:03d}"

                chunks.append(
                    RAGChunk(
                        chunk_id=chunk_id,
                        text=sec_text.strip(),
                        document_id=file_name,
                        page=page_num,
                        well_id=well_id,
                        section=sec_name,
                        formation=formation,
                        depth_min=depth_min,
                        depth_max=depth_max,
                        event_types=event_types,
                    )
                )

        return chunks

    def _split_into_sections(self, text: str) -> list[tuple[str, str]]:
        """Split text into distinct sections based on headers."""
        lines = text.splitlines()
        sections: list[tuple[str, str]] = []

        current_sec = "GENERAL"
        current_lines: list[str] = []

        header_pattern = re.compile(
            r"^(?:\d+[\.\)]\s*)?([A-Z\s/]{3,40}(?:SUMMARY|STATUS|PROPERTIES|EVENTS|REMARKS|LESSONS|RECOMMENDATIONS|STUDY|REPORT))",
            re.IGNORECASE,
        )

        for line in lines:
            clean_line = line.strip()
            match = header_pattern.match(clean_line)
            if match and len(current_lines) > 2:
                sections.append((current_sec, "\n".join(current_lines)))
                current_sec = match.group(0).strip()
                current_lines = [line]
            else:
                current_lines.append(line)

        if current_lines:
            sections.append((current_sec, "\n".join(current_lines)))

        return sections

    def _extract_formation(self, text: str) -> str | None:
        for fmt in ["Barail", "Tipam", "Kopili", "Sylhet", "Girujan", "Alluvium"]:
            if re.search(rf"\b{fmt}\b", text, re.IGNORECASE):
                return fmt
        return None

    def _extract_depths(self, text: str) -> tuple[float | None, float | None]:
        depth_matches = re.findall(r"(?:at|@|depth|interval|from)\s*([0-9]{1,2},?[0-9]{3})\s*(?:m|meters)?", text, re.IGNORECASE)
        if not depth_matches:
            depth_matches = re.findall(r"\b([1-4],?[0-9]{3})\s*m\b", text, re.IGNORECASE)

        depths: list[float] = []
        for dm in depth_matches:
            try:
                val = float(dm.replace(",", ""))
                if 500 <= val <= 6000:
                    depths.append(val)
            except ValueError:
                pass

        if depths:
            return min(depths), max(depths)
        return None, None

    def _extract_event_types(self, text: str, events_data: list[dict[str, Any]]) -> list[str]:
        types = set()
        t_upper = text.upper()
        if "MUD LOSS" in t_upper or "LOSS OF RETURNS" in t_upper or "LOST CIRCULATION" in t_upper:
            types.add("MUD_LOSS")
        if "STUCK PIPE" in t_upper or "DIFFERENTIAL STICKING" in t_upper or "PACK-OFF" in t_upper:
            types.add("STUCK_PIPE")
        if "KICK" in t_upper or "INFLUX" in t_upper or "WELL CONTROL" in t_upper:
            types.add("KICK")
        if "TORQUE SPIKE" in t_upper or "STICK-SLIP" in t_upper:
            types.add("TORQUE_SPIKE")
        return sorted(list(types))
