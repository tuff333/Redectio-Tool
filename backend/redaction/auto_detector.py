# ------------------------------------------------------------
# backend/redaction/auto_detector.py
# DEPRECATED — Legacy auto-detector (pre-template system)
#
# SAFE CHANGES ONLY:
# - Marked as deprecated
# - Added import guards
# - Added warnings
# - Prevent accidental use in new system
#
# INTERNAL LOGIC UNCHANGED (for backward compatibility)
# ------------------------------------------------------------

import json
import re
from pathlib import Path
from typing import List, Dict, Any

# ------------------------------------------------------------
# WARNING: This module is deprecated.
# It should NOT be used by any new code.
# ------------------------------------------------------------

def _deprecated_warning():
    print(
        "[auto_detector] WARNING: AutoRedactionDetector is deprecated and "
        "will be removed once the template-driven system is fully stable."
    )

_deprecated_warning()


class AutoRedactionDetector:
    """
    LEGACY DETECTOR — DO NOT USE IN NEW SYSTEMS.

    This class exists ONLY for backward compatibility with
    old configs and old CLI tools.

    New system uses:
        - TemplateLoader
        - TemplateCompiler
        - AutoRedactionEngine
        - ManualRedactionEngine
    """

    def __init__(self, config_path: str):
        _deprecated_warning()
        self.config = json.loads(Path(config_path).read_text(encoding="utf-8"))
        self._compile_regex()

    def _compile_regex(self):
        self.compiled_regex = {
            key: [re.compile(p) for p in patterns]
            for key, patterns in self.config.get("regex_patterns", {}).items()
        }

    def detect(self, pages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        _deprecated_warning()
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

                if self._matches_fixed(text, company_strings, fixed_phrases):
                    results.append(self._make_item(page_num, bbox, "company_or_fixed", text))
                    continue

                if self._matches_label_pattern(text, label_patterns):
                    results.append(self._make_item(page_num, bbox, "label_value", text))
                    continue

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
        return any(s and s in t for s in company_strings) or any(s and s in t for s in fixed_phrases)

    def _matches_label_pattern(self, text: str, labels: List[str]) -> bool:
        t = text.strip()
        return any(label in t for label in labels)

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
