# backend/ocr_engine.py

import io
from dataclasses import dataclass
from typing import List, Dict

import fitz  # PyMuPDF
import pytesseract
from PIL import Image

# IMPORTANT: adjust this path if your Tesseract is installed elsewhere
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"


@dataclass
class OCRWord:
    page: int
    text: str
    x0: float
    y0: float
    x1: float
    y1: float


class OCREngine:
    """
    Simple OCR engine using Tesseract + PyMuPDF.
    Produces word-level bounding boxes normalized to [0,1] coordinates.
    """

    def __init__(self, lang: str = "eng"):
        self.lang = lang

    def _page_to_image(self, page: fitz.Page, dpi: int = 200) -> Image.Image:
        zoom = dpi / 72.0
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        return img

    def ocr_pdf_bytes(self, pdf_bytes: bytes) -> List[OCRWord]:
        """
        Run OCR on all pages of a PDF (bytes) and return word-level boxes.
        Coordinates are normalized to [0,1] per page.
        """
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        results: List[OCRWord] = []

        for page_index in range(len(doc)):
            page = doc[page_index]
            img = self._page_to_image(page)
            width, height = img.size

            data = pytesseract.image_to_data(
                img,
                lang=self.lang,
                output_type=pytesseract.Output.DICT,
            )

            n = len(data["text"])
            for i in range(n):
                text = data["text"][i].strip()
                if not text:
                    continue
                x = data["left"][i]
                y = data["top"][i]
                w = data["width"][i]
                h = data["height"][i]

                x0 = x / width
                y0 = y / height
                x1 = (x + w) / width
                y1 = (y + h) / height

                results.append(
                    OCRWord(
                        page=page_index + 1,
                        text=text,
                        x0=x0,
                        y0=y0,
                        x1=x1,
                        y1=y1,
                    )
                )

        doc.close()
        return results

    def ocr_pdf_bytes_per_page(self, pdf_bytes: bytes, page_index: int) -> List[OCRWord]:
        """
        OCR a single page (0-based index) of a PDF.
        """
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        if page_index < 0 or page_index >= len(doc):
            doc.close()
            return []

        page = doc[page_index]
        img = self._page_to_image(page)
        width, height = img.size

        data = pytesseract.image_to_data(
            img,
            lang=self.lang,
            output_type=pytesseract.Output.DICT,
        )

        results: List[OCRWord] = []
        n = len(data["text"])
        for i in range(n):
            text = data["text"][i].strip()
            if not text:
                continue
            x = data["left"][i]
            y = data["top"][i]
            w = data["width"][i]
            h = data["height"][i]

            x0 = x / width
            y0 = y / height
            x1 = (x + w) / width
            y1 = (y + h) / height

            results.append(
                OCRWord(
                    page=page_index + 1,
                    text=text,
                    x0=x0,
                    y0=y0,
                    x1=x1,
                    y1=y1,
                )
            )

        doc.close()
        return results
