"""Combine text, table rows, and rule-based classifiers into event records."""

from __future__ import annotations

import re
from pathlib import Path

from .entity_extractor import EntityExtractor
from .event_classifier import EventClassifier
from .schemas import ExtractedEvent
from .sentence_segmenter import split_sentences


class EventExtractor:
    """Extract event records from a processed document's text and tables."""

    def __init__(self) -> None:
        self.entities = EntityExtractor()
        self.classifier = EventClassifier()

    @staticmethod
    def _normalized_header(value: str) -> str:
        return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()

    def _evidence_for_event(
        self,
        event: ExtractedEvent,
        original_text: str,
        source_section: str | None,
        source_document_text: str | None = None,
    ) -> list[dict]:
        lines = [line.strip() for line in original_text.splitlines() if line.strip()]
        evidence = []
        fields_to_cite = (
            "event_type", "description", "well_id", "depth_md", "depth_tvd", "formation", "severity",
            "cause", "mitigation", "outcome", "npt_hours",
        )

        for field_name in fields_to_cite:
            value = getattr(event, field_name)
            if value is None:
                continue

            matching_line = None
            for line in lines:
                if isinstance(value, str) and value.casefold() in line.casefold():
                    matching_line = line
                elif field_name == "event_type" and self.classifier.classify(line) == value:
                    matching_line = line
                elif field_name == "description" and str(value).lower() in line.lower():
                    matching_line = line
                elif field_name == "depth_md" and self.entities.extract_depth_md(line) == value:
                    matching_line = line
                elif field_name == "severity" and self.entities.extract_severity(line) == value:
                    matching_line = line
                elif field_name == "formation" and re.search(rf"\b{re.escape(str(value))}\b", line, re.IGNORECASE):
                    matching_line = line
                elif field_name == "cause" and re.search(r"\b(?:cause|caused by|due to|because of)\b", line, re.IGNORECASE):
                    matching_line = line
                elif field_name == "mitigation" and re.search(r"\b(?:mitigation|treated with|treatment|applied)\b", line, re.IGNORECASE):
                    matching_line = line
                elif field_name == "outcome" and re.search(r"\b(?:outcome|result|freed pipe|pipe freed|resolved)\b", line, re.IGNORECASE):
                    matching_line = line
                elif field_name == "npt_hours" and self.entities.extract_npt_hours(line) == value:
                    matching_line = line
                elif field_name == "well_id" and re.search(rf"\b{re.escape(str(value))}\b", line, re.IGNORECASE):
                    matching_line = line

                if matching_line:
                    break

            if field_name == "well_id" and matching_line is None and source_document_text:
                for line in source_document_text.splitlines():
                    if re.search(
                        rf"\b(?:well(?:\s+id|\s+identifier)?\s*[:|]\s*){re.escape(str(value))}\b",
                        line,
                        flags=re.IGNORECASE,
                    ):
                        matching_line = line.strip()
                        break

            evidence.append({
                "field": field_name,
                "original_text": matching_line or original_text.strip(),
                "source_document": event.source_document,
                "source_page": event.source_page,
                "source_section": source_section,
            })

        return evidence

    def _make_event(
        self,
        description: str,
        source_document: str,
        source_page: int | None,
        sequence: int,
        confidence: float,
        event_type: str | None = None,
        depth: int | float | None = None,
        severity: str | None = None,
        cause: str | None = None,
        mitigation: str | None = None,
        outcome: str | None = None,
        npt_hours: float | None = None,
        formation: str | None = None,
        well_id: str | None = None,
        source_section: str | None = None,
        evidence_text: str | None = None,
        source_document_text: str | None = None,
    ) -> ExtractedEvent | None:
        event_type = event_type or self.classifier.classify(description)
        if event_type is None:
            return None

        depth = depth if depth is not None else self.entities.extract_depth_md(description)
        severity = self.entities.extract_severity(severity or description)
        formation = formation or self.entities.extract_formation(description)
        cause = cause or self.entities.extract_cause(description)
        mitigation = mitigation or self.entities.extract_mitigation(description)
        outcome = outcome or self.entities.extract_outcome(description)
        npt_hours = npt_hours if npt_hours is not None else self.entities.extract_npt_hours(description)

        event = ExtractedEvent(
            event_id=f"{Path(source_document).stem}:event-{sequence:03d}",
            well_id=well_id or self.entities.extract_well_id(description),
            event_type=event_type,
            depth_md=depth,
            depth_tvd=None,
            formation=formation,
            severity=severity,
            description=description.strip(),
            cause=cause,
            mitigation=mitigation,
            outcome=outcome,
            source_document=source_document,
            source_page=source_page,
            confidence=confidence,
            npt_hours=npt_hours,
            source_section=source_section,
        )
        event.evidence = self._evidence_for_event(
            event,
            evidence_text or description,
            source_section,
            source_document_text,
        )
        return event

    @staticmethod
    def _is_numbered_section_heading(line: str) -> bool:
        return bool(re.fullmatch(r"\s*\d+\.\s+[A-Z][A-Z0-9 /&()\-]*\s*", line))

    def _events_from_incident_section(
        self,
        text: str,
        source_document: str,
        source_page: int | None,
        well_id: str | None,
        start_sequence: int,
    ) -> list[ExtractedEvent]:
        lines = text.splitlines()
        section_header = re.compile(
            r"^\s*\d+\.\s+(?:(?:DRILLING|OPERATIONAL)\s+)?(?:EVENTS|INCIDENTS)(?:\s*/.*)?\s*$",
            flags=re.IGNORECASE,
        )
        section_start = next(
            (index + 1 for index, line in enumerate(lines) if section_header.match(line)),
            None,
        )
        if section_start is None:
            return []
        source_section = lines[section_start - 1].strip() or "Incident section"

        events = []
        sequence = start_sequence
        index = section_start
        while index < len(lines):
            if self._is_numbered_section_heading(lines[index]):
                break

            heading_match = re.match(r"^\s*\d+\.\s+(.+)$", lines[index])
            event_type = self.classifier.classify(heading_match.group(1)) if heading_match else None
            if event_type is None:
                index += 1
                continue

            heading = heading_match.group(1).strip()
            group_lines = [heading]
            index += 1
            while index < len(lines):
                if self._is_numbered_section_heading(lines[index]):
                    break
                next_heading = re.match(r"^\s*\d+\.\s+(.+)$", lines[index])
                if next_heading and self.classifier.classify(next_heading.group(1)):
                    break
                group_lines.append(lines[index])
                index += 1

            group_text = "\n".join(group_lines)
            description = re.split(r"\s*\|\s*", heading, maxsplit=1)[0].strip()
            description = re.sub(r"^(?:EXTRACTED EVENT:\s*)", "", description, flags=re.IGNORECASE)
            sequence += 1
            event = self._make_event(
                description=description,
                source_document=source_document,
                source_page=source_page,
                sequence=sequence,
                confidence=0.9,
                event_type=event_type,
                depth=self.entities.extract_depth_md(group_text),
                severity=self.entities.extract_severity(group_text),
                cause=self.entities.extract_cause(group_text),
                mitigation=self.entities.extract_mitigation(group_text),
                outcome=self.entities.extract_outcome(group_text),
                npt_hours=self.entities.extract_npt_hours(group_text),
                formation=self.entities.extract_formation(group_text),
                well_id=well_id,
                source_section=source_section,
                evidence_text=group_text,
                source_document_text=text,
            )
            if event:
                events.append(event)

        return events

    def _enrich_from_matching_sentences(self, event: ExtractedEvent, text: str) -> None:
        """Attach missing attributes only from sentences matching this event's type and depth."""
        if event.depth_md is None:
            return

        paragraphs = re.split(r"\r?\n\s*\r?\n", text)
        for paragraph in paragraphs:
            sentences = split_sentences(paragraph)
            for index, sentence in enumerate(sentences):
                if self.classifier.classify(sentence) != event.event_type:
                    continue
                if self.entities.extract_depth_md(sentence) != event.depth_md:
                    continue

                evidence = [sentence]
                for following in sentences[index + 1:]:
                    if self.classifier.classify(following) is not None:
                        break
                    evidence.append(following)
                evidence_text = " ".join(evidence)
                event.cause = event.cause or self.entities.extract_cause(evidence_text)
                event.mitigation = event.mitigation or self.entities.extract_mitigation(evidence_text)
                event.outcome = event.outcome or self.entities.extract_outcome(evidence_text)
                event.formation = event.formation or self.entities.extract_formation(evidence_text)
                event.evidence = self._evidence_for_event(
                    event,
                    text,
                    event.source_section,
                    source_document_text=text,
                )

    def _events_from_labeled_event_blocks(
        self,
        text: str,
        source_document: str,
        source_page: int | None,
        well_id: str | None,
        start_sequence: int,
    ) -> list[ExtractedEvent]:
        lines = text.splitlines()
        event_label = re.compile(r"^\s*(?:EXTRACTED\s+)?EVENT\s*:\s*(.+)$", re.IGNORECASE)
        events = []
        sequence = start_sequence
        index = 0

        while index < len(lines):
            match = event_label.match(lines[index])
            event_type = self.classifier.classify(match.group(1)) if match else None
            if event_type is None:
                index += 1
                continue

            event_description = match.group(1).strip()
            block_lines = [event_description]
            index += 1
            while index < len(lines) and lines[index].strip():
                if (
                    event_label.match(lines[index])
                    or self._is_numbered_section_heading(lines[index])
                    or re.fullmatch(r"\s*[-_=]{3,}\s*", lines[index])
                ):
                    break
                block_lines.append(lines[index].strip())
                index += 1

            block_text = "\n".join(block_lines)
            sequence += 1
            event = self._make_event(
                description=event_description,
                source_document=source_document,
                source_page=source_page,
                sequence=sequence,
                confidence=0.9,
                event_type=event_type,
                depth=self.entities.extract_depth_md(block_text),
                severity=self.entities.extract_severity(block_text),
                cause=self.entities.extract_cause(block_text),
                mitigation=self.entities.extract_mitigation(block_text),
                outcome=self.entities.extract_outcome(block_text),
                npt_hours=self.entities.extract_npt_hours(block_text),
                formation=self.entities.extract_formation(block_text),
                well_id=well_id,
                source_section="EXTRACTED EVENT",
                evidence_text=block_text,
                source_document_text=text,
            )
            if event:
                self._enrich_from_matching_sentences(event, text)
                events.append(event)

        return events

    def _events_from_tables(
        self,
        tables: list[list[str]],
        source_document: str,
        source_page: int | None,
        well_id: str | None,
        start_sequence: int,
    ) -> list[ExtractedEvent]:
        events = []
        sequence = start_sequence
        for header_index, header_row in enumerate(tables):
            normalized = [self._normalized_header(cell) for cell in header_row]
            if "event" not in normalized and "event type" not in normalized:
                continue

            event_index = normalized.index("event") if "event" in normalized else normalized.index("event type")
            depth_index = next((i for i, name in enumerate(normalized) if name in {"depth", "depth md", "md"}), None)
            severity_index = next((i for i, name in enumerate(normalized) if name == "severity"), None)
            description_index = next((i for i, name in enumerate(normalized) if name in {"description", "observation", "details"}), None)
            cause_index = next((i for i, name in enumerate(normalized) if name == "cause"), None)
            mitigation_index = next((i for i, name in enumerate(normalized) if name == "mitigation"), None)

            for row in tables[header_index + 1:]:
                row_headers = [self._normalized_header(cell) for cell in row]
                if "event" in row_headers or "event type" in row_headers:
                    break
                if event_index >= len(row):
                    break

                raw_event = row[event_index]
                event_type = self.classifier.classify(raw_event)
                if event_type is None:
                    continue

                depth = self.entities.extract_depth_md(row[depth_index]) if depth_index is not None and depth_index < len(row) else None
                severity = row[severity_index] if severity_index is not None and severity_index < len(row) else None
                cause = row[cause_index] if cause_index is not None and cause_index < len(row) else None
                mitigation = row[mitigation_index] if mitigation_index is not None and mitigation_index < len(row) else None
                observation = row[description_index] if description_index is not None and description_index < len(row) else ""
                description = f"{raw_event}: {observation}".strip(": ")

                sequence += 1
                event = self._make_event(
                    description=description,
                    source_document=source_document,
                    source_page=source_page,
                    sequence=sequence,
                    confidence=0.9,
                    event_type=event_type,
                    depth=depth,
                    severity=severity,
                    cause=cause,
                    mitigation=mitigation,
                    well_id=well_id,
                    source_section="Extracted event table",
                    evidence_text="\n".join([" | ".join(header_row), " | ".join(row)]),
                )
                if event:
                    events.append(event)

        return events

    def extract(
        self,
        text: str,
        tables: list[list[str]] | None = None,
        source_document: str = "unknown",
        page_count: int = 1,
        page_texts: list[str] | None = None,
    ) -> list[dict]:
        """Extract normalized events from one processed document."""
        well_id = self.entities.extract_well_id(text)
        source_pages = [page for page in (page_texts or []) if page.strip()] or [text]
        events = []
        for page_number, page_text in enumerate(source_pages, start=1):
            source_page = page_number if len(source_pages) == page_count else None
            page_events = self._events_from_incident_section(
                page_text, source_document, source_page, well_id, len(events)
            )
            events.extend(page_events)

        if not events:
            for page_number, page_text in enumerate(source_pages, start=1):
                source_page = page_number if len(source_pages) == page_count else None
                page_events = self._events_from_labeled_event_blocks(
                    page_text, source_document, source_page, well_id, len(events)
                )
                events.extend(page_events)
        if not events:
            source_page = 1 if page_count == 1 else None
            events = self._events_from_tables(tables or [], source_document, source_page, well_id, 0)
        if events:
            return [event.to_dict() for event in events]

        next_sequence = 0
        known_keys = set()
        for page_number, page_text in enumerate(source_pages, start=1):
            source_page = page_number if len(source_pages) == page_count else None
            for sentence in split_sentences(page_text):
                if "_" in sentence and re.fullmatch(r"[A-Z0-9_ ]+", sentence):
                    continue
                if re.match(r"^\s*NPT\s+\d+(?:\.\d+)?\s*(?:hrs?|hours?)\b", sentence, re.IGNORECASE):
                    continue
                if re.match(r"^\s*(?:lesson|lessons learned)\s*:", sentence, re.IGNORECASE):
                    continue

                event_type = self.classifier.classify(sentence)
                if event_type is None:
                    continue

                depth = self.entities.extract_depth_md(sentence)
                key = (event_type, depth)
                has_depth_match = depth is None and any(
                    known_type == event_type and known_depth is not None
                    for known_type, known_depth in known_keys
                )
                if key in known_keys or has_depth_match:
                    continue

                next_sequence += 1
                description = sentence.strip()
                event = self._make_event(
                    description=description,
                    source_document=source_document,
                    source_page=source_page,
                    sequence=next_sequence,
                    confidence=0.7,
                    event_type=event_type,
                    depth=depth,
                    cause=self.entities.extract_cause(description),
                    mitigation=self.entities.extract_mitigation(description),
                    outcome=self.entities.extract_outcome(description),
                    npt_hours=self.entities.extract_npt_hours(sentence),
                    well_id=well_id,
                    source_section="Unstructured report text",
                    evidence_text=sentence,
                    source_document_text=page_text,
                )
                if event:
                    events.append(event)
                    known_keys.add(key)

        return [event.to_dict() for event in events]


def extract_events(
    text: str,
    tables: list[list[str]] | None = None,
    source_document: str = "unknown",
    page_count: int = 1,
    page_texts: list[str] | None = None,
) -> list[dict]:
    """Convenience wrapper for the initial rule-based event extractor."""
    return EventExtractor().extract(text, tables, source_document, page_count, page_texts)
