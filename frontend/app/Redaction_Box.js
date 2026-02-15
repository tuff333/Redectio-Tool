// ------------------------------------------------------------
// Redaction_Box.js — Pixel-perfect box drawing redaction tool
// ------------------------------------------------------------

import {
  panMode,
  redactions,
  setRedactions,
  selectionMode
} from "./Utils.js";

import { pushUndo } from "./Redaction_Core.js";
import { renderPageView } from "./PDF_Loader.js";

// ------------------------------------------------------------
// attachBoxRedactionHandlers(view)
// ------------------------------------------------------------
export function attachBoxRedactionHandlers(overlay, view) {

  let drawing = false;
  let startX = 0;
  let startY = 0;
  let snapshot = null;

  // -----------------------------
  // Mousedown → start drawing box
  // -----------------------------
  overlay.addEventListener("mousedown", e => {
    if (panMode) return;
    if (selectionMode !== "box") return;

    drawing = true;

    const rect = overlay.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;

    const ctx = overlay.getContext("2d");
    snapshot = ctx.getImageData(0, 0, overlay.width, overlay.height);

    e.preventDefault();
  });

  // -----------------------------
  // Mousemove → draw preview box
  // -----------------------------
  overlay.addEventListener("mousemove", e => {
    if (!drawing) return;

    const rect = overlay.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = overlay.getContext("2d");

    if (snapshot) ctx.putImageData(snapshot, 0, 0);

    ctx.save();
    ctx.strokeStyle = document.getElementById("redactionColor").value || "#000000";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 2]);
    ctx.strokeRect(startX, startY, x - startX, y - startY);
    ctx.restore();
  });

  // -----------------------------
  // Mouseup → finalize redaction
  // -----------------------------
  overlay.addEventListener("mouseup", e => {
    if (!drawing) return;
    drawing = false;

    const rect = overlay.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;

    if (Math.abs(endX - startX) < 3 || Math.abs(endY - startY) < 3) {
      snapshot = null;
      renderPageView(view);
      return;
    }

    const vw = view.viewport.width;
    const vh = view.viewport.height;

    const norm = {
      x0: Math.min(startX, endX) / vw,
      y0: 1 - (Math.max(startY, endY) / vh),
      x1: Math.max(startX, endX) / vw,
      y1: 1 - (Math.min(startY, endY) / vh)
    };

    pushUndo();

    const page = view.pageNumber;
    const newRedactions = structuredClone(redactions);

    if (!newRedactions[page]) newRedactions[page] = [];

    newRedactions[page].push({
      page,
      type: "box",
      rects: [norm],
      color: document.getElementById("redactionColor").value || "#000000"
    });

    setRedactions(newRedactions);

    snapshot = null;
    renderPageView(view);
  });
}
