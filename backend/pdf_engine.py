# backend/pdf_engine.py

import os
import shutil
from typing import Dict, Any


def build_redacted_filename(input_path: str) -> str:
    """
    Given an input PDF path, return the output path with '_Redacted' before the .pdf extension.

    Example:
        'WIM-0028 Cannabinoid PPB Anlytical June 25, 2025.pdf'
        -> 'WIM-0028 Cannabinoid PPB Anlytical June 25, 2025_Redacted.pdf'
    """
    directory, filename = os.path.split(input_path)
    name, ext = os.path.splitext(filename)

    # Ensure extension is .pdf (case-insensitive)
    if ext.lower() != ".pdf":
        raise ValueError(f"Expected a PDF file, got: {filename}")

    redacted_name = f"{name}_Redacted{ext}"
    return os.path.join(directory, redacted_name)


def redact_pdf_with_template(
    input_path: str,
    template: Dict[str, Any],
    output_path: str | None = None,
) -> str:
    """
    Core entry point for redaction.

    - input_path: path to the original PDF.
    - template: a dictionary describing the company template (zones, rules, etc.).
    - output_path: optional explicit output path. If None, we auto-generate using _Redacted rule.

    Returns:
        The path to the redacted PDF.

    NOTE:
        For now, this function only:
        - Validates the input.
        - Computes the output path (if not provided).
        - Copies the original file to the redacted path.
        - Logs what it *would* do based on the template.

        In later steps, we will:
        - Parse the PDF.
        - Apply zone-based and regex-based redactions.
        - Render black/white/blur boxes and remove underlying text.
    """
    if not os.path.isfile(input_path):
        raise FileNotFoundError(f"Input PDF not found: {input_path}")

    if output_path is None:
        output_path = build_redacted_filename(input_path)

    # Ensure output directory exists
    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.isdir(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    # TEMP IMPLEMENTATION:
    # Just copy the file as a placeholder for real redaction.
    shutil.copy2(input_path, output_path)

    # Simple console log to show intent (later we will replace this with real logging)
    company_id = template.get("company_id", "UNKNOWN_COMPANY")
    print(f"[pdf_engine] Redaction placeholder for '{input_path}'")
    print(f"[pdf_engine] Using template: {company_id}")
    print(f"[pdf_engine] Output written to: {output_path}")
    print("[pdf_engine] NOTE: No actual redaction yet. This is a structural placeholder.")

    return output_path
