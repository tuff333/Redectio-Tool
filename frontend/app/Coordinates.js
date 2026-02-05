// ------------------------------------------------------------
// Coordinates.js — Screen ↔ PDF coordinate conversion
// CRITICAL FIX for accurate redaction placement
// ------------------------------------------------------------

export class CoordinateConverter {
  constructor(pdfViewer) {
    this.pdfViewer = pdfViewer;
  }

  /**
   * Convert screen (mouse) coordinates to PDF coordinates
   * ESSENTIAL for saving redaction positions correctly
   */
  screenToPdf(screenX, screenY, pageNumber) {
    const pageView = this.pdfViewer.getPageView(pageNumber - 1);
    if (!pageView) {
      console.error(`Page ${pageNumber} not found`);
      return null;
    }

    const viewport = pageView.viewport;
    const rect = pageView.div.getBoundingClientRect();
    
    // Calculate position relative to page div
    const relativeX = screenX - rect.left;
    const relativeY = screenY - rect.top;
    
    // Convert to PDF coordinates (accounting for zoom/rotation)
    const pdfPoint = viewport.convertToPdfPoint(relativeX, relativeY);
    
    return {
      x: pdfPoint[0],
      y: pdfPoint[1],
      page: pageNumber
    };
  }

  /**
   * Convert PDF coordinates to screen coordinates for rendering
   * ESSENTIAL for drawing boxes at correct positions
   */
  pdfToScreen(pdfX, pdfY, pageNumber) {
    const pageView = this.pdfViewer.getPageView(pageNumber - 1);
    if (!pageView) return null;

    const viewport = pageView.viewport;
    const rect = pageView.div.getBoundingClientRect();
    
    // Convert PDF point to viewport point
    const viewportPoint = viewport.convertToViewportPoint(pdfX, pdfY);
    
    return {
      x: viewportPoint[0] + rect.left,
      y: viewportPoint[1] + rect.top
    };
  }

  /**
   * Convert PDF rectangle to screen rectangle
   */
  pdfRectToScreen(pdfRect, pageNumber) {
    const topLeft = this.pdfToScreen(pdfRect.x, pdfRect.y, pageNumber);
    const bottomRight = this.pdfToScreen(
      pdfRect.x + pdfRect.width, 
      pdfRect.y + pdfRect.height, 
      pageNumber
    );
    
    if (!topLeft || !bottomRight) return null;
    
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y
    };
  }

  /**
   * Get viewport scale for current zoom level
   */
  getScale(pageNumber) {
    const pageView = this.pdfViewer.getPageView(pageNumber - 1);
    return pageView ? pageView.viewport.scale : 1;
  }
}