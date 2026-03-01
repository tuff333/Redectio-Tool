# backend/api/redact.py

import json
from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import StreamingResponse, JSONResponse

from backend.redaction.manual_redaction_engine import apply_manual_redactions
# ^^^ if the function name is different, adjust this import + call below

router = APIRouter(prefix="/api/redact", tags=["Redaction"])


@router.post("/manual")
async def manual_redact(
    file: UploadFile = File(...),
    redactions: str = Form(...),
    scrub_metadata: bool = Form(False),
):
    try:
        pdf_bytes = await file.read()
        redactions_list = json.loads(redactions)

        output_bytes = apply_manual_redactions(
            pdf_bytes,
            redactions_list,
            scrub_metadata=scrub_metadata,
        )

        return StreamingResponse(
            output_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=redacted.pdf"},
        )
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
