// ------------------------------------------------------------
// Redaction_Box.js — Box drawing on overlay canvas (Stirling‑style)
// ------------------------------------------------------------

import {
  redactions,
  setRedactions,
  setStatus
} from "./Utils.js";

import { pushUndo } from "./Redaction_Core.js";
import { renderPageView } from "./PDF_Loader.js";

// ------------------------------------------------------------
// attachBoxRedactionHandlers(overlay, view)
// ------------------------------------------------------------
export function attachBoxRedactionHandlers(overlay, view) {
  if (!overlay) return;

  let isDrawing = false;
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let currentY = 0;

  const ctx = overlay.getContext("2d");

  function clearOverlay() {
    ctx.clearRect(0, 0, overlay.width, overlay.height);
  }

  function drawPreviewRect() {
    clearOverlay();

    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const w = Math.abs(currentX - startX);
    const h = Math.abs(currentY - startY);

    if (w < 2 || h < 2) return;

    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255, 0, 0, 0.9)";
    ctx.fillStyle = "rgba(255, 0, 0, 0.15)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }

  function screenToNormalizedRect(x0, y0, x1, y1) {
    const { viewport } = view;
    if (!viewport) return null;

    const nx0 = x0 / overlay.width;
    const ny0 = y0 / overlay.height;
    const nx1 = x1 / overlay.width;
    const ny1 = y1 / overlay.height;

    return {
      x0: Math.min(nx0, nx1),
      y0: Math.min(ny0, ny1),
      x1: Math.max(nx0, nx1),
      y1: Math.max(ny0, ny1)
    };
  }

  function onMouseDown(e) {
    const rect = overlay.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    currentX = startX;
    currentY = startY;
    isDrawing = true;

    e.preventDefault();
    e.stopPropagation();
  }

  function onMouseMove(e) {
    if (!isDrawing) return;

    const rect = overlay.getBoundingClientRect();
    currentX = e.clientX - rect.left;
    currentY = e.clientY - rect.top;

    drawPreviewRect();

    e.preventDefault();
    e.stopPropagation();
  }

  function onMouseUp(e) {
    if (!isDrawing) return;
    isDrawing = false;

    const rect = overlay.getBoundingClientRect();
    currentX = e.clientX - rect.left;
    currentY = e.clientY - rect.top;

    const norm = screenToNormalizedRect(startX, startY, currentX, currentY);
    clearOverlay();

    if (!norm) return;

    const minSize = 0.002;
    if (
      Math.abs(norm.x1 - norm.x0) < minSize ||
      Math.abs(norm.y1 - norm.y0) < minSize
    ) {
      return;
    }

    pushUndo();

    const page = view.pageNumber;
    const newMap = structuredClone(redactions);
    if (!newMap[page]) newMap[page] = [];

    newMap[page].push({
      page,
      type: "box",
      rects: [norm],
      color: document.getElementById("redactionColor")?.value || "#000000"
    });

    setRedactions(newMap);
    setStatus(`Added box redaction on page ${page}.`);

    renderPageView(view);

    e.preventDefault();
    e.stopPropagation();
  }

  function onMouseLeave() {
    if (!isDrawing) return;
    isDrawing = false;
    clearOverlay();
  }

  overlay.addEventListener("mousedown", onMouseDown);
  overlay.addEventListener("mousemove", onMouseMove);
  overlay.addEventListener("mouseup", onMouseUp);
  overlay.addEventListener("mouseleave", onMouseLeave);
}
