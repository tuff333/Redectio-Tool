# backend/cli_batch_redact.py
# Batch redaction using the new template-driven system

import sys
import os
import json

from backend.template_loader import TemplateLoader
from backend.company_detector import CompanyDetector
from backend.redaction.auto_redaction_engine import AutoRedactionEngine
from backend.manual_redaction_engine import ManualRedactionEngine


def main():
    if len(sys.argv) < 3:
        print("Usage: python -m backend.cli_batch_redact <input_folder> <output_folder>")
        return

    input_folder = sys.argv[1]
    output_folder = sys.argv[2]

    if not os.path.isdir(input_folder):
        print(f"ERROR: Input folder not found: {input_folder}")
        return

    os.makedirs(output_folder, exist_ok=True)

    print("\n=== COA Batch Redaction Tool (Template‑Driven) ===\n")
    print(f"Input folder:  {input_folder}")
    print(f"Output folder: {output_folder}\n")

    loader = TemplateLoader()
    detector = CompanyDetector()
    auto_engine = AutoRedactionEngine()
    manual_engine = ManualRedactionEngine()

    total = 0
    success = 0
    failed = 0

    for filename in os.listdir(input_folder):
        if not filename.lower().endswith(".pdf"):
            continue

        total += 1
        input_path = os.path.join(input_folder, filename)

        print(f"\nProcessing: {filename}")

        try:
            pdf_bytes = open(input_path, "rb").read()

            # Detect company
            company_id = detector.detect_company(pdf_bytes)
            if not company_id:
                print("  ERROR: No matching company template found. Skipping.")
                failed += 1
                continue

            template = loader.get_template(company_id)
            print(f"  Detected company: {template['display_name']}")

            # Auto-redaction suggestions
            suggestions = auto_engine.suggest_redactions(
                pdf_bytes=pdf_bytes,
                company_id=company_id,
                use_ocr=False,
                auto_ocr=True,
            )

            # Convert suggestions to manual redaction format
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
            output_path = os.path.join(
                output_folder,
                filename.replace(".pdf", "_Redacted.pdf")
            )

            manual_engine.apply_redactions(
                pdf_bytes=pdf_bytes,
                redactions=redactions,
                scrub_metadata=True,
                base_filename=output_path,
            )

            print(f"  Saved: {output_path}")
            success += 1

        except Exception as e:
            print(f"  ERROR processing file: {e}")
            failed += 1

    print("\n=== Batch Redaction Summary ===")
    print(f"Total PDFs:   {total}")
    print(f"Success:      {success}")
    print(f"Failed:       {failed}")
    print("\n")


if __name__ == "__main__":
    main()
