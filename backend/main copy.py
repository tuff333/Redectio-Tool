# backend/main.py
# Clean entry point that imports the existing API server
# and mounts additional routers (like OCR)

from fastapi import FastAPI

# Import the base API app (all existing routes)
from backend.api_server import app as base_app

# Import your OCR router
from backend.api.ocr import router as ocr_router

# Import your QR code reader
#from backend.api.routes.redaction_barcodes import router as barcode_router
#app.include_router(barcode_router)

# Create a new FastAPI app that wraps the existing one
app = FastAPI()

# Mount all existing routes from api_server.py
#app.mount("", base_app)
app.mount("/api", base_app)

app.include_router(ocr_router) # add OCR

# Add your new OCR route
app.include_router(ocr_router, prefix="/api")

# Optional: root endpoint
@app.get("/")
def root():
    return {"status": "Backend running", "source": "main.py"}
