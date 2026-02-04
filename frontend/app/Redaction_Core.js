// ------------------------------------------------------------
// Redaction_Core.js — Core redaction engine (undo/redo + drawing)
// ------------------------------------------------------------

import {
  redactions,
  undoStack,
  redoStack,
  pageViews,

  setRedactions,
  setUndoStack,
  setRedoStack,

  setStatus
} from "./Utils.js";

// ------------------------------------------------------------
// pushUndo()
// ------------------------------------------------------------
export function pushUndo() {
  const newUndo = [...undoStack, JSON.stringify(redactions)];
  setUndoStack(newUndo);
  setRedoStack([]); // clear redo stack
}

// ------------------------------------------------------------
// restoreState(stackFrom, stackTo)
// ------------------------------------------------------------
export function restoreState(stackFrom, stackTo) {
  if (stackFrom.length === 0) return;

  const newStackFrom = [...stackFrom];
  const newStackTo = [...stackTo, JSON.stringify(redactions)];

  const state = JSON.parse(newStackFrom.pop());

  setRedactions(state);
  setUndoStack(newStackFrom);
  setRedoStack(newStackTo);

  renderAllPagesSafe();
}

// ------------------------------------------------------------
// drawRedactionsOnView(view)
// ------------------------------------------------------------
export function drawRedactionsOnView(view) {
  const overlayCtx = view.overlay.getContext("2d");
  overlayCtx.clearRect(0, 0, view.overlay.width, view.overlay.height);

  const pageRedactions = redactions.filter(r => r.page === view.pageNumber);

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
