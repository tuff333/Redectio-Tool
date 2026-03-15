// ------------------------------------------------------------
// Coordinates.js — Correct Screen ↔ PDF coordinate conversion
// FIXED: Validates viewport.scale + safe fallbacks
// ------------------------------------------------------------

export class CoordinateConverter {
  constructor(pageViews) {
    this.pageViews = pageViews; // array from Utils.js
  }

  // ------------------------------------------------------------
  // Convert screen (mouse) → PDF coordinates
  // ------------------------------------------------------------
  screenToPdf(screenX, screenY, pageNumber) {
    const view = this.pageViews.find(v => v.pageNumber === pageNumber);
    if (!view || !view.wrapper || !view.viewport) return null;

    const rect = view.wrapper.getBoundingClientRect();
    const viewport = view.viewport;

    const x = screenX - rect.left;
    const y = screenY - rect.top;

    // FIX: Validate scale
    const scale = viewport.scale || (viewport.width / view.canvas?.width) || 1;

    const pdfX = x / scale;
    const pdfY = y / scale;

    return { x: pdfX, y: pdfY, page: pageNumber };
  }

  // ------------------------------------------------------------
  // Convert PDF → screen coordinates
  // ------------------------------------------------------------
  pdfToScreen(pdfX, pdfY, pageNumber) {
    const view = this.pageViews.find(v => v.pageNumber === pageNumber);
    if (!view || !view.wrapper || !view.viewport) return null;

    const rect = view.wrapper.getBoundingClientRect();
    const viewport = view.viewport;

    const scale = viewport.scale || (viewport.width / view.canvas?.width) || 1;

    const screenX = rect.left + pdfX * scale;
    const screenY = rect.top + pdfY * scale;

    return { x: screenX, y: screenY };
  }

  // ------------------------------------------------------------
  // Convert PDF rectangle → screen rectangle
  // ------------------------------------------------------------
  pdfRectToScreen(pdfRect, pageNumber) {
    const tl = this.pdfToScreen(pdfRect.x0, pdfRect.y0, pageNumber);
    const br = this.pdfToScreen(pdfRect.x1, pdfRect.y1, pageNumber);

    if (!tl || !br) return null;

    return {
      x: tl.x,
      y: tl.y,
      width: br.x - tl.x,
      height: br.y - tl.y
    };
  }

  // ------------------------------------------------------------
  // Get current zoom scale
  // ------------------------------------------------------------
  getScale(pageNumber) {
    const view = this.pageViews.find(v => v.pageNumber === pageNumber);
    if (!view || !view.viewport) return 1;

    return view.viewport.scale || 1;
  }
}
