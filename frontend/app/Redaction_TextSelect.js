// ------------------------------------------------------------
// Redaction_TextSelect.js — Text selection redaction tool
// ------------------------------------------------------------

import {
  panMode,
  redactions,
  pageViews,

  setRedactions
} from "./Utils.js";

import { normalizeRect } from "./Utils.js";
import { pushUndo } from "./Redaction_Core.js";
import { renderPageView } from "./PDF_Loader.js";

// ------------------------------------------------------------
// attachTextSelectionHandlers(view)
// ------------------------------------------------------------
// This attaches the text-selection redaction handlers to each page.
// Called from Events.js after pageViews are created.
// ------------------------------------------------------------

export function attachTextSelectionHandlers(view) {
  const overlay = view.overlay;
  const textLayer = view.textLayer;

  let selectingText = false;
  let selStartX = 0;
  let selStartY = 0;
  let selEndX = 0;
  let selEndY = 0;
  let textSelSnapshot = null;

  // Enable/disable pointer events depending on mode
  function updateTextLayerPointerEvents() {
    const selectBtn = document.getElementById("btnModeSelectText");
    if (selectBtn && selectBtn.classList.contains("btn-toggle-active")) {
      textLayer.style.pointerEvents = "auto";
    } else {
      textLayer.style.pointerEvents = "none";
    }
  }

  updateTextLayerPointerEvents();

  document.getElementById("btnModeSelectText")
    ?.addEventListener("click", updateTextLayerPointerEvents);

  document.getElementById("btnModeDrawBox")
    ?.addEventListener("click", updateTextLayerPointerEvents);

  // -----------------------------
  // Mousedown → start selection
  // -----------------------------
  textLayer.addEventListener("mousedown", e => {
    if (panMode) return;

    const selectBtn = document.getElementById("btnModeSelectText");
    if (!selectBtn || !selectBtn.classList.contains("btn-toggle-active")) return;

    selectingText = true;

    const rect = overlay.getBoundingClientRect();
    selStartX = e.clientX - rect.left;
    selStartY = e.clientY - rect.top;
    selEndX = selStartX;
    selEndY = selStartY;

    const ctx = overlay.getContext("2d");
    textSelSnapshot = ctx.getImageData(0, 0, overlay.width, overlay.height);

    e.preventDefault();
  });

  // -----------------------------
  // Mousemove → draw selection box
  // -----------------------------
  textLayer.addEventListener("mousemove", e => {
    if (!selectingText) return;

    const rect = overlay.getBoundingClientRect();
    selEndX = e.clientX - rect.left;
    selEndY = e.clientY - rect.top;

    const ctx = overlay.getContext("2d");
    if (textSelSnapshot) ctx.putImageData(textSelSnapshot, 0, 0);

    ctx.save();
    ctx.strokeStyle = "rgba(255, 215, 0, 0.9)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 2]);
    ctx.strokeRect(
      Math.min(selStartX, selEndX),
      Math.min(selStartY, selEndY),
      Math.abs(selEndX - selStartX),
      Math.abs(selEndY - selStartY)
    );
    ctx.restore();
  });

  // -----------------------------
  // Mouseup → finalize selection
  // -----------------------------
  textLayer.addEventListener("mouseup", e => {
    if (!selectingText) return;
    selectingText = false;

    const rect = overlay.getBoundingClientRect();
    selEndX = e.clientX - rect.left;
    selEndY = e.clientY - rect.top;

    const x0 = Math.min(selStartX, selEndX);
    const y0 = Math.min(selStartY, selEndY);
    const x1 = Math.max(selStartX, selEndX);
    const y1 = Math.max(selStartY, selEndY);

    // Find intersecting text spans
    const spans = Array.from(textLayer.querySelectorAll("span"));
    const selectedSpans = spans.filter(span => {
      const r = span.getBoundingClientRect();
      const o = overlay.getBoundingClientRect();

      const sx0 = r.left - o.left;
      const sy0 = r.top - o.top;
      const sx1 = r.right - o.left;
      const sy1 = r.bottom - o.top;

      return (
        sx1 > x0 &&
        sx0 < x1 &&
        sy1 > y0 &&
        sy0 < y1
      );
    });

    if (selectedSpans.length === 0) {
      textSelSnapshot = null;
      renderPageView(view);
      return;
    }

    // Compute union bounding box
    let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

    const o = overlay.getBoundingClientRect();

    selectedSpans.forEach(span => {
      const r = span.getBoundingClientRect();
      const sx0 = r.left - o.left;
      const sy0 = r.top - o.top;
      const sx1 = r.right - o.left;
      const sy1 = r.bottom - o.top;

      minX = Math.min(minX, sx0);
      minY = Math.min(minY, sy0);
      maxX = Math.max(maxX, sx1);
      maxY = Math.max(maxY, sy1);
    });

    // Normalize to PDF coordinates
    const norm = normalizeRect(
      minX,
      minY,
      maxX,
      maxY,
      overlay.width,
      overlay.height
    );

    // Draw preview
    const ctx = overlay.getContext("2d");
    if (textSelSnapshot) ctx.putImageData(textSelSnapshot, 0, 0);

    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 0, 0.4)";
    ctx.fillRect(
      norm.x0 * overlay.width,
      norm.y0 * overlay.height,
      (norm.x1 - norm.x0) * overlay.width,
      (norm.y1 - norm.y0) * overlay.height
    );
    ctx.restore();

    textSelSnapshot = null;

    // Save redaction
    pushUndo();

    const newRedactions = [...redactions, {
      page: view.pageNumber,
      type: "text",
      rects: [norm],
      color: document.getElementById("redactionColor").value || "#000000"
    }];

    setRedactions(newRedactions);

    renderPageView(view);
  });
}