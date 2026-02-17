from fastapi import APIRouter, UploadFile, File
from pyzbar.pyzbar import decode
from PIL import Image
from pdf2image import convert_from_bytes
import os

router = APIRouter()


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


# Barcode auto-suggest endpoint (kept with /api prefix as requested)
@router.post("/redact/auto-suggest-barcodes")
async def auto_suggest_barcodes(file: UploadFile = File(...)):
  pdf_bytes = await file.read()
  print("BARCODE BYTES LEN:", len(pdf_bytes))

  poppler_path = find_poppler_path()
  if not poppler_path:
      return {"error": "Poppler not found. Install Poppler and set correct path."}

  pages = convert_from_bytes(
      pdf_bytes,
      dpi=200,
      poppler_path=poppler_path
  )

  suggestions = []
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
              "type": "barcode"
          })

      page_number += 1

  return {"suggestions": suggestions}
