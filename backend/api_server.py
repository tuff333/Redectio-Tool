# backend/api_server.py

import os
import fitz  # PyMuPDF
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware

from backend.template_loader import TemplateLoader
from backend.pdf_text_extractor import PDFTextExtractor
from backend.redaction_engine import RedactionEngine
from backend.pdf_engine import build_redacted_filename


app = FastAPI(title="COA Redaction API")

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


# ---------------------------------------------------------
# List templates
# ---------------------------------------------------------
@app.get("/templates/list")
def list_templates():
    return {"templates": loader.list_templates()}


# ---------------------------------------------------------
# Get template by ID
# ---------------------------------------------------------
@app.get("/templates/get/{company_id}")
def get_template(company_id: str):
    template = loader.get_template(company_id)
    if not template:
        return JSONResponse({"error": "Template not found"}, status_code=404)
    return template


# ---------------------------------------------------------
# Update or create template
# ---------------------------------------------------------
@app.post("/templates/update")
async def update_template(template_json: dict):
    company_id = template_json.get("company_id")
    if not company_id:
        return JSONResponse({"error": "Missing company_id"}, status_code=400)

    path = os.path.join("templates", f"{company_id}.json")

    with open(path, "w", encoding="utf-8") as f:
        import json
        json.dump(template_json, f, indent=2)

    loader.load_templates()  # reload
    return {"status": "ok", "saved_to": path}


# ---------------------------------------------------------
# Auto-detect company
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
# Redact a single PDF
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
# Batch redaction
# ---------------------------------------------------------
@app.post("/batch-redact")
async def batch_redact(files: list[UploadFile] = File(...)):
    results = []

    for file in files:
        temp_path = f"temp_{file.filename}"
        with open(temp_path, "wb") as f:
            f.write(await file.read())

        text = extractor.extract_text(temp_path)
        template = loader.auto_detect_template(text)

        if not template:
            results.append({"file": file.filename, "status": "failed", "reason": "no template"})
            os.remove(temp_path)
            continue

        output_path = engine.redact_pdf(temp_path, template)
        results.append({"file": file.filename, "status": "success", "output": output_path})

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
