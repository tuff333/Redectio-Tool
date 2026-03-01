# backend/rules/merge_utils.py
from typing import List, TypeVar, Dict
from .types import (
    TextRule,
    LayoutRule,
    BarcodeZone,
    DefaultsRegex,
    DefaultsLayout,
    CompanyRules,
    CompanyRegexEntry,
    CompanyLayoutEntry,
    DefaultsBarcodeQr,
)

T = TypeVar("T", bound=Dict)

def merge_by_id(base: List[T], override: List[T]) -> List[T]:
    """
    Simple 'last wins' merge by id.
    """
    by_id: Dict[str, T] = {}
    for r in base:
        by_id[r["id"]] = r
    for r in override:
        by_id[r["id"]] = r
    return list(by_id.values())

def concat_unique_strings(base: List[str], extra: List[str]) -> List[str]:
    seen = set(base)
    for s in extra:
        if s not in seen:
            seen.add(s)
            base.append(s)
    return base

def normalize_defaults_regex_to_text_rules(defaults: DefaultsRegex) -> List[TextRule]:
    rules: List[TextRule] = []
    for r in defaults["actual_regex"]:
        rules.append(
            TextRule(
                id=r["id"],
                label=r["label"],
                type="regex",
                pattern=r["pattern"],
                action=r["action"],
                confidence=r["confidence"],
                page_scope="all",
            )
        )
    return rules

def normalize_company_regex_to_text_rules(company_regex: List[CompanyRegexEntry]) -> List[TextRule]:
    rules: List[TextRule] = []
    for r in company_regex:
        rules.append(
            TextRule(
                id=r["id"],
                label=r.get("id", r["id"]),
                type="regex",
                pattern=r["pattern"],
                action=r["action"],
                confidence=0.95,  # default if not specified
                page_scope="all",
            )
        )
    return rules

def normalize_defaults_layout_to_layout_rules(defaults: DefaultsLayout) -> List[LayoutRule]:
    rules: List[LayoutRule] = []
    for r in defaults["layout_defaults"]:
        rules.append(
            LayoutRule(
                id=r["id"],
                label=r["id"],
                type="zone",
                rect=r["rect"],
                page_scope=r.get("page_scope", "all"),
                action=r["action"],
                relative=True,
            )
        )
    return rules

def normalize_company_layout_to_layout_rules(company_layout: List[CompanyLayoutEntry]) -> List[LayoutRule]:
    rules: List[LayoutRule] = []
    for r in company_layout:
        rules.append(
            LayoutRule(
                id=r["id"],
                label=r["id"],
                type="zone",
                rect=r["rect"],
                page_scope=r.get("page_scope", "all"),
                action=r["action"],
                relative=r.get("relative", True),
            )
        )
    return rules

def normalize_defaults_barcode_qr(defaults: DefaultsBarcodeQr) -> (List[BarcodeZone], List[BarcodeZone]):
    barcode_zones: List[BarcodeZone] = []
    qr_zones: List[BarcodeZone] = []

    for z in defaults["barcode_qr_defaults"]["barcode_zones"]:
        barcode_zones.append(
            BarcodeZone(
                rect=z["rect"],
                page_scope=z["page_scope"],
                action=z["action"],
            )
        )

    for z in defaults["barcode_qr_defaults"]["qr_zones"]:
        qr_zones.append(
            BarcodeZone(
                rect=z["rect"],
                page_scope=z["page_scope"],
                action=z["action"],
            )
        )

    return barcode_zones, qr_zones
