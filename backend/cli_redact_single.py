# backend/cli_redact_single.py

import sys
import json
from pathlib import Path
from pdfminer.high_level import extract_text

from template_loader import TemplateLoader
from redactor_engine import RedactorEngine


def redact_single_pdf(input_pdf: str, output_pdf: str):
    print(f"[cli] Processing: {input_pdf}")

    # Extract text
    pdf_text = extract_text(input_pdf)

    # Load templates
    loader = TemplateLoader()
    template = loader.auto_detect_template(pdf_text)

    # Initialize redactor
    redactor = RedactorEngine(template)

    # Run automatic redaction
    result = redactor.redact_pdf(input_pdf, output_pdf)

    # Save detection log
    log_path = Path(output_pdf).with_suffix(".log.json")
    with open(log_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=4)

    print(f"[cli] Redaction complete → {output_pdf}")
    print(f"[cli] Log saved → {log_path}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python cli_redact_single.py input.pdf output.pdf")
        sys.exit(1)

    redact_single_pdf(sys.argv[1], sys.argv[2])
