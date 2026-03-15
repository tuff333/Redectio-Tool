import os
import re
from typing import Optional, Dict, Any, List

from backend.rules.merge_engine import detect_company, merge_rules_for_company
from backend.rules.types import (
    MergedRuleSet,
    TextRule,
    LayoutRule,
    BarcodeZone,
)

# ------------------------------------------------------------
# Build merged rule set
# ------------------------------------------------------------
def build_final_rules_for_document(
    ocr_text: str,
    company_hint: str | None = None,
) -> MergedRuleSet:
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    company_rules_dir = os.path.join(base_dir, "config", "rules", "company_rules")

    company_rules = None

    if company_hint:
        path = os.path.join(company_rules_dir, f"{company_hint}.json")
        if os.path.isfile(path):
            import json
            with open(path, "r", encoding="utf-8") as f:
                company_rules = json.load(f)
    else:
        company_rules = detect_company(ocr_text, company_rules_dir)

    merged: MergedRuleSet = merge_rules_for_company(company_rules, base_dir)
    return merged


# ------------------------------------------------------------
# Regex compiler
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


# ------------------------------------------------------------
# Group inference
# ------------------------------------------------------------
def _infer_group_from_id(rule_id: str) -> str:
    rid = (rule_id or "").lower()

    if any(k in rid for k in ["barcode", "qr"]):
        return "barcode"
    if any(k in rid for k in ["client", "name", "address", "phone", "email"]):
        return "client_info"
    if any(k in rid for k in ["report", "account", "sample", "lot", "batch", "lab", "po", "category"]):
        return "document_id"

    return "pii"


# ------------------------------------------------------------
# Label filter
# ------------------------------------------------------------
_LABEL_TOKENS = {
    "REPORT NO",
    "REPORT NO.",
    "REPORT NUMBER",
    "ACCOUNT NUMBER",
    "ACCOUNT NO",
    "ACCOUNT NO.",
    "TO",
    "TO:",
    "PHONE",
    "PHONE:",
    "PO#",
    "PO#:",
    "LAB NUMBER",
    "LAB NUMBER:",
    "SAMPLE ID",
    "SAMPLE ID:",
    "CATEGORY",
    "CATEGORY:",
    "STRAIN",
    "STRAIN:",
    "SAMPLE MATRIX",
    "SAMPLE MATRIX:",
    "DATE SAMPLED",
    "DATE SAMPLED:",
    "DATE RECEIVED",
    "DATE RECEIVED:",
    "DATE REPORTED",
    "DATE REPORTED:",
    "DATE PRINTED",
    "DATE PRINTED:",
}

# Map label tokens to semantic info
_LABEL_FIELD_MAP = {
    "REPORT NO":      {"group": "document_id", "label": "Report Number"},
    "REPORT NO.":     {"group": "document_id", "label": "Report Number"},
    "REPORT NUMBER":  {"group": "document_id", "label": "Report Number"},

    "ACCOUNT NUMBER": {"group": "document_id", "label": "Account Number"},
    "ACCOUNT NO":     {"group": "document_id", "label": "Account Number"},
    "ACCOUNT NO.":    {"group": "document_id", "label": "Account Number"},

    "TO":             {"group": "client_info", "label": "Client Name"},
    "TO:":            {"group": "client_info", "label": "Client Name"},

    "PHONE":          {"group": "client_info", "label": "Client Phone"},
    "PHONE:":         {"group": "client_info", "label": "Client Phone"},

    "PO#":            {"group": "document_id", "label": "PO Number"},
    "PO#:":           {"group": "document_id", "label": "PO Number"},

    "LAB NUMBER":     {"group": "product_info", "label": "Lab Number"},
    "LAB NUMBER:":    {"group": "product_info", "label": "Lab Number"},

    "SAMPLE ID":      {"group": "product_info", "label": "Sample ID"},
    "SAMPLE ID:":     {"group": "product_info", "label": "Sample ID"},
}


