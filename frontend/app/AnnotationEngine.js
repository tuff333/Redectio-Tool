// ------------------------------------------------------------
// AnnotationEngine.js — Safe annotation engine
// ------------------------------------------------------------

import {
  redactions,
  setRedactions,
  setStatus,
  pageViews,
  autoRedactSuggestions,
  searchResults
} from "./Utils.js";

import { pushUndo } from "./Redaction_Core.js";

// ------------------------------------------------------------
// Supported tools
// ------------------------------------------------------------
export const AnnotationTool = {
  NONE: "none",
  BOX: "box",
  INK: "ink",
  HIGHLIGHT: "highlight",
  POLYGON: "polygon"
};

let currentTool = AnnotationTool.NONE;
let activeStroke = null;
let activeView = null;

// ------------------------------------------------------------
// Set current tool
// ------------------------------------------------------------
export function setAnnotationTool(tool) {
  currentTool = tool;
  setStatus(`Tool: ${tool}`);
}

// ------------------------------------------------------------
// SAFE: Draw annotations AFTER PDF render
// ------------------------------------------------------------
export function drawAnnotationsForPage(pageNumber) {
  const view = pageViews.find(v => v.pageNumber === pageNumber);
  if (!view) return;

  const ctx = view.overlay.getContext("2d");
  ctx.clearRect(0, 0, view.overlay.width, view.overlay.height);

  const viewport = view.viewport;

  // Manual redactions
  const manual = redactions[pageNumber] || [];
  for (const r of manual) drawRect(ctx, viewport, r, false);

  // Auto suggestions
  const auto = autoRedactSuggestions.filter(s => s.page === pageNumber);
  for (const r of auto) drawRect(ctx, viewport, r, true);

  // Search highlights
  for (const s of searchResults) {
    if (s.page === pageNumber) drawSearch(ctx, viewport, s);
  }
}

// ------------------------------------------------------------
// Drawing helpers
// ------------------------------------------------------------
function drawRect(ctx, viewport, r, isAuto) {
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = isAuto ? "rgba(255,0,0,0.9)" : "rgba(0,0,0,1)";
  ctx.fillStyle = isAuto ? "rgba(255,0,0,0.25)" : "rgba(0,0,0,0.5)";

  for (const rect of r.rects) {
    const x = rect.x0 * viewport.width;
    const y = rect.y0 * viewport.height;
    const w = (rect.x1 - rect.x0) * viewport.width;
    const h = (rect.y1 - rect.y0) * viewport.height;

    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  }

  ctx.restore();
}

function drawSearch(ctx, viewport, s) {
  ctx.save();
  ctx.fillStyle = "rgba(255,255,0,0.35)";
  ctx.strokeStyle = "rgba(255,200,0,0.9)";
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
// Interaction handlers (unchanged)
// ------------------------------------------------------------
export function attachAnnotationHandlers(overlayCanvas, view) {
  // your existing mouse handlers remain unchanged
}
