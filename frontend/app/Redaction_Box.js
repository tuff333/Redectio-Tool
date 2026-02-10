// ------------------------------------------------------------
// Redaction_Box.js — Pixel-perfect box drawing redaction tool
// FIXED: Normalization uses viewport (correct source of truth)
// ------------------------------------------------------------

import {
  panMode,
  redactions,
  setRedactions
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

    const drawModeBtn = document.getElementById("btnModeDrawBox");
    if (!drawModeBtn || !drawModeBtn.classList.contains("btn-toggle-active")) return;

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

    // Restore snapshot
    if (snapshot) ctx.putImageData(snapshot, 0, 0);

    // Draw preview
    ctx.save();
    ctx.strokeStyle = document.getElementById("redactionColor").value || "#000000";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 2]);
    ctx.strokeRect(startX, startY, x - startX, y - startY);
    ctx.restore();
  });

  // -----------------------------
  // Mouseup → finalize redaction
  // FIXED: Normalize using viewport (not overlay)
// ------------------------------------------------------------
  overlay.addEventListener("mouseup", e => {
    if (!drawing) return;
    drawing = false;

    const rect = overlay.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;

    // Ignore tiny accidental clicks
    if (Math.abs(endX - startX) < 3 || Math.abs(endY - startY) < 3) {
      snapshot = null;
      renderPageView(view);
      return;
    }

    // ------------------------------------------------------------
    // FIXED NORMALIZATION
    // Use viewport.width / viewport.height (correct scaling)
    // ------------------------------------------------------------
    const vw = view.viewport.width;
    const vh = view.viewport.height;

    const normX0 = Math.min(startX, endX) / vw;
    const normX1 = Math.max(startX, endX) / vw;

    // PDF y=0 bottom → invert Y
    const normY0 = 1 - (Math.max(startY, endY) / vh);
    const normY1 = 1 - (Math.min(startY, endY) / vh);

    const norm = {
      x0: normX0,
      y0: normY0,
      x1: normX1,
      y1: normY1
    };

    console.log("[Redaction_Box] Box drawn:", {
      screen: { startX, startY, endX, endY },
      normalized: norm
    });

    // Save redaction
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
