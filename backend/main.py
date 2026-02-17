# backend/main.py
import sys, os
from fastapi import FastAPI

# Make backend/ importable
#sys.path.append(os.path.dirname(__file__))
#sys.path.append(os.path.dirname(os.path.abspath(__file__)) + "/api")
#sys.path.append(os.path.dirname(os.path.abspath(__file__)) + "/api/routes")

# Import the base API app
from backend.api_server import app as base_app

# Import routers
from backend.api.ocr import router as ocr_router

from backend.api.routes.redaction_barcodes import router as barcode_router
base_app.include_router(barcode_router)

# Create main app
app = FastAPI()

# Mount existing API server under /api
#app.mount("/api", base_app)

# Add new routes under /api
app.include_router(ocr_router, prefix="/api")
#app.include_router(barcode_router, prefix="/api")

@app.get("/")
def root():
    return {"status": "Backend running", "source": "main.py"}
