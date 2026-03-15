# backend: ocr_report.py
# Unified FastAPI app for:
# - Report-number OCR helper
# - Template-based auto-suggest (hybrid engine)
# - Manual redaction application
# - Barcode / QR detection
#
# Requires:
#   pip install pymupdf pillow pytesseract fastapi uvicorn pdf2image pyzbar

import io
import os
import re
import json
from typing import Dict, Any, List, Optional

import fitz  # PyMuPDF
from PIL import Image
import pytesseract
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import JSONResponse, Response

from backend.suggestions import (
    build_final_rules_for_document,
    generate_suggestions,
)
from backend.rules_engine import detect_company_from_text
from backend.pdf_engine import build_redacted_filename

# Barcode libs
from pyzbar.pyzbar import decode
from pdf2image import convert_from_bytes

app = FastAPI()

# -------------------------------------------------------------------
# 1) OCR helper for report number
# -------------------------------------------------------------------

REPORT_REGEX = re.compile(r"C[0-9A-Z]{4,6}-[0-9A-Z]{4,6}")


def ocr_region_from_pdf(
    pdf_bytes: bytes,
    page_index: int = 0,
    rect_frac=(0.55, 0.70, 0.95, 0.90),
    dpi: int = 300,
):
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    if page_index >= len(doc):
        return None, None, None

    page = doc[page_index]
    page_rect = page.rect

    x0 = page_rect.x0 + rect_frac[0] * page_rect.width
    y0 = page_rect.y0 + rect_frac[1] * page_rect.height
    x1 = page_rect.x0 + rect_frac[2] * page_rect.width
    y1 = page_rect.y0 + rect_frac[3] * page_rect.height

    clip = fitz.Rect(x0, y0, x1, y1)
    pix = page.get_pixmap(clip=clip, dpi=dpi, alpha=False)
    img = Image.open(io.BytesIO(pix.tobytes()))
    text = pytesseract.image_to_string(img)
    return text, clip, page_rect


@app.post("/api/redact/ocr-report")
async def ocr_report(file: UploadFile = File(...)):
    pdf_bytes = await file.read()
    try:
        text, clip, page_rect = ocr_region_from_pdf(pdf_bytes)
        if not text:
            return JSONResponse({"ok": False, "message": "no text"}, status_code=200)

        m = REPORT_REGEX.search(text)
        if not m:
            return JSONResponse({"ok": True, "candidate": None}, status_code=200)

        report = m.group()

        rect = {
            "x0": clip.x0 / page_rect.width,
            "y0": clip.y0 / page_rect.height,
            "x1": clip.x1 / page_rect.width,
            "y1": clip.y1 / page_rect.height,
        }

        candidate = {
            "page": 1,
            "rect": rect,
            "value": report,
        }
        return JSONResponse({"ok": True, "candidate": candidate}, status_code=200)

    except Exception as e:
        return JSONResponse({"ok": False, "message": str(e)}, status_code=500)


# -------------------------------------------------------------------
# 2) OCR/Text extraction → spans_by_page
# -------------------------------------------------------------------

def extract_ocr_structure(pdf_bytes: bytes) -> Dict[str, Any]:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages_text: List[str] = []
    spans_by_page: Dict[int, List[Dict[str, Any]]] = {}

    for i, page in enumerate(doc):
        page_num = i + 1
        text = page.get_text("text") or ""
        pages_text.append(text)

        spans: List[Dict[str, Any]] = []
        for w in page.get_text("words") or []:
            x0, y0, x1, y1, text = w
            spans.append({
                "text": text,
                "x0": float(x0),
                "y0": float(y0),
                "x1": float(x1),
                "y1": float(y1),
            })

        spans_by_page[page_num] = spans

    return {
        "pages_text": pages_text,
        "spans_by_page": spans_by_page,
    }


# -------------------------------------------------------------------
# 3) Company detection (used by frontend Template_Detect_Backend)
# -------------------------------------------------------------------

@app.post("/api/templates/detect-company")
async def api_detect_company(file: UploadFile = File(...)):
    """
    Detect company_id from PDF text using config/rules/company_rules.
    """
    pdf_bytes = await file.read()
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        all_text = "\n".join(page.get_text("text") or "" for page in doc)
        company_id = detect_company_from_text(all_text)
        return {"ok": True, "company_id": company_id}
    except Exception as e:
        return {"ok": False, "company_id": None, "error": str(e)}


# -------------------------------------------------------------------
# 4) Template-based auto-suggest (hybrid engine)
# -------------------------------------------------------------------

