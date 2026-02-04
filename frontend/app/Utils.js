// ------------------------------------------------------------
// Utils.js — Shared state + helpers
// ------------------------------------------------------------

// ---------- Shared State ----------

export let pdfDoc = null;
export let pdfBytes = null;
export let numPages = 0;

export let zoom = 1.0;
export let panMode = false;

export let pageViews = []; // [{ pageNumber, page, container, canvas, overlay, textLayer, baseScale }]

export let redactions = []; // [{ page, type, rects, color }]
export let autoRedactSuggestions = []; // [{ page, rects, selected, id }]

export let undoStack = [];
export let redoStack = [];

export let highlightMode = false;
export let searchResults = [];
export let searchIndex = 0;

export let currentPageVisible = 0;

export let originalFileName = "";
export let hoveredSuggestionId = null;

// ---------- State Mutators ----------

export function setPdfDoc(doc) { pdfDoc = doc; }
export function setPdfBytes(bytes) { pdfBytes = bytes; }
export function setNumPages(n) { numPages = n; }

export function setZoom(z) { zoom = z; }
export function setPanMode(v) { panMode = v; }

export function setPageViews(v) { pageViews = v; }

export function setRedactions(v) { redactions = v; }
export function setAutoRedactSuggestions(v) { autoRedactSuggestions = v; }

export function setUndoStack(v) { undoStack = v; }
export function setRedoStack(v) { redoStack = v; }

export function setHighlightMode(v) { highlightMode = v; }
export function setSearchResults(v) { searchResults = v; }
export function setSearchIndex(v) { searchIndex = v; }

export function setCurrentPageVisible(v) { currentPageVisible = v; }

export function setOriginalFileName(v) { originalFileName = v; }
export function setHoveredSuggestionId(v) { hoveredSuggestionId = v; }

// ---------- DOM Helpers ----------

export function setStatus(msg) {
  const el = document.getElementById("statusText");
  if (el) el.textContent = msg || "";
}

// ---------- Geometry Helpers ----------

export function normalizeRect(x0, y0, x1, y1, width, height) {
  return {
    x0: Math.min(x0, x1) / width,
    y0: Math.min(y0, y1) / height,
    x1: Math.max(x0, x1) / width,
    y1: Math.max(y0, y1) / height
  };
}

// ---------- Filename Helpers ----------

export function getRedactedFilename() {
  if (!originalFileName) return "redacted_manual.pdf";

  const dotIndex = originalFileName.toLowerCase().lastIndexOf(".pdf");
  if (dotIndex === -1) {
    return originalFileName + "_Redacted.pdf";
  }

  return (
    originalFileName.substring(0, dotIndex) +
    "_Redacted" +
    originalFileName.substring(dotIndex)
  );
}

// ---------- Download Helper ----------

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
