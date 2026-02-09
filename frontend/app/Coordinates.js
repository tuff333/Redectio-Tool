// ------------------------------------------------------------
// Coordinates.js — Correct Screen ↔ PDF coordinate conversion
// FIXED: Applies viewport.scale + viewport offsets
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
    if (!view) return null;

    const rect = view.wrapper.getBoundingClientRect();
    const viewport = view.viewport;

    // Position inside the page container
    const x = screenX - rect.left;
    const y = screenY - rect.top;

    // FIX: Apply viewport scale
    const pdfX = x / viewport.scale;
    const pdfY = y / viewport.scale;

    return { x: pdfX, y: pdfY, page: pageNumber };
  }

  // ------------------------------------------------------------
  // Convert PDF → screen coordinates
  // ------------------------------------------------------------
  pdfToScreen(pdfX, pdfY, pageNumber) {
    const view = this.pageViews.find(v => v.pageNumber === pageNumber);
    if (!view) return null;

    const rect = view.wrapper.getBoundingClientRect();
    const viewport = view.viewport;

    // FIX: Apply viewport scale
    const screenX = rect.left + pdfX * viewport.scale;
    const screenY = rect.top + pdfY * viewport.scale;

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
    return view?.viewport.scale || 1;
  }
}
