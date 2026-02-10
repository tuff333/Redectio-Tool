# backend/api_server.py
# FIXED: Consistent API endpoints, basic validation, safer CORS

import os
import json
import fitz  # PyMuPDF
from typing import List

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware

import pytesseract

# FIXED: Use absolute imports with 'backend.' prefix
from backend.template_loader import TemplateLoader
from backend.pdf_text_extractor import PDFTextExtractor
from backend.redaction.redaction_engine import RedactionEngine
from backend.pdf_engine import build_redacted_filename
from backend.redaction.manual_redaction_engine import ManualRedactionEngine
from backend.redaction.auto_redaction_engine import AutoRedactionEngine

# FIXED: Import routers from api module
from backend.api.routes.redaction import router as redaction_router
from backend.api.company_detection import router as company_router
from backend.api.stirling_compatible import router as stirling_router

app = FastAPI(title="COA Redaction API")

# Configure Tesseract path (adjust if needed)
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# ---------------------------------------------------------
# CORS (safe for local dev; easy to tighten later)
# ---------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
      "http://localhost",
      "http://127.0.0.1",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "*",  # keep for now; can be removed when you lock origins
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(redaction_router)
app.include_router(company_router)
app.include_router(stirling_router)

loader = TemplateLoader()
extractor = PDFTextExtractor()
engine = RedactionEngine()
manual_engine = ManualRedactionEngine()
auto_engine = AutoRedactionEngine()

MAX_PDF_SIZE = 50 * 1024 * 1024  # 50 MB


# ---------------------------------------------------------
# Health check endpoint
# ---------------------------------------------------------
@app.get("/health")
def health_check():
    return {"status": "ok", "service": "COA Redaction API"}


# ---------------------------------------------------------
# Auto-redaction suggestion (no OCR / auto OCR fallback)
# ---------------------------------------------------------
@app.post("/api/redact/auto-suggest")
async def api_redact_auto_suggest(
    file: UploadFile = File(...),
    use_ocr: bool = Form(False),
):
    pdf_bytes = await file.read()
    if len(pdf_bytes) > MAX_PDF_SIZE:
        return JSONResponse({"error": "File too large"}, status_code=413)

    result = auto_engine.suggest_redactions_json(
        pdf_bytes=pdf_bytes,
        use_ocr=bool(use_ocr),
        auto_ocr=True,
    )
    return JSONResponse(result)


# ---------------------------------------------------------
# Auto-redaction suggestion (force OCR for all pages)
# ---------------------------------------------------------
@app.post("/api/redact/auto-suggest-ocr")
async def api_redact_auto_suggest_ocr(
    file: UploadFile = File(...),
):
    pdf_bytes = await file.read()
    if len(pdf_bytes) > MAX_PDF_SIZE:
        return JSONResponse({"error": "File too large"}, status_code=413)

    result = auto_engine.suggest_redactions_json(
        pdf_bytes=pdf_bytes,
        use_ocr=True,
        auto_ocr=True,
    )
    return JSONResponse(result)


# ---------------------------------------------------------
# Manual redaction endpoint
# ---------------------------------------------------------
@app.post("/api/redact/manual")
async def api_redact_manual(
    file: UploadFile = File(...),
    redactions: str = Form(...),
    scrub_metadata: bool = Form(True),
):
    try:
        redaction_list = json.loads(redactions)
        if not isinstance(redaction_list, list):
            return JSONResponse(
                {"error": "redactions must be a JSON array"}, status_code=400
            )
    except json.JSONDecodeError:
        return JSONResponse({"error": "Invalid JSON in redactions"}, status_code=400)

    pdf_bytes = await file.read()
    if len(pdf_bytes) > MAX_PDF_SIZE:
        return JSONResponse({"error": "File too large"}, status_code=413)

    output_path = manual_engine.apply_redactions(
        pdf_bytes,
        redaction_list,
        scrub_metadata=bool(scrub_metadata),
        base_filename=file.filename,
    )

    return FileResponse(
        output_path,
        filename=os.path.basename(output_path),
        media_type="application/pdf",
    )


# ---------------------------------------------------------
# API-friendly template list for frontend
# ---------------------------------------------------------
@app.get("/api/templates")
def api_list_templates():
    templates_meta = []
    for company_id in loader.list_templates():
        tmpl = loader.get_template(company_id) or {}
        templates_meta.append(
            {
                "company_id": company_id,
                "display_name": tmpl.get("display_name", company_id),
            }
        )
    return {"templates": templates_meta}


# ---------------------------------------------------------
# API: Get template by ID (matches frontend /api/templates/{id})
# ---------------------------------------------------------
@app.get("/api/templates/{company_id}")
def api_get_template(company_id: str):
    template = loader.get_template(company_id)
    if not template:
        return JSONResponse({"error": "Template not found"}, status_code=404)
    return template


