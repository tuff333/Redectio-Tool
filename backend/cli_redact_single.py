# backend/cli_redact_single.py

import sys
import os

from backend.template_loader import TemplateLoader
from backend.pdf_text_extractor import PDFTextExtractor
from backend.redaction_engine import RedactionEngine


def main():
    if len(sys.argv) < 2:
        print("Usage: python backend/cli_redact_single.py <pdf_path>")
        return

    pdf_path = sys.argv[1]

    if not os.path.isfile(pdf_path):
        print(f"ERROR: File not found: {pdf_path}")
        return

    print("\n=== COA Redaction Tool (Single File) ===\n")

    # Load templates
    loader = TemplateLoader()

    # Extract text for auto-detection
    extractor = PDFTextExtractor()
    pdf_text = extractor.extract_text(pdf_path)

    # Auto-detect template
    template = loader.auto_detect_template(pdf_text)

    if not template:
        print("ERROR: No matching company template found for this PDF.")
        print("Make sure your templates contain correct detection keywords.")
        return

    print(f"Detected company: {template['display_name']} ({template['company_id']})")

    # Run redaction
    engine = RedactionEngine()
    output_path = engine.redact_pdf(pdf_path, template)

    print("\n=== Redaction Complete ===")
    print(f"Input:  {pdf_path}")
    print(f"Output: {output_path}")
    print("\n")


if __name__ == "__main__":
    main()
