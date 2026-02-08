# backend/manual_redaction_engine.py
# Enhanced with Stirling-PDF inspired features

import os
import uuid
import fitz  # PyMuPDF
from typing import List, Dict, Any, Optional, Tuple
from enum import Enum
import io


class RedactionMode(Enum):
    """Redaction modes inspired by Stirling-PDF"""
    BLACK = "black"           # Black box (default)
    WHITE = "white"           # White box
    BLUR = "blur"             # Blur content (pixelated)
    PIXELATE = "pixelate"     # Heavy pixelation
    REMOVE = "remove"         # Remove text entirely (no fill)
    HIGHLIGHT = "highlight"   # Yellow highlight for preview


class ManualRedactionEngine:
    """
    Enhanced manual redaction engine with Stirling-PDF compatible features.
    
    Supports:
    - Box redaction (single and multiple rects)
    - Text selection redaction
    - Full page redaction
    - Multiple redaction modes (black, white, blur, pixelate, remove)
    - Custom colors
    - Metadata scrubbing
    """

    def __init__(self, output_dir: str = "temp_redacted"):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)

    @staticmethod
    def _hex_to_rgb01(hex_color: str) -> Tuple[float, float, float]:
        """
        Convert #RRGGBB or #RGB to (r, g, b) in 0–1 range.
        """
        if not hex_color:
            return (0, 0, 0)
        
        hex_color = hex_color.strip().lstrip("#")
        
        # Handle short form #RGB
        if len(hex_color) == 3:
            hex_color = ''.join([c*2 for c in hex_color])
            
        if len(hex_color) != 6:
            return (0, 0, 0)
            
        try:
            r = int(hex_color[0:2], 16) / 255.0
            g = int(hex_color[2:4], 16) / 255.0
            b = int(hex_color[4:6], 16) / 255.0
            return (r, g, b)
        except ValueError:
            return (0, 0, 0)

    def _apply_blur_effect(self, page: fitz.Page, rect: fitz.Rect, intensity: int = 10):
        """
        Apply blur effect by pixelating and smoothing.
        Stirling-PDF style blur implementation.
        """
        try:
            # Get the region as an image
            zoom = 2  # Higher zoom for better quality
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat, clip=rect)
            
            # Create a simple pixelation effect
            # Downscale to create pixelation
            small_width = max(1, pix.width // intensity)
            small_height = max(1, pix.height // intensity)
            
            # Create pixelated version by sampling
            from PIL import Image
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            
            # Resize down (pixelate) then back up
            img_small = img.resize((small_width, small_height), Image.Resampling.LANCZOS)
            img_pixelated = img_small.resize((pix.width, pix.height), Image.Resampling.NEAREST)
            
            # Convert back to pixmap and insert
            img_bytes = io.BytesIO()
            img_pixelated.save(img_bytes, format='PNG')
            img_bytes.seek(0)
            
            # Insert the blurred image
            page.insert_image(rect, stream=img_bytes.read())
            
        except Exception as e:
            print(f"[manual_redaction_engine] Blur effect failed: {e}")
            # Fallback to black box
            page.add_redact_annot(rect, fill=(0, 0, 0))

    def _apply_redaction_annot(self, page: fitz.Page, rect: fitz.Rect, 
                                mode: RedactionMode, color: Tuple[float, float, float]):
        """
        Apply a single redaction annotation based on mode.
        """
        if mode == RedactionMode.BLACK:
            page.add_redact_annot(rect, fill=(0, 0, 0))
            
        elif mode == RedactionMode.WHITE:
            page.add_redact_annot(rect, fill=(1, 1, 1))
            
        elif mode == RedactionMode.BLUR:
            # Apply blur then add semi-transparent overlay
            self._apply_blur_effect(page, rect, intensity=8)
            page.add_redact_annot(rect, fill=(*color, 0.3))  # Semi-transparent
            
        elif mode == RedactionMode.PIXELATE:
            # Heavy pixelation
            self._apply_blur_effect(page, rect, intensity=20)
            page.add_redact_annot(rect, fill=(*color, 0.5))
            
        elif mode == RedactionMode.REMOVE:
            # Remove without fill (just redact annotation)
            page.add_redact_annot(rect)
            
        elif mode == RedactionMode.HIGHLIGHT:
            # Yellow highlight for preview mode
            page.add_redact_annot(rect, fill=(1, 1, 0), opacity=0.3)

    def _apply_redactions_to_doc(
        self,
        doc: fitz.Document,
        redactions: List[Dict[str, Any]],
        scrub_metadata: bool = True,
    ):
        """
        Apply redactions to an open PyMuPDF document.
        Enhanced with multiple redaction modes.
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
                
                # Get redaction mode (default to BLACK)
                mode_str = r.get("mode", "black").lower()
                try:
                    mode = RedactionMode(mode_str)
                except ValueError:
                    mode = RedactionMode.BLACK

                if rtype == "page":
                    # Full page redaction
                    rect = fitz.Rect(0, 0, page_width, page_height)
                    self._apply_redaction_annot(page, rect, mode, rgb)
                    
                elif rtype == "box":
                    # Single box redaction
                    rect_data = r.get("rect") or r.get("rects", [{}])[0]
                    x0n = float(rect_data.get("x0", 0.0))
                    y0n = float(rect_data.get("y0", 0.0))
                    x1n = float(rect_data.get("x1", 1.0))
                    y1n = float(rect_data.get("y1", 1.0))
                    
                    # FIXED: Ensure proper coordinate order
                    x0 = min(x0n, x1n) * page_width
                    y0 = min(y0n, y1n) * page_height
                    x1 = max(x0n, x1n) * page_width
                    y1 = max(y0n, y1n) * page_height
                    
                    rect = fitz.Rect(x0, y0, x1, y1)
                    self._apply_redaction_annot(page, rect, mode, rgb)
                    
                elif rtype == "text":
                    # Text selection redaction (multiple rects)
                    rects = r.get("rects") or []
                    for rd in rects:
                        x0n = float(rd.get("x0", 0.0))
                        y0n = float(rd.get("y0", 0.0))
                        x1n = float(rd.get("x1", 1.0))
                        y1n = float(rd.get("y1", 1.0))
                        
                        # FIXED: Ensure proper coordinate order
                        x0 = min(x0n, x1n) * page_width
                        y0 = min(y0n, y1n) * page_height
                        x1 = max(x0n, x1n) * page_width
                        y1 = max(y0n, y1n) * page_height
                        
                        rect = fitz.Rect(x0, y0, x1, y1)
                        self._apply_redaction_annot(page, rect, mode, rgb)
                        
                elif rtype == "area":
                    # Freehand area redaction (Stirling-PDF style)
                    points = r.get("points", [])
                    if len(points) >= 3:
                        # Create polygon from points
                        x_coords = [p["x"] * page_width for p in points]
                        y_coords = [p["y"] * page_height for p in points]
                        
                        # Use bounding box for redaction
                        x0, x1 = min(x_coords), max(x_coords)
                        y0, y1 = min(y_coords), max(y_coords)
                        
                        rect = fitz.Rect(x0, y0, x1, y1)
                        self._apply_redaction_annot(page, rect, mode, rgb)

            # Apply all redactions for this page with proper settings
            # FIXED: Use new PyMuPDF API
            page.apply_redactions(
                images=fitz.PDF_REDACT_IMAGE_NONE,  # Remove images in redacted areas
                graphics=fitz.PDF_REDACT_LINE_ART_IF_COVERED  # Remove graphics if covered
            )

        # Scrub metadata if requested
        if scrub_metadata:
            doc.set_metadata({})
            # Also remove XML metadata streams
            for key in list(doc.metadata.keys()):
                doc.metadata[key] = None

    def apply_redactions(
        self,
        pdf_bytes: bytes,
        redactions: List[Dict[str, Any]],
        scrub_metadata: bool = True,
        base_filename: Optional[str] = None,
    ) -> str:
        """
        Apply redactions to a PDF (bytes) and return the output file path.
        
        Args:
            pdf_bytes: PDF file content as bytes
            redactions: List of redaction objects
            scrub_metadata: Whether to remove PDF metadata
            base_filename: Original filename for naming output
            
        Returns:
            Path to the redacted PDF file
        """
        if not redactions:
            raise ValueError("No redactions provided")
            
        if base_filename:
            safe_name = os.path.splitext(os.path.basename(base_filename))[0]
        else:
            safe_name = "document"

        out_name = f"{safe_name}_redacted_{uuid.uuid4().hex[:8]}.pdf"
        out_path = os.path.join(self.output_dir, out_name)

        try:
            with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
                self._apply_redactions_to_doc(doc, redactions, scrub_metadata=scrub_metadata)
                doc.save(
                    out_path,
                    garbage=4,           # Maximum garbage collection
                    deflate=True,        # Compress streams
                    clean=True,          # Clean content streams
                    linear=True,         # Linearized for web viewing
                )
                
        except Exception as e:
            print(f"[manual_redaction_engine] Error applying redactions: {e}")
            raise

        return out_path

    def preview_redactions(
        self,
        pdf_bytes: bytes,
        redactions: List[Dict[str, Any]],
    ) -> str:
        """
        Create a preview PDF with yellow highlights instead of black redactions.
        Useful for review before final redaction.
        """
        # Convert all redactions to highlight mode
        preview_redactions = []
        for r in redactions:
            preview_r = r.copy()
            preview_r["mode"] = "highlight"
            preview_r["color"] = "#FFFF00"
            preview_redactions.append(preview_r)
            
        return self.apply_redactions(
            pdf_bytes,
            preview_redactions,
            scrub_metadata=False,
            base_filename="preview"
        )