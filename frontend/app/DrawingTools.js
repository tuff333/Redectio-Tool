// frontend/app/DrawingTools.js
// Drawing tools inspired by Stirling-PDF

export const DrawingTools = {
  // Rectangle (your current implementation)
  RECTANGLE: 'rectangle',
  
  // Additional tools from Stirling-PDF
  HIGHLIGHT: 'highlight',
  UNDERLINE: 'underline',
  STRIKEOUT: 'strikeout',
  SQUIGGLY: 'squiggly',
  CARET: 'caret',
  STAMP: 'stamp',
  INK: 'ink',
  POLYGON: 'polygon',
  POLYLINE: 'polyline',
  CIRCLE: 'circle',
  SQUARE: 'square',
  LINE: 'line',
};

export class DrawingTool {
  constructor(type, color = '#000000', thickness = 2) {
    this.type = type;
    this.color = color;
    this.thickness = thickness;
    this.points = [];
  }
  
  addPoint(x, y) {
    this.points.push({ x, y });
  }
  
  // Convert to PDF annotation format
  toPDFAnnotation(pageNumber) {
    return {
      page: pageNumber,
      type: this.type,
      color: this.color,
      thickness: this.thickness,
      points: this.points,
      rect: this.calculateBoundingBox()
    };
  }
  
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
