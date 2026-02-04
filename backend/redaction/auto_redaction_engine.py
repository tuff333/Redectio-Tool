# backend/redaction/auto_redaction_engine.py

import json
import os
from typing import List, Dict, Any, Optional

from backend.redaction.text_finder import TextFinder


class AutoRedactionEngine:
    """
    Pattern-based auto-redaction engine.

    - Loads default patterns from config/redaction_patterns_default.json
    - Optionally loads additional/custom patterns from another JSON file
    - Uses TextFinder to locate matches and returns redaction candidates
      in the same format as manual redactions.
    """

    def __init__(
        self,
        default_patterns_path: str = "config/redaction_patterns_default.json",
    ):
        self.text_finder = TextFinder()
        self.default_patterns_path = default_patterns_path
        self.default_patterns = self._load_patterns(default_patterns_path)

    @staticmethod
    def _load_patterns(path: str) -> List[Dict[str, Any]]:
        if not os.path.isfile(path):
            return []
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list):
                return data
            return []
        except Exception:
            return []

    def _merge_patterns(
        self,
        custom_patterns_path: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        patterns = list(self.default_patterns)

        if custom_patterns_path and os.path.isfile(custom_patterns_path):
            try:
                with open(custom_patterns_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, list):
                    patterns.extend(data)
            except Exception:
                pass

        # Filter enabled only
        patterns = [p for p in patterns if p.get("enabled", True)]
        return patterns

    def suggest_redactions(
        self,
        pdf_bytes: bytes,
        custom_patterns_path: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Return auto-redaction candidates as a list of redaction actions:

        [
          {
            "page": 1,
            "type": "text",
            "rects": [
              { "x0": 0.1, "y0": 0.2, "x1": 0.15, "y1": 0.22 },
              ...
            ],
            "text": "matched text",
            "color": "#000000",
            "pattern_id": "email"
          },
          ...
        ]
        """
        patterns = self._merge_patterns(custom_patterns_path)
        candidates: List[Dict[str, Any]] = []

        for pattern in patterns:
            pid = pattern.get("id", "pattern")
            regex = pattern.get("regex")
            color = pattern.get("color", "#000000")
            if not regex:
                continue

            matches = self.text_finder.search_regex(pdf_bytes, regex)
            for m in matches:
                candidates.append(
                    {
                        "page": m["page"],
                        "type": "text",
                        "rects": m["rects"],
                        "text": m["text"],
                        "color": color,
                        "pattern_id": pid,
                    }
                )

        return candidates
