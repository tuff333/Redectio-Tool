// ------------------------------------------------------------
// AnnotationEngine.js — Stirling‑style annotation engine
// ------------------------------------------------------------

import {
  redactions,
  setRedactions,
  setStatus
} from "./Utils.js";

import { pushUndo } from "./Redaction_Core.js";
import { renderPageView } from "./PDF_Loader.js";

// ------------------------------------------------------------
// Supported tools
// ------------------------------------------------------------
export const AnnotationTool = {
  NONE: "none",
  BOX: "box",
  INK: "ink",
  HIGHLIGHT: "highlight",
  POLYGON: "polygon"
};

// ------------------------------------------------------------
// Engine state
// ------------------------------------------------------------
let currentTool = AnnotationTool.NONE;
let activeStroke = null; // for ink / polygon
let activeView = null;

// ------------------------------------------------------------
// Set current tool
// ------------------------------------------------------------
export function setAnnotationTool(tool) {
  currentTool = tool;
  setStatus(`Tool: ${tool}`);
}

// ------------------------------------------------------------
// Attach handlers to overlay canvas
// ------------------------------------------------------------
export function attachAnnotationHandlers(overlayCanvas, view) {
  if (!overlayCanvas) return;

  const ctx = overlayCanvas.getContext("2d");

  function clearOverlay() {
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  }

  function screenToNorm(x, y) {
    const { viewport } = view;
    return {
      x: x / viewport.width,
      y: y / viewport.height
    };
  }

  function onMouseDown(e) {
    if (currentTool === AnnotationTool.NONE) return;

    const rect = overlayCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    activeView = view;

    if (currentTool === AnnotationTool.INK) {
      activeStroke = [{ x, y }];
    }

    if (currentTool === AnnotationTool.POLYGON) {
      if (!activeStroke) activeStroke = [];
      activeStroke.push({ x, y });
    }

    e.preventDefault();
    e.stopPropagation();
  }

  function onMouseMove(e) {
    if (!activeStroke) return;

    const rect = overlayCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (currentTool === AnnotationTool.INK) {
      activeStroke.push({ x, y });

      clearOverlay();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255,0,0,0.9)";
      ctx.beginPath();
      ctx.moveTo(activeStroke[0].x, activeStroke[0].y);
      for (const p of activeStroke) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    e.preventDefault();
    e.stopPropagation();
  }

  function onMouseUp(e) {
    if (!activeStroke) return;

    const page = activeView.pageNumber;
    const newMap = structuredClone(redactions);
    if (!newMap[page]) newMap[page] = [];

    // Convert stroke to normalized polygon
    const rects = activeStroke.map(p => screenToNorm(p.x, p.y));

    pushUndo();

    newMap[page].push({
      page,
      type: currentTool,
      points: rects,
      color: document.getElementById("redactionColor")?.value || "#000000"
    });

    setRedactions(newMap);
    setStatus(`Added ${currentTool} annotation on page ${page}.`);

    activeStroke = null;
    clearOverlay();
    renderPageView(activeView);

    e.preventDefault();
    e.stopPropagation();
  }

  function onMouseLeave() {
    if (currentTool === AnnotationTool.INK && activeStroke) {
      activeStroke = null;
      clearOverlay();
    }
  }

  overlayCanvas.addEventListener("mousedown", onMouseDown);
  overlayCanvas.addEventListener("mousemove", onMouseMove);
  overlayCanvas.addEventListener("mouseup", onMouseUp);
  overlayCanvas.addEventListener("mouseleave", onMouseLeave);
}
