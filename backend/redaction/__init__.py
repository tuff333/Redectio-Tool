# ------------------------------------------------------------
# backend/redaction/__init__.py
# FIXED: consolidated exports, consistent package structure
# ------------------------------------------------------------

from .auto_redaction_engine import AutoRedactionEngine
from .manual_redaction_engine import ManualRedactionEngine
from .text_finder import TextFinder, TextSpan
from .redaction_engine import RedactionEngine

__all__ = [
    "AutoRedactionEngine",
    "ManualRedactionEngine",
    "RedactionEngine",
    "TextFinder",
    "TextSpan",
]
