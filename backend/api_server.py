# backend/api_server.py

import os
import json
import fitz  # PyMuPDF
from typing import List

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware

import pytesseract

from backend.template_loader import TemplateLoader
from backend.pdf_text_extractor import PDFTextExtractor
from backend.redaction_engine import RedactionEngine
from backend.pdf_engine import build_redacted_filename
from backend.manual_redaction_engine import ManualRedactionEngine
from backend.auto_redaction_engine import AutoRedactionEngine

app = FastAPI(title="COA Redaction API")

# Configure Tesseract path (adjust if needed)
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# Allow UI to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

loader = TemplateLoader()
extractor = PDFTextExtractor()
engine = RedactionEngine()
manual_engine = ManualRedactionEngine()
auto_engine = AutoRedactionEngine()


# ---------------------------------------------------------
# NEW: Auto-redaction suggestion (no OCR / auto OCR fallback)
# ---------------------------------------------------------
@app.post("/api/redact/auto-suggest")
async def api_redact_auto_suggest(
    file: UploadFile = File(...),
    use_ocr: bool = Form(False),
):
    """
    Suggest redactions based on regex patterns and text positions.

    - use_ocr=False, auto_ocr=True (default): use PDF text, fallback to OCR on empty pages.
    """
    pdf_bytes = await file.read()
    result = auto_engine.suggest_redactions_json(
        pdf_bytes=pdf_bytes,
        use_ocr=bool(use_ocr),
        auto_ocr=True,
    )
    return JSONResponse(result)


# ---------------------------------------------------------
# NEW: Auto-redaction suggestion (force OCR for all pages)
# ---------------------------------------------------------
@app.post("/api/redact/auto-suggest-ocr")
async def api_redact_auto_suggest_ocr(
    file: UploadFile = File(...),
):
    """
    Suggest redactions using OCR for all pages (for scanned PDFs).
    """
    pdf_bytes = await file.read()
    result = auto_engine.suggest_redactions_json(
        pdf_bytes=pdf_bytes,
        use_ocr=True,
        auto_ocr=True,
    )
    return JSONResponse(result)


# ---------------------------------------------------------
# NEW: Manual redaction endpoint (Stirling-style)
# ---------------------------------------------------------
@app.post("/api/redact/manual")
async def api_redact_manual(
    file: UploadFile = File(...),
    redactions: str = Form(...),
    scrub_metadata: bool = Form(True),
):
    """
    Apply manual redactions based on a JSON redaction map.

    redactions: JSON string, e.g.
    [
      {
        "page": 1,
        "type": "box",
        "rect": { "x0": 0.1, "y0": 0.2, "x1": 0.4, "y1": 0.3 },
        "color": "#000000"
      },
      {
        "page": 2,
        "type": "text",
        "rects": [
          { "x0": 0.15, "y0": 0.25, "x1": 0.35, "y1": 0.28 }
        ],
        "text": "some selected text",
        "color": "#000000"
      },
      {
        "page": 3,
        "type": "page",
        "color": "#000000"
      }
    ]
    """
    try:
        redaction_list = json.loads(redactions)
        if not isinstance(redaction_list, list):
            return JSONResponse(
                {"error": "redactions must be a JSON array"}, status_code=400
            )
    except json.JSONDecodeError:
        return JSONResponse({"error": "Invalid JSON in redactions"}, status_code=400)

    pdf_bytes = await file.read()
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
# Existing: API-friendly template list for frontend
# (kept for future batch/template features)
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
# Existing: Single redaction endpoint (template-based)
# (legacy COA flow – you can ignore in UI for now)
# ---------------------------------------------------------
@app.post("/api/redact/single")
async def api_redact_single(file: UploadFile = File(...)):
    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as f:
        f.write(await file.read())

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
# Existing: List templates (raw IDs)
# ---------------------------------------------------------
@app.get("/templates/list")
def list_templates():
    return {"templates": loader.list_templates()}


# ---------------------------------------------------------
# Existing: Get template by ID
# ---------------------------------------------------------
@app.get("/templates/get/{company_id}")
def get_template(company_id: str):
    template = loader.get_template(company_id)
    if not template:
        return JSONResponse({"error": "Template not found"}, status_code=404)
    return template


# ---------------------------------------------------------
# Existing: Update or create template
# ---------------------------------------------------------
@app.post("/templates/update")
async def update_template(template_json: dict):
    company_id = template_json.get("company_id")
    if not company_id:
        return JSONResponse({"error": "Missing company_id"}, status_code=400)

    path = os.path.join("templates", f"{company_id}.json")

    with open(path, "w", encoding="utf-8") as f:
        json.dump(template_json, f, indent=2)

    loader.load_templates()  # reload
    return {"status": "ok", "saved_to": path}


# ---------------------------------------------------------
# Existing: Auto-detect company
# ---------------------------------------------------------
@app.post("/detect-company")
async def detect_company(file: UploadFile = File(...)):
    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as f:
        f.write(await file.read())

    text = extractor.extract_text(temp_path)
    template = loader.auto_detect_template(text)

    os.remove(temp_path)

    if not template:
        return {"company_id": None, "display_name": None}

    return {
        "company_id": template["company_id"],
        "display_name": template["display_name"],
    }


# ---------------------------------------------------------
# Existing: Redact a single PDF (legacy endpoint)
# ---------------------------------------------------------
@app.post("/redact")
async def redact_pdf(file: UploadFile = File(...)):
    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as f:
        f.write(await file.read())

    text = extractor.extract_text(temp_path)
    template = loader.auto_detect_template(text)

    if not template:
        os.remove(temp_path)
        return JSONResponse({"error": "No matching template"}, status_code=400)

    output_path = engine.redact_pdf(temp_path, template)

    os.remove(temp_path)
    return FileResponse(output_path, filename=os.path.basename(output_path))


# ---------------------------------------------------------
# Existing: Batch redaction
# ---------------------------------------------------------
@app.post("/batch-redact")
async def batch_redact(files: List[UploadFile] = File(...)):
    results = []

    for file in files:
        temp_path = f"temp_{file.filename}"
        with open(temp_path, "wb") as f:
            f.write(await file.read())

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
# Existing: PDF preview (for UI)
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
