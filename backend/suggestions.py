import re
from typing import Optional, Dict, Any, List

from .rules_engine import (
    load_universal_rules,
    load_defaults,
    load_company_rules,
    merge_rules,
    detect_company_from_text,
)


# ------------------------------------------------------------
# Build final rules for a document
# ------------------------------------------------------------
def build_final_rules_for_document(ocr_text: str, company_hint: str | None = None) -> dict:
    """
    Merge:
      - universal rules
      - defaults
      - company-specific rules (if detected or hinted)

    Option D: always run both universal + company rules.
    """
    universal = load_universal_rules()
    defaults = load_defaults()

    if company_hint:
        company_id = company_hint
    else:
        company_id = detect_company_from_text(ocr_text)

    company_rules = load_company_rules(company_id) if company_id else None

    # merge_rules is your existing logic; we do not change it.
    final_rules = merge_rules(universal, defaults, company_rules)
    final_rules["company_id"] = company_id
    return final_rules


# ------------------------------------------------------------
# Internal helpers
# ------------------------------------------------------------
def _compile_regex(pattern: str, flags: str = "i") -> Optional[re.Pattern]:
    if not pattern:
        return None

    re_flags = 0
    if "i" in flags:
        re_flags |= re.IGNORECASE
    if "m" in flags:
        re_flags |= re.MULTILINE
    if "s" in flags:
        re_flags |= re.DOTALL

    try:
        return re.compile(pattern, re_flags)
    except re.error:
        return None


def _get_text_rules(final_rules: dict) -> List[Dict[str, Any]]:
    """
    Support both:
      - final_rules["text_rules"] (rules_engine style)
      - final_rules["rules"]      (template_loader style)
    """
    if "text_rules" in final_rules and isinstance(final_rules["text_rules"], list):
        return final_rules["text_rules"]

    if "rules" in final_rules and isinstance(final_rules["rules"], list):
        return final_rules["rules"]

    return []


def _get_layout_rules(final_rules: dict) -> List[Dict[str, Any]]:
    """
    Support both:
      - final_rules["layout_rules"] (rules_engine style)
      - final_rules["zones"]        (template_loader style)
    """
    if "layout_rules" in final_rules and isinstance(final_rules["layout_rules"], list):
        return final_rules["layout_rules"]

    if "zones" in final_rules and isinstance(final_rules["zones"], list):
        return final_rules["zones"]

    return []


# ------------------------------------------------------------
# generate_suggestions
# ------------------------------------------------------------
def generate_suggestions(pdf_pages, ocr_result, final_rules: dict):
    """
    pdf_pages: (unused, kept for backward compatibility)
    ocr_result: {
        "pages": [ "full text per page", ... ],
        "spans_by_page": {
            page_number (int): [
                { "text": str, "x0": float, "y0": float, "x1": float, "y1": float },
                ...
            ]
        }
    }
    final_rules: merged rules dict

    Returns: list of suggestion dicts:
      {
        "id": (assigned on frontend),
        "type": "text" | "layout_zone",
        "page": int,          # 1-based
        "rects": [ { x0, y0, x1, y1 } ],
        "rule_id": str,
        "label": str,
        "text": str,          # for text matches
        "reason": str
      }
    """
    suggestions: List[Dict[str, Any]] = []

    pages_text: List[str] = ocr_result.get("pages") or []
    spans_by_page: Dict[int, List[Dict[str, Any]]] = ocr_result.get("spans_by_page") or {}

    # --------------------------------------------------------
    # 1) Text-based suggestions (regex on spans)
    # --------------------------------------------------------
    text_rules = _get_text_rules(final_rules)

    for rule in text_rules:
        pattern = rule.get("pattern") or ""
        if not pattern:
            continue

        flags = rule.get("flags", "i")
        regex = _compile_regex(pattern, flags)
        if not regex:
            continue

        rule_id = rule.get("id") or rule.get("label") or "rule"
        label = rule.get("label", rule_id)
        action = rule.get("action", "suggest")

        if action != "suggest":
            continue

        # For each page, scan spans
        for page_num, spans in spans_by_page.items():
            for span in spans:
                text = span.get("text", "") or ""
                if not text.strip():
                    continue

                if regex.search(text):
                    rect = {
                        "x0": float(span.get("x0", 0.0)),
                        "y0": float(span.get("y0", 0.0)),
                        "x1": float(span.get("x1", 1.0)),
                        "y1": float(span.get("y1", 1.0)),
                    }

                    suggestions.append(
                        {
                            "type": "text",
                            "rule_id": rule_id,
                            "label": label,
                            "page": int(page_num),
                            "rects": [rect],
                            "text": text,
                            "reason": f"Matched pattern: {label}",
                        }
                    )

    # --------------------------------------------------------
    # 2) Layout-based suggestions (zones)
    # --------------------------------------------------------
    layout_rules = _get_layout_rules(final_rules)

    total_pages = max(len(pages_text), max(spans_by_page.keys(), default=0))

    for lr in layout_rules:
        action = lr.get("action", "suggest")
        if action != "suggest":
            continue

        rect = lr.get("rect") or {}
        x0 = float(rect.get("x0", 0.0))
        y0 = float(rect.get("y0", 0.0))
        x1 = float(rect.get("x1", 1.0))
        y1 = float(rect.get("y1", 1.0))

        rule_id = lr.get("id") or lr.get("label") or "layout_zone"
        label = lr.get("label", rule_id)

        page_scope = lr.get("page_scope", "single")
        page = int(lr.get("page", 1))

        if page_scope == "all":
            pages = range(1, total_pages + 1)
        else:
            pages = [page]

        for p in pages:
            suggestions.append(
                {
                    "type": "layout_zone",
                    "rule_id": rule_id,
                    "label": label,
                    "page": int(p),
                    "rects": [
                        {
                            "x0": x0,
                            "y0": y0,
                            "x1": x1,
                            "y1": y1,
                        }
                    ],
                    "text": "",
                    "reason": f"Layout zone: {label}",
                }
            )

    # --------------------------------------------------------
    # 3) Barcode / QR suggestions (hook point)
    # --------------------------------------------------------
    # If you later wire barcode/QR detection into ocr_result or pdf_pages,
    # you can append suggestions here in the same format.

    return suggestions
