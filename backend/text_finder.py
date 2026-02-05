# backend/text_finder.py

from dataclasses import dataclass
from typing import List

import fitz  # PyMuPDF

from backend.ocr_engine import OCREngine, OCRWord


@dataclass
class TextSpan:
    page: int
    text: str
    x0: float
    y0: float
    x1: float
    y1: float


class TextFinder:
    """
    OCR-aware text finder.

    - Uses native PDF text (fast, precise) when available.
    - Falls back to OCR when a page has no text.
    - Can be forced to use OCR for all pages (for scanned PDFs).
    """

    def __init__(self, ocr_engine: OCREngine | None = None):
        self.ocr_engine = ocr_engine or OCREngine()

    def _extract_pdf_words(self, doc: fitz.Document, page_index: int) -> List[TextSpan]:
        page = doc[page_index]
        words = page.get_text("words")  # [x0, y0, x1, y1, "word", block, line, word_no]
        if not words:
            return []

        width = page.rect.width
        height = page.rect.height

        spans: List[TextSpan] = []
        for w in words:
            x0, y0, x1, y1, text, *_ = w
            if not text.strip():
                continue
            spans.append(
                TextSpan(
                    page=page_index + 1,
                    text=text,
                    x0=x0 / width,
                    y0=y0 / height,
                    x1=x1 / width,
                    y1=y1 / height,
                )
            )
        return spans

    def _extract_ocr_words(self, pdf_bytes: bytes, page_index: int) -> List[TextSpan]:
        ocr_words: List[OCRWord] = self.ocr_engine.ocr_pdf_bytes_per_page(
            pdf_bytes, page_index
        )
        spans: List[TextSpan] = []
        for w in ocr_words:
            spans.append(
                TextSpan(
                    page=w.page,
                    text=w.text,
                    x0=w.x0,
                    y0=w.y0,
                    x1=w.x1,
                    y1=w.y1,
                )
            )
        return spans

    def find_text_spans(
        self,
        pdf_bytes: bytes,
        use_ocr: bool = False,
        auto_ocr: bool = True,
    ) -> List[TextSpan]:
        """
        Extract text spans with normalized bounding boxes.

        - use_ocr=True: always use OCR for all pages.
        - auto_ocr=True: if a page has no text, fallback to OCR.
        """
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        all_spans: List[TextSpan] = []

        for page_index in range(len(doc)):
            if use_ocr:
                spans = self._extract_ocr_words(pdf_bytes, page_index)
            else:
                spans = self._extract_pdf_words(doc, page_index)
                if auto_ocr and not spans:
                    spans = self._extract_ocr_words(pdf_bytes, page_index)

            all_spans.extend(spans)

        doc.close()
        return all_spans
