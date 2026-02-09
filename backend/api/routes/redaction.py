# backend/api/routes/redaction.py

from fastapi import APIRouter, UploadFile, File, Query
from typing import Dict, Any, Optional

from backend.redaction.auto_redaction_engine import AutoRedactionEngine

router = APIRouter(prefix="/api/redact", tags=["redaction"])

auto_engine = AutoRedactionEngine()


@router.post("/auto-suggest")
async def auto_suggest_redactions(
    file: UploadFile = File(...),
    custom_profile: Optional[str] = Query(
        default=None,
        description="Optional path to a custom redaction pattern JSON file",
    ),
) -> Dict[str, Any]:
    """
    Auto-redaction suggestion endpoint (Stirling-style).

    - Reads PDF bytes
    - Runs pattern-based detection using default + optional custom patterns
    - Returns candidates in the same format as manual redactions.

    Response:
    {
      "filename": "input.pdf",
      "candidates": [
        {
          "page": 1,
          "type": "text",
          "rects": [
            { "x0": 0.1, "y0": 0.2, "x1": 0.15, "y1": 0.22 }
          ],
          "text": "example@example.com",
          "color": "#000000",
          "pattern_id": "email"
        },
        ...
      ]
    }
    """
    pdf_bytes = await file.read()
    candidates = auto_engine.suggest_redactions(
        pdf_bytes,
        custom_patterns_path=custom_profile,
    )

    return {
        "filename": file.filename,
        "candidates": candidates,
    }
