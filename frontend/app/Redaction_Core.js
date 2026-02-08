// ------------------------------------------------------------
// Redaction_Core.js — Unified Stirling‑style overlay renderer
// ------------------------------------------------------------

import {
  redactions,
  autoRedactions,
  searchResults,
  reviewMode,
  showOnlyAuto
} from "./Utils.js";

// ------------------------------------------------------------
// Undo/Redo
// ------------------------------------------------------------
export const undoStack = [];
export const redoStack = [];

export function pushUndo() {
  undoStack.push(structuredClone(redactions));
  redoStack.length = 0;
}

export function restoreState(fromStack, toStack) {
  if (!fromStack.length) return;
  toStack.push(structuredClone(redactions));

  const prev = fromStack.pop();
  window.__setRedactions(prev);

  document.dispatchEvent(new CustomEvent("pages-rendered"));
}

// ------------------------------------------------------------
// drawRedactionsOnView(view)
// ------------------------------------------------------------
export function drawRedactionsOnView(view) {
  const ctx = view.overlay.getContext("2d");
  ctx.clearRect(0, 0, view.overlay.width, view.overlay.height);

  const page = view.pageNumber;

  // 1. Manual redactions
  const manual = redactions[page] || [];
  for (const r of manual) {
    if (reviewMode && showOnlyAuto) continue;
    drawRedaction(ctx, view, r);
  }

  // 2. Auto redactions (preview)
  const auto = autoRedactions[page] || [];
  for (const r of auto) {
    if (reviewMode && !showOnlyAuto) continue;
    drawRedaction(ctx, view, r, true);
  }

  // 3. Search highlights
  for (const s of searchResults) {
    if (s.page === page) drawSearchHighlight(ctx, view, s);
  }
}

// ------------------------------------------------------------
// drawRedaction(ctx, view, r, isAuto = false)
// ------------------------------------------------------------
function drawRedaction(ctx, view, r, isAuto = false) {
  const { viewport } = view;

  ctx.save();

  const color = r.color || "#000000";
  const fill = hexToRGBA(color, isAuto ? 0.25 : 0.5);
  const stroke = hexToRGBA(color, isAuto ? 0.9 : 1.0);

  if (r.type === "box" || r.type === "text" || r.type === "search" || r.type === "auto") {
    for (const rect of r.rects) {
      const { x0, y0, x1, y1 } = rect;

      const x = x0 * viewport.width;
      const y = y0 * viewport.height;
      const w = (x1 - x0) * viewport.width;
      const h = (y1 - y0) * viewport.height;

      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;

      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    }
  }

  if (r.type === "ink" || r.type === "polygon") {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 3;

    ctx.beginPath();
    const pts = r.points || [];
    if (pts.length > 0) {
      const p0 = pts[0];
      ctx.moveTo(p0.x * viewport.width, p0.y * viewport.height);
      for (const p of pts) {
        ctx.lineTo(p.x * viewport.width, p.y * viewport.height);
      }
    }
    ctx.stroke();
  }

  ctx.restore();
}

// ------------------------------------------------------------
// drawSearchHighlight(ctx, view, s)
// ------------------------------------------------------------
function drawSearchHighlight(ctx, view, s) {
  const { viewport } = view;

  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 0, 0.35)";
  ctx.strokeStyle = "rgba(255, 200, 0, 0.9)";
  ctx.lineWidth = 2;

  for (const rect of s.rects) {
    const x = rect.x0 * viewport.width;
    const y = rect.y0 * viewport.height;
    const w = (rect.x1 - rect.x0) * viewport.width;
    const h = (rect.y1 - rect.y0) * viewport.height;

    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  }

  ctx.restore();
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function hexToRGBA(hex, alpha) {
  hex = hex.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
