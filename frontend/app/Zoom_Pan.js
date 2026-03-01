// ------------------------------------------------------------
// Zoom_Pan.js — Correct zoom + pan with overlay redraw
// FIXED: Applies viewport.scale to all coordinate math
// ------------------------------------------------------------

import {
  zoom,
  panMode,
  pageViews,
  numPages,
  currentPageVisible,
  setZoom,
  setPanMode,
  setCurrentPageVisible
} from "./Utils.js";

import { renderAllPages } from "./PDF_Loader.js";
import { drawRedactionsOnView } from "./Redaction_Core.js";
import { drawSearchHighlightsOnView } from "./Search.js";
import { drawAutoRedactPreviewOnView } from "./Redaction_Auto.js";

// DOM
const btnZoomIn = document.getElementById("btnZoomIn");
const btnZoomOut = document.getElementById("btnZoomOut");
const btnPanMode = document.getElementById("btnPanMode");
const zoomInfo = document.getElementById("zoomInfo");
const pageInfo = document.getElementById("pageInfo");
const pdfScrollContainer = document.querySelector(".pdf-scroll-container");

// Zoom limits
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4.0;
const ZOOM_STEP = 1.1;

// ------------------------------------------------------------
// initZoomControls()
// ------------------------------------------------------------
export function initZoomControls() {
  btnZoomIn?.addEventListener("click", () => applyZoom(ZOOM_STEP));
  btnZoomOut?.addEventListener("click", () => applyZoom(1 / ZOOM_STEP));

  btnPanMode?.addEventListener("click", () => {
    const newPan = !panMode;
    setPanMode(newPan);
    btnPanMode.classList.toggle("btn-toggle-active", newPan);
    pdfScrollContainer.style.cursor = newPan ? "grab" : "default";
  });

  initPanHandlers();
  initScrollTracking();
}

// ------------------------------------------------------------
// applyZoom()
// FIXED: Re-renders overlays using viewport.scale
// ------------------------------------------------------------
async function applyZoom(multiplier) {
  const oldZoom = zoom;
  let newZoom = oldZoom * multiplier;

  newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
  setZoom(newZoom);

  zoomInfo.textContent = `${Math.round(newZoom * 100)}%`;

  // Preserve scroll center
  const rect = pdfScrollContainer.getBoundingClientRect();
  const centerY = pdfScrollContainer.scrollTop + rect.height / 2;
  const scaleFactor = newZoom / oldZoom;
  const newScrollTop = centerY * scaleFactor - rect.height / 2;

  // Re-render PDF pages at new scale
  await renderAllPages();

  // Re-draw overlays at new scale
  redrawAllOverlays();

  pdfScrollContainer.scrollTop = newScrollTop;
}

// ------------------------------------------------------------
// Redraw overlays after zoom
// ------------------------------------------------------------
function redrawAllOverlays() {
  for (const view of pageViews) {
    const ctx = view.overlay.getContext("2d");
    ctx.clearRect(0, 0, view.overlay.width, view.overlay.height);

    drawRedactionsOnView(view);
    drawSearchHighlightsOnView(view);
    drawAutoRedactPreviewOnView(view);
  }
}

// ------------------------------------------------------------
// Pan Mode
// ------------------------------------------------------------
function initPanHandlers() {
  let isPanning = false;
  let startX = 0;
  let startY = 0;
  let scrollStartX = 0;
  let scrollStartY = 0;

  pdfScrollContainer.addEventListener("mousedown", e => {
    if (!panMode) return;

    isPanning = true;
    startX = e.clientX;
    startY = e.clientY;
    scrollStartX = pdfScrollContainer.scrollLeft;
    scrollStartY = pdfScrollContainer.scrollTop;

    pdfScrollContainer.style.cursor = "grabbing";
    e.preventDefault();
  });

  document.addEventListener("mousemove", e => {
    if (!isPanning) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    pdfScrollContainer.scrollLeft = scrollStartX - dx;
    pdfScrollContainer.scrollTop = scrollStartY - dy;
  });

  document.addEventListener("mouseup", () => {
    if (isPanning) {
      isPanning = false;
      pdfScrollContainer.style.cursor = panMode ? "grab" : "default";
    }
  });
}

// ------------------------------------------------------------
// Scroll tracking
// ------------------------------------------------------------
function initScrollTracking() {
  pdfScrollContainer.addEventListener("scroll", () => {
    let bestPage = 1;
    let bestOffset = Infinity;

    for (const view of pageViews) {
      const rect = view.wrapper.getBoundingClientRect();
      const containerRect = pdfScrollContainer.getBoundingClientRect();

      const offset = Math.abs(rect.top - containerRect.top - 50);

      if (offset < bestOffset) {
        bestOffset = offset;
        bestPage = view.pageNumber;
      }
    }

    setCurrentPageVisible(bestPage);

    if (numPages > 0) {
      pageInfo.textContent = `Page ${bestPage} / ${numPages}`;
    } else {
      pageInfo.textContent = "Page 0 / 0";
    }
  });
}
