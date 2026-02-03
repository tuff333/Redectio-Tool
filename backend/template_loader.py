# backend/template_loader.py

import os
import json
import re
from typing import Dict, Any, List, Optional


TEMPLATES_DIR = "templates"


class TemplateLoader:
    """
    Loads, validates, and manages all company templates.
    Supports:
        - load_templates()
        - get_template(company_id)
        - auto_detect_template(pdf_text)
        - fallback template for unknown companies
    """

    def __init__(self, templates_dir: str = TEMPLATES_DIR):
        self.templates_dir = templates_dir
        self.templates: Dict[str, Dict[str, Any]] = {}
        self.fallback_template = None
        self.load_templates()

    # ---------------------------------------------------------
    # Load all templates from /templates/*.json
    # ---------------------------------------------------------
    def load_templates(self) -> None:
        if not os.path.isdir(self.templates_dir):
            raise FileNotFoundError(
                f"Templates directory not found: {self.templates_dir}"
            )

        for filename in os.listdir(self.templates_dir):
            if not filename.lower().endswith(".json"):
                continue

            path = os.path.join(self.templates_dir, filename)

            try:
                with open(path, "r", encoding="utf-8") as f:
                    template = json.load(f)

                self.validate_template(template)
                company_id = template["company_id"]

                if company_id == "fallback":
                    self.fallback_template = template
                    print("[template_loader] Loaded fallback template")
                else:
                    self.templates[company_id] = template
                    print(f"[template_loader] Loaded template: {company_id}")

            except Exception as e:
                print(f"[template_loader] ERROR loading {filename}: {e}")

    # ---------------------------------------------------------
    # Validate template structure
    # ---------------------------------------------------------
    def validate_template(self, template: Dict[str, Any]) -> None:
        required_fields = ["company_id", "display_name", "detection"]

        for field in required_fields:
            if field not in template:
                raise ValueError(f"Template missing required field: {field}")

        detection = template["detection"]

        if "text_contains" not in detection and "regex" not in detection:
            raise ValueError(
                f"Template {template['company_id']} must have detection.text_contains or detection.regex"
            )

        template.setdefault("page_patterns", [])
        template.setdefault("rules", [])
        template.setdefault("qr_code_regions", [])

    # ---------------------------------------------------------
    # Get template by company_id
    # ---------------------------------------------------------
    def get_template(self, company_id: str) -> Optional[Dict[str, Any]]:
        return self.templates.get(company_id)

    # ---------------------------------------------------------
    # Auto-detect template based on PDF text
    # ---------------------------------------------------------
    def auto_detect_template(self, pdf_text: str) -> Dict[str, Any]:
        pdf_text_lower = pdf_text.lower()
        best_match = None
        best_score = 0

        for template in self.templates.values():
            detection = template.get("detection", {})
            score = 0

            # Keyword detection
            for kw in detection.get("text_contains", []):
                if kw.lower() in pdf_text_lower:
                    score += 10

            # Regex detection
            for pattern in detection.get("regex", []):
                if re.search(pattern, pdf_text, re.IGNORECASE):
                    score += 20

            # Priority boost
            score += detection.get("priority", 0)

            if score > best_score:
                best_score = score
                best_match = template

        if best_match:
            print(f"[template_loader] Auto-detected company: {best_match['company_id']} (score={best_score})")
            return best_match

        # Fallback template for unknown companies
        print("[template_loader] No template matched. Using fallback template.")
        return self.fallback_template

    # ---------------------------------------------------------
    # List all templates
    # ---------------------------------------------------------
    def list_templates(self) -> List[str]:
        return list(self.templates.keys())
