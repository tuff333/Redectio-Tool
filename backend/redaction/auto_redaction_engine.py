# ------------------------------------------------------------
# auto_redaction_engine.py — Template‑driven auto‑redaction engine
# ------------------------------------------------------------

from dataclasses import dataclass
from typing import List, Dict, Any, Optional

from backend.redaction.text_finder import TextFinder, TextSpan
from backend.template_loader import TemplateLoader
from backend.template_compiler import TemplateCompiler


@dataclass
class AutoRedactionCandidate:
    page: int
    type: str
    rects: List[Dict[str, float]]
    text: str
    rule_id: Optional[str] = None
    color: str = "#000000"
    mode: str = "black"


class AutoRedactionEngine:
    """
    Full Stirling‑style auto‑redaction engine.

    Supports:
    - Multi‑word regex patterns
    - Label‑anchored detection
    - Company‑specific templates
    - Page‑level zones
    - OCR fallback
    - Hybrid text + OCR detection
    """

    def __init__(self, template_loader: Optional[TemplateLoader] = None):
        self.text_finder = TextFinder()
        self.template_loader = template_loader or TemplateLoader()

    # ------------------------------------------------------------
    # Load and compile template rules
    # ------------------------------------------------------------
    def _load_compiled_rules(self, company_id: Optional[str]):
        template = self.template_loader.get_template(company_id)
        if not template:
            return {"regex_rules": [], "zone_rules": []}

        compiled = TemplateCompiler(template).compile()
        return compiled

    # ------------------------------------------------------------
    # Group spans into lines for multi‑word matching
    # ------------------------------------------------------------
    def _group_spans_into_lines(self, spans: List[TextSpan]) -> List[List[TextSpan]]:
        lines = {}
        for s in spans:
            key = (s.page, round(s.y0, 2))
            lines.setdefault(key, []).append(s)

        grouped = []
        for key, line in lines.items():
            grouped.append(sorted(line, key=lambda s: s.x0))

        return grouped

    # ------------------------------------------------------------
    # Convert multi‑word match to bounding box
    # ------------------------------------------------------------
    def _spans_to_rect(self, spans: List[TextSpan]) -> Dict[str, float]:
        x0 = min(s.x0 for s in spans)
        y0 = min(s.y0 for s in spans)
        x1 = max(s.x1 for s in spans)
        y1 = max(s.y1 for s in spans)
        return {"x0": x0, "y0": y0, "x1": x1, "y1": y1}

    # ------------------------------------------------------------
    # Apply regex rules to grouped spans
    # ------------------------------------------------------------
    def _apply_regex_rules(self, grouped_lines, regex_rules):
        candidates = []

        for line in grouped_lines:
            full_text = " ".join(s.text for s in line)

            for rule in regex_rules:
                regex = rule["regex"]
                match = regex.search(full_text)
                if not match:
                    continue

                matched_spans = []
                start, end = match.span()

                cursor = 0
                for s in line:
                    word = s.text
                    w_start = cursor
                    w_end = cursor + len(word)
                    cursor += len(word) + 1

                    if w_start < end and w_end > start:
                        matched_spans.append(s)

                if matched_spans:
                    rect = self._spans_to_rect(matched_spans)
                    candidates.append(
                        AutoRedactionCandidate(
                            page=matched_spans[0].page,
                            type="auto",
                            rects=[rect],
                            text=match.group(0),
                            rule_id=rule["id"],
                            color=rule["color"],
                            mode=rule["mode"],
                        )
                    )

        return candidates

    # ------------------------------------------------------------
    # Apply zone rules
    # ------------------------------------------------------------
    def _apply_zone_rules(self, spans, zone_rules):
        candidates = []

        for rule in zone_rules:
            page = rule["page"]
            rect = rule["rect"]

            candidates.append(
                AutoRedactionCandidate(
                    page=page,
                    type="auto",
                    rects=[rect],
                    text="ZONE",
                    rule_id=rule["id"],
                    color=rule["color"],
                    mode=rule["mode"],
                )
            )

        return candidates

    # ------------------------------------------------------------
    # Main entry point
    # ------------------------------------------------------------
    def suggest_redactions(
        self,
        pdf_bytes: bytes,
        company_id: Optional[str],
        use_ocr: bool = False,
        auto_ocr: bool = True,
    ):
        spans = self.text_finder.find_text_spans(
            pdf_bytes,
            use_ocr=use_ocr,
            auto_ocr=auto_ocr,
        )
        if not spans:
            return []

        compiled = self._load_compiled_rules(company_id)
        regex_rules = compiled["regex_rules"]
        zone_rules = compiled["zone_rules"]

        grouped = self._group_spans_into_lines(spans)

        candidates = []
        candidates += self._apply_regex_rules(grouped, regex_rules)
        candidates += self._apply_zone_rules(spans, zone_rules)

        return candidates

    # ------------------------------------------------------------
    # JSON output for API
    # ------------------------------------------------------------
    def suggest_redactions_json(
        self,
        pdf_bytes: bytes,
        company_id: Optional[str],
        use_ocr: bool = False,
        auto_ocr: bool = True,
    ):
        candidates = self.suggest_redactions(pdf_bytes, company_id, use_ocr, auto_ocr)

        return {
            "candidates": [
                {
                    "page": c.page,
                    "type": c.type,
                    "rects": c.rects,
                    "text": c.text,
                    "rule_id": c.rule_id,
                    "color": c.color,
                    "mode": c.mode,
                }
                for c in candidates
            ]
        }
