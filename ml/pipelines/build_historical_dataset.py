"""Build a tabular historical event dataset from Stage 5 event files."""

from __future__ import annotations

import argparse
import csv
import json
import math
from collections import Counter
from dataclasses import fields
from pathlib import Path

from ml.src.information_extraction.schemas import ExtractedEvent
from ml.src.information_extraction.taxonomy import EVENT_TYPES, SEVERITY_LEVELS, TAXONOMY
from ml.src.information_extraction.well_extractor import WellExtractor


EVENT_COLUMNS = tuple(field.name for field in fields(ExtractedEvent))
WELL_COLUMNS = (
    "well_id",
    "field",
    "latitude",
    "longitude",
    "source_documents",
    "source_pages",
)


def _read_event_file(events_path: Path) -> list[dict]:
    payload = json.loads(events_path.read_text(encoding="utf-8"))
    events = payload.get("events") if isinstance(payload, dict) else None
    if not isinstance(events, list):
        raise ValueError(f"Expected an 'events' list in {events_path}")

    validated_events = []
    for index, event in enumerate(events):
        if not isinstance(event, dict):
            raise ValueError(f"Event {index} in {events_path} is not an object")

        missing_fields = [column for column in EVENT_COLUMNS if column not in event]
        if missing_fields:
            raise ValueError(
                f"Event {index} in {events_path} is missing fields: {', '.join(missing_fields)}"
            )

        if event["event_type"] not in EVENT_TYPES:
            raise ValueError(f"Unsupported event type in {events_path}: {event['event_type']}")
        if event["severity"] is not None and event["severity"] not in SEVERITY_LEVELS:
            raise ValueError(f"Unsupported severity in {events_path}: {event['severity']}")

        validated_events.append({column: event[column] for column in EVENT_COLUMNS})

    return validated_events


