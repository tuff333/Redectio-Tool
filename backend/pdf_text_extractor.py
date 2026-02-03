# backend/pdf_text_extractor.py

import os
from typing import List, Dict, Any
from PyPDF2 import PdfReader


class PDFTextExtractor:
    """
    Extracts text from PDFs.
    Provides:
        - extract_text()
        - extract_text_per_page()
    """

    def __init__(self):
        pass

    # ---------------------------------------------------------
    # Extract full text from PDF
    # ---------------------------------------------------------
    def extract_text(self, pdf_path: str) -> str:
        if not os.path.isfile(pdf_path):
            raise FileNotFoundError(f"PDF not found: {pdf_path}")

        reader = PdfReader(pdf_path)
        full_text = []

        for page in reader.pages:
            try:
                text = page.extract_text() or ""
                full_text.append(text)
            except Exception as e:
                print(f"[pdf_text_extractor] Error extracting page text: {e}")
                full_text.append("")

        return "\n".join(full_text)

    # ---------------------------------------------------------
    # Extract text per page (list of strings)
    # ---------------------------------------------------------
    def extract_text_per_page(self, pdf_path: str) -> List[str]:
        if not os.path.isfile(pdf_path):
            raise FileNotFoundError(f"PDF not found: {pdf_path}")

        reader = PdfReader(pdf_path)
        pages_text = []

        for page in reader.pages:
            try:
                text = page.extract_text() or ""
                pages_text.append(text)
            except Exception as e:
                print(f"[pdf_text_extractor] Error extracting page text: {e}")
                pages_text.append("")

        return pages_text
