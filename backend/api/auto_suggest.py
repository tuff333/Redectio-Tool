from fastapi import APIRouter, UploadFile, File, Query
from fastapi.responses import JSONResponse

from backend.redaction.text_finder import TextFinder
from backend.suggestions import build_final_rules_for_document, generate_suggestions
import traceback

# For pyzbar-based barcode detection
from pdf2image import convert_from_bytes
from pyzbar.pyzbar import decode
import os

router = APIRouter(prefix="/redact", tags=["Auto‑Suggest"])

def _find_poppler_path() -> str | None:
    candidates = [
        r"C:\poppler\bin",
        r"C:\poppler\Library\bin",
        r"C:\poppler\Library\mingw64\bin",
    ]
    for path in candidates:
        if os.path.isfile(os.path.join(path, "pdfinfo.exe")):
            return path
    return None


def _detect_barcodes_pyzbar(pdf_bytes: bytes):
    poppler_path = _find_poppler_path()
    if not poppler_path:
        return []

    pages = convert_from_bytes(
        pdf_bytes,
        dpi=200,
        poppler_path=poppler_path
    )

    suggestions = []
    page_number = 1

    for img in pages:
        decoded = decode(img)

        width, height = img.size

        for d in decoded:
            x, y, w, h = d.rect

            norm = {
                "x0": x / width,
                "y0": y / height,
                "x1": (x + w) / width,
                "y1": (y + h) / height
            }

            suggestions.append({
                "type": "barcode",
                "rule_id": "pyzbar_barcode",
                "label": "Barcode",
                "group": "barcode",
                "page": page_number,
                "rects": [norm],
                "text": d.data.decode("utf-8", errors="ignore") if d.data else "",
                "reason": "Detected barcode (pyzbar)"
            })

        page_number += 1

    return suggestions


@router.post("/template")
async def auto_suggest_template(
    file: UploadFile = File(...),
    company_id: str | None = Query(None),
):
    try:
        pdf_bytes = await file.read()

        finder = TextFinder()
        spans = finder.find_text_spans(pdf_bytes, use_ocr=False, auto_ocr=True)

        spans_by_page: dict[int, list[dict]] = {}
        for s in spans:
            page = getattr(s, "page", None) or getattr(s, "page", 1)
            text = getattr(s, "text", None) or getattr(s, "text", "")
            x0 = getattr(s, "x0", None) or getattr(s, "x0", 0.0)
            y0 = getattr(s, "y0", None) or getattr(s, "y0", 0.0)
            x1 = getattr(s, "x1", None) or getattr(s, "x1", 1.0)
            y1 = getattr(s, "y1", None) or getattr(s, "y1", 1.0)

            page = int(page)
            spans_by_page.setdefault(page, []).append(
                {
                    "text": text,
                    "x0": float(x0),
                    "y0": float(y0),
                    "x1": float(x1),
                    "y1": float(y1),
                }
            )

        pages_text = [
            " ".join(s["text"] for s in spans_by_page[p] if s["text"])
            for p in sorted(spans_by_page.keys())
        ] if spans_by_page else [""]

        full_text = " ".join(pages_text)

        final_rules = build_final_rules_for_document(
            full_text,
            company_hint=company_id,
        )

        # IMPORTANT: use pages_text key to match suggestion engine
        ocr_result = {
            "pages_text": pages_text,
            "spans_by_page": spans_by_page,
        }

        # Rule-based suggestions (text + layout + zones)
        suggestions = generate_suggestions([], ocr_result, final_rules)

        # PyMuPDF image-block barcodes
        pymupdf_barcodes = finder.find_barcodes(pdf_bytes)
        for b in pymupdf_barcodes:
            suggestions.append(
                {
                    "type": "barcode",
                    "rule_id": "pymupdf_barcode",
                    "label": "Barcode",
                    "group": "barcode",
                    "page": b["page"],
                    "rects": b["rects"],
                    "text": b.get("text", ""),
                    "reason": "Detected image block (PyMuPDF)"
                }
            )

        # pyzbar barcodes (same engine as barcode button)
        pyzbar_suggestions = _detect_barcodes_pyzbar(pdf_bytes)
        suggestions.extend(pyzbar_suggestions)

        return JSONResponse({"candidates": suggestions}, status_code=200)

    except Exception as e:
        print("🔥🔥🔥 AUTO-SUGGEST ERROR 🔥🔥🔥")
        traceback.print_exc()
        print("🔥🔥🔥 END ERROR 🔥🔥🔥")
        return JSONResponse({"error": str(e)}, status_code=500)