def _label_value_suggestions(spans_by_page):
    """
    For label patterns (REPORT NO, ACCOUNT NUMBER, TO, etc.),
    handle both single-span and multi-span labels on the same line,
    then pick the nearest value span to the right.
    """
    suggestions = []

    for page_num, spans in spans_by_page.items():
        # sort spans top-to-bottom, left-to-right
        spans_sorted = sorted(
            spans,
            key=lambda s: (float(s.get("y0", 0.0)), float(s.get("x0", 0.0)))
        )

        # group spans into "lines" by vertical overlap
        lines: List[List[Dict[str, Any]]] = []
        for span in spans_sorted:
            y0 = float(span.get("y0", 0.0))
            y1 = float(span.get("y1", 0.0))

            placed = False
            for line in lines:
                ly0 = float(line[0].get("y0", 0.0))
                ly1 = float(line[0].get("y1", 0.0))
                # vertical overlap → same line
                if not (y1 < ly0 or y0 > ly1):
                    line.append(span)
                    placed = True
                    break
            if not placed:
                lines.append([span])

        # process each line
        for line in lines:
            # sort left-to-right within line
            line.sort(key=lambda s: float(s.get("x0", 0.0)))

            n = len(line)
            i = 0
            while i < n:
                # try to build a label from consecutive spans
                label_spans = [line[i]]
                j = i + 1

                while j < n:
                    candidate_text = " ".join(
                        (ls.get("text") or "").strip()
                        for ls in label_spans + [line[j]]
                        if (ls.get("text") or "").strip()
                    )
                    norm = candidate_text.upper().strip()
                    if norm.endswith(":"):
                        norm = norm[:-1].strip()

                    if norm in _LABEL_FIELD_MAP:
                        label_spans.append(line[j])
                        break

                    # if adding this span makes it worse, stop extending
                    # (we only allow short labels)
                    if len(candidate_text) > 40:
                        break

                    label_spans.append(line[j])
                    j += 1

                # check if we formed a known label
                label_text = " ".join(
                    (ls.get("text") or "").strip()
                    for ls in label_spans
                    if (ls.get("text") or "").strip()
                )
                norm_label = label_text.upper().strip()
                if norm_label.endswith(":"):
                    norm_label = norm_label[:-1].strip()

                if norm_label in _LABEL_FIELD_MAP:
                    field_info = _LABEL_FIELD_MAP[norm_label]

                    # value span = first span to the right of the last label span
                    last_label_span = label_spans[-1]
                    lx1 = float(last_label_span.get("x1", 0.0))

                    best = None
                    best_dx = None
                    for k in range(line.index(last_label_span) + 1, n):
                        cand = line[k]
                        cx0 = float(cand.get("x0", 0.0))
                        if cx0 <= lx1:
                            continue
                        dx = cx0 - lx1
                        if best is None or dx < best_dx:
                            best = cand
                            best_dx = dx

                    if best:
                        value_text = (best.get("text") or "").strip()
                        if value_text:
                            rect = {
                                "x0": float(best.get("x0", 0.0)),
                                "y0": float(best.get("y0", 0.0)),
                                "x1": float(best.get("x1", 1.0)),
                                "y1": float(best.get("y1", 1.0)),
                            }

                            suggestions.append(
                                {
                                    "type": "text",
                                    "rule_id": f"label_value_{norm_label.replace(' ', '_')}",
                                    "label": field_info["label"],
                                    "group": field_info["group"],
                                    "page": int(page_num),
                                    "rects": [rect],
                                    "text": value_text,
                                    "reason": f"Value for label: {norm_label}",
                                }
                            )

                    # move past this label sequence
                    i = line.index(label_spans[-1]) + 1
                else:
                    i += 1

    return suggestions


def _is_label_only(text: str) -> bool:
    if not text:
        return False

    norm = text.strip().upper()
    if norm.endswith(":"):
        norm = norm[:-1].strip()

    return norm in _LABEL_TOKENS


# ------------------------------------------------------------
# Measurement filter
# ------------------------------------------------------------
_MEASUREMENT_TOKENS = {"%", "MG/G", "LOQ", "LOQ:", "ORG-M-", "METHOD", "RESULT"}


def _is_measurement_span(text: str) -> bool:
    if not text:
        return False

    t = text.upper()

    for tok in _MEASUREMENT_TOKENS:
        if tok in t:
            return True

    stripped = t.strip()

    if re.fullmatch(r"[0-9]+(?:\.[0-9]+)?", stripped):
        if len(stripped) < 5:
            return True
        return False

    return False


