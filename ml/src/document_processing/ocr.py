"""OCR fallback logic for PDFs that do not yield good raw text.

This module is the third step in the pipeline. After the PDF is read and the
PDF type is known, we attempt OCR only when the raw text extraction doesn't
produce usable content.

The initial version keeps the logic straightforward:
- try PDF text extraction
- if it is empty or poor, run OCR
- return the best text available
"""

from __future__ import annotations

from pathlib import Path

try:
    from paddleocr import PaddleOCR
except ImportError:  # pragma: no cover
    PaddleOCR = None


class OCRProcessor:
    """Minimal OCR fallback wrapper for scanned or image-based PDFs."""

    def __init__(self, use_gpu: bool = False) -> None:
        self.use_gpu = use_gpu
        self._ocr_model = None

    def _load_model(self):
        if PaddleOCR is None:
            raise ImportError(
                "paddleocr is not installed. Install it with: pip install paddleocr"
            )

        if self._ocr_model is None:
            self._ocr_model = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)

        return self._ocr_model

    def run_ocr(self, pdf_path: str | Path) -> str:
        """Run OCR on a PDF or image file and return extracted text."""
        pdf_path = Path(pdf_path)

        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF/image file not found: {pdf_path}")

        if PaddleOCR is None:
            return ""

        model = self._load_model()

        result = model.ocr(str(pdf_path), cls=True)
        extracted_lines = []

        for page in result:
            if not page:
                continue
            for line in page:
                text = line[1][0] if isinstance(line, list) and len(line) > 1 else ""
                if text:
                    extracted_lines.append(text)

        return "\n".join(extracted_lines)


def run_ocr(pdf_path: str | Path) -> str:
    """Convenience function for OCR execution."""
    processor = OCRProcessor()
    return processor.run_ocr(pdf_path)


def should_run_ocr(text: str, min_words: int = 30) -> bool:
    """Return True when extracted PDF text is empty or too sparse for downstream models."""
    cleaned = (text or "").strip()
    return len(cleaned.split()) < min_words


if __name__ == "__main__":
    sample_pdf = Path(__file__).resolve().parents[2] / "data" / "raw" / "Fabricated_Data" / "WCR_OIL102.pdf"
    print(f"OCR module loaded. Sample path: {sample_pdf}")
