// ------------------------------------------------------------
// Redaction_Core.js — Core redaction engine (undo/redo + drawing)
// FIXED: Import names corrected to match Utils.js exports
// ------------------------------------------------------------

import {
  redactions,
  undoStack,
  redoStack,
  // FIXED: Use correct export name from Utils.js
  autoRedactSuggestions,
  
  setRedactions,
  setUndoStack,
  setRedoStack,
  setStatus
} from "./Utils.js";

// ------------------------------------------------------------
// INTERNAL HELPERS
// ------------------------------------------------------------

// Ensure redactions are stored per page (map: { pageNumber: [ ... ] })
function ensurePageStructure() {
  if (!redactions || Array.isArray(redactions)) {
    const map = {};
    for (const r of redactions || []) {
      if (!map[r.page]) map[r.page] = [];
      map[r.page].push(r);
    }
    setRedactions(map);
  }
}

// Deep clone redactions map
function cloneRedactionsMap(map) {
  const out = {};
  for (const page in map) {
    out[page] = map[page].map(r => ({
      page: r.page,
      type: r.type,
      rects: r.rects.map(rect => ({ ...rect })),
      color: r.color
    }));
  }
  return out;
}

// ------------------------------------------------------------
// pushUndo()
// ------------------------------------------------------------
export function pushUndo() {
  ensurePageStructure();
  const snapshot = cloneRedactionsMap(redactions);
  const newUndo = [...undoStack, snapshot];
  setUndoStack(newUndo);
  setRedoStack([]);
}

// ------------------------------------------------------------
// restoreState(stackFrom, stackTo)
// ------------------------------------------------------------
export function restoreState(stackFrom, stackTo) {
  if (!stackFrom || stackFrom.length === 0) return;

  ensurePageStructure();

  const newStackFrom = [...stackFrom];
  const snapshot = newStackFrom.pop();

  const newStackTo = [...stackTo, cloneRedactionsMap(redactions)];

  setUndoStack(newStackFrom);
  setRedoStack(newStackTo);
  setRedactions(snapshot);

  renderAllPagesSafe();
}

// ------------------------------------------------------------
// drawRedactionsOnView(view)
// ------------------------------------------------------------
export function drawRedactionsOnView(view) {
  ensurePageStructure();

  const overlayCtx = view.overlay.getContext("2d");
  overlayCtx.clearRect(0, 0, view.overlay.width, view.overlay.height);

  const page = view.pageNumber;
  const pageRedactions = redactions[page] || [];

  for (const r of pageRedactions) {
    overlayCtx.fillStyle = r.color || "#000000";

    for (const rect of r.rects) {
      const x = rect.x0 * view.overlay.width;
      const y = rect.y0 * view.overlay.height;
      const w = (rect.x1 - rect.x0) * view.overlay.width;
      const h = (rect.y1 - rect.y0) * view.overlay.height;

      overlayCtx.fillRect(x, y, w, h);
    }
  }
}

// ------------------------------------------------------------
// Safe re-render (used by undo/redo)
// ------------------------------------------------------------
async function renderAllPagesSafe() {
  try {
    const { renderAllPages } = await import("./PDF_Loader.js");
    await renderAllPages();
  } catch (err) {
    console.error("Render error:", err);
    setStatus("Render failed.");
  }
}