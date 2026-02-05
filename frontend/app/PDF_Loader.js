// ------------------------------------------------------------
// PDF_Loader.js — Unified rendering pipeline
// ------------------------------------------------------------

import * as pdfjsLib from "../pdfjs/pdf.mjs";

import {
  pdfDoc,
  pdfBytes,
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
import { drawReviewOverlay } from "./Review_Mode.js";

// ------------------------------------------------------------
// loadPDF(fileBytes)
// ------------------------------------------------------------
export async function loadPDF(fileBytes) {
  try {
    setPdfBytes(fileBytes);

    const loadingTask = pdfjsLib.getDocument({ data: fileBytes });
    const doc = await loadingTask.promise;

    setPdfDoc(doc);
    setNumPages(doc.numPages);

    await buildPageViews();
    await renderAllPages();

    document.dispatchEvent(new Event("pdf-loaded"));
    setStatus("PDF loaded.");

  } catch (err) {
    console.error(err);
    setStatus("Failed to load PDF.");
  }
}

// ------------------------------------------------------------
// buildPageViews()
// ------------------------------------------------------------
async function buildPageViews() {
  const container = document.getElementById("pdfContainer");
  container.innerHTML = "";

  const views = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);

    const pageDiv = document.createElement("div");
    pageDiv.className = "page-container";

    const canvas = document.createElement("canvas");
    canvas.className = "pdf-canvas";

    const overlay = document.createElement("canvas");
    overlay.className = "overlay-canvas";

    const textLayer = document.createElement("div");
    textLayer.className = "text-layer";

    pageDiv.appendChild(canvas);
    pageDiv.appendChild(overlay);
    pageDiv.appendChild(textLayer);
    container.appendChild(pageDiv);

    views.push({
      pageNumber: pageNum,
      page,
      container: pageDiv,
      canvas,
      overlay,
      textLayer,
      baseScale: 1
    });
  }

  setPageViews(views);
}

// ------------------------------------------------------------
// renderAllPages()
// ------------------------------------------------------------
export async function renderAllPages() {
  for (const view of pageViews) {
    await renderPageView(view);
  }
}

// ------------------------------------------------------------
// renderPageView(view)
// ------------------------------------------------------------
export async function renderPageView(view) {
  const { page, canvas, overlay, textLayer } = view;

  // 1. Compute viewport
  const viewport = page.getViewport({ scale: view.baseScale * zoom });

  // 2. Resize canvases
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  overlay.width = viewport.width;
  overlay.height = viewport.height;

  textLayer.style.width = `${viewport.width}px`;
  textLayer.style.height = `${viewport.height}px`;

  // 3. Render PDF page
  const ctx = canvas.getContext("2d");
  await page.render({ canvasContext: ctx, viewport }).promise;

  // 4. Build text layer
  await buildTextLayer(view, viewport);

  // 5. Draw manual redactions
  drawRedactionsOnView(view);

  // 6. Draw auto-redaction previews
  drawAutoRedactPreviewOnView(view);

  // 7. Draw search highlights
  drawSearchHighlightsOnView(view);

  // 8. Draw review mode overlay
  drawReviewOverlay(view);
}
