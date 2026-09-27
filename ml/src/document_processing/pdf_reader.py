"""PDF reading and text extraction for the NWIS document pipeline.

This module is the first step in the PDF processing chain. It is responsible for
opening a PDF file, reading its pages, and extracting the raw textual content from
those pages.

The output is intentionally simple and easy to understand so that later modules
can build on top of it without dealing with PDF internals.
"""

from __future__ import annotations  #Since we are using older versions of Python, we need to import annotations from __future__ to enable postponed evaluation of type annotations. This allows us to use forward references in type hints, which can be useful for defining classes that reference themselves or other classes that are defined later in the code.

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

try:
    from pypdf import PdfReader
except ImportError as exc:  # pragma: no cover - only for environment validation
    raise ImportError(
        "The 'pypdf' package is required to read PDF documents. "
        "Install it with: pip install pypdf"
    ) from exc


@dataclass
class PdfDocument:
    """Container for a PDF file and the text extracted from its pages."""

    file_path: str
    file_name: str
    total_pages: int
    text_pages: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    extracted_text: str = ""

    @property
    def text(self) -> str:
        """Return the extracted text for the whole document."""
        return self.extracted_text


def read_pdf_document(file_path: str | Path) -> PdfDocument:
    """Read a PDF file and return a document object with extracted page text.

    Args:
        file_path: Path to the PDF file.

    Returns:
        A PdfDocument containing the extracted text and metadata.
    """
    pdf_path = Path(file_path)

    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")

    reader = PdfReader(str(pdf_path))

    document = PdfDocument(
        file_path=str(pdf_path),
        file_name=pdf_path.name,
        total_pages=len(reader.pages),
        text_pages=[],
        metadata={},
        extracted_text="",
    )

    for page in reader.pages:
        page_text = page.extract_text() or ""
        cleaned_text = page_text.strip()
        document.text_pages.append(cleaned_text)

    document.extracted_text = "\n\n".join(document.text_pages)

    pdf_metadata = reader.metadata or {}
    for key, value in pdf_metadata.items():
        if value is not None:
            document.metadata[str(key)] = str(value)

    return document


def read_pdf_text(file_path: str | Path) -> str:
    """Convenience function that returns only the extracted text from a PDF."""
    return read_pdf_document(file_path).extracted_text


if __name__ == "__main__":
    sample_pdf = Path(__file__).resolve().parents[2] / "data" / "raw" / "Fabricated_Data" / "CEMENTING_OIL114.pdf"

    try:
        document = read_pdf_document(sample_pdf)
        print(f"Loaded: {document.file_name}")
        print(f"Pages: {document.total_pages}")
        print(document.extracted_text[:800])
    except FileNotFoundError:
        print(f"Sample PDF not found: {sample_pdf}")
