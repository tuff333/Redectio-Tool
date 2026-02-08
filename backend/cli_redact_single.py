# backend/cli_redact_single.py
# Redact a single PDF using the new template-driven system

import argparse
import os
import json

from backend.template_loader import TemplateLoader
from backend.company_detector import CompanyDetector
from backend.redaction.auto_redaction_engine import AutoRedactionEngine
from backend.manual_redaction_engine import ManualRedactionEngine


def main():
    parser = argparse.ArgumentParser(
        description="Redact a single COA PDF using unified templates."
    )
    parser.add_argument("input_pdf", help="Path to input PDF")
    parser.add_argument("output_pdf", help="Path to output redacted PDF")
    parser.add_argument(
        "--company-id",
        help="Force a specific company template (e.g., 'high_north').",
        default=None,
    )

    args = parser.parse_args()

    if not os.path.isfile(args.input_pdf):
        raise FileNotFoundError(f"Input PDF not found: {args.input_pdf}")

    loader = TemplateLoader()
    detector = CompanyDetector()
    auto_engine = AutoRedactionEngine()
    manual_engine = ManualRedactionEngine()

    pdf_bytes = open(args.input_pdf, "rb").read()

    # Determine company
    if args.company_id:
        company_id = args.company_id
    else:
        company_id = detector.detect_company(pdf_bytes)
        if not company_id:
            raise RuntimeError("Could not auto-detect company template.")

    template = loader.get_template(company_id)
    print(f"[cli_redact_single] Using template: {template['display_name']} ({company_id})")

    # Auto-redaction suggestions
    suggestions = auto_engine.suggest_redactions(
        pdf_bytes=pdf_bytes,
        company_id=company_id,
        use_ocr=False,
        auto_ocr=True,
    )

    redactions = [
        {
            "page": c.page,
            "type": c.type,
            "rects": c.rects,
            "color": c.color,
            "mode": c.mode,
        }
        for c in suggestions
    ]

    # Apply redactions
    manual_engine.apply_redactions(
        pdf_bytes=pdf_bytes,
        redactions=redactions,
        scrub_metadata=True,
        base_filename=args.output_pdf,
    )

    print(f"[cli_redact_single] Redacted PDF written to: {args.output_pdf}")


if __name__ == "__main__":
    main()
