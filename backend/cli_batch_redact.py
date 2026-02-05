# backend/cli_batch_redact.py

import sys
import os
from backend.template_loader import TemplateLoader
from backend.pdf_text_extractor import PDFTextExtractor
from backend.redaction_engine import RedactionEngine


def main():
    if len(sys.argv) < 3:
        print("Usage: python -m backend.cli_batch_redact <input_folder> <output_folder>")
        return

    input_folder = sys.argv[1]
    output_folder = sys.argv[2]

    if not os.path.isdir(input_folder):
        print(f"ERROR: Input folder not found: {input_folder}")
        return

    if not os.path.isdir(output_folder):
        os.makedirs(output_folder, exist_ok=True)

    print("\n=== COA Batch Redaction Tool ===\n")
    print(f"Input folder:  {input_folder}")
    print(f"Output folder: {output_folder}\n")

    loader = TemplateLoader()
    extractor = PDFTextExtractor()
    engine = RedactionEngine()

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
            # Extract text for auto-detection
            pdf_text = extractor.extract_text(input_path)
            template = loader.auto_detect_template(pdf_text)

            if not template:
                print("  ERROR: No matching template found. Skipping.")
                failed += 1
                continue

            print(f"  Detected company: {template['display_name']}")

            # Build output path
            output_path = os.path.join(
                output_folder,
                filename.replace(".pdf", "_Redacted.pdf")
            )

            # Run redaction
            engine.redact_pdf(input_path, template)

            # Move output file to output folder
            redacted_path = input_path.replace(".pdf", "_Redacted.pdf")
            if os.path.isfile(redacted_path):
                os.replace(redacted_path, output_path)

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
