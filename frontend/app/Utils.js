// ------------------------------------------------------------
// Utils.js — Centralized global state manager
// FIXED: Export names corrected (autoRedactSuggestions, not autoRedactions)
// ------------------------------------------------------------

// ------------------------------------------------------------
// PDF + Rendering State
// ------------------------------------------------------------
export let pdfDoc = null;
export let pdfBytes = null;
export let numPages = 0;
export let pageViews = [];

export function setPdfDoc(v) { pdfDoc = v; }
export function setPdfBytes(v) { pdfBytes = v; }
export function setNumPages(v) { numPages = v; }
export function setPageViews(v) { pageViews = v; }

// ------------------------------------------------------------
// Zoom + Pan
// ------------------------------------------------------------
export let zoom = 1.0;
export let panMode = false;
export let currentPageVisible = 1;

export function setZoom(v) { zoom = v; }
export function setPanMode(v) { panMode = v; }
export function setCurrentPageVisible(v) { currentPageVisible = v; }

// ------------------------------------------------------------
// Redactions (per page)
// FIXED: Ensure this is always an object { pageNumber: [redactions] }
// ------------------------------------------------------------
export let redactions = {}; // { pageNumber: [ { page, type, rects, color } ] }

export function setRedactions(v) { redactions = v; }

// Undo/Redo
export let undoStack = [];
export let redoStack = [];

export function setUndoStack(v) { undoStack = v; }
export function setRedoStack(v) { redoStack = v; }

// ------------------------------------------------------------
// Auto-Redaction Suggestions
// FIXED: Correct export name is autoRedactSuggestions (not autoRedactions)
// ------------------------------------------------------------
export let autoRedactSuggestions = []; // [ { id, page, rects, selected } ]
export let hoveredSuggestionId = null;

export function setAutoRedactSuggestions(v) { autoRedactSuggestions = v; }
export function setHoveredSuggestionId(v) { hoveredSuggestionId = v; }

// ------------------------------------------------------------
// Search State
// ------------------------------------------------------------
export let searchResults = []; // [ { page, rects } ]
export let searchIndex = 0;
export let highlightMode = true;

export function setSearchResults(v) { searchResults = v; }
export function setSearchIndex(v) { searchIndex = v; }
export function setHighlightMode(v) { highlightMode = v; }

// ------------------------------------------------------------
// Review Mode
// ------------------------------------------------------------
export let reviewMode = false;
export let showOnlyAuto = false;

export function setReviewMode(v) { reviewMode = v; }
export function setShowOnlyAuto(v) { showOnlyAuto = v; }

// ------------------------------------------------------------
// Status Bar
// FIXED: Added fallback if element not found
// ------------------------------------------------------------
export function setStatus(msg) {
  const el = document.getElementById("statusBar") || document.getElementById("statusText");
  if (el) el.textContent = msg;
  console.log("[Status]", msg);
}

// ------------------------------------------------------------
// Utility: Normalize rectangle
// Converts screen coordinates to normalized (0-1) coordinates
// ------------------------------------------------------------
export function normalizeRect(x0, y0, x1, y1, width, height) {
  return {
    x0: Math.min(x0, x1) / width,
    y0: Math.min(y0, y1) / height,
    x1: Math.max(x0, x1) / width,
    y1: Math.max(y0, y1) / height
  };
}

// ------------------------------------------------------------
// Utility: Download blob
// ------------------------------------------------------------
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ------------------------------------------------------------
// Utility: Generate redacted filename
// ------------------------------------------------------------
export function getRedactedFilename(original) {
  if (!original) return "redacted.pdf";
  const dot = original.lastIndexOf(".");
  if (dot === -1) return original + "_redacted.pdf";
  return original.slice(0, dot) + "_redacted" + original.slice(dot);
}

// ------------------------------------------------------------
// Debug Helper
// ------------------------------------------------------------
export function debugState() {
  console.log("PDF:", { pdfDoc, numPages });
  console.log("Zoom:", zoom);
  console.log("Redactions:", redactions);
  console.log("Auto Suggestions:", autoRedactSuggestions);
  console.log("Search:", { searchResults, searchIndex });
  console.log("Review Mode:", { reviewMode, showOnlyAuto });
}