# ------------------------------------------------------------
# Company constant filter
# ------------------------------------------------------------
def _is_company_constant(text: str, constants: Dict[str, List[str]]) -> bool:
    if not text:
        return False

    t = text.strip().lower()

    for addr in constants.get("addresses", []):
        if t in addr.lower():
            return True

    for ph in constants.get("phones", []):
        if t in ph.lower():
            return True

    for em in constants.get("emails", []):
        if t in em.lower():
            return True

    return False


def _get_company_constants(final_rules) -> Dict[str, List[str]]:
    """
    Safely extract company_constants from final_rules.
    If not present (older MergedRuleSet), return empty defaults.
    """
    cc = getattr(final_rules, "company_constants", None)
    if not cc:
        return {
            "addresses": [],
            "phones": [],
            "emails": [],
        }
    if isinstance(cc, dict):
        return {
            "addresses": cc.get("addresses", []),
            "phones": cc.get("phones", []),
            "emails": cc.get("emails", []),
        }
    return {
        "addresses": getattr(cc, "addresses", []),
        "phones": getattr(cc, "phones", []),
        "emails": getattr(cc, "emails", []),
    }


# ------------------------------------------------------------
# Main suggestion generator
# ------------------------------------------------------------
def generate_suggestions(pdf_pages, ocr_result, final_rules: MergedRuleSet):
    suggestions: List[Dict[str, Any]] = []

    pages_text: List[str] = ocr_result.get("pages_text") or []
    spans_by_page: Dict[int, List[Dict[str, Any]]] = ocr_result.get("spans_by_page") or {}

    company_constants = _get_company_constants(final_rules)

    # ------------------------------------------------------------
    # 0) LABEL → VALUE SUGGESTIONS (REPORT NO, ACCOUNT NUMBER, TO, etc.)
    # ------------------------------------------------------------
    label_value_sugs = _label_value_suggestions(spans_by_page)
    suggestions.extend(label_value_sugs)

    # ------------------------------------------------------------
    # 1) TEXT RULES
    # ------------------------------------------------------------
    for rule in final_rules.text_rules:
        pattern = rule.pattern or ""
        if not pattern:
            continue

        regex = _compile_regex(pattern, "im")
        if not regex:
            continue

        if rule.action != "suggest":
            continue

        rule_id = rule.id or "rule"
        label = rule.label or rule_id
        group = _infer_group_from_id(rule_id)

        for page_num, spans in spans_by_page.items():
            for span in spans:
                text = span.get("text", "") or ""
                if not text.strip():
                    continue

                if regex.search(text):
                    if _is_label_only(text):
                        continue
                    if _is_measurement_span(text):
                        continue
                    if _is_company_constant(text, company_constants):
                        continue

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
                            "group": group,
                            "page": int(page_num),
                            "rects": [rect],
                            "text": text,
                            "reason": f"Matched pattern: {label}",
                        }
                    )

    # ------------------------------------------------------------
    # 2) LAYOUT RULES  (still disabled for now)
    # ------------------------------------------------------------
    # total_pages = max(len(pages_text), max(spans_by_page.keys(), default=0))
    # for lr in final_rules.layout_rules:
    #     ...

    # ------------------------------------------------------------
    # 3) BARCODE / QR ZONES  (still handled by dedicated endpoint)
    # ------------------------------------------------------------
    # def _zones_to_suggestions(...):
    #     ...

    # ------------------------------------------------------------
    # 4) CLEANING
    # ------------------------------------------------------------
    cleaned = []
    seen = set()

    for s in suggestions:
        text = (s.get("text") or "").strip()

        if s.get("type") == "text":
            if not text:
                continue
            if _is_label_only(text):
                continue
            if _is_measurement_span(text):
                continue
            if _is_company_constant(text, company_constants):
                continue

        key = (s["page"], s["rects"][0]["x0"], s["rects"][0]["y0"], text)
        if key in seen:
            continue
        seen.add(key)

        cleaned.append(s)

    # ------------------------------------------------------------
    # 5) FINAL FILTER
    # ------------------------------------------------------------
    allowed_groups = {
        "pii",
        "client_info",
        "document_id",
        "product_info",
        "barcode",
        "qr",
    }

    return [s for s in cleaned if s.get("group") in allowed_groups]
