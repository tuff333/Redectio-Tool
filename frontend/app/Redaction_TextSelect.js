// ------------------------------------------------------------
// Redaction_TextSelect.js — Smart text selection using textStore
// ------------------------------------------------------------

import {
  panMode,
  redactions,
  setRedactions
} from "./Utils.js";

import { textStore } from "./TextLayer.js";
import { normalizeRect } from "./Utils.js";
import { pushUndo } from "./Redaction_Core.js";
import { renderPageView } from "./PDF_Loader.js";

// ------------------------------------------------------------
// attachTextSelectionHandlers(view)
// ------------------------------------------------------------
export function attachTextSelectionHandlers(view) {
  const overlay = view.overlay;

  let selecting = false;
  let startX = 0;
  let startY = 0;
  let snapshot = null;

  // -----------------------------
  // Mousedown → start selection
  // -----------------------------
  overlay.addEventListener("mousedown", e => {
    if (panMode) return;

    const selectBtn = document.getElementById("btnModeSelectText");
    if (!selectBtn || !selectBtn.classList.contains("btn-toggle-active")) return;

    selecting = true;

    const rect = overlay.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;

    const ctx = overlay.getContext("2d");
    snapshot = ctx.getImageData(0, 0, overlay.width, overlay.height);

    e.preventDefault();
  });

  // -----------------------------
  // Mousemove → draw selection box
  // -----------------------------
  overlay.addEventListener("mousemove", e => {
    if (!selecting) return;

    const rect = overlay.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = overlay.getContext("2d");

    if (snapshot) ctx.putImageData(snapshot, 0, 0);

    ctx.save();
    ctx.strokeStyle = "rgba(0, 120, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 2]);
    ctx.strokeRect(startX, startY, x - startX, y - startY);
    ctx.restore();
  });

  // -----------------------------
  // Mouseup → finalize selection
  // -----------------------------
  overlay.addEventListener("mouseup", e => {
    if (!selecting) return;
    selecting = false;

    const rect = overlay.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;

    snapshot = null;

    // Ignore tiny clicks
    if (Math.abs(endX - startX) < 3 && Math.abs(endY - startY) < 3) {
      renderPageView(view);
      return;
    }

    const selX0 = Math.min(startX, endX) / overlay.width;
    const selY0 = Math.min(startY, endY) / overlay.height;
    const selX1 = Math.max(startX, endX) / overlay.width;
    const selY1 = Math.max(startY, endY) / overlay.height;

    const page = view.pageNumber;
    const items = textStore[page] || [];

    const selectedRects = [];

    // Find text items inside selection box
    for (const item of items) {
      if (
        item.x1 >= selX0 &&
        item.x0 <= selX1 &&
        item.y1 >= selY0 &&
        item.y0 <= selY1
      ) {
        selectedRects.push({
          x0: item.x0,
          y0: item.y0,
          x1: item.x1,
          y1: item.y1
        });
      }
    }

    if (selectedRects.length === 0) {
      renderPageView(view);
      return;
    }

    // Save redaction
    pushUndo();

    const newRedactions = structuredClone(redactions);
    if (!newRedactions[page]) newRedactions[page] = [];

    newRedactions[page].push({
      page,
      type: "text",
      rects: selectedRects,
      color: document.getElementById("redactionColor").value || "#000000"
    });

    setRedactions(newRedactions);
    renderPageView(view);
  });
}
