# backend/api_server.py
# Run with: uvicorn backend.api_server:app --reload --port 8000

import os
import json
from typing import List

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware

# ---------------------------------------------------------
# Correct imports for your package layout
# ---------------------------------------------------------
from backend.api.routes.redaction import router as redaction_router
from backend.api.company_detection import router as company_router
from backend.api.stirling_compatible import router as stirling_router

from backend.template_loader import TemplateLoader
from backend.manual_redaction_engine import ManualRedactionEngine

# ---------------------------------------------------------
# App setup
# ---------------------------------------------------------

app = FastAPI(title="COA Redaction API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(redaction_router)
app.include_router(company_router)
app.include_router(stirling_router)

# Core services
loader = TemplateLoader()
manual_engine = ManualRedactionEngine()

BASE_DIR = os.path.dirname(__file__)
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates_unified")


# ---------------------------------------------------------
# Health check
# ---------------------------------------------------------
@app.get("/health")
def health_check():
    return {"status": "ok", "service": "COA Redaction API"}


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
    output_path = manual_engine.apply_redactions(
        pdf_bytes=pdf_bytes,
        redactions=redaction_list,
        scrub_metadata=bool(scrub_metadata),
        base_filename=file.filename,
    )

    return FileResponse(
        output_path,
        filename=os.path.basename(output_path),
        media_type="application/pdf",
    )


# ---------------------------------------------------------
# API-friendly template list
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
# Legacy template list
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

    os.makedirs(TEMPLATES_DIR, exist_ok=True)
    path = os.path.join(TEMPLATES_DIR, f"{company_id}.json")

    with open(path, "w", encoding="utf-8") as f:
        json.dump(template_json, f, indent=2)

    if hasattr(loader, "load_templates"):
        loader.load_templates()

    return {"status": "ok", "saved_to": path}
