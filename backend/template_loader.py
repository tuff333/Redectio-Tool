# backend/template_loader.py

import os
import json
from typing import Dict, Any, List, Optional


class TemplateLoader:
    """
    Loads unified templates from backend/templates_unified.

    Provides:
        - load_templates()
        - get_template(company_id)
        - get_all_templates()
        - list_templates()
    """

    def __init__(self, templates_dir: str = None):
        base_dir = os.path.dirname(__file__)
        self.templates_dir = templates_dir or os.path.join(base_dir, "templates_unified")
        self.templates: Dict[str, Dict[str, Any]] = {}
        self.load_templates()

    # ---------------------------------------------------------
    # Load all templates from templates_unified/*.json
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

                # Unified template schema requires:
                # - company_id
                # - display_name
                if "company_id" not in template:
                    raise ValueError("Template missing 'company_id'")
                if "display_name" not in template:
                    raise ValueError("Template missing 'display_name'")

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
    # Get template by company_id
    # ---------------------------------------------------------
    def get_template(self, company_id: str) -> Optional[Dict[str, Any]]:
        return self.templates.get(company_id)

    # ---------------------------------------------------------
    # Return all templates (raw dicts)
    # ---------------------------------------------------------
    def get_all_templates(self) -> List[Dict[str, Any]]:
        return list(self.templates.values())

    # ---------------------------------------------------------
    # List all template IDs
    # ---------------------------------------------------------
    def list_templates(self) -> List[str]:
        return list(self.templates.keys())
