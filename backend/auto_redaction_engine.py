# backend/auto_redaction_engine.py

import json
import os
import re
from dataclasses import dataclass
from typing import List, Dict, Any

from backend.text_finder import TextFinder, TextSpan


@dataclass
class RedactionCandidate:
    page: int
    type: str  # "text" | "box" | "page"
    rects: List[Dict[str, float]]
    text: str
    pattern_id: str | None = None
    color: str = "#000000"


class AutoRedactionEngine:
    """
    Simple regex-based auto-redaction engine.

    - Loads patterns from a JSON file (config/redaction_patterns_high_north.json).
    - Uses TextFinder (OCR-aware) to get text spans with bounding boxes.
    - For now, matches at word level: if a word matches a pattern, we redact that word.
    """

    def __init__(
        self,
        patterns_path: str = os.path.join("config", "redaction_patterns_high_north.json"),
    ):
        self.patterns_path = patterns_path
        self.text_finder = TextFinder()
        self.patterns = self._load_patterns()

    def _load_patterns(self) -> List[Dict[str, Any]]:
        if not os.path.isfile(self.patterns_path):
            return []

        try:
            with open(self.patterns_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            return []

        # Expected structure (flexible):
        # {
        #   "patterns": [
        #     { "id": "EMAIL", "regex": "...", "color": "#000000" },
        #     ...
        #   ]
        # }
        patterns = data.get("patterns")
        if isinstance(patterns, list):
            out = []
            for p in patterns:
                regex = p.get("regex") or p.get("pattern")
                if not regex:
                    continue
                out.append(
                    {
                        "id": p.get("id") or p.get("name") or "PATTERN",
                        "regex": re.compile(regex, re.IGNORECASE),
                        "color": p.get("color", "#000000"),
                    }
                )
            return out

        # Fallback: maybe it's a list directly
        if isinstance(data, list):
            out = []
            for p in data:
                regex = p.get("regex") or p.get("pattern")
                if not regex:
                    continue
                out.append(
                    {
                        "id": p.get("id") or p.get("name") or "PATTERN",
                        "regex": re.compile(regex, re.IGNORECASE),
                        "color": p.get("color", "#000000"),
                    }
                )
            return out

        return []

    def suggest_redactions(
        self,
        pdf_bytes: bytes,
        use_ocr: bool = False,
        auto_ocr: bool = True,
    ) -> List[RedactionCandidate]:
        spans: List[TextSpan] = self.text_finder.find_text_spans(
            pdf_bytes, use_ocr=use_ocr, auto_ocr=auto_ocr
        )

        candidates: List[RedactionCandidate] = []
        if not self.patterns:
            return candidates

        for span in spans:
            for p in self.patterns:
                if p["regex"].search(span.text):
                    rect = {
                        "x0": span.x0,
                        "y0": span.y0,
                        "x1": span.x1,
                        "y1": span.y1,
                    }
                    candidates.append(
                        RedactionCandidate(
                            page=span.page,
                            type="text",
                            rects=[rect],
                            text=span.text,
                            pattern_id=p["id"],
                            color=p["color"],
                        )
                    )
                    break  # avoid duplicate patterns on same word

        return candidates

    def suggest_redactions_json(
        self,
        pdf_bytes: bytes,
        use_ocr: bool = False,
        auto_ocr: bool = True,
    ) -> Dict[str, Any]:
        candidates = self.suggest_redactions(
            pdf_bytes=pdf_bytes,
            use_ocr=use_ocr,
            auto_ocr=auto_ocr,
        )
        return {
            "candidates": [
                {
                    "page": c.page,
                    "type": c.type,
                    "rects": c.rects,
                    "text": c.text,
                    "pattern_id": c.pattern_id,
                    "color": c.color,
                }
                for c in candidates
            ]
        }
