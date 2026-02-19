import json
import os
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
RULES_DIR = BASE / "config" / "rules"
UNIVERSAL = RULES_DIR / "universal_rules.json"
DEFAULTS_DIR = RULES_DIR / "company_rules" / "defaults"
COMPANY_DIR = RULES_DIR / "company_rules"


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_universal():
    return load_json(UNIVERSAL)


def load_defaults():
    defaults = {
        "regex": [],
        "layout": [],
        "barcode_qr": {},
        "anchors": []
    }

    if (DEFAULTS_DIR / "regex.json").exists():
        defaults["regex"] = load_json(DEFAULTS_DIR / "regex.json")["actual_regex"]

    if (DEFAULTS_DIR / "layout.json").exists():
        defaults["layout"] = load_json(DEFAULTS_DIR / "layout.json")["layout_defaults"]

    if (DEFAULTS_DIR / "barcode_qr.json").exists():
        defaults["barcode_qr"] = load_json(DEFAULTS_DIR / "barcode_qr.json")["barcode_qr_defaults"]

    if (DEFAULTS_DIR / "anchors.json").exists():
        defaults["anchors"] = load_json(DEFAULTS_DIR / "anchors.json")["actual_anchors"]

    return defaults


def load_company(company_id):
    path = COMPANY_DIR / f"{company_id}.json"
    if not path.exists():
        return None
    return load_json(path)


def merge_rules(company_id):
    universal = load_universal()
    defaults = load_defaults()
    company = load_company(company_id)

    if not company:
        return None

    merged = {
        "company_id": company_id,
        "display_name": company.get("display_name", company_id),
        "type": "generic",
        "manual_presets": {},
        "rules": [],
        "zones": []
    }

    # universal → rules
    for r in universal.get("text_rules", []):
        merged["rules"].append({
            "id": r["id"],
            "type": "regex",
            "pattern": r["pattern"],
            "flags": "i",
            "color": "#000000",
            "mode": "black"
        })

    # defaults → regex
    for r in defaults["regex"]:
        merged["rules"].append({
            "id": r["id"],
            "type": "regex",
            "pattern": r["pattern"],
            "flags": "i",
            "color": "#000000",
            "mode": "black"
        })

    # company → regex
    for r in company.get("regex", []):
        merged["rules"].append({
            "id": r["id"],
            "type": "regex",
            "pattern": r["pattern"],
            "flags": "i",
            "color": "#000000",
            "mode": "black"
        })

    # defaults → layout
    for z in defaults["layout"]:
        merged["zones"].append({
            "id": z["id"],
            "page": 1,
            "rect": z["rect"],
            "color": "#000000",
            "mode": "black",
            "action": "suggest"
        })

    # company → layout
    for z in company.get("layout", []):
        merged["zones"].append({
            "id": z["id"],
            "page": 1,
            "rect": z["rect"],
            "color": "#000000",
            "mode": "black",
            "action": "suggest"
        })

    # barcode/qr defaults
    for b in defaults["barcode_qr"].get("barcode_zones", []):
        merged["zones"].append({
            "id": "barcode_default",
            "page": 1,
            "rect": b["rect"],
            "color": "#000000",
            "mode": "black",
            "action": "suggest"
        })

    # company barcode/qr
    for b in company.get("barcode_qr", []):
        merged["zones"].append({
            "id": b["id"],
            "page": 1,
            "rect": b["rect"],
            "color": "#000000",
            "mode": "black",
            "action": "suggest"
        })

    return merged
