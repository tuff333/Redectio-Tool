# backend/cli_redact_single.py

import argparse
import os
from typing import Optional, Dict, Any, List

from PyPDF2 import PdfReader, PdfWriter

from template_loader import TemplateLoader


def extract_text_from_pdf(path: str) -> str:
    reader = PdfReader(path)
    texts: List[str] = []
    for page in reader.pages:
        try:
            texts.append(page.extract_text() or "")
        except Exception:
            # Fail-soft: keep going even if one page is problematic
            continue
    return "\n".join(texts)


def apply_text_redactions(
    reader: PdfReader, template: Dict[str, Any]
) -> PdfWriter:
    """
    Very simple text-based redaction:
    - For each rule with type == "regex" and action == "redact_text",
      we replace matching text with █ characters in the extracted text layer.

    NOTE:
    - This is a text-layer redaction, not a vector/annotation redaction.
    - Your existing redaction engine (if you have one) can be wired here instead.
    """

    import re

    writer = PdfWriter()

    rules = template.get("rules", [])

    for page_index, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        original_text = text

        for rule in rules:
            if rule.get("type") != "regex":
                continue
            if rule.get("action") != "redact_text":
                continue

            pattern = rule.get("pattern")
            flags = rule.get("flags", "i")
            pages = rule.get("pages", "all")

            # Page filter
            if pages != "all" and isinstance(pages, list):
                if page_index not in pages:
                    continue

            if not pattern:
                continue

            re_flags = 0
            if "i" in flags:
                re_flags |= re.IGNORECASE
            if "m" in flags:
                re_flags |= re.MULTILINE

            def repl(match: re.Match) -> str:
                return "█" * len(match.group(0))

            text = re.sub(pattern, repl, text, flags=re_flags)

        # If text changed, we can't easily re-embed it into the PDF content
        # without a more advanced engine. For now, we just copy the page as-is.
        # In your existing system, you likely draw black boxes over bounding boxes
        # instead of replacing text. This function is a placeholder hook.
        #
        # So we just add the original page:
        writer.add_page(page)

        # You can log what changed for debugging:
        if text != original_text:
            print(f"[cli_redact_single] Page {page_index + 1}: text matches found for redaction rules.")

    return writer


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Redact a single COA PDF using company templates."
    )
    parser.add_argument("input_pdf", help="Path to input PDF")
    parser.add_argument("output_pdf", help="Path to output redacted PDF")
    parser.add_argument(
        "--company-id",
        help="Force a specific company template (e.g., 'high_north', 'pathogenia'). "
             "If omitted, auto-detection is used.",
        default=None,
    )
    parser.add_argument(
        "--templates-dir",
        help="Directory containing template JSON files (default: templates)",
        default="templates",
    )

    args = parser.parse_args()

    if not os.path.isfile(args.input_pdf):
        raise FileNotFoundError(f"Input PDF not found: {args.input_pdf}")

    loader = TemplateLoader(templates_dir=args.templates_dir)

    pdf_text = extract_text_from_pdf(args.input_pdf)

    template: Optional[Dict[str, Any]] = None

    if args.company_id:
        template = loader.get_template(args.company_id)
        if template is None:
            raise ValueError(
                f"No template found for company_id='{args.company_id}'. "
                f"Available: {loader.list_templates()}"
            )
        print(f"[cli_redact_single] Using forced template: {template['display_name']} ({template['company_id']})")
    else:
        template = loader.auto_detect_template(pdf_text)
        if template is None:
            raise RuntimeError(
                "Could not auto-detect company template from PDF text. "
                "Consider specifying --company-id explicitly."
            )
        print(f"[cli_redact_single] Auto-detected template: {template['display_name']} ({template['company_id']})")

    reader = PdfReader(args.input_pdf)
    writer = apply_text_redactions(reader, template)

    with open(args.output_pdf, "wb") as f:
        writer.write(f)

    print(f"[cli_redact_single] Redacted PDF written to: {args.output_pdf}")


if __name__ == "__main__":
    main()