async def _run_template_suggest_internal(
    file: UploadFile,
    company_id: Optional[str] = None,
):
    pdf_bytes = await file.read()

    ocr_result = extract_ocr_structure(pdf_bytes)
    full_text = "\n".join(ocr_result.get("pages_text") or [])

    final_rules = build_final_rules_for_document(
        ocr_text=full_text,
        company_hint=company_id,
    )

    suggestions = generate_suggestions(
        pdf_pages=None,
        ocr_result=ocr_result,
        final_rules=final_rules,
    )

    cid = getattr(final_rules, "company_id", None)
    return {
        "ok": True,
        "company_id": cid,
        "suggestions": suggestions,
    }


@app.post("/redact/template")
async def redact_template(company_id: Optional[str] = None, file: UploadFile = File(...)):
    try:
        result = await _run_template_suggest_internal(file, company_id=company_id)
        return JSONResponse(result, status_code=200)
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)


@app.post("/api/redact/auto-suggest")
async def api_auto_suggest(file: UploadFile = File(...)):
    try:
        result = await _run_template_suggest_internal(file, company_id=None)
        return JSONResponse(result, status_code=200)
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)


@app.post("/api/redact/auto-suggest-ocr")
async def api_auto_suggest_ocr(file: UploadFile = File(...)):
    try:
        result = await _run_template_suggest_internal(file, company_id=None)
        return JSONResponse(result, status_code=200)
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)


# -------------------------------------------------------------------
# 5) BARCODE / QR DETECTION (returns suggestions[])
# -------------------------------------------------------------------

def find_poppler_path():
    candidates = [
        r"C:\poppler\bin",
        r"C:\poppler\Library\bin",
        r"C:\poppler\Library\mingw64\bin",
    ]
    for path in candidates:
        if os.path.isfile(os.path.join(path, "pdfinfo.exe")):
            return path
    return None


@app.post("/api/redact/auto-suggest-barcodes")
async def auto_suggest_barcodes(file: UploadFile = File(...)):
    """
    Pure barcode/QR endpoint.
    Returns:
      { ok: True, suggestions: [ {id,page,rects[],type:'barcode',group:'barcode',label:'BARCODE'} ] }
    """
    pdf_bytes = await file.read()
    print("BARCODE BYTES LEN:", len(pdf_bytes))

    poppler_path = find_poppler_path()
    if not poppler_path:
        return {"ok": False, "suggestions": [], "error": "Poppler not found"}

    pages = convert_from_bytes(
        pdf_bytes,
        dpi=200,
        poppler_path=poppler_path
    )

    suggestions: List[Dict[str, Any]] = []
    page_number = 1

    for img in pages:
        decoded = decode(img)

        for d in decoded:
            x, y, w, h = d.rect
            width, height = img.size

            norm = {
                "x0": x / width,
                "y0": y / height,
                "x1": (x + w) / width,
                "y1": (y + h) / height
            }

            suggestions.append({
                "id": f"barcode-{page_number}-{x}-{y}",
                "page": page_number,
                "rects": [norm],
                "selected": True,
                "type": "barcode",
                "group": "barcode",
                "label": "BARCODE"
            })

        page_number += 1

    return {"ok": True, "suggestions": suggestions}


# -------------------------------------------------------------------
# 6) Manual redaction
# -------------------------------------------------------------------

def _apply_redactions_to_pdf(
    pdf_bytes: bytes,
    redactions: List[Dict[str, Any]],
    scrub_metadata: bool = True,
) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    for r in redactions:
        page_index = int(r.get("page", 1)) - 1
        if page_index < 0 or page_index >= len(doc):
            continue

        page = doc[page_index]
        page_rect = page.rect

        rects = r.get("rects") or []
        for nr in rects:
            try:
                x0 = float(nr.get("x0", 0.0)) * page_rect.width
                y0 = float(nr.get("y0", 0.0)) * page_rect.height
                x1 = float(nr.get("x1", 1.0)) * page_rect.width
                y1 = float(nr.get("y1", 1.0)) * page_rect.height
            except Exception:
                continue

            rect = fitz.Rect(x0, y0, x1, y1)
            page.add_redact_annot(rect, fill=(0, 0, 0))

        page.apply_redactions()

    if scrub_metadata:
        try:
            doc.set_metadata({})
        except Exception:
            pass

    out_bytes = doc.tobytes()
    doc.close()
    return out_bytes


@app.post("/api/redact/manual")
async def api_manual_redact(
    file: UploadFile = File(...),
    redactions: str = Form(...),
    scrub_metadata: str = Form("true"),
):
    try:
        pdf_bytes = await file.read()
        redactions_list = json.loads(redactions) if redactions else []
        scrub = scrub_metadata.lower() == "true"

        out_bytes = _apply_redactions_to_pdf(
            pdf_bytes=pdf_bytes,
            redactions=redactions_list,
            scrub_metadata=scrub,
        )

        return Response(
            content=out_bytes,
            media_type="application/pdf",
        )
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)
