# ------------------------------------------------------------
# template_compiler.py — Unified template compiler
# ------------------------------------------------------------

import re
from typing import Dict, Any, List


class TemplateCompiler:
    """
    Compiles unified templates into:
    - regex rules
    - zone rules
    - label-anchored rules
    - manual presets
    """

    def __init__(self, template: Dict[str, Any]):
        self.template = template
        self.compiled = {
            "company_id": template.get("company_id"),
            "display_name": template.get("display_name"),
            "manual_presets": template.get("manual_presets", {}),
            "regex_rules": [],
            "zone_rules": []
        }

    # ------------------------------------------------------------
    # Compile regex rules
    # ------------------------------------------------------------
    def _compile_regex_rules(self):
        rules = self.template.get("rules", [])
        for r in rules:
            if r.get("type") != "regex":
                continue

            pattern = r.get("pattern")
            if not pattern:
                continue

            flags = r.get("flags", "i")
            re_flags = 0
            if "i" in flags: re_flags |= re.IGNORECASE
            if "m" in flags: re_flags |= re.MULTILINE

            self.compiled["regex_rules"].append({
                "id": r.get("id"),
                "regex": re.compile(pattern, re_flags),
                "color": r.get("color", "#000000"),
                "mode": r.get("mode", "black")
            })

    # ------------------------------------------------------------
    # Compile zone rules
    # ------------------------------------------------------------
    def _compile_zone_rules(self):
        zones = self.template.get("zones", [])
        for z in zones:
            rect = z.get("rect")
            if not rect:
                continue

            self.compiled["zone_rules"].append({
                "id": z.get("id"),
                "page": z.get("page"),
                "rect": rect,
                "color": z.get("color", "#000000"),
                "mode": z.get("mode", "black"),
                "action": z.get("action", "redact")
            })

    # ------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------
    def compile(self):
        self._compile_regex_rules()
        self._compile_zone_rules()
        return self.compiled
