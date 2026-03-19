# backend/main.py
# Unified backend entrypoint for COA Redaction Tool

import os
import json
import re

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi import HTTPException

from backend.ocr_report import app as ocr_app
from backend.api.company_detection import router as company_router
from backend.api.auto_suggest import router as auto_suggest_router
from backend.api.routes.redaction_barcodes import router as barcode_router
from backend.api.ocr import router as ocr_router
from backend.template_loader import TemplateLoader
from backend.rules.merge_engine import detect_company

app = FastAPI()

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
# Health check (used by dev + smoke-tests)
# ------------------------------------------------------------
@app.get("/health")
def health_check():
    return {"status": "ok", "service": "COA Redaction Tool"}

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

loader = TemplateLoader(templates_dir=COMPANY_RULES_DIR)


def _build_company_template_raw_from_saved_rule(saved: dict) -> dict:
    """
    Convert frontend SaveRule.js payload into the company JSON schema
    that backend/rules/merge_engine expects.
    """
    company_id = (saved.get("company_id") or "").strip()
    display_name = (saved.get("display_name") or company_id or "Unnamed Company").strip()

    rules = saved.get("rules")
    if not isinstance(rules, list):
        rules = []

    regex_rules = []
    for idx, r in enumerate(rules):
        if not isinstance(r, dict):
            continue

        sample_text = (r.get("sample_text") or "").strip()
        if not sample_text:
            continue

        rid = str(r.get("id") or r.get("label") or f"saved_rule_{idx}").strip()
        # Escape literal sample text into a safe regex.
        pattern = re.escape(sample_text)
        regex_rules.append(
            {
                "id": rid,
                "pattern": pattern,
                "action": "suggest",
            }
        )

    # Provide a minimal detection block so /detect-company can find it later.
    detection = {
        "match_strings": [display_name, company_id],
        "priority": 1,
    }

    return {
        "company_id": company_id,
        "display_name": display_name,
        "detection": detection,
        "anchors": [company_id, display_name],
        "regex": regex_rules,
        "layout": [],
        "barcode_qr": [],
    }


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


@app.get("/api/templates/{company_id}")
def api_get_template(company_id: str):
    template = loader.get_template(company_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@app.post("/api/templates/save-rule")
async def api_save_rule(rule: str = Form(...)):
    """
    Saves a "saved rule" created from frontend suggestions.
    Frontend posts FormData field named `rule` as a JSON string.
    """
    try:
        saved = json.loads(rule)
    except json.JSONDecodeError:
        return JSONResponse({"error": "Invalid JSON in rule"}, status_code=400)

    company_id = (saved.get("company_id") or "").strip()
    if not company_id:
        return JSONResponse({"error": "Missing company_id"}, status_code=400)

    raw_template = _build_company_template_raw_from_saved_rule(saved)

    # Safety: ensure company_id is always set correctly.
    raw_template["company_id"] = company_id
    raw_template["display_name"] = raw_template.get("display_name") or company_id

    os.makedirs(COMPANY_RULES_DIR, exist_ok=True)
    path = os.path.join(COMPANY_RULES_DIR, f"{company_id}.json")

    with open(path, "w", encoding="utf-8") as f:
        json.dump(raw_template, f, indent=2)

    # Reload so the UI immediately sees the newly saved template.
    loader.load_templates()
    return {"status": "ok", "saved_to": path, "company_id": company_id}


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


# Mount OCR + Redaction + Plugin API LAST.
# Mounting at "/" can otherwise shadow non-mounted routes (notably /api/templates)
# depending on Starlette route ordering.
app.mount("/", ocr_app)
