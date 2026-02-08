// ------------------------------------------------------------
// PDF_Loader.js — Stirling‑style viewer with text + overlay layers
// ------------------------------------------------------------

import * as pdfjsLib from "../pdfjs/pdf.mjs";

import {
  setPdfDoc,
  setPdfBytes,
  setNumPages,
  pageViews,
  setPageViews,
  zoom,
  highlightMode
} from "./Utils.js";

import { drawRedactionsOnView } from "./Redaction_Core.js";
import { drawSearchHighlightsOnView } from "./Search.js";
import { drawAutoRedactPreviewOnView } from "./Redaction_Auto.js";

// ------------------------------------------------------------
// PDF.js worker
// ------------------------------------------------------------
pdfjsLib.GlobalWorkerOptions.workerSrc = "../pdfjs/pdf.worker.mjs";

// ------------------------------------------------------------
// loadPDF(pdfBytes)
// ------------------------------------------------------------
export async function loadPDF(pdfBytes) {
  setPdfBytes(pdfBytes);

  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
  const pdf = await loadingTask.promise;

  window.__PDF_DOC = pdf;
  setPdfDoc(pdf);
  setNumPages(pdf.numPages);

  await renderAllPages();

  document.dispatchEvent(new CustomEvent("pdf-loaded"));
}

// ------------------------------------------------------------
// createPageView(page, viewport, pageNum)
// ------------------------------------------------------------
function createPageView(page, viewport, pageNum) {
  const container = document.getElementById("pdfPagesColumn");

  const wrapper = document.createElement("div");
  wrapper.className = "page-container";
  wrapper.dataset.pageNumber = pageNum;

  // Canvas layer (PDF rendering)
  const canvas = document.createElement("canvas");
  canvas.className = "pdf-canvas";

  // Text layer (real selectable text)
  const textLayerDiv = document.createElement("div");
  textLayerDiv.className = "text-layer";

  // Overlay layer (redactions, search, auto)
  const overlay = document.createElement("canvas");
  overlay.className = "overlay-canvas";

  wrapper.appendChild(canvas);
  wrapper.appendChild(textLayerDiv);
  wrapper.appendChild(overlay);
  container.appendChild(wrapper);

  // Size canvases
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  overlay.width = viewport.width;
  overlay.height = viewport.height;

  return {
    pageNumber: pageNum,
    page,
    canvas,
    textLayerDiv,
    overlay,          // ← canonical overlay
    overlayCanvas: overlay, // ← backward‑compat alias
    wrapper,
    viewport
  };
}

// ------------------------------------------------------------
// renderPageView(view)
// ------------------------------------------------------------
export async function renderPageView(view) {
  const pdf = window.__PDF_DOC;
  if (!pdf) return;

  const page = await pdf.getPage(view.pageNumber);

  const currentZoom = zoom || 1.25;
  const viewport = page.getViewport({ scale: currentZoom });
  view.viewport = viewport;

  // Resize layers
  view.canvas.width = viewport.width;
  view.canvas.height = viewport.height;

  view.overlay.width = viewport.width;
  view.overlay.height = viewport.height;

  view.textLayerDiv.style.width = viewport.width + "px";
  view.textLayerDiv.style.height = viewport.height + "px";

  // Render PDF page
  const ctx = view.canvas.getContext("2d");
  await page.render({ canvasContext: ctx, viewport }).promise;

  // Render text layer
  const textContent = await page.getTextContent();
  pdfjsLib.renderTextLayer({
    textContent,
    container: view.textLayerDiv,
    viewport,
    textDivs: []
  });

  // Draw overlays
  drawRedactionsOnView(view);
  if (highlightMode) drawSearchHighlightsOnView(view);
  drawAutoRedactPreviewOnView(view);
}

// ------------------------------------------------------------
// renderAllPages()
// ------------------------------------------------------------
export async function renderAllPages() {
  const pdf = window.__PDF_DOC;
  if (!pdf) return;

  const container = document.getElementById("pdfPagesColumn");
  container.innerHTML = "";

  const views = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);

    const currentZoom = zoom || 1.25;
    const viewport = page.getViewport({ scale: currentZoom });

    const view = createPageView(page, viewport, pageNum);

    // Render page + layers
    await renderPageView(view);

    views.push(view);
  }

  setPageViews(views);

  // Let listeners (Events.js) re‑attach handlers
  document.dispatchEvent(new CustomEvent("pages-rendered"));
}
