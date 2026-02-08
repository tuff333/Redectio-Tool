# backend/redaction/__init__.py
# Modern, template-driven redaction package

from .auto_redaction_engine import AutoRedactionEngine
from .text_finder import TextFinder, TextSpan

__all__ = [
    "AutoRedactionEngine",
    "TextFinder",
    "TextSpan"
]
