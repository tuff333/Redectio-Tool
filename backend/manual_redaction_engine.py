# ------------------------------------------------------------
# manual_redaction_engine.py — Stirling‑style manual redaction engine
# ------------------------------------------------------------

import os
import uuid
import fitz  # PyMuPDF
from typing import List, Dict, Any, Optional, Tuple
import io
from PIL import Image


class ManualRedactionEngine:
    """
    Fully upgraded manual redaction engine supporting:
    - box redactions
    - text redactions (multi-rect)
    - polygon redactions
    - ink strokes
    - highlight mode
    - blur / pixelate modes
    - remove mode
    - full-page redaction
    - metadata scrubbing
    """

    def __init__(self, output_dir: str = "temp_redacted"):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)

    # ------------------------------------------------------------
    # Color helpers
    # ------------------------------------------------------------
    @staticmethod
    def _hex_to_rgb01(hex_color: str) -> Tuple[float, float, float]:
        if not hex_color:
            return (0, 0, 0)
        hex_color = hex_color.strip().lstrip("#")
        if len(hex_color) == 3:
            hex_color = "".join([c * 2 for c in hex_color])
        if len(hex_color) != 6:
            return (0, 0, 0)
        r = int(hex_color[0:2], 16) / 255.0
        g = int(hex_color[2:4], 16) / 255.0
        b = int(hex_color[4:6], 16) / 255.0
        return (r, g, b)

    # ------------------------------------------------------------
    # Blur / pixelate helpers
    # ------------------------------------------------------------
    def _apply_pixel_effect(self, page, rect, intensity: int):
        try:
            zoom = 2
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat, clip=rect)

            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

            small_w = max(1, pix.width // intensity)
            small_h = max(1, pix.height // intensity)

            img_small = img.resize((small_w, small_h), Image.Resampling.LANCZOS)
            img_pixel = img_small.resize((pix.width, pix.height), Image.Resampling.NEAREST)

            buf = io.BytesIO()
            img_pixel.save(buf, format="PNG")
            buf.seek(0)

            page.insert_image(rect, stream=buf.read())
        except Exception as e:
            print(f"[manual_redaction_engine] Pixel effect failed: {e}")
            page.add_redact_annot(rect, fill=(0, 0, 0))

    # ------------------------------------------------------------
    # Apply a single redaction annotation
    # ------------------------------------------------------------
    def _apply_redaction(self, page, rect, mode, rgb):
        if mode == "black":
            page.add_redact_annot(rect, fill=(0, 0, 0))

        elif mode == "white":
            page.add_redact_annot(rect, fill=(1, 1, 1))

        elif mode == "highlight":
            page.add_redact_annot(rect, fill=(1, 1, 0), opacity=0.3)

        elif mode == "remove":
            page.add_redact_annot(rect)

        elif mode == "blur":
            self._apply_pixel_effect(page, rect, intensity=8)
            page.add_redact_annot(rect, fill=(*rgb, 0.3))

        elif mode == "pixelate":
            self._apply_pixel_effect(page, rect, intensity=20)
            page.add_redact_annot(rect, fill=(*rgb, 0.5))

        else:
            page.add_redact_annot(rect, fill=rgb)

    # ------------------------------------------------------------
    # Convert polygon/ink strokes to bounding box
    # ------------------------------------------------------------
    def _points_to_rect(self, points, page_width, page_height):
        xs = [p["x"] * page_width for p in points]
        ys = [p["y"] * page_height for p in points]
        return fitz.Rect(min(xs), min(ys), max(xs), max(ys))

    # ------------------------------------------------------------
    # Apply all redactions to a document
    # ------------------------------------------------------------
    def _apply_redactions_to_doc(self, doc, redactions, scrub_metadata=True):
        by_page = {}
        for r in redactions:
            p = int(r.get("page", 1))
            by_page.setdefault(p, []).append(r)

        for page_index in range(len(doc)):
            page_num = page_index + 1
            page = doc[page_index]
            pw, ph = page.rect.width, page.rect.height

            items = by_page.get(page_num, [])
            if not items:
                continue

            for r in items:
                rtype = r.get("type", "box")
                mode = r.get("mode", "black").lower()
                rgb = self._hex_to_rgb01(r.get("color", "#000000"))

                if rtype == "page":
                    rect = fitz.Rect(0, 0, pw, ph)
                    self._apply_redaction(page, rect, mode, rgb)

                elif rtype in ("box", "text", "search", "auto"):
                    for rd in r.get("rects", []):
                        x0 = rd["x0"] * pw
                        y0 = rd["y0"] * ph
                        x1 = rd["x1"] * pw
                        y1 = rd["y1"] * ph
                        rect = fitz.Rect(x0, y0, x1, y1)
                        self._apply_redaction(page, rect, mode, rgb)

                elif rtype in ("ink", "polygon"):
                    pts = r.get("points", [])
                    if len(pts) >= 2:
                        rect = self._points_to_rect(pts, pw, ph)
                        self._apply_redaction(page, rect, mode, rgb)

            page.apply_redactions(
                images=fitz.PDF_REDACT_IMAGE_NONE,
                graphics=fitz.PDF_REDACT_LINE_ART_IF_COVERED
            )

        if scrub_metadata:
            doc.set_metadata({})
            for k in list(doc.metadata.keys()):
                doc.metadata[k] = None

    # ------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------
    def apply_redactions(self, pdf_bytes, redactions, scrub_metadata=True, base_filename=None):
        if not redactions:
            raise ValueError("No redactions provided")

        safe_name = os.path.splitext(os.path.basename(base_filename or "document"))[0]
        out_name = f"{safe_name}_redacted_{uuid.uuid4().hex[:8]}.pdf"
        out_path = os.path.join(self.output_dir, out_name)

        with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
            self._apply_redactions_to_doc(doc, redactions, scrub_metadata)
            doc.save(out_path, garbage=4, deflate=True, clean=True, linear=True)

        return out_path
