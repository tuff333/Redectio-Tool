# backend/redaction/text_finder.py

from dataclasses import dataclass
from typing import List, Dict, Any, Optional
import re

import fitz  # PyMuPDF

# Optional OCR import
try:
    from backend.ocr_engine import OCREngine, OCRWord
    HAS_OCR = True
except ImportError:
    HAS_OCR = False
    OCREngine = None
    OCRWord = None


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
    OCR-aware text finder with regex search capability.

    - Uses native PDF text (fast, precise) when available.
    - Falls back to OCR when a page has no text.
    - Can be forced to use OCR for all pages (for scanned PDFs).
    - NEW: search_regex() method for pattern-based redaction.
    """

    def __init__(self, ocr_engine: Optional[OCREngine] = None):
        if HAS_OCR and ocr_engine:
            self.ocr_engine = ocr_engine
        else:
            self.ocr_engine = None

    def _extract_pdf_words(self, doc: fitz.Document, page_index: int) -> List[TextSpan]:
        """Extract words from PDF using native text extraction."""
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
        """Extract words using OCR (fallback for scanned PDFs)."""
        if not self.ocr_engine or not HAS_OCR:
            return []
            
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
                if auto_ocr and not spans and self.ocr_engine:
                    spans = self._extract_ocr_words(pdf_bytes, page_index)

            all_spans.extend(spans)

        doc.close()
        return all_spans

    def search_regex(
        self,
        pdf_bytes: bytes,
        pattern: str,
        use_ocr: bool = False,
        auto_ocr: bool = True,
    ) -> List[Dict[str, Any]]:
        """
        Search for regex pattern in PDF and return matches with bounding boxes.

        Returns:
        [
            {
                "page": 1,
                "text": "matched text",
                "rects": [{"x0": 0.1, "y0": 0.2, "x1": 0.3, "y1": 0.25}],
                "match_groups": ["group1", "group2"]
            },
            ...
        ]
        """
        spans = self.find_text_spans(pdf_bytes, use_ocr, auto_ocr)
        compiled = re.compile(pattern, re.IGNORECASE)
        results: List[Dict[str, Any]] = []

        for span in spans:
            match = compiled.search(span.text)
            if match:
                results.append({
                    "page": span.page,
                    "text": span.text,
                    "rects": [{
                        "x0": span.x0,
                        "y0": span.y0,
                        "x1": span.x1,
                        "y1": span.y1
                    }],
                    "match_groups": list(match.groups())
                })

        return results