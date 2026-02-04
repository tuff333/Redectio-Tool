// ------------------------------------------------------------
// Zoom_Pan.js — Zoom controls, pan mode, scroll tracking
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

// DOM elements
const btnZoomIn = document.getElementById("btnZoomIn");
const btnZoomOut = document.getElementById("btnZoomOut");
const btnPanMode = document.getElementById("btnPanMode");
const zoomInfo = document.getElementById("zoomInfo");
const pageInfo = document.getElementById("pageInfo");
const pdfScrollContainer = document.querySelector(".pdf-scroll-container");

// ------------------------------------------------------------
// Zoom In
// ------------------------------------------------------------
export function initZoomControls() {
  btnZoomIn?.addEventListener("click", async () => {
    const newZoom = zoom * 1.1;
    setZoom(newZoom);

    zoomInfo.textContent = `${Math.round(newZoom * 100)}%`;
    await renderAllPages();
  });

  // ------------------------------------------------------------
  // Zoom Out
  // ------------------------------------------------------------
  btnZoomOut?.addEventListener("click", async () => {
    const newZoom = zoom / 1.1;
    setZoom(newZoom);

    zoomInfo.textContent = `${Math.round(newZoom * 100)}%`;
    await renderAllPages();
  });

  // ------------------------------------------------------------
  // Pan Mode Toggle
  // ------------------------------------------------------------
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
// Pan Mode Handlers
// ------------------------------------------------------------
function initPanHandlers() {
  let isPanning = false;
  let panStartY = 0;
  let scrollStartY = 0;

  pdfScrollContainer.addEventListener("mousedown", e => {
    if (!panMode) return;

    isPanning = true;
    panStartY = e.clientY;
    scrollStartY = pdfScrollContainer.scrollTop;
    pdfScrollContainer.style.cursor = "grabbing";
  });

  document.addEventListener("mousemove", e => {
    if (!isPanning) return;

    const dy = e.clientY - panStartY;
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
// Track Current Visible Page
// ------------------------------------------------------------
function initScrollTracking() {
  pdfScrollContainer.addEventListener("scroll", () => {
    let bestPage = 1;
    let bestOffset = Infinity;

    for (const view of pageViews) {
      const rect = view.container.getBoundingClientRect();
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