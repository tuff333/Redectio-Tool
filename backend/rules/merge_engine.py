# backend/rules/merge_engine.py
import json
import os
from typing import Optional, List
from .types import (
    UniversalRules,
    DefaultsAnchors,
    DefaultsRegex,
    DefaultsLayout,
    DefaultsBarcodeQr,
    CompanyRules,
    MergedRuleSet,
    BarcodeZone,
)
from .merge_utils import (
    merge_by_id,
    concat_unique_strings,
    normalize_defaults_regex_to_text_rules,
    normalize_company_regex_to_text_rules,
    normalize_defaults_layout_to_layout_rules,
    normalize_company_layout_to_layout_rules,
    normalize_defaults_barcode_qr,
)

def load_json(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def detect_company(doc_text: str, company_rules_dir: str) -> Optional[CompanyRules]:
    """
    Scan all company JSONs and pick the highest-priority match
    whose detection.match_strings appear in doc_text.
    """
    best: Optional[CompanyRules] = None
    best_score = -1

    for fname in os.listdir(company_rules_dir):
        if not fname.endswith(".json"):
            continue
        if fname.lower().startswith("defaults"):
            continue

        full = os.path.join(company_rules_dir, fname)
        rules: CompanyRules = load_json(full)

        detection = rules.get("detection")
        if not detection:
            continue

        match_strings: List[str] = detection.get("match_strings", [])
        priority: int = detection.get("priority", 0)

        if any(s.lower() in doc_text.lower() for s in match_strings):
            if priority > best_score:
                best = rules
                best_score = priority

    return best

def merge_rules_for_company(company: Optional[CompanyRules], base_dir: str) -> MergedRuleSet:
    # Paths
    universal_path = os.path.join(base_dir, "config", "rules", "universal_rules.json")
    defaults_dir = os.path.join(base_dir, "config", "rules", "company_rules", "defaults")

    anchors_path = os.path.join(defaults_dir, "anchors.json")
    regex_path = os.path.join(defaults_dir, "regex.json")
    layout_path = os.path.join(defaults_dir, "layout.json")
    barcode_qr_path = os.path.join(defaults_dir, "barcode_qr.json")

    # Load JSONs
    universal: UniversalRules = load_json(universal_path)
    defaults_anchors: DefaultsAnchors = load_json(anchors_path)
    defaults_regex: DefaultsRegex = load_json(regex_path)
    defaults_layout: DefaultsLayout = load_json(layout_path)
    defaults_barcode_qr: DefaultsBarcodeQr = load_json(barcode_qr_path)

    # 1) TEXT RULES
    universal_text = [
        # convert raw dicts to TextRule dataclasses
        # we rely on the same fields as in TextRuleDict
        # and set missing ones if needed
        # but easiest is to re-wrap them:
        # (we'll keep them as dicts then normalize)
    ]

    # Normalize universal text rules into TextRule dataclasses
    from .types import TextRule
    for r in universal["text_rules"]:
        universal_text.append(
            TextRule(
                id=r["id"],
                label=r["label"],
                type="regex",
                pattern=r["pattern"],
                action=r["action"],
                confidence=r["confidence"],
                page_scope=r.get("page_scope", "all"),
            )
        )

    defaults_text = normalize_defaults_regex_to_text_rules(defaults_regex)
    company_text = (
        normalize_company_regex_to_text_rules(company.get("regex", []))
        if company and "regex" in company
        else []
    )

    # mergeById but now on dicts; easiest is to convert dataclasses to dicts, merge, then back
    def text_to_dict(ts: List[TextRule]):
        return [t.__dict__ for t in ts]

    def dict_to_text(ds):
        return [
            TextRule(
                id=d["id"],
                label=d["label"],
                type="regex",
                pattern=d["pattern"],
                action=d["action"],
                confidence=d["confidence"],
                page_scope=d.get("page_scope", "all"),
            )
            for d in ds
        ]

    merged_text_dicts = merge_by_id(
        merge_by_id(text_to_dict(universal_text), text_to_dict(defaults_text)),
        text_to_dict(company_text),
    )
    text_merged = dict_to_text(merged_text_dicts)

    # 2) ANCHORS
    anchors = list(defaults_anchors["actual_anchors"])
    if company and "anchors" in company:
        anchors = concat_unique_strings(anchors, company["anchors"])

    # 3) LAYOUT
    universal_layout_raw = universal.get("layout_rules", [])
    from .types import LayoutRule
    universal_layout: List[LayoutRule] = []
    for r in universal_layout_raw:
        universal_layout.append(
            LayoutRule(
                id=r["id"],
                label=r["label"],
                type="zone",
                rect=r["rect"],
                page_scope=r.get("page_scope", "all"),
                action=r["action"],
                relative=r.get("relative", True),
            )
        )

    defaults_layout_rules = normalize_defaults_layout_to_layout_rules(defaults_layout)
    company_layout_rules = (
        normalize_company_layout_to_layout_rules(company.get("layout", []))
        if company and "layout" in company
        else []
    )

    def layout_to_dict(ls: List[LayoutRule]):
        return [l.__dict__ for l in ls]

    def dict_to_layout(ds):
        return [
            LayoutRule(
                id=d["id"],
                label=d["label"],
                type="zone",
                rect=d["rect"],
                page_scope=d.get("page_scope", "all"),
                action=d["action"],
                relative=d.get("relative", True),
            )
            for d in ds
        ]

    merged_layout_dicts = merge_by_id(
        merge_by_id(layout_to_dict(universal_layout), layout_to_dict(defaults_layout_rules)),
        layout_to_dict(company_layout_rules),
    )
    layout_merged = dict_to_layout(merged_layout_dicts)

    # 4) BARCODE / QR CONFIG + ZONES
    barcode_config = universal["barcode_rules"]
    qr_config = universal["qr_rules"]

    default_barcode_zones, default_qr_zones = normalize_defaults_barcode_qr(defaults_barcode_qr)

    company_barcode_zones: List[BarcodeZone] = []
    if company and "barcode_qr" in company:
        for z in company["barcode_qr"]:
            company_barcode_zones.append(
                BarcodeZone(
                    rect=z["rect"],
                    page_scope=z.get("page_scope", "all"),
                    action=z["action"],
                )
            )

    barcode_zones = default_barcode_zones + company_barcode_zones
    qr_zones = default_qr_zones  # extend later if company adds QR-specific zones

    return MergedRuleSet(
        company_id=company.get("company_id") if company else None,
        display_name=company.get("display_name") if company else None,
        text_rules=text_merged,
        anchors=anchors,
        layout_rules=layout_merged,
        barcode_config=barcode_config,
        qr_config=qr_config,
        barcode_zones=barcode_zones,
        qr_zones=qr_zones,
    )
