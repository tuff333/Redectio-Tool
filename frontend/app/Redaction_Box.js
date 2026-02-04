// ------------------------------------------------------------
// Redaction_Box.js — Box drawing redaction tool
// ------------------------------------------------------------

import {
  panMode,
  redactions,
  zoom,
  pageViews,

  setRedactions,
  setStatus
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

  let drawingBox = false;
  let boxStartX = 0;
  let boxStartY = 0;
  let boxSnapshot = null;

  // -----------------------------
  // Mousedown → start drawing box
  // -----------------------------
  overlay.addEventListener("mousedown", e => {
    if (panMode) return;

    const drawModeBtn = document.getElementById("btnModeDrawBox");
    if (!drawModeBtn || !drawModeBtn.classList.contains("btn-toggle-active")) return;

    drawingBox = true;

    const rect = overlay.getBoundingClientRect();
    boxStartX = e.clientX - rect.left;
    boxStartY = e.clientY - rect.top;

    const ctx = overlay.getContext("2d");
    boxSnapshot = ctx.getImageData(0, 0, overlay.width, overlay.height);
  });

  // -----------------------------
  // Mousemove → draw preview box
  // -----------------------------
  overlay.addEventListener("mousemove", e => {
    if (!drawingBox) return;

    const rect = overlay.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = overlay.getContext("2d");

    if (boxSnapshot) {
      ctx.putImageData(boxSnapshot, 0, 0);
    }

    ctx.save();
    ctx.strokeStyle = document.getElementById("redactionColor").value || "#000000";
    ctx.lineWidth = 2;
    ctx.strokeRect(boxStartX, boxStartY, x - boxStartX, y - boxStartY);
    ctx.restore();
  });

  // -----------------------------
  // Mouseup → finalize redaction
  // -----------------------------
  overlay.addEventListener("mouseup", e => {
    if (!drawingBox) return;
    drawingBox = false;

    const rect = overlay.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;

    const norm = normalizeRect(
      boxStartX,
      boxStartY,
      endX,
      endY,
      overlay.width,
      overlay.height
    );

    pushUndo();

    const newRedactions = [...redactions, {
      page: view.pageNumber,
      type: "box",
      rects: [norm],
      color: document.getElementById("redactionColor").value || "#000000"
    }];

    setRedactions(newRedactions);

    boxSnapshot = null;
    renderPageView(view);
  });
}