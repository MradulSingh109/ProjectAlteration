"""Entry point for the NWIS PDF document processing pipeline.

This script orchestrates the document processing flow in a simple and readable
order:

1. Read the PDF file and extract raw text
2. Classify the document type
3. Run OCR if needed
4. Clean the text
5. Extract table-like content

This is intentionally built as an easy-to-follow pipeline. Later, it can be
expanded with logging, validation, and output persistence.
"""

from __future__ import annotations

import json
from pathlib import Path

try:
    from src.document_processing.pdf_reader import read_pdf_document
    from src.document_processing.pdf_classifier import classify_pdf
    from src.document_processing.ocr import run_ocr_pages, should_run_ocr
    from src.document_processing.text_cleaner import clean_text
    from src.document_processing.table_extractor import extract_tables
except ModuleNotFoundError:
    from ml.src.document_processing.pdf_reader import read_pdf_document
    from ml.src.document_processing.pdf_classifier import classify_pdf
    from ml.src.document_processing.ocr import run_ocr_pages, should_run_ocr
    from ml.src.document_processing.text_cleaner import clean_text
    from ml.src.document_processing.table_extractor import extract_tables


def process_document(pdf_path: str | Path) -> dict:
    """Run the document processing pipeline for a single PDF."""
    pdf_path = Path(pdf_path)

    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    # Step 1: read the PDF and extract raw text
    document = read_pdf_document(pdf_path)

    # Step 2: classify the document type
    doc_type = classify_pdf(pdf_path, document.extracted_text)

    # Step 3: OCR fallback when extracted text is empty or sparse
    raw_text = document.extracted_text
    page_texts = list(document.text_pages)
    if should_run_ocr(raw_text):
        ocr_page_texts = run_ocr_pages(pdf_path)
        ocr_text = "\n\n".join(ocr_page_texts)
        if ocr_text.strip():
            raw_text = ocr_text
            page_texts = ocr_page_texts

    # Step 4: clean the extracted text
    cleaned_text = clean_text(raw_text)

    # Step 5: extract table-like rows from the text
    tables = extract_tables(cleaned_text)

    return {
        "file_name": pdf_path.name,
        "document_type": doc_type,
        "page_count": document.total_pages,
        "text_length": len(cleaned_text),
        "tables": tables,
        "cleaned_text": cleaned_text,
        "page_texts": page_texts,
    }


def save_processed_document(result: dict, output_dir: str | Path | None = None) -> Path:
    """Save processed text, tables, and metadata for one document under its own folder."""
    if output_dir is None:
        output_dir = Path(__file__).resolve().parent.parent / "data" / "processed"

    document_name = Path(result["file_name"]).stem
    document_output_dir = Path(output_dir) / document_name
    document_output_dir.mkdir(parents=True, exist_ok=True)

    text_payload = {
        "file_name": result["file_name"],
        "document_type": result["document_type"],
        "cleaned_text": result["cleaned_text"],
        "page_texts": result.get("page_texts", []),
    }

    tables_payload = {
        "file_name": result["file_name"],
        "tables": result["tables"],
    }

    metadata_payload = {
        "file_name": result["file_name"],
        "document_type": result["document_type"],
        "page_count": result["page_count"],
        "text_length": result["text_length"],
    }

    text_path = document_output_dir / "text.json"
    tables_path = document_output_dir / "tables.json"
    metadata_path = document_output_dir / "metadata.json"

    text_path.write_text(json.dumps(text_payload, indent=2, ensure_ascii=False), encoding="utf-8")
    tables_path.write_text(json.dumps(tables_payload, indent=2, ensure_ascii=False), encoding="utf-8")
    metadata_path.write_text(json.dumps(metadata_payload, indent=2, ensure_ascii=False), encoding="utf-8")

    return document_output_dir


if __name__ == "__main__":
    sample_pdf = Path(__file__).resolve().parent.parent / "data" / "raw" / "Fabricated_Data" / "WELL_SURVEY_OIL102.pdf"
    result = process_document(sample_pdf)

    saved_dir = save_processed_document(result)

    print(f"Document Type: {result['document_type']}")
    print(f"Pages: {result['page_count']}")
    print(f"Text length: {result['text_length']}")
    print(f"Saved to: {saved_dir}")
    print(result["cleaned_text"][:1200])
