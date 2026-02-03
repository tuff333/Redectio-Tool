# backend/redaction/auto_detector.py
import json
import re
from pathlib import Path
from typing import List, Dict, Any


class AutoRedactionDetector:
    def __init__(self, config_path: str):
        self.config = json.loads(Path(config_path).read_text(encoding="utf-8"))
        self._compile_regex()

    def _compile_regex(self):
        self.compiled_regex = {}
        for key, patterns in self.config.get("regex_patterns", {}).items():
            self.compiled_regex[key] = [re.compile(p) for p in patterns]

    def detect(self, pages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        pages: list of { "page": int, "blocks": [ { "text": str, "bbox": [x1,y1,x2,y2] }, ... ] }
        returns: list of redaction items: { "page": int, "bbox": [...], "reason": str, "text": str }
        """
        results = []

        fixed_phrases = set(self.config.get("fixed_phrases", []))
        label_patterns = self.config.get("label_patterns", [])
        company_strings = self._collect_company_strings()

        for page in pages:
            page_num = page["page"]
            for block in page.get("blocks", []):
                text = block.get("text", "") or ""
                bbox = block.get("bbox", None)
                if not text.strip() or not bbox:
                    continue

                # 1. Exact matches (company names, addresses, fixed phrases)
                if self._matches_fixed(text, company_strings, fixed_phrases):
                    results.append(self._make_item(page_num, bbox, "company_or_fixed", text))
                    continue

                # 2. Label-anchored values (e.g., "High North ID: 00685494")
                if self._matches_label_pattern(text, label_patterns):
                    results.append(self._make_item(page_num, bbox, "label_value", text))
                    continue

                # 3. Regex-based matches (phone, date, id, email)
                regex_reason = self._matches_regex(text)
                if regex_reason:
                    results.append(self._make_item(page_num, bbox, regex_reason, text))
                    continue

        return results

    def _collect_company_strings(self) -> List[str]:
        strings = []
        for company in self.config.get("companies", {}).values():
            for key in ("names", "addresses", "phones", "emails"):
                strings.extend(company.get(key, []))
        return [s for s in strings if s]

    def _matches_fixed(self, text: str, company_strings: List[str], fixed_phrases: set) -> bool:
        t = text.strip()
        for s in company_strings:
            if s and s in t:
                return True
        for s in fixed_phrases:
            if s and s in t:
                return True
        return False

    def _matches_label_pattern(self, text: str, labels: List[str]) -> bool:
        t = text.strip()
        for label in labels:
            if label in t:
                return True
        return False

    def _matches_regex(self, text: str) -> str:
        t = text.strip()
        for key, patterns in self.compiled_regex.items():
            for pat in patterns:
                if pat.search(t):
                    return f"regex_{key}"
        return ""

    def _make_item(self, page: int, bbox: List[float], reason: str, text: str) -> Dict[str, Any]:
        return {
            "page": page,
            "bbox": bbox,
            "reason": reason,
            "text": text
        }