def build_historical_dataset(
    processed_root: str | Path,
    output_dir: str | Path | None = None,
) -> dict:
    """Aggregate all per-document events into a validated CSV and summary JSON."""
    processed_root = Path(processed_root)
    if not processed_root.is_dir():
        raise NotADirectoryError(f"Processed-document directory not found: {processed_root}")

    if output_dir is None:
        output_dir = processed_root / "historical_dataset"
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    output_dir_resolved = output_dir.resolve()
    document_dirs = sorted(
        path
        for path in processed_root.iterdir()
        if path.is_dir() and path.resolve() != output_dir_resolved
    )
    documents_without_events = []
    documents_without_well_id = []
    source_documents = []
    events = []
    seen_event_ids = set()
    wells = {}
    coordinate_conflicts = {}
    well_extractor = WellExtractor()

    for document_dir in document_dirs:
        events_path = document_dir / "events.json"
        if events_path.is_file():
            document_events = _read_event_file(events_path)
            source_documents.append(document_dir.name)
            for event in document_events:
                event_id = event["event_id"]
                if event_id in seen_event_ids:
                    raise ValueError(f"Duplicate event_id across dataset: {event_id}")
                seen_event_ids.add(event_id)
                events.append(event)
        else:
            documents_without_events.append(document_dir.name)

        text_path = document_dir / "text.json"
        metadata_path = document_dir / "metadata.json"
        if not text_path.is_file():
            continue

        text_data = json.loads(text_path.read_text(encoding="utf-8"))
        metadata = json.loads(metadata_path.read_text(encoding="utf-8")) if metadata_path.is_file() else {}
        well = well_extractor.extract(
            text=text_data.get("cleaned_text", ""),
            source_document=text_data.get("file_name", document_dir.name),
            page_count=metadata.get("page_count", 1),
        )
        if not well.well_id:
            documents_without_well_id.append(document_dir.name)
            continue

        if well.well_id not in wells:
            wells[well.well_id] = {
                "well_id": well.well_id,
                "field": well.field,
                "latitude": well.latitude,
                "longitude": well.longitude,
                "source_documents": [],
                "source_pages": [],
            }
        merged_well = wells[well.well_id]
        if not merged_well["field"] and well.field:
            merged_well["field"] = well.field

        for coordinate in ("latitude", "longitude"):
            value = getattr(well, coordinate)
            if value is None or well.well_id in coordinate_conflicts and coordinate in coordinate_conflicts[well.well_id]:
                continue
            existing = merged_well[coordinate]
            if existing is None:
                merged_well[coordinate] = value
            elif not math.isclose(existing, value, rel_tol=0.0, abs_tol=0.0001):
                coordinate_conflicts.setdefault(well.well_id, {})[coordinate] = sorted({existing, value})
                merged_well[coordinate] = None

        if well.source_document not in merged_well["source_documents"]:
            merged_well["source_documents"].append(well.source_document)
        if well.source_page is not None:
            page_ref = f"{well.source_document}#page={well.source_page}"
            if page_ref not in merged_well["source_pages"]:
                merged_well["source_pages"].append(page_ref)

    events_path = output_dir / "events.csv"
    with events_path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=EVENT_COLUMNS, extrasaction="raise")
        writer.writeheader()
        for event in events:
            row = dict(event)
            row["evidence"] = json.dumps(event["evidence"], ensure_ascii=False)
            writer.writerow(row)

    wells_path = output_dir / "wells.csv"
    with wells_path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=WELL_COLUMNS, extrasaction="raise")
        writer.writeheader()
        for well_id in sorted(wells):
            well_row = wells[well_id]
            writer.writerow({
                **well_row,
                "source_documents": "; ".join(well_row["source_documents"]),
                "source_pages": "; ".join(well_row["source_pages"]),
            })

    event_type_counts = Counter(event["event_type"] for event in events)
    severity_counts = Counter(event["severity"] for event in events if event["severity"] is not None)
    field_coverage = {
        column: {
            "present": sum(event[column] is not None and event[column] != "" for event in events),
            "missing": sum(event[column] is None or event[column] == "" for event in events),
        }
        for column in EVENT_COLUMNS
    }
    summary = {
        "dataset_schema_version": "1.0.0",
        "taxonomy_schema_version": TAXONOMY["schema_version"],
        "document_count": len(source_documents),
        "documents_without_events_json": documents_without_events,
        "documents_without_well_id": documents_without_well_id,
        "event_count": len(events),
        "unique_well_count": len(wells),
        "unique_formation_count": len({event["formation"] for event in events if event["formation"]}),
        "event_type_counts": {event_type: event_type_counts[event_type] for event_type in EVENT_TYPES},
        "severity_counts": {severity: severity_counts[severity] for severity in SEVERITY_LEVELS},
        "field_coverage": field_coverage,
        "well_coordinate_coverage": {
            "wells_with_latitude": sum(well["latitude"] is not None for well in wells.values()),
            "wells_with_longitude": sum(well["longitude"] is not None for well in wells.values()),
            "coordinate_conflicts": coordinate_conflicts,
        },
        "source_documents": source_documents,
        "events_csv": str(events_path),
        "wells_csv": str(wells_path),
    }

    summary_path = output_dir / "dataset_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Aggregate per-document Stage 5 events into a historical CSV dataset."
    )
    parser.add_argument("processed_root", help="Folder containing per-document processed folders")
    parser.add_argument("--output-dir", help="Output folder (defaults to <processed_root>/historical_dataset)")
    args = parser.parse_args()

    summary = build_historical_dataset(args.processed_root, args.output_dir)
    print(f"Documents: {summary['document_count']}")
    print(f"Events: {summary['event_count']}")
    print(f"Unique wells: {summary['unique_well_count']}")
    print(f"Unique formations: {summary['unique_formation_count']}")
    print(f"Dataset: {summary['events_csv']}")


if __name__ == "__main__":
    main()
