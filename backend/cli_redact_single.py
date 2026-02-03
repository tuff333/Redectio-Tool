# backend/cli_redact_single.py

import argparse
import os
from typing import Optional

import fitz  # PyMuPDF

from backend.template_loader import TemplateLoader

# TODO: change this import to your real redaction engine
# from backend.redact_engine import redact_pdf_with_template


def extract_pdf_text(path: str) -> str:
    """Extracts all text from a PDF for template detection."""
    doc = fitz.open(path)
    parts = []
    for page in doc:
        parts.append(page.get_text("text"))
    doc.close()
    return "\n".join(parts)


def detect_template(loader: TemplateLoader, pdf_path: str) -> Optional[dict]:
    text = extract_pdf_text(pdf_path)
    return loader.auto_detect_template(text)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Redact a single PDF using company templates (auto-detect or manual)."
    )
    parser.add_argument("input_pdf", help="Path to input PDF")
    parser.add_argument(
        "-o",
        "--output",
        dest="output_pdf",
        help="Path to output redacted PDF (default: <input>_redacted.pdf)",
    )
    parser.add_argument(
        "-c",
        "--company",
        dest="company_id",
        help="Force a specific company_id template (skip auto-detect)",
    )
    parser.add_argument(
        "--list-templates",
        action="store_true",
        help="List available templates and exit",
    )

    args = parser.parse_args()

    loader = TemplateLoader()

    if args.list_templates:
        print("Available templates:")
        for meta in loader.list_templates_metadata():
            print(
                f"  - {meta['company_id']}: {meta['display_name']} "
                f"(priority={meta['priority']}, keywords={meta['keywords']})"
            )
        return

    input_pdf = args.input_pdf
    if not os.path.isfile(input_pdf):
        raise FileNotFoundError(f"Input PDF not found: {input_pdf}")

    output_pdf = args.output_pdf
    if not output_pdf:
        root, ext = os.path.splitext(input_pdf)
        output_pdf = f"{root}_redacted{ext}"

    # 1) Choose template: manual override or auto-detect
    template = None

    if args.company_id:
        template = loader.get_template(args.company_id)
        if template is None:
            raise ValueError(
                f"Requested company_id '{args.company_id}' not found in templates."
            )
        print(f"[cli_redact_single] Using template (forced): {args.company_id}")
    else:
        template = detect_template(loader, input_pdf)
        if template is None:
            raise RuntimeError(
                "Could not auto-detect company template from PDF text. "
                "Try specifying --company explicitly."
            )
        print(
            f"[cli_redact_single] Auto-detected template: "
            f"{template['company_id']} ({template['display_name']})"
        )

    # 2) Call your existing redaction engine with this template
    # ------------------------------------------------------------------
    # IMPORTANT:
    #   Wire this to your actual implementation that:
    #     - reads the template["rules"]
    #     - applies regex / positional redactions
    #     - writes the redacted PDF to output_pdf
    # ------------------------------------------------------------------
    # Example placeholder:
    # redact_pdf_with_template(input_pdf, output_pdf, template)
    #
    # For now, just show what would be used:
    print(f"[cli_redact_single] Would redact '{input_pdf}' -> '{output_pdf}'")
    print(f"[cli_redact_single] Template rules count: {len(template.get('rules', []))}")

    # Remove the print above and uncomment your real call when ready.
    # redact_pdf_with_template(input_pdf, output_pdf, template)


if __name__ == "__main__":
    main()
