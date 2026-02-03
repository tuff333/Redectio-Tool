# backend/company_detector.py
import json
import os
from typing import Optional, Dict, Any, List

from backend.pdf_text_extractor import PDFTextExtractor

CONFIG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config")
COMPANIES_CONFIG_PATH = os.path.join(CONFIG_DIR, "companies.json")


class CompanyDetector:
    def __init__(self):
        self.text_extractor = PDFTextExtractor()
        self._companies_cfg = self._load_companies_config()

    def _load_companies_config(self) -> Dict[str, Any]:
        if not os.path.isfile(COMPANIES_CONFIG_PATH):
            raise FileNotFoundError(f"companies.json not found at {COMPANIES_CONFIG_PATH}")
        with open(COMPANIES_CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)

    def detect_company_id(self, pdf_path: str) -> Optional[str]:
        """
        Look at the first page (or all pages if you want) and
        try to match company by configured 'match_strings'.
        """
        pages_text: List[str] = self.text_extractor.extract_text_per_page(pdf_path)
        if not pages_text:
            return None

        full_text = "\n".join(pages_text[:2])  # first 1–2 pages are usually enough
        full_text_lower = full_text.lower()

        for company in self._companies_cfg.get("companies", []):
            for needle in company.get("match_strings", []):
                if needle.lower() in full_text_lower:
                    return company["id"]

        return None

    def get_template_file_for_company(self, company_id: Optional[str]) -> str:
        if company_id is None:
            return self._companies_cfg.get("fallback_template_file")

        for company in self._companies_cfg.get("companies", []):
            if company.get("id") == company_id:
                return company.get("template_file")

        return self._companies_cfg.get("fallback_template_file")
