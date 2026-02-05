// ------------------------------------------------------------
// Review_Mode.js — Professional review workflow
// ------------------------------------------------------------

import {
  reviewMode,
  showOnlyAuto,
  redactions,
  autoRedactSuggestions,

  setReviewMode,
  setShowOnlyAuto
} from "./Utils.js";

import { renderAllPages } from "./PDF_Loader.js";

// ------------------------------------------------------------
// toggleReviewMode()
// ------------------------------------------------------------
export function toggleReviewMode() {
  const newMode = !reviewMode;
  setReviewMode(newMode);

  const btn = document.getElementById("btnReviewMode");
  if (btn) btn.classList.toggle("btn-toggle-active", newMode);

  renderAllPages();
}

// ------------------------------------------------------------
// toggleShowOnlyAuto()
// ------------------------------------------------------------
export function toggleShowOnlyAuto() {
  const newState = !showOnlyAuto;
  setShowOnlyAuto(newState);

  const btn = document.getElementById("btnShowOnlyAuto");
  if (btn) btn.classList.toggle("btn-toggle-active", newState);

  renderAllPages();
}

// ------------------------------------------------------------
// drawReviewOverlay(view)
// ------------------------------------------------------------
// Called from PDF_Loader.js AFTER redactions + auto-redactions + search
// ------------------------------------------------------------
export function drawReviewOverlay(view) {
  const ctx = view.overlay.getContext("2d");

  // REVIEW MODE OFF → nothing to do
  if (!reviewMode) return;

  ctx.save();

  // Dim entire page slightly
  ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
  ctx.fillRect(0, 0, view.overlay.width, view.overlay.height);

  // If "show only auto" is enabled → hide manual redactions
  if (showOnlyAuto) {
    drawAutoOnly(view, ctx);
  }

  ctx.restore();
}

// ------------------------------------------------------------
// drawAutoOnly(view)
// ------------------------------------------------------------
function drawAutoOnly(view, ctx) {
  const page = view.pageNumber;

  // Hide manual redactions by clearing them
  const manual = (redactions[page] || []).filter(r => r.type !== "auto");
  for (const r of manual) {
    for (const rect of r.rects) {
      const x = rect.x0 * view.overlay.width;
      const y = rect.y0 * view.overlay.height;
      const w = (rect.x1 - rect.x0) * view.overlay.width;
      const h = (rect.y1 - rect.y0) * view.overlay.height;

      ctx.clearRect(x, y, w, h);
    }
  }

  // Re-draw auto-redactions in bright orange
  const autos = autoRedactSuggestions.filter(s => s.page === page);
  ctx.strokeStyle = "rgba(255, 140, 0, 1)";
  ctx.fillStyle = "rgba(255, 140, 0, 0.25)";
  ctx.lineWidth = 2;

  for (const s of autos) {
    for (const rect of s.rects) {
      const x = rect.x0 * view.overlay.width;
      const y = rect.y0 * view.overlay.height;
      const w = (rect.x1 - rect.x0) * view.overlay.width;
      const h = (rect.y1 - rect.y0) * view.overlay.height;

      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    }
  }
}
