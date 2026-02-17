# ------------------------------------------------------------
# text_finder.py — OCR-aware text extraction + multi-span regex
# FIXED: Y-flip, multi-span regex, line/block grouping, template integration
# ------------------------------------------------------------

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

    FIXED:
    - Y-axis normalization
    - Multi-span regex search
    - Line + block grouping
    - TemplateCompiler-compatible span output
    """

    def __init__(self, ocr_engine: Optional[OCREngine] = None):
        if HAS_OCR and ocr_engine:
            self.ocr_engine = ocr_engine
        else:
            self.ocr_engine = None

    # ------------------------------------------------------------
    # PDF-native text extraction
    # ------------------------------------------------------------
    def _extract_pdf_words(self, doc: fitz.Document, page_index: int) -> List[TextSpan]:
        page = doc[page_index]
        words = page.get_text("words")
        if not words:
            return []

        width = page.rect.width
        height = page.rect.height

        spans: List[TextSpan] = []
        for w in words:
            x0, y0, x1, y1, text, *_ = w
            if not text.strip():
                continue

            # FIXED: Y-flip normalization
            spans.append(
                TextSpan(
                    page=page_index + 1,
                    text=text,
                    x0=x0 / width,
                    y0=1 - (y1 / height),
                    x1=x1 / width,
                    y1=1 - (y0 / height),
                )
            )
        return spans

    # ------------------------------------------------------------
    # OCR fallback
    # ------------------------------------------------------------
    def _extract_ocr_words(self, pdf_bytes: bytes, page_index: int) -> List[TextSpan]:
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

    # ------------------------------------------------------------
    # Extract all spans
    # ------------------------------------------------------------
    def find_text_spans(
        self,
        pdf_bytes: bytes,
        use_ocr: bool = False,
        auto_ocr: bool = True,
    ) -> List[TextSpan]:

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

    # ------------------------------------------------------------
    # FIXED: Group spans into lines
    # ------------------------------------------------------------
    def _group_into_lines(self, spans: List[TextSpan]) -> List[List[TextSpan]]:
        lines = {}
        for s in spans:
            key = (s.page, round(s.y0, 2))
            lines.setdefault(key, []).append(s)

        grouped = []
        for key, line in lines.items():
            grouped.append(sorted(line, key=lambda s: s.x0))

        return grouped

    # ------------------------------------------------------------
    # FIXED: Group lines into blocks (multi-line)
    # ------------------------------------------------------------
    def _group_lines_into_blocks(self, lines: List[List[TextSpan]]) -> List[List[TextSpan]]:
        blocks = []
        current = []
        last_y = None
        last_page = None

        # Flatten lines sorted by page + y
        flat = sorted([s for line in lines for s in line], key=lambda s: (s.page, s.y0, s.x0))

        for s in flat:
            if last_page != s.page or (last_y is not None and abs(s.y0 - last_y) > 0.03):
                if current:
                    blocks.append(current)
                current = [s]
            else:
                current.append(s)

            last_y = s.y0
            last_page = s.page

        if current:
            blocks.append(current)

        # Sort each block left→right
        for b in blocks:
            b.sort(key=lambda s: s.x0)

        return blocks

    # ------------------------------------------------------------
    # FIXED: Multi-span regex search
    # ------------------------------------------------------------
    def _search_blocks(self, blocks, compiled_regex):
        results = []

        for block in blocks:
            full_text = " ".join(s.text for s in block)
            match = compiled_regex.search(full_text)
            if not match:
                continue

            start, end = match.span()
            matched_spans = []

            cursor = 0
            for s in block:
                word = s.text
                w_start = cursor
                w_end = cursor + len(word)
                cursor += len(word) + 1

                if w_start < end and w_end > start:
                    matched_spans.append(s)

            if matched_spans:
                x0 = min(s.x0 for s in matched_spans)
                y0 = min(s.y0 for s in matched_spans)
                x1 = max(s.x1 for s in matched_spans)
                y1 = max(s.y1 for s in matched_spans)

                results.append({
                    "page": matched_spans[0].page,
                    "text": match.group(0),
                    "rects": [{"x0": x0, "y0": y0, "x1": x1, "y1": y1}],
                    "match_groups": list(match.groups())
                })

        return results

    # ------------------------------------------------------------
    # Public regex search API
    # ------------------------------------------------------------
    def search_regex(
        self,
        pdf_bytes: bytes,
        pattern: str,
        use_ocr: bool = False,
        auto_ocr: bool = True,
    ) -> List[Dict[str, Any]]:

        spans = self.find_text_spans(pdf_bytes, use_ocr, auto_ocr)
        if not spans:
            return []

        compiled = re.compile(pattern, re.IGNORECASE)

        lines = self._group_into_lines(spans)
        blocks = self._group_lines_into_blocks(lines)

        return self._search_blocks(blocks, compiled)
