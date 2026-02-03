# backend/api/routes/redaction.py
from fastapi import APIRouter, UploadFile, File
from typing import List, Dict, Any
from backend.redaction.auto_detector import AutoRedactionDetector
from backend.redaction.pdf_extractor import extract_text_blocks  # your existing util

router = APIRouter()
detector = AutoRedactionDetector("config/redaction_patterns_high_north.json")


@router.post("/auto-redact")
async def auto_redact_pdf(file: UploadFile = File(...)) -> Dict[str, Any]:
    # 1. Read PDF bytes
    pdf_bytes = await file.read()

    # 2. Extract text blocks with coordinates (you already have something like this)
    pages: List[Dict[str, Any]] = extract_text_blocks(pdf_bytes)

    # 3. Detect redaction candidates
    candidates = detector.detect(pages)

    # 4. Return to frontend
    return {
        "filename": file.filename,
        "candidates": candidates
    }
