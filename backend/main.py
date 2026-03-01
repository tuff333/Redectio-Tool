# backend/main.py
from backend.api_server import app as base_app
from backend.api.ocr import router as ocr_router
from backend.api.routes.redaction_barcodes import router as barcode_router
from backend.api.auto_suggest import router as auto_suggest_router

# Use the existing app from api_server.py
app = base_app

# Add extra routers on top
app.include_router(ocr_router, prefix="/api")
app.include_router(barcode_router, prefix="/api")
app.include_router(auto_suggest_router)

@app.get("/")
def root():
    return {"status": "Backend running", "source": "main.py"}
