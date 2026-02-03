# backend/redaction_engine.py

import os
import fitz  # PyMuPDF
import re
from typing import Dict, Any, List

from backend.pdf_text_extractor import PDFTextExtractor
from backend.pdf_engine import build_redacted_filename


class RedactionEngine:
    """
    Applies:
        - Zone-based redaction
        - Regex-based redaction
        - QR-code region masking
        - Black/white/blur styles
    """

    def __init__(self):
        self.text_extractor = PDFTextExtractor()

    # ---------------------------------------------------------
    # Main entry point
    # ---------------------------------------------------------
    def redact_pdf(self, input_path: str, template: Dict[str, Any]) -> str:
        if not os.path.isfile(input_path):
            raise FileNotFoundError(f"PDF not found: {input_path}")

        output_path = build_redacted_filename(input_path)

        doc = fitz.open(input_path)
        pages_text = self.text_extractor.extract_text_per_page(input_path)

        # Apply zone-based redactions
        self.apply_zone_redactions(doc, template)

        # Apply regex-based redactions
        self.apply_regex_redactions(doc, template, pages_text)

        # Apply QR-code region redactions
        self.apply_qr_redactions(doc, template)

        # Save output
        doc.save(output_path, deflate=True, clean=True)
        doc.close()

        print(f"[redaction_engine] Redacted PDF saved to: {output_path}")
        return output_path

    # ---------------------------------------------------------
    # Zone-based redactions
    # ---------------------------------------------------------
    def apply_zone_redactions(self, doc, template: Dict[str, Any]):
        page_patterns = template.get("page_patterns", [])

        for pattern in page_patterns:
            page_type = pattern.get("page_type", "specific")
            zones = pattern.get("zones", [])

            for zone in zones:
                style = zone.get("style", "black")
                page_index = zone.get("page_index", 0)

                target_pages = self.resolve_page_targets(doc, page_type, page_index)

                for p in target_pages:
                    self.draw_redaction_box(
                        doc[p],
                        zone["x1"], zone["y1"],
                        zone["x2"], zone["y2"],
                        style
                    )

    # ---------------------------------------------------------
    # Regex-based redactions
    # ---------------------------------------------------------
    def apply_regex_redactions(self, doc, template: Dict[str, Any], pages_text: List[str]):
        rules = template.get("rules", [])

        for rule in rules:
            if rule.get("type") != "regex":
                continue

            pattern = re.compile(rule["pattern"])
            scope = rule.get("scope", "all_pages")
            style = rule.get("style", "black")

            target_pages = self.resolve_regex_scope(doc, scope)

            for page_index in target_pages:
                text = pages_text[page_index]
                matches = list(pattern.finditer(text))

                if not matches:
                    continue

                page = doc[page_index]

                for match in matches:
                    matched_text = match.group(0)

                    # Find text positions on page
                    rects = page.search_for(matched_text)
                    for rect in rects:
                        self.draw_redaction_box(
                            page,
                            rect.x0, rect.y0,
                            rect.x1, rect.y1,
                            style
                        )

    # ---------------------------------------------------------
    # QR-code region redactions
    # ---------------------------------------------------------
    def apply_qr_redactions(self, doc, template: Dict[str, Any]):
        qr_regions = template.get("qr_code_regions", [])

        for region in qr_regions:
            page_index = region["page_index"]
            style = region.get("style", "white")

            page = doc[page_index]

            self.draw_redaction_box(
                page,
                region["x1"], region["y1"],
                region["x2"], region["y2"],
                style
            )

    # ---------------------------------------------------------
    # Draw redaction box (black, white, blur)
    # ---------------------------------------------------------
    def draw_redaction_box(self, page, x1, y1, x2, y2, style):
        rect = fitz.Rect(x1, y1, x2, y2)

        if style == "black":
            page.add_redact_annot(rect, fill=(0, 0, 0))
            page.apply_redactions()

        elif style == "white":
            page.add_redact_annot(rect, fill=(1, 1, 1))
            page.apply_redactions()

        elif style == "blur":
            # Rasterize region, blur it, paste back
            pix = page.get_pixmap(clip=rect)
            blurred = pix.blur(10)
            page.insert_image(rect, pixmap=blurred)

        else:
            print(f"[redaction_engine] Unknown style: {style}")

    # ---------------------------------------------------------
    # Resolve page targets for zone-based redactions
    # ---------------------------------------------------------
    def resolve_page_targets(self, doc, page_type: str, page_index: int):
        if page_type == "first_page":
            return [0]

        if page_type == "last_page":
            return [len(doc) - 1]

        if page_type == "all_pages":
            return list(range(len(doc)))

        # Default: specific page index
        return [page_index]

    # ---------------------------------------------------------
    # Resolve pages for regex rules
    # ---------------------------------------------------------
    def resolve_regex_scope(self, doc, scope: str):
        if scope == "all_pages":
            return list(range(len(doc)))

        if scope == "first_page":
            return [0]

        if scope == "last_page":
            return [len(doc) - 1]

        return list(range(len(doc)))
