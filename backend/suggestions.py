from .rules_engine import (
    load_universal_rules,
    load_defaults,
    load_company_rules,
    merge_rules,
    detect_company_from_text,
)

def build_final_rules_for_document(ocr_text: str, company_hint: str | None = None) -> dict:
    universal = load_universal_rules()
    defaults = load_defaults()

    if company_hint:
        company_id = company_hint
    else:
        company_id = detect_company_from_text(ocr_text)

    company_rules = load_company_rules(company_id) if company_id else None
    final_rules = merge_rules(universal, defaults, company_rules)
    final_rules["company_id"] = company_id
    return final_rules


def generate_suggestions(pdf_pages, ocr_result, final_rules: dict):
    """
    pdf_pages: list of page objects (from your existing pipeline)
    ocr_result: structure with text + positions per page
    final_rules: merged rules dict

    Returns: list of suggestion dicts:
      { id, type, page, box, label, reason }
    """
    suggestions = []

    # 1) text-based suggestions
    for rule in final_rules.get("text_rules", []):
        pattern = rule["pattern"]
        label = rule.get("label", rule["id"])
        action = rule.get("action", "suggest")

        if action != "suggest":
            continue

        # you already have some text search logic; conceptually:
        # for each page, run regex on text, map to bounding boxes
        for page_index, page_text in enumerate(ocr_result["pages"]):
            # pseudo-code: matches = find_regex_matches_with_boxes(pattern, page_text)
            matches = []  # replace with your real function
            for m in matches:
                suggestions.append({
                    "type": "text",
                    "rule_id": rule["id"],
                    "label": label,
                    "page": page_index,
                    "box": m["box"],  # {x0,y0,x1,y1}
                    "reason": f"Matched pattern: {label}"
                })

    # 2) layout-based suggestions
    for lr in final_rules.get("layout_rules", []):
        if lr.get("action") != "suggest":
            continue
        rect = lr["rect"]
        page_scope = lr.get("page_scope", "all")
        label = lr.get("label", lr["id"])

        pages = range(len(pdf_pages)) if page_scope == "all" else [0]
        for p in pages:
            suggestions.append({
                "type": "layout_zone",
                "rule_id": lr["id"],
                "label": label,
                "page": p,
                "box": rect,
                "reason": f"Layout zone: {label}"
            })

    # 3) barcode / QR suggestions
    # You already have barcode/QR detection; conceptually:
    # detected_barcodes = detect_barcodes(pdf_pages)
    # detected_qr = detect_qr_codes(pdf_pages)
    # For each, add suggestions.

    return suggestions
