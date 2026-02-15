// ------------------------------------------------------------
// Redaction_TextSelect.js — Stirling‑PDF style + Smart Selection (S1)
// ------------------------------------------------------------

import {
  redactions,
  setRedactions,
  setStatus,
  selectionMode
} from "./Utils.js";

import { pushUndo } from "./Redaction_Core.js";
import { renderPageView } from "./PDF_Loader.js";
import { textStore } from "./TextLayer.js";

let tempSelectionRect = null;

export function attachTextSelectionHandlers(textLayerDiv, view) {
  if (!textLayerDiv) return;

  let isSelecting = false;
  let startX = 0;
  let startY = 0;
  let endX = 0;
  let endY = 0;

  function getRelativeCoords(e) {
    const rect = textLayerDiv.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  function screenToNormalizedRect(x0, y0, x1, y1) {
    const { viewport } = view;
    if (!viewport) return null;

    const w = viewport.width;
    const h = viewport.height;

    return {
      x0: Math.min(x0, x1) / w,
      y0: Math.min(y0, y1) / h,
      x1: Math.max(x0, x1) / w,
      y1: Math.max(y0, y1) / h
    };
  }

  // ------------------------------------------------------------
  // Smart Selection (S1 Strict) — row + column cluster locking
  // ------------------------------------------------------------
  function getIntersectingTextRects(normRect) {
    const chars = textStore[view.pageNumber]?.charMap;
    if (!chars) return [];

    // Step 1: find all intersecting characters
    const selected = chars.filter(ch =>
      ch.x1 >= normRect.x0 &&
      ch.x0 <= normRect.x1 &&
      ch.y1 >= normRect.y0 &&
      ch.y0 <= normRect.y1
    );

    if (!selected.length) return [];

    // Step 2: compute vertical center band
    const yCenters = selected.map(ch => (ch.y0 + ch.y1) / 2);
    const avgY = yCenters.reduce((a, b) => a + b, 0) / yCenters.length;
    const rowBand = 0.02; // 2% of page height

    // Step 3: filter to same row
    const rowLocked = selected.filter(ch => {
      const cy = (ch.y0 + ch.y1) / 2;
      return Math.abs(cy - avgY) <= rowBand;
    });

    if (!rowLocked.length) return [];

    // Step 4: compute horizontal cluster
    const xCenters = rowLocked.map(ch => (ch.x0 + ch.x1) / 2);
    const avgX = xCenters.reduce((a, b) => a + b, 0) / xCenters.length;
    const avgWidth = rowLocked.reduce((sum, ch) => sum + (ch.x1 - ch.x0), 0) / rowLocked.length;
    const clusterWidth = avgWidth * 1.5;

    // Step 5: filter to column cluster
    const finalChars = rowLocked.filter(ch => {
      const cx = (ch.x0 + ch.x1) / 2;
      return Math.abs(cx - avgX) <= clusterWidth;
    });

    if (!finalChars.length) return [];

    // Step 6: compute bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const ch of finalChars) {
      minX = Math.min(minX, ch.x0);
      minY = Math.min(minY, ch.y0);
      maxX = Math.max(maxX, ch.x1);
      maxY = Math.max(maxY, ch.y1);
    }

    return [{ x0: minX, y0: minY, x1: maxX, y1: maxY }];
  }

  function onMouseDown(e) {
    if (selectionMode !== "text") return;
    window.getSelection()?.removeAllRanges();

    const { x, y } = getRelativeCoords(e);
    startX = x;
    startY = y;
    endX = x;
    endY = y;
    isSelecting = true;
  }

  function onMouseMove(e) {
    if (!isSelecting) return;

    const { x, y } = getRelativeCoords(e);
    endX = x;
    endY = y;

    const ctx = view.overlay.getContext("2d");
    ctx.clearRect(0, 0, view.overlay.width, view.overlay.height);

    const x0 = Math.min(startX, endX);
    const y0 = Math.min(startY, endY);
    const w = Math.abs(endX - startX);
    const h = Math.abs(endY - startY);

    ctx.fillStyle = "rgba(255, 255, 0, 0.45)";
    ctx.fillRect(x0, y0, w, h);

    ctx.strokeStyle = "rgba(0, 150, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x0, y0, w, h);

    tempSelectionRect = { x0, y0, x1: x0 + w, y1: y0 + h };
  }

  function onMouseUp(e) {
    if (!isSelecting) return;
    isSelecting = false;

    const { x, y } = getRelativeCoords(e);
    endX = x;
    endY = y;

    const ctx = view.overlay.getContext("2d");
    ctx.clearRect(0, 0, view.overlay.width, view.overlay.height);
    tempSelectionRect = null;

    const norm = screenToNormalizedRect(startX, startY, endX, endY);
    if (!norm) return;

    const rects = getIntersectingTextRects(norm);
    if (!rects.length) return;

    pushUndo();

    const page = view.pageNumber;
    const newMap = structuredClone(redactions);
    if (!newMap[page]) newMap[page] = [];

    newMap[page].push({
      page,
      type: "text",
      rects,
      color: document.getElementById("redactionColor")?.value || "#000000"
    });

    setRedactions(newMap);
    setStatus(`Added text redaction on page ${page}.`);

    renderPageView(view);
  }

  function onMouseLeave() {
    if (!isSelecting) return;
    isSelecting = false;
  }

  textLayerDiv.addEventListener("mousedown", onMouseDown);
  textLayerDiv.addEventListener("mousemove", onMouseMove);
  textLayerDiv.addEventListener("mouseup", onMouseUp);
  textLayerDiv.addEventListener("mouseleave", onMouseLeave);
}
