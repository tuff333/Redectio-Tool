// ------------------------------------------------------------
// Redaction_Box.js — Pixel-perfect box drawing redaction tool
// ------------------------------------------------------------

import {
  panMode,
  redactions,
  setRedactions
} from "./Utils.js";

import { normalizeRect } from "./Utils.js";
import { pushUndo } from "./Redaction_Core.js";
import { renderPageView } from "./PDF_Loader.js";

// ------------------------------------------------------------
// attachBoxRedactionHandlers(view)
// ------------------------------------------------------------
// This attaches the box‑drawing mouse handlers to each page overlay.
// Called from Events.js after pageViews are created.
// ------------------------------------------------------------

export function attachBoxRedactionHandlers(view) {
  const overlay = view.overlay;

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
  // -----------------------------
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

    // Normalize to PDF coordinates
    const norm = normalizeRect(
      startX,
      startY,
      endX,
      endY,
      overlay.width,
      overlay.height
    );

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
