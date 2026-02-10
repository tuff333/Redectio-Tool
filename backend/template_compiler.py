# ------------------------------------------------------------
# template_compiler.py — Unified template compiler
# FIXED: supports missing type, validates patterns, safe regex compile,
#        validates zone rects, preserves original behavior
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

    FIXED:
    - Support templates without "type"
    - Validate regex patterns
    - Catch regex compilation errors
    - Validate zone rects
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
    # Safe rect validator
    # ------------------------------------------------------------
    def _validate_rect(self, rect: Dict[str, float]) -> Dict[str, float]:
        def clamp(v):
            try:
                v = float(v)
            except Exception:
                return 0.0
            return max(0.0, min(1.0, v))

        return {
            "x0": clamp(rect.get("x0", 0)),
            "y0": clamp(rect.get("y0", 0)),
            "x1": clamp(rect.get("x1", 1)),
            "y1": clamp(rect.get("y1", 1)),
        }

    # ------------------------------------------------------------
    # Compile regex rules
    # ------------------------------------------------------------
    def _compile_regex_rules(self):
        rules = self.template.get("rules", [])

        for r in rules:
            # FIXED: allow rules without "type"
            if r.get("type") not in (None, "regex"):
                continue

            pattern = r.get("pattern")
            if not pattern or not isinstance(pattern, str):
                continue

            # FIXED: safe regex compilation
            try:
                flags = r.get("flags", "i")
                re_flags = 0
                if "i" in flags: re_flags |= re.IGNORECASE
                if "m" in flags: re_flags |= re.MULTILINE

                compiled = re.compile(pattern, re_flags)
            except Exception:
                # Skip invalid regex
                continue

            self.compiled["regex_rules"].append({
                "id": r.get("id"),
                "regex": compiled,
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
            page = z.get("page")

            if rect is None or page is None:
                continue

            # FIXED: validate rect
            rect = self._validate_rect(rect)

            self.compiled["zone_rules"].append({
                "id": z.get("id"),
                "page": page,
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
