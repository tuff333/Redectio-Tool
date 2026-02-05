// ------------------------------------------------------------
// Redaction_Core.js — Page-aware redaction storage
// CRITICAL FIX for multi-page PDFs
// ------------------------------------------------------------

export class RedactionCore {
  constructor() {
    // Store by page number: Map { 1 => [boxes], 2 => [boxes] }
    this.redactions = new Map();
    this.undoStack = [];
    this.redoStack = [];
    this.previewMode = false;
    this.currentColor = 'black';
  }

  /**
   * Add redaction with PDF coordinates
   */
  addRedaction(pdfCoords, options = {}) {
    const redaction = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      page: pdfCoords.page,
      x: pdfCoords.x,
      y: pdfCoords.y,
      width: pdfCoords.width,
      height: pdfCoords.height,
      color: options.color || this.currentColor,
      label: options.label || '',
      createdAt: new Date().toISOString()
    };

    // Store by page
    if (!this.redactions.has(pdfCoords.page)) {
      this.redactions.set(pdfCoords.page, []);
    }
    this.redactions.get(pdfCoords.page).push(redaction);

    // Add to undo stack
    this.undoStack.push({ action: 'add', redaction });
    this.redoStack = [];

    return redaction;
  }

  /**
   * Get redactions for specific page ONLY
   */
  getRedactionsForPage(pageNumber) {
    return this.redactions.get(pageNumber) || [];
  }

  /**
   * Get all redactions across all pages
   */
  getAllRedactions() {
    const all = [];
    this.redactions.forEach((boxes, page) => {
      all.push(...boxes);
    });
    return all;
  }

  /**
   * Remove redaction by ID
   */
  removeRedaction(id) {
    for (const [page, boxes] of this.redactions.entries()) {
      const index = boxes.findIndex(b => b.id === id);
      if (index !== -1) {
        const removed = boxes.splice(index, 1)[0];
        this.undoStack.push({ action: 'remove', redaction: removed, page });
        return removed;
      }
    }
    return null;
  }

  /**
   * Undo last action
   */
  undo() {
    if (this.undoStack.length === 0) return null;
    const action = this.undoStack.pop();
    
    if (action.action === 'add') {
      this.removeRedaction(action.redaction.id);
    } else if (action.action === 'remove') {
      if (!this.redactions.has(action.page)) {
        this.redactions.set(action.page, []);
      }
      this.redactions.get(action.page).push(action.redaction);
    }
    
    this.redoStack.push(action);
    return action;
  }

  /**
   * Redo last undone action
   */
  redo() {
    if (this.redoStack.length === 0) return null;
    const action = this.redoStack.pop();
    // Replay action...
    return action;
  }

  /**
   * Clear all redactions
   */
  clearAll() {
    this.undoStack.push({ 
      action: 'clear', 
      redactions: new Map(this.redactions) 
    });
    this.redactions.clear();
  }

  /**
   * Export to JSON
   */
  exportToJSON() {
    const exportObj = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      redactions: {}
    };
    
    this.redactions.forEach((boxes, page) => {
      exportObj.redactions[page] = boxes;
    });
    
    return JSON.stringify(exportObj, null, 2);
  }

  /**
   * Import from JSON
   */
  importFromJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      this.redactions.clear();
      
      Object.entries(data.redactions).forEach(([page, boxes]) => {
        this.redactions.set(parseInt(page), boxes);
      });
      
      return true;
    } catch (e) {
      console.error('Import failed:', e);
      return false;
    }
  }
}