# ------------------------------------------------------------
# rules_engine.py — Minimal rule loader + merger
# ------------------------------------------------------------

import os
import json

BASE_DIR = os.path.dirname(__file__)
RULES_DIR = os.path.join(BASE_DIR, "..", "config", "rules")
UNIVERSAL_RULES_PATH = os.path.join(RULES_DIR, "universal_rules.json")
COMPANY_RULES_DIR = os.path.join(RULES_DIR, "company_rules")
DEFAULTS_DIR = os.path.join(COMPANY_RULES_DIR, "defaults")


# ------------------------------------------------------------
# Load universal rules
# ------------------------------------------------------------
def load_universal_rules():
    try:
        with open(UNIVERSAL_RULES_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print("[rules_engine] ERROR loading universal rules:", e)
        return {}


# ------------------------------------------------------------
# Load defaults (regex/layout/barcode)
# ------------------------------------------------------------
def load_defaults():
    defaults = {}

    # Load all JSON files in defaults/
    if os.path.isdir(DEFAULTS_DIR):
        for fn in os.listdir(DEFAULTS_DIR):
            if fn.endswith(".json"):
                path = os.path.join(DEFAULTS_DIR, fn)
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        defaults.update(data)
                except Exception as e:
                    print("[rules_engine] ERROR loading default:", fn, e)

    return defaults


# ------------------------------------------------------------
# Load company-specific rules
# ------------------------------------------------------------
def load_company_rules(company_id):
    if not company_id:
        return None

    path = os.path.join(COMPANY_RULES_DIR, f"{company_id}.json")
    if not os.path.isfile(path):
        return None

    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print("[rules_engine] ERROR loading company rules:", e)
        return None


# ------------------------------------------------------------
# Merge rules: universal + defaults + company
# ------------------------------------------------------------
def merge_rules(universal, defaults, company):
    final = {}

    # Start with universal
    final.update(universal)

    # Merge defaults
    for k, v in defaults.items():
        if k not in final:
            final[k] = v

    # Merge company-specific
    if company:
        for k, v in company.items():
            final[k] = v

    return final


# ------------------------------------------------------------
# Simple text-based company detection fallback
# ------------------------------------------------------------
def detect_company_from_text(text):
    if not text:
        return None

    # Very simple fallback: match folder names
    for fn in os.listdir(COMPANY_RULES_DIR):
        if fn.endswith(".json"):
            cid = fn.replace(".json", "")
            if cid.lower().replace("_", " ") in text.lower():
                return cid

    return None
