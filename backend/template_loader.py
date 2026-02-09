# backend/template_loader.py

import os
import json
from typing import Dict, Any, List, Optional


TEMPLATES_DIR = "templates"


class TemplateLoader:
    """
    Loads, validates, and manages all company templates.
    Provides:
        - load_templates()
        - get_template(company_id)
        - auto_detect_template(pdf_text)
        - auto_detect_company_id(pdf_text)
        - list_templates()
    """

    def __init__(self, templates_dir: str = TEMPLATES_DIR):
        self.templates_dir = templates_dir
        self.templates: Dict[str, Dict[str, Any]] = {}
        self.load_templates()

    # ---------------------------------------------------------
    # Load all templates from /templates/*.json
    # ---------------------------------------------------------
    def load_templates(self) -> None:
        if not os.path.isdir(self.templates_dir):
            raise FileNotFoundError(
                f"Templates directory not found: {self.templates_dir}"
            )

        self.templates.clear()

        for filename in os.listdir(self.templates_dir):
            if not filename.lower().endswith(".json"):
                continue

            path = os.path.join(self.templates_dir, filename)

            try:
                with open(path, "r", encoding="utf-8") as f:
                    template = json.load(f)

                self.validate_template(template)
                company_id = template["company_id"]

                self.templates[company_id] = template
                print(f"[template_loader] Loaded template: {company_id} ({filename})")

            except Exception as e:
                print(f"[template_loader] ERROR loading {filename}: {e}")

        if not self.templates:
            raise RuntimeError(
                f"No valid templates loaded from directory: {self.templates_dir}"
            )

    # ---------------------------------------------------------
    # Validate template structure
    # ---------------------------------------------------------
    def validate_template(self, template: Dict[str, Any]) -> None:
        required_fields = ["company_id", "display_name", "detection"]

        for field in required_fields:
            if field not in template:
                raise ValueError(f"Template missing required field: {field}")

        detection = template["detection"]
        if "text_contains" not in detection or not isinstance(
            detection["text_contains"], list
        ):
            raise ValueError(
                f"Template {template['company_id']} missing detection.text_contains (list)"
            )

        # Optional fields: page_patterns, rules, qr_code_regions
        template.setdefault("page_patterns", [])
        template.setdefault("rules", [])
        template.setdefault("qr_code_regions", [])

        # Optional: default priority
        detection.setdefault("priority", 0)

    # ---------------------------------------------------------
    # Get template by company_id
    # ---------------------------------------------------------
    def get_template(self, company_id: str) -> Optional[Dict[str, Any]]:
        return self.templates.get(company_id)

    # ---------------------------------------------------------
    # Auto-detect template based on PDF text
    # ---------------------------------------------------------
    def auto_detect_template(self, pdf_text: str) -> Optional[Dict[str, Any]]:
        """
        Returns the best matching template based on:
            - detection.text_contains keywords
            - detection.priority
        """

        pdf_text_lower = pdf_text.lower()
        best_match: Optional[Dict[str, Any]] = None
        best_priority = -999

        for template in self.templates.values():
            detection = template.get("detection", {})
            keywords = detection.get("text_contains", [])
            priority = detection.get("priority", 0)

            if not keywords:
                continue

            # Check if ANY keyword matches
            if any(kw.lower() in pdf_text_lower for kw in keywords):
                if priority > best_priority:
                    best_priority = priority
                    best_match = template

        return best_match

    # ---------------------------------------------------------
    # Convenience: return just the company_id
    # ---------------------------------------------------------
    def auto_detect_company_id(self, pdf_text: str) -> Optional[str]:
        tmpl = self.auto_detect_template(pdf_text)
        if tmpl is None:
            return None
        return tmpl.get("company_id")

    # ---------------------------------------------------------
    # List all templates
    # ---------------------------------------------------------
    def list_templates(self) -> List[str]:
        return list(self.templates.keys())
