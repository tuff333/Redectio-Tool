// ------------------------------------------------------------
// PDF_Loader.js — PDF loading, page creation, rendering
// ------------------------------------------------------------

import * as pdfjsLib from "../pdfjs/pdf.mjs";

import {
  pdfDoc,
  numPages,
  zoom,
  pageViews,

  setPdfDoc,
  setPdfBytes,
  setNumPages,
  setPageViews,
  setStatus
} from "./Utils.js";

import { buildTextLayer } from "./TextLayer.js";
import { drawRedactionsOnView } from "./Redaction_Core.js";
import { drawAutoRedactPreviewOnView } from "./Redaction_Auto.js";
import { drawSearchHighlightsOnView } from "./Search.js";
import {
  applyReviewFilters,
  shouldDrawManualRedactions,
  shouldDrawSearchHighlights
} from "./Review_Mode.js";

// PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = "../pdfjs/pdf.worker.mjs";

// DOM elements
const pdfPagesColumn = document.getElementById("pdfPagesColumn");
const pageInfo = document.getElementById("pageInfo");
const pdfScrollContainer = document.querySelector(".pdf-scroll-container");

// ------------------------------------------------------------
// loadPDF
// ------------------------------------------------------------
export async function loadPDF(bytes) {
  setPdfBytes(bytes);
  setStatus("Loading PDF...");

  const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
  setPdfDoc(doc);
  setNumPages(doc.numPages);

  pageInfo.textContent = `Page 1 / ${doc.numPages}`;
  setPageViews([]);

  pdfPagesColumn.innerHTML = "";

  // Ensure layout is ready
  await new Promise(requestAnimationFrame);

  await createPageViews();
  await renderAllPages();

  setStatus("PDF loaded.");
}

// ------------------------------------------------------------
// createPageViews
// ------------------------------------------------------------
export async function createPageViews() {
  const views = [];

  let columnWidth = pdfPagesColumn.clientWidth;
  if (!columnWidth || columnWidth < 50) {
    columnWidth = pdfScrollContainer.clientWidth - 40;
  }
  if (!columnWidth || columnWidth < 200) {
    columnWidth = 800;
  }

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const fitWidthScale = columnWidth / viewport.width;

    const pageContainer = document.createElement("div");
    pageContainer.className = "page-container";

    const canvas = document.createElement("canvas");
    canvas.className = "pdf-canvas";

    const overlay = document.createElement("canvas");
    overlay.className = "overlay-canvas";

    const textLayer = document.createElement("div");
    textLayer.className = "text-layer";

    pageContainer.appendChild(canvas);
    pageContainer.appendChild(overlay);
    pageContainer.appendChild(textLayer);
    pdfPagesColumn.appendChild(pageContainer);

    const scaledViewport = page.getViewport({ scale: fitWidthScale * zoom });
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    overlay.width = scaledViewport.width;
    overlay.height = scaledViewport.height;
    textLayer.style.width = scaledViewport.width + "px";
    textLayer.style.height = scaledViewport.height + "px";

    views.push({
      pageNumber: pageNum,
      page,
      container: pageContainer,
      canvas,
      overlay,
      textLayer,
      baseScale: fitWidthScale
    });
  }

  setPageViews(views);
}

// ------------------------------------------------------------
// renderPageView
// ------------------------------------------------------------
export async function renderPageView(view) {
  const { page, canvas, overlay, textLayer, baseScale } = view;

  const ctx = canvas.getContext("2d");
  const overlayCtx = overlay.getContext("2d");

  const viewport = page.getViewport({ scale: baseScale * zoom });

  canvas.width = viewport.width;
  canvas.height = viewport.height;
  view.container.style.minHeight = canvas.height + "px";

  overlay.width = viewport.width;
  overlay.height = viewport.height;

  textLayer.style.width = viewport.width + "px";
  textLayer.style.height = viewport.height + "px";

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  textLayer.innerHTML = "";

  await page.render({ canvasContext: ctx, viewport }).promise;
  await buildTextLayer(view, viewport);

  // Manual redactions (respect review mode)
  if (shouldDrawManualRedactions()) {
    drawRedactionsOnView(view);
  }

  // Search highlights (respect review mode)
  if (shouldDrawSearchHighlights()) {
    drawSearchHighlightsOnView(view);
  }

  // Auto-redaction preview always draws
  drawAutoRedactPreviewOnView(view);

  // Apply dimming filters last
  applyReviewFilters(view);
}

// ------------------------------------------------------------
// renderAllPages
// ------------------------------------------------------------
export async function renderAllPages() {
  for (const view of pageViews) {
    await renderPageView(view);
  }
}