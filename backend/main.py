# backend/main.py
# Unified backend entrypoint for COA Redaction Tool

import os

from fastapi import UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from backend.api_server import app as base_app

# Routers
from backend.api.company_detection import router as company_router
from backend.api.auto_suggest import router as auto_suggest_router
from backend.api.routes.redaction_barcodes import router as barcode_router
from backend.api.ocr import router as ocr_router

from backend.rules.merge_engine import detect_company

# Use the main FastAPI app from api_server.py
app = base_app

# ------------------------------------------------------------
# CORS (allow frontend at 127.0.0.1:5500)
# ------------------------------------------------------------
origins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "*",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------
# Include routers
# ------------------------------------------------------------
# Company detection router (/company/detect)
app.include_router(company_router)

# Unified rule-engine auto-suggest endpoint:
#   POST /redact/template
app.include_router(auto_suggest_router)

# Pure barcode/QR endpoint:
#   POST /api/redact/auto-suggest-barcodes
app.include_router(barcode_router, prefix="/api")

# OCR engine endpoint:
#   POST /ocr
app.include_router(ocr_router, prefix="/api")

# ------------------------------------------------------------
# Fallback /detect-company endpoint (used by Template_Detect_Backend.js)
# ------------------------------------------------------------
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
COMPANY_RULES_DIR = os.path.join(PROJECT_ROOT, "config", "rules", "company_rules")


@app.post("/detect-company")
async def detect_company_endpoint(file: UploadFile = File(...)):
    """
    Simple backend company detection used by Template_Detect_Backend.js.
    - Extracts text from PDF with PyMuPDF (via api_server's PDFTextExtractor if needed)
    - Uses merge_engine.detect_company over config/rules/company_rules/*.json
    - Returns { company_id, display_name } or nulls
    """
    import fitz  # local import to avoid unused at module level

    pdf_bytes = await file.read()

    # Extract text from PDF
    text_chunks = []
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        for page in doc:
            text_chunks.append(page.get_text("text") or "")
        doc.close()
    except Exception as e:
        print("[detect-company] ERROR extracting text:", e)
        return {"company_id": None, "display_name": None}

    full_text = "\n".join(text_chunks)

    rules = detect_company(full_text, COMPANY_RULES_DIR)
    if not rules:
        return {"company_id": None, "display_name": None}

    company_id = rules.get("company_id") or None
    display_name = rules.get("display_name") or company_id

    return {
        "company_id": company_id,
        "display_name": display_name,
    }
