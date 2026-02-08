# backend/api/stirling_compatible.py
# API endpoints compatible with Stirling-PDF's API

import json

from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import FileResponse

from backend.manual_redaction_engine import ManualRedactionEngine

router = APIRouter(prefix="/stirling", tags=["Stirling-PDF Compatible"])

manual_engine = ManualRedactionEngine()


@router.post("/api/v1/redact")
async def stirling_redact(
    file: UploadFile = File(...),
    redactions: str = Form(...),  # JSON string matching Stirling format
):
    """
    Compatible with Stirling-PDF's redaction API format.

    Expects Stirling-style redaction objects:
    [
      {
        "page": 1,
        "redactionType": "box",
        "x": 100,
        "y": 200,
        "width": 150,
        "height": 40,
        "pageWidth": 800,
        "pageHeight": 1000,
        "color": "#000000"
      },
      ...
    ]
    """
    pdf_bytes = await file.read()
    stirling_redactions = json.loads(redactions)

    converted = []
    for r in stirling_redactions:
        page_width = r.get("pageWidth") or 1
        page_height = r.get("pageHeight") or 1

        converted.append(
            {
                "page": r.get("page", 1),
                "type": r.get("redactionType", "box"),
                "rects": [
                    {
                        "x0": r["x"] / page_width,
                        "y0": r["y"] / page_height,
                        "x1": (r["x"] + r["width"]) / page_width,
                        "y1": (r["y"] + r["height"]) / page_height,
                    }
                ],
                "color": r.get("color", "#000000"),
                "mode": "black",
            }
        )

    out_path = manual_engine.apply_redactions(
        pdf_bytes=pdf_bytes,
        redactions=converted,
        scrub_metadata=True,
        base_filename=file.filename,
    )

    return FileResponse(
        out_path,
        media_type="application/pdf",
        filename=file.filename or "redacted.pdf",
    )