# ---------------------------------------------------------
# Single redaction endpoint (template-based)
# (kept for compatibility)
# ---------------------------------------------------------
@app.post("/api/redact/single")
async def api_redact_single(file: UploadFile = File(...)):
  pdf_bytes = await file.read()
  if len(pdf_bytes) > MAX_PDF_SIZE:
      return JSONResponse({"error": "File too large"}, status_code=413)

  temp_path = f"temp_{file.filename}"
  with open(temp_path, "wb") as f:
      f.write(pdf_bytes)

  text = extractor.extract_text(temp_path)
  template = loader.auto_detect_template(text)

  if not template:
      os.remove(temp_path)
      return JSONResponse({"error": "No matching template"}, status_code=400)

  output_path = engine.redact_pdf(temp_path, template)
  os.remove(temp_path)

  return FileResponse(
      output_path,
      filename=os.path.basename(output_path),
      media_type="application/pdf",
  )


# ---------------------------------------------------------
# Legacy template endpoints (kept for now)
# ---------------------------------------------------------
@app.get("/templates/list")
def list_templates():
    return {"templates": loader.list_templates()}


@app.get("/templates/get/{company_id}")
def get_template(company_id: str):
    template = loader.get_template(company_id)
    if not template:
        return JSONResponse({"error": "Template not found"}, status_code=404)
    return template


@app.post("/templates/update")
async def update_template(template_json: dict):
    company_id = template_json.get("company_id")
    if not company_id:
        return JSONResponse({"error": "Missing company_id"}, status_code=400)

    os.makedirs("templates", exist_ok=True)
    path = os.path.join("templates", f"{company_id}.json")

    with open(path, "w", encoding="utf-8") as f:
        json.dump(template_json, f, indent=2)

    loader.load_templates()
    return {"status": "ok", "saved_to": path}


# ---------------------------------------------------------
# Auto-detect company (API version used by frontend)
# ---------------------------------------------------------
@app.post("/api/detect-company")
async def api_detect_company(file: UploadFile = File(...)):
    pdf_bytes = await file.read()
    if len(pdf_bytes) > MAX_PDF_SIZE:
        return JSONResponse({"company_id": None, "display_name": None, "reason": "file too large"}, status_code=413)

    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as f:
        f.write(pdf_bytes)

    text = extractor.extract_text(temp_path)
    template = loader.auto_detect_template(text)

    os.remove(temp_path)

    if not template:
        return {"company_id": None, "display_name": None}

    return {
        "company_id": template.get("company_id"),
        "display_name": template.get("display_name"),
    }


# ---------------------------------------------------------
# Legacy detect-company (kept for compatibility)
# ---------------------------------------------------------
@app.post("/detect-company")
async def detect_company(file: UploadFile = File(...)):
    pdf_bytes = await file.read()
    if len(pdf_bytes) > MAX_PDF_SIZE:
        return JSONResponse({"company_id": None, "display_name": None, "reason": "file too large"}, status_code=413)

    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as f:
        f.write(pdf_bytes)

    text = extractor.extract_text(temp_path)
    template = loader.auto_detect_template(text)

    os.remove(temp_path)

    if not template:
        return {"company_id": None, "display_name": None}

    return {
        "company_id": template.get("company_id"),
        "display_name": template.get("display_name"),
    }


# ---------------------------------------------------------
# Redact a single PDF (legacy endpoint)
# ---------------------------------------------------------
@app.post("/redact")
async def redact_pdf(file: UploadFile = File(...)):
    pdf_bytes = await file.read()
    if len(pdf_bytes) > MAX_PDF_SIZE:
        return JSONResponse({"error": "File too large"}, status_code=413)

    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as f:
        f.write(pdf_bytes)

    text = extractor.extract_text(temp_path)
    template = loader.auto_detect_template(text)

    if not template:
        os.remove(temp_path)
        return JSONResponse({"error": "No matching template"}, status_code=400)

    output_path = engine.redact_pdf(temp_path, template)
    os.remove(temp_path)

    return FileResponse(output_path, filename=os.path.basename(output_path))


# ---------------------------------------------------------
# Batch redaction
# ---------------------------------------------------------
@app.post("/batch-redact")
async def batch_redact(files: List[UploadFile] = File(...)):
    results = []

    for file in files:
        pdf_bytes = await file.read()
        if len(pdf_bytes) > MAX_PDF_SIZE:
            results.append(
                {
                    "file": file.filename,
                    "status": "failed",
                    "reason": "file too large",
                }
            )
            continue

        temp_path = f"temp_{file.filename}"
        with open(temp_path, "wb") as f:
            f.write(pdf_bytes)

        text = extractor.extract_text(temp_path)
        template = loader.auto_detect_template(text)

        if not template:
            results.append(
                {"file": file.filename, "status": "failed", "reason": "no template"}
            )
            os.remove(temp_path)
            continue

        output_path = engine.redact_pdf(temp_path, template)
        results.append(
            {"file": file.filename, "status": "success", "output": output_path}
        )

        os.remove(temp_path)

    return {"results": results}


# ---------------------------------------------------------
# PDF preview (for UI)
# ---------------------------------------------------------
@app.get("/preview/page")
def preview_page(file: str, page: int = 0):
    if not os.path.isfile(file):
        return JSONResponse({"error": "File not found"}, status_code=404)

    doc = fitz.open(file)
    if page < 0 or page >= len(doc):
        return JSONResponse({"error": "Invalid page index"}, status_code=400)

    pix = doc[page].get_pixmap()
    output_path = f"preview_{page}.png"
    pix.save(output_path)

    return FileResponse(output_path)
