# backend/pdf_engine.py
# Temporary stub to satisfy imports

import os

def build_redacted_filename(original_filename: str) -> str:
    """
    Generate a safe redacted filename.
    """
    base, ext = os.path.splitext(original_filename)
    return f"{base}_Redacted{ext}"
