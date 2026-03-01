# backend/api_server.py
# FIXED: Correct router order, correct imports, no NameError, all legacy endpoints restored

import os
import json
import fitz  # PyMuPDF
from typing import List

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from backend.api.company_detection import router as company_router
from backend.api.auto_suggest import router as auto_suggest_router

import pytesseract

# ---------------------------------------------------------
# FastAPI app MUST be created BEFORE include_router
# ---------------------------------------------------------
app = FastAPI(title="COA Redaction API")

# ---------------------------------------------------------
# CORS
# ---------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://127.0.0.1",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# Configure Tesseract
# ---------------------------------------------------------
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# ---------------------------------------------------------
# Core backend imports
# ---------------------------------------------------------
from backend.template_loader import TemplateLoader
from backend.pdf_text_extractor import PDFTextExtractor
from backend.redaction.redaction_engine import RedactionEngine
from backend.pdf_engine import build_redacted_filename
from backend.redaction.manual_redaction_engine import ManualRedactionEngine
from backend.redaction.auto_redaction_engine import AutoRedactionEngine

# ---------------------------------------------------------
# Routers (MUST be after app = FastAPI)
# ---------------------------------------------------------
from backend.api.routes.redaction_barcodes import router as barcode_router

app.include_router(barcode_router, prefix="/api")
# Company detection (new)
app.include_router(company_router)  # exposes /company/detect

# Template-based auto-suggest (new)
app.include_router(auto_suggest_router)  # exposes /redact/template


# ---------------------------------------------------------
# Singletons
# ---------------------------------------------------------
loader = TemplateLoader()
extractor = PDFTextExtractor()
engine = RedactionEngine()
manual_engine = ManualRedactionEngine()
auto_engine = AutoRedactionEngine()

MAX_PDF_SIZE = 50 * 1024 * 1024  # 50 MB

# ---------------------------------------------------------
# Health check
# ---------------------------------------------------------
@app.get("/health")
def health_check():
    return {"status": "ok", "service": "COA Redaction API"}

# ---------------------------------------------------------
# Auto-redaction suggestion
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
# Auto-redaction suggestion (force OCR)
# ---------------------------------------------------------
@app.post("/api/redact/auto-suggest-ocr")
async def api_redact_auto_suggest_ocr(file: UploadFile = File(...)):
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
# OCR endpoint (used by OCR_Fallback.js)
# ---------------------------------------------------------
@app.post("/api/ocr")
async def api_ocr(file: UploadFile = File(...)):
    pdf_bytes = await file.read()

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    words = []
    for page_index in range(len(doc)):
        page = doc[page_index]
        pix = page.get_pixmap()
        img_bytes = pix.tobytes("png")

        ocr_result = pytesseract.image_to_data(
            img_bytes,
            output_type=pytesseract.Output.DICT
        )

        for i in range(len(ocr_result["text"])):
            text = ocr_result["text"][i].strip()
            if not text:
                continue

            words.append({
                "page": page_index + 1,
                "text": text,
                "x0": ocr_result["left"][i],
                "y0": ocr_result["top"][i],
                "x1": ocr_result["left"][i] + ocr_result["width"][i],
                "y1": ocr_result["top"][i] + ocr_result["height"][i],
            })

    return {"words": words}

# ---------------------------------------------------------
# Manual redaction endpoint (aligned with frontend)
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
            return JSONResponse({"error": "redactions must be a JSON array"}, status_code=400)
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
# Template list (legacy)
# ---------------------------------------------------------
@app.get("/templates/list")
def list_templates():
    return {"templates": loader.list_templates()}

# ---------------------------------------------------------
# Template get (legacy)
# ---------------------------------------------------------
@app.get("/templates/get/{company_id}")
def get_template(company_id: str):
    template = loader.get_template(company_id)
    if not template:
        return JSONResponse({"error": "Template not found"}, status_code=404)
    return template

# ---------------------------------------------------------
# Template update (legacy)
# ---------------------------------------------------------
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
# Template list (API)
# ---------------------------------------------------------
@app.get("/api/templates")
def api_list_templates():
    templates_meta = []
    for company_id in loader.list_templates():
        tmpl = loader.get_template(company_id) or {}
        templates_meta.append({
            "company_id": company_id,
            "display_name": tmpl.get("display_name", company_id),
        })
    return {"templates": templates_meta}

