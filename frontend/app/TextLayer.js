// ------------------------------------------------------------
// TextLayer.js — PDF.js v5 text layer builder
// ------------------------------------------------------------

import * as pdfjsLib from "../pdfjs/pdf.mjs";

// ------------------------------------------------------------
// buildTextLayer(view, viewport)
// ------------------------------------------------------------
// Creates absolutely-positioned <span> elements for each text item.
// This is the foundation for:
//   - text selection redaction
//   - search highlighting
//   - OCR snapping (future)
// ------------------------------------------------------------

export async function buildTextLayer(view, viewport) {
  const { page, textLayer } = view;

  textLayer.innerHTML = "";
  textLayer.style.display = "block";

  const textContent = await page.getTextContent();

  for (const item of textContent.items) {
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
  }

  // Prevent text layer from blocking mouse events unless text-select mode is active
  textLayer.style.pointerEvents = "none";
}
