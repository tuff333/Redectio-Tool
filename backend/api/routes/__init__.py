# backend/api/routes/__init__.py

from .redaction import router as redaction_router
from .redaction_barcodes import router as barcode_router

__all__ = ["redaction_router", "barcode_router"]
