# ------------------------------------------------------------
# backend/api/company_detection.py
# ------------------------------------------------------------

from fastapi import APIRouter, UploadFile, File
from fastapi.responses import JSONResponse

from backend.company_detector import CompanyDetector

router = APIRouter(prefix="/api", tags=["Company Detection"])

detector = CompanyDetector()


@router.post("/detect-company")
async def detect_company(file: UploadFile = File(...)):
    pdf_bytes = await file.read()
    result = detector.detect_company_json(pdf_bytes)
    return JSONResponse(result)
