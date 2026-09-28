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

import json
from pathlib import Path

try:
    from paddleocr import PaddleOCR
except ImportError:  # pragma: no cover
    PaddleOCR = None

try:
    import pypdfium2 as pdfium
except ImportError:  # pragma: no cover
    pdfium = None


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
            self._ocr_model = PaddleOCR(
                lang="en",
                use_textline_orientation=True,
                enable_mkldnn=False,
            )

        return self._ocr_model

    @staticmethod
    def _recognized_texts(result) -> list[str]:
        """Read recognized text from PaddleOCR 3 result objects or dictionaries."""
        texts = []
        for item in result:
            payload = getattr(item, "json", item)
            if callable(payload):
                payload = payload()
            if isinstance(payload, str):
                payload = json.loads(payload)
            if not isinstance(payload, dict):
                continue

            data = payload.get("res", payload)
            if isinstance(data, dict):
                texts.extend(text for text in data.get("rec_texts", []) if text)
        return texts

    def run_ocr_pages(self, pdf_path: str | Path) -> list[str]:
        """Run OCR and return recognized text separately for each PDF page."""
        pdf_path = Path(pdf_path)

        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF/image file not found: {pdf_path}")

        if PaddleOCR is None:
            return ""
        if pdfium is None:
            raise ImportError(
                "pypdfium2 is required to render PDF pages for OCR. "
                "Install it with: pip install pypdfium2"
            )

        model = self._load_model()
        pdf = pdfium.PdfDocument(str(pdf_path))
        page_texts = []

        try:
            for page in pdf:
                image = page.render(scale=2).to_numpy()
                if image.ndim == 3 and image.shape[2] == 4:
                    image = image[:, :, :3]
                result = model.predict(input=image)
                page_texts.append("\n".join(self._recognized_texts(result)))
        finally:
            pdf.close()

        return page_texts

    def run_ocr(self, pdf_path: str | Path) -> str:
        """Run OCR on a PDF or image file and return combined extracted text."""
        return "\n\n".join(self.run_ocr_pages(pdf_path))


def run_ocr(pdf_path: str | Path) -> str:
    """Convenience function for OCR execution."""
    processor = OCRProcessor()
    return processor.run_ocr(pdf_path)


def run_ocr_pages(pdf_path: str | Path) -> list[str]:
    """Convenience function returning one OCR text string per PDF page."""
    processor = OCRProcessor()
    return processor.run_ocr_pages(pdf_path)


def should_run_ocr(text: str, min_words: int = 30) -> bool:
    """Return True when extracted PDF text is empty or too sparse for downstream models."""
    cleaned = (text or "").strip()
    return len(cleaned.split()) < min_words


if __name__ == "__main__":
    sample_pdf = Path(__file__).resolve().parents[2] / "data" / "raw" / "Fabricated_Data" / "WCR_OIL102.pdf"
    print(f"OCR module loaded. Sample path: {sample_pdf}")