# ---------------------------------------------------------
# Template get (API)
# ---------------------------------------------------------
@app.get("/api/templates/{company_id}")
def api_get_template(company_id: str):
    template = loader.get_template(company_id)
    if not template:
        return JSONResponse({"error": "Template not found"}, status_code=404)
    return template

# ---------------------------------------------------------
# Detect company (root)
# ---------------------------------------------------------
@app.post("/detect-company")
async def detect_company(file: UploadFile = File(...)):
    pdf_bytes = await file.read()
    if len(pdf_bytes) > MAX_PDF_SIZE:
        return JSONResponse(
            {"company_id": None, "display_name": None, "reason": "file too large"},
            status_code=413,
        )

    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as f:
        f.write(pdf_bytes)

    text = extractor.extract(temp_path) if hasattr(extractor, "extract") else ""
    template = getattr(loader, "auto_detect_template", lambda _t: None)(text)

    os.remove(temp_path)

    if not template:
        return {"company_id": None, "display_name": None}

    return {
        "company_id": template.get("company_id"),
        "display_name": template.get("display_name"),
    }

# ---------------------------------------------------------
# Detect company (API)
# ---------------------------------------------------------
@app.post("/api/detect-company")
async def api_detect_company(file: UploadFile = File(...)):
    pdf_bytes = await file.read()
    if len(pdf_bytes) > MAX_PDF_SIZE:
        return JSONResponse(
            {"company_id": None, "display_name": None, "reason": "file too large"},
            status_code=413,
        )

    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as f:
        f.write(pdf_bytes)

    text = extractor.extract(temp_path) if hasattr(extractor, "extract") else ""
    template = getattr(loader, "auto_detect_template", lambda _t: None)(text)

    os.remove(temp_path)

    if not template:
        return {"company_id": None, "display_name": None}

    return {
        "company_id": template.get("company_id"),
        "display_name": template.get("display_name"),
    }

# ---------------------------------------------------------
# Redact single (legacy)
# ---------------------------------------------------------
@app.post("/api/redact/single")
async def api_redact_single(file: UploadFile = File(...)):
    pdf_bytes = await file.read()
    if len(pdf_bytes) > MAX_PDF_SIZE:
        return JSONResponse({"error": "File too large"}, status_code=413)

    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as f:
        f.write(pdf_bytes)

    text = extractor.extract(temp_path) if hasattr(extractor, "extract") else ""
    template = getattr(loader, "auto_detect_template", lambda _t: None)(text)

    if not template:
        os.remove(temp_path)
        return JSONResponse({"error": "No matching template"}, status_code=400)

    output_path = engine.redact_pdf(temp_path, template)
    os.remove(temp_path)

    return FileResponse(output_path, filename=os.path.basename(output_path))

# ---------------------------------------------------------
# Standard redact (legacy)
# ---------------------------------------------------------
@app.post("/redact")
async def redact_pdf(file: UploadFile = File(...)):
    pdf_bytes = await file.read()
    if len(pdf_bytes) > MAX_PDF_SIZE:
        return JSONResponse({"error": "File too large"}, status_code=413)

    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as f:
        f.write(pdf_bytes)

    text = extractor.extract(temp_path) if hasattr(extractor, "extract") else ""
    template = getattr(loader, "auto_detect_template", lambda _t: None)(text)

    if not template:
        os.remove(temp_path)
        return JSONResponse({"error": "No matching template"}, status_code=400)

    output_path = engine.redact_pdf(temp_path, template)
    os.remove(temp_path)

    return FileResponse(output_path, filename=os.path.basename(output_path))

# ---------------------------------------------------------
# Batch redaction (legacy)
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

        text = extractor.extract(temp_path) if hasattr(extractor, "extract") else ""
        template = getattr(loader, "auto_detect_template", lambda _t: None)(text)

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
# PDF preview
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

# ---------------------------------------------------------
# Run server
# ---------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.api_server:app", host="127.0.0.1", port=8000, reload=True)
