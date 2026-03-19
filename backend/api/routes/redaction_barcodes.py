# backend/api/routes/redaction_barcodes.py

import os
import io
from fastapi import APIRouter, UploadFile, File
from pyzbar.pyzbar import decode
from pdf2image import convert_from_bytes
import fitz  # PyMuPDF
from PIL import Image

router = APIRouter()

def find_poppler_path():
    env_path = os.environ.get("POPPLER_PATH")
    if env_path:
        pdfinfo = os.path.join(env_path, "pdfinfo.exe")
        if os.path.isfile(pdfinfo):
            return env_path

    candidates = [
        r"C:\poppler\bin",
        r"C:\poppler\Library\bin",
        r"C:\poppler\Library\mingw64\bin",
        r"C:\Program Files\poppler\bin",
        r"C:\Program Files (x86)\poppler\bin",
        r"C:\Program Files\poppler\Library\bin",
        r"C:\Program Files (x86)\poppler\Library\bin",
    ]
    for path in candidates:
        if os.path.isfile(os.path.join(path, "pdfinfo.exe")):
            return path
    return None


@router.post("/redact/auto-suggest-barcodes")
async def auto_suggest_barcodes(file: UploadFile = File(...)):
    """
    Pure barcode/QR detection endpoint.
    Returns:
      { ok: True, suggestions: [...] }
    """
    pdf_bytes = await file.read()

    poppler_path = find_poppler_path()
    pages_or_images = None
    if poppler_path:
        pages_or_images = convert_from_bytes(pdf_bytes, dpi=200, poppler_path=poppler_path)
    else:
        # Fallback: render with PyMuPDF when Poppler/pdfinfo isn't installed.
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        pages_or_images = []
        try:
            zoom = 200 / 72.0
            mat = fitz.Matrix(zoom, zoom)
            for page in doc:
                pix = page.get_pixmap(matrix=mat, alpha=False)
                img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
                pages_or_images.append(img)
        finally:
            doc.close()

    suggestions = []
    page_number = 1

    for img in pages_or_images:
        decoded = decode(img)

        for d in decoded:
            x, y, w, h = d.rect
            width, height = img.size

            rect = {
                "x0": x / width,
                "y0": y / height,
                "x1": (x + w) / width,
                "y1": (y + h) / height
            }

            suggestions.append({
                "id": f"barcode-{page_number}-{x}-{y}",
                "page": page_number,
                "rects": [rect],
                "selected": True,
                "type": "barcode",
                "group": "barcode",
                "label": "BARCODE"
            })

        page_number += 1

    return {"ok": True, "suggestions": suggestions}
