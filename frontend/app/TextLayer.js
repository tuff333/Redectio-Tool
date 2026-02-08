// ------------------------------------------------------------
// TextLayer.js — PDF.js v5 text layer builder (enhanced)
// ------------------------------------------------------------

import * as pdfjsLib from "../pdfjs/pdf.mjs";
import { pageViews } from "./Utils.js";

// Global structured text store:
// textStore[pageNumber] = [ { text, x0, y0, x1, y1, fontHeight, width } ]
export const textStore = {};

// ------------------------------------------------------------
// buildTextLayer(view, viewport)
// ------------------------------------------------------------
// Creates absolutely-positioned <span> elements for each text item.
// ALSO stores structured text metadata for search, auto-redact, etc.
// ------------------------------------------------------------

export async function buildTextLayer(view, viewport) {
  const { page, textLayer, pageNumber } = view;

  textLayer.innerHTML = "";
  textLayer.style.display = "block";

  const textContent = await page.getTextContent();
  const items = textContent.items;

  // Reset structured text for this page
  textStore[pageNumber] = [];

  for (const item of items) {
    if (!item.str) continue;

    const span = document.createElement("span");
    span.textContent = item.str;
    span.style.position = "absolute";
    span.style.whiteSpace = "pre";

    // Transform PDF.js text matrix into viewport coordinates
    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
    const x = tx[4];
    const y = tx[5];

    const fontHeight = Math.hypot(tx[2], tx[3]);
    const width = item.width * viewport.scale;

    // Positioning
    span.style.left = `${x}px`;
    span.style.top = `${viewport.height - y - fontHeight}px`;
    span.style.fontSize = `${fontHeight}px`;
    span.style.height = `${fontHeight}px`;
    span.style.width = `${width}px`;

    textLayer.appendChild(span);

    // ------------------------------------------------------------
    // Store structured metadata (normalized)
    // ------------------------------------------------------------
    const norm = {
      text: item.str,
      x0: x / viewport.width,
      y0: (viewport.height - y - fontHeight) / viewport.height,
      x1: (x + width) / viewport.width,
      y1: (viewport.height - y) / viewport.height,
      fontHeight,
      width,
      page: pageNumber
    };

    textStore[pageNumber].push(norm);
  }

  // Prevent text layer from blocking mouse events unless text-select mode is active
  textLayer.style.pointerEvents = "none";
}
