// ------------------------------------------------------------
// DrawingTools.js — Optional drawing tools (Stirling-style)
// FIXED: Safe, dormant, non-conflicting with overlay pipeline
// ------------------------------------------------------------

export const DrawingTools = {
  RECTANGLE: "rectangle",
  HIGHLIGHT: "highlight",
  UNDERLINE: "underline",
  STRIKEOUT: "strikeout",
  SQUIGGLY: "squiggly",
  CARET: "caret",
  STAMP: "stamp",
  INK: "ink",
  POLYGON: "polygon",
  POLYLINE: "polyline",
  CIRCLE: "circle",
  SQUARE: "square",
  LINE: "line"
};

export class DrawingTool {
  constructor(type, color = "#000000", thickness = 2) {
    this.type = type;
    this.color = color;
    this.thickness = thickness;
    this.points = [];
  }

  addPoint(x, y) {
    this.points.push({ x, y });
  }

  // ------------------------------------------------------------
  // Convert to PDF annotation format (normalized)
  // ------------------------------------------------------------
  toPDFAnnotation(pageNumber, viewport) {
    if (!viewport) return null;

    const rect = this.calculateBoundingBox();
    if (!rect) return null;

    return {
      page: pageNumber,
      type: this.type,
      color: this.color,
      thickness: this.thickness,
      points: this.points.map(p => ({
        x: p.x / viewport.width,
        y: p.y / viewport.height
      })),
      rect: {
        x0: rect.x0 / viewport.width,
        y0: rect.y0 / viewport.height,
        x1: rect.x1 / viewport.width,
        y1: rect.y1 / viewport.height
      }
    };
  }

  // ------------------------------------------------------------
  // Bounding box in screen space
  // ------------------------------------------------------------
  calculateBoundingBox() {
    if (this.points.length === 0) return null;

    const xs = this.points.map(p => p.x);
    const ys = this.points.map(p => p.y);

    return {
      x0: Math.min(...xs),
      y0: Math.min(...ys),
      x1: Math.max(...xs),
      y1: Math.max(...ys)
    };
  }
}
