// ------------------------------------------------------------
// Redaction_TextSelect.js — Text selection redaction (Stirling‑style)
// ------------------------------------------------------------

import {
  redactions,
  setRedactions,
  setStatus
} from "./Utils.js";

import { pushUndo } from "./Redaction_Core.js";
import { renderPageView } from "./PDF_Loader.js";

// ------------------------------------------------------------
// attachTextSelectionHandlers(textLayerDiv, view)
// ------------------------------------------------------------
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

  function getIntersectingTextRects(normRect) {
    const rects = [];

    const children = Array.from(textLayerDiv.children);
    for (const span of children) {
      const r = span.getBoundingClientRect();
      const parent = textLayerDiv.getBoundingClientRect();

      const x0 = r.left - parent.left;
      const y0 = r.top - parent.top;
      const x1 = x0 + r.width;
      const y1 = y0 + r.height;

      const nr = screenToNormalizedRect(x0, y0, x1, y1);
      if (!nr) continue;

      const intersects =
        nr.x1 >= normRect.x0 &&
        nr.x0 <= normRect.x1 &&
        nr.y1 >= normRect.y0 &&
        nr.y0 <= normRect.y1;

      if (intersects) rects.push(nr);
    }

    return rects;
  }

  function onMouseDown(e) {
    const { x, y } = getRelativeCoords(e);
    startX = x;
    startY = y;
    endX = x;
    endY = y;
    isSelecting = true;

    e.preventDefault();
    e.stopPropagation();
  }

  function onMouseMove(e) {
    if (!isSelecting) return;

    const { x, y } = getRelativeCoords(e);
    endX = x;
    endY = y;

    e.preventDefault();
    e.stopPropagation();
  }

  function onMouseUp(e) {
    if (!isSelecting) return;
    isSelecting = false;

    const { x, y } = getRelativeCoords(e);
    endX = x;
    endY = y;

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

    e.preventDefault();
    e.stopPropagation();
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
