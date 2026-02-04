// ------------------------------------------------------------
// Review_Mode.js — Review Mode + Show-Only-Auto Mode
// ------------------------------------------------------------

import {
  pageViews,
  redactions,
  autoRedactSuggestions,
  highlightMode,

  setStatus
} from "./Utils.js";

import { renderAllPages } from "./PDF_Loader.js";

// ------------------------------------------------------------
// Mode State
// ------------------------------------------------------------
let reviewMode = false;
let showOnlyAuto = false;

// ------------------------------------------------------------
// toggleReviewMode()
// ------------------------------------------------------------
export function toggleReviewMode() {
  reviewMode = !reviewMode;
  renderAllPages();
  return reviewMode;
}

// ------------------------------------------------------------
// toggleShowOnlyAuto()
// ------------------------------------------------------------
export function toggleShowOnlyAuto() {
  showOnlyAuto = !showOnlyAuto;
  renderAllPages();
  return showOnlyAuto;
}

// ------------------------------------------------------------
// applyReviewFilters(view)
// ------------------------------------------------------------
// Called at the END of renderPageView() to dim or hide layers
// ------------------------------------------------------------
export function applyReviewFilters(view) {
  const { canvas, overlay, textLayer } = view;

  // Reset
  canvas.style.filter = "";
  textLayer.style.opacity = "1";
  overlay.style.opacity = "1";

  // -----------------------------
  // Review Mode
  // -----------------------------
  if (reviewMode) {
    // Dim everything except overlays
    canvas.style.filter = "brightness(40%)";
    textLayer.style.opacity = "0.25";
    overlay.style.opacity = "1";
  }

  // -----------------------------
  // Show Only Auto Suggestions
  // -----------------------------
  if (showOnlyAuto) {
    // Dim canvas + text layer
    canvas.style.filter = "brightness(30%)";
    textLayer.style.opacity = "0.15";
  }
}

// ------------------------------------------------------------
// shouldDrawManualRedactions()
// ------------------------------------------------------------
export function shouldDrawManualRedactions() {
  return !showOnlyAuto;
}

// ------------------------------------------------------------
// shouldDrawSearchHighlights()
// ------------------------------------------------------------
export function shouldDrawSearchHighlights() {
  return !showOnlyAuto && highlightMode;
}