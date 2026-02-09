// ------------------------------------------------------------
// TextLayer.js — PDF.js v5 text layer builder (MERGED TEXT ENGINE)
// ------------------------------------------------------------

import * as pdfjsLib from "../pdfjs/pdf.mjs";

// textStore[page] = {
//   fullText: "entire page text",
//   charMap: [ { char, x0, y0, x1, y1 } ],
//   spans: [ { text, x0, y0, x1, y1 } ]
// }
export const textStore = {};

// ------------------------------------------------------------
// buildTextLayer(view, viewport)
// ------------------------------------------------------------
export async function buildTextLayer(view, viewport) {
  const { page, textLayerDiv, pageNumber } = view;

  textLayerDiv.innerHTML = "";
  textLayerDiv.style.display = "block";

  const textContent = await page.getTextContent();
  const items = textContent.items;

  // Initialize store
  textStore[pageNumber] = {
    fullText: "",
    charMap: [],
    spans: []
  };

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

    textLayerDiv.appendChild(span);

    // Store span metadata
    const spanInfo = {
      text: item.str,
      x0: x / viewport.width,
      y0: (viewport.height - y - fontHeight) / viewport.height,
      x1: (x + width) / viewport.width,
      y1: (viewport.height - y) / viewport.height
    };

    textStore[pageNumber].spans.push(spanInfo);

    // ------------------------------------------------------------
    // Build merged fullText + charMap
    // ------------------------------------------------------------
    const charWidth = width / item.str.length;

    for (let i = 0; i < item.str.length; i++) {
      const cx0 = (x + charWidth * i) / viewport.width;
      const cx1 = (x + charWidth * (i + 1)) / viewport.width;

      textStore[pageNumber].charMap.push({
        char: item.str[i],
        x0: cx0,
        y0: spanInfo.y0,
        x1: cx1,
        y1: spanInfo.y1
      });

      textStore[pageNumber].fullText += item.str[i];
    }
  }

  textLayerDiv.style.pointerEvents = "none";
}
