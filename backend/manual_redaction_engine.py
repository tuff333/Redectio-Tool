# backend/manual_redaction_engine.py

import os
import uuid
import fitz  # PyMuPDF
from typing import List, Dict, Any, Optional


class ManualRedactionEngine:
    """
    Generic manual redaction engine.

    Expects a redaction map like:

    redactions = [
        {
            "page": 1,  # 1-based page index
            "type": "box",  # "box" | "text" | "page"
            "rect": { "x0": 0.1, "y0": 0.2, "x1": 0.4, "y1": 0.3 },  # normalized (0–1)
            "color": "#000000"
        },
        {
            "page": 2,
            "type": "text",
            "rects": [
                { "x0": 0.15, "y0": 0.25, "x1": 0.35, "y1": 0.28 },
                { "x0": 0.15, "y0": 0.30, "x1": 0.40, "y1": 0.33 }
            ],
            "text": "some selected text",
            "color": "#000000"
        },
        {
            "page": 3,
            "type": "page",
            "color": "#000000"
        }
    ]
    """

    def __init__(self, output_dir: str = "temp_redacted"):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)

    @staticmethod
    def _hex_to_rgb01(hex_color: str):
        """
        Convert #RRGGBB to (r, g, b) in 0–1 range.
        """
        if not hex_color:
            return (0, 0, 0)
        hex_color = hex_color.strip().lstrip("#")
        if len(hex_color) != 6:
            return (0, 0, 0)
        r = int(hex_color[0:2], 16) / 255.0
        g = int(hex_color[2:4], 16) / 255.0
        b = int(hex_color[4:6], 16) / 255.0
        return (r, g, b)

    def _apply_redactions_to_doc(
        self,
        doc: fitz.Document,
        redactions: List[Dict[str, Any]],
        scrub_metadata: bool = True,
    ):
        """
        Apply redactions to an open PyMuPDF document.
        """
        # Group redactions by page (1-based)
        by_page: Dict[int, List[Dict[str, Any]]] = {}
        for r in redactions:
            page_num = int(r.get("page", 1))
            by_page.setdefault(page_num, []).append(r)

        for page_index in range(len(doc)):
            page_number = page_index + 1
            page = doc[page_index]
            page_width = page.rect.width
            page_height = page.rect.height

            page_redactions = by_page.get(page_number, [])
            if not page_redactions:
                continue

            for r in page_redactions:
                rtype = r.get("type", "box")
                color_hex = r.get("color", "#000000")
                rgb = self._hex_to_rgb01(color_hex)

                if rtype == "page":
                    rect = fitz.Rect(0, 0, page_width, page_height)
                    page.add_redact_annot(rect, fill=rgb)
                elif rtype == "box":
                    rect_data = r.get("rect") or {}
                    x0n = float(rect_data.get("x0", 0.0))
                    y0n = float(rect_data.get("y0", 0.0))
                    x1n = float(rect_data.get("x1", 1.0))
                    y1n = float(rect_data.get("y1", 1.0))
                    rect = fitz.Rect(
                        x0n * page_width,
                        y0n * page_height,
                        x1n * page_width,
                        y1n * page_height,
                    )
                    page.add_redact_annot(rect, fill=rgb)
                elif rtype == "text":
                    rects = r.get("rects") or []
                    for rd in rects:
                        x0n = float(rd.get("x0", 0.0))
                        y0n = float(rd.get("y0", 0.0))
                        x1n = float(rd.get("x1", 1.0))
                        y1n = float(rd.get("y1", 1.0))
                        rect = fitz.Rect(
                            x0n * page_width,
                            y0n * page_height,
                            x1n * page_width,
                            y1n * page_height,
                        )
                        page.add_redact_annot(rect, fill=rgb)

            # Apply all redactions for this page
            page.apply_redactions()

        if scrub_metadata:
            doc.set_metadata({})

    def apply_redactions(
        self,
        pdf_bytes: bytes,
        redactions: List[Dict[str, Any]],
        scrub_metadata: bool = True,
        base_filename: Optional[str] = None,
    ) -> str:
        """
        Apply redactions to a PDF (bytes) and return the output file path.
        """
        if base_filename:
            safe_name = os.path.splitext(os.path.basename(base_filename))[0]
        else:
            safe_name = "document"

        out_name = f"{safe_name}_redacted_{uuid.uuid4().hex[:8]}.pdf"
        out_path = os.path.join(self.output_dir, out_name)

        with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
            self._apply_redactions_to_doc(doc, redactions, scrub_metadata=scrub_metadata)
            doc.save(
                out_path,
                garbage=4,
                deflate=True,
                clean=True,
            )

        return out_path
