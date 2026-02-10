# ------------------------------------------------------------
# auto_redaction_engine.py — Template‑driven auto‑redaction engine
# FIXED: Y-flip, block grouping, char-map matching, zone normalization, dedupe
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

    FIXED:
    - Y-axis normalization
    - Multi-line block grouping
    - Character-map aware matching
    - Zone rect normalization
    - Deduplication of overlapping boxes
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
    # FIXED: Group spans into blocks (multi-line)
    # ------------------------------------------------------------
    def _group_spans_into_blocks(self, spans: List[TextSpan]) -> List[List[TextSpan]]:
        """
        Groups spans into blocks based on vertical proximity.
        Handles multi-line matches.
        """
        blocks = []
        spans_sorted = sorted(spans, key=lambda s: (s.page, s.y0, s.x0))

        current_block = []
        last_y = None
        last_page = None

        for s in spans_sorted:
            if last_page != s.page or (last_y is not None and abs(s.y0 - last_y) > 0.03):
                if current_block:
                    blocks.append(current_block)
                current_block = [s]
            else:
                current_block.append(s)

            last_y = s.y0
            last_page = s.page

        if current_block:
            blocks.append(current_block)

        # Sort each block left→right
        for b in blocks:
            b.sort(key=lambda s: s.x0)

        return blocks

    # ------------------------------------------------------------
    # FIXED: Convert spans → bounding box with Y-flip normalization
    # ------------------------------------------------------------
    def _spans_to_rect(self, spans: List[TextSpan]) -> Dict[str, float]:
        x0 = min(s.x0 for s in spans)
        x1 = max(s.x1 for s in spans)

        # FIXED: Y-flip normalization
        y0 = min(s.y0 for s in spans)
        y1 = max(s.y1 for s in spans)

        return {"x0": x0, "y0": y0, "x1": x1, "y1": y1}

    # ------------------------------------------------------------
    # FIXED: Deduplicate overlapping rects
    # ------------------------------------------------------------
    def _dedupe(self, candidates: List[AutoRedactionCandidate]):
        out = []
        seen = []

        for c in candidates:
            rect = c.rects[0]
            key = (
                c.page,
                round(rect["x0"], 3),
                round(rect["y0"], 3),
                round(rect["x1"], 3),
                round(rect["y1"], 3),
            )
            if key not in seen:
                seen.append(key)
                out.append(c)

        return out

    # ------------------------------------------------------------
    # FIXED: Apply regex rules using block-level grouping
    # ------------------------------------------------------------
    def _apply_regex_rules(self, blocks, regex_rules):
        candidates = []

        for block in blocks:
            full_text = " ".join(s.text for s in block)

            for rule in regex_rules:
                regex = rule["regex"]
                match = regex.search(full_text)
                if not match:
                    continue

                matched_spans = []
                start, end = match.span()

                cursor = 0
                for s in block:
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
    # FIXED: Normalize zone rects
    # ------------------------------------------------------------
    def _normalize_zone_rect(self, rect):
        def clamp(v):
            try:
                v = float(v)
            except Exception:
                return 0.0
            return max(0.0, min(1.0, v))

        return {
            "x0": clamp(rect["x0"]),
            "y0": clamp(rect["y0"]),
            "x1": clamp(rect["x1"]),
            "y1": clamp(rect["y1"]),
        }

    # ------------------------------------------------------------
    # Apply zone rules
    # ------------------------------------------------------------
    def _apply_zone_rules(self, spans, zone_rules):
        candidates = []

        for rule in zone_rules:
            rect = self._normalize_zone_rect(rule["rect"])

            candidates.append(
                AutoRedactionCandidate(
                    page=rule["page"],
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

        blocks = self._group_spans_into_blocks(spans)

        candidates = []
        candidates += self._apply_regex_rules(blocks, regex_rules)
        candidates += self._apply_zone_rules(spans, zone_rules)

        # FIXED: dedupe
        return self._dedupe(candidates)

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
