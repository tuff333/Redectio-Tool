# backend/api/routes/redaction.py

from fastapi import APIRouter, UploadFile, File, Query
from typing import Dict, Any, Optional

from backend.redaction.auto_redaction_engine import AutoRedactionEngine

router = APIRouter(prefix="/api/redact", tags=["redaction"])

auto_engine = AutoRedactionEngine()


@router.post("/auto-suggest")
async def auto_suggest_redactions(
    file: UploadFile = File(...),
    company_id: Optional[str] = Query(
        default=None,
        description="Optional company_id to select a specific template; if omitted, detection can be used elsewhere.",
    ),
    use_ocr: bool = Query(
        default=False,
        description="Force OCR-based text extraction.",
    ),
    auto_ocr: bool = Query(
        default=True,
        description="Automatically fall back to OCR when no text is found.",
    ),
) -> Dict[str, Any]:
    """
    Auto-redaction suggestion endpoint (template-driven, Stirling-style).

    - Reads PDF bytes
    - Runs template-based detection (regex + zones)
    - Returns candidates in the same format as manual redactions.

    Response:
    {
      "filename": "input.pdf",
      "candidates": [
        {
          "page": 1,
          "type": "auto",
          "rects": [
            { "x0": 0.1, "y0": 0.2, "x1": 0.15, "y1": 0.22 }
          ],
          "text": "example@example.com",
          "color": "#000000",
          "mode": "black",
          "rule_id": "EMAIL"
        },
        ...
      ]
    }
    """
    pdf_bytes = await file.read()

    result = auto_engine.suggest_redactions_json(
        pdf_bytes=pdf_bytes,
        company_id=company_id,
        use_ocr=use_ocr,
        auto_ocr=auto_ocr,
    )

    return {
        "filename": file.filename,
        "candidates": result.get("candidates", []),
    }
