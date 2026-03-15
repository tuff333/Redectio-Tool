// ------------------------------------------------------------
// OCR_Fallback.js — Run OCR when PDF.js finds no real text
// ------------------------------------------------------------

import { textStore } from "./TextLayer.js";
import { renderAllPages } from "./PDF_Loader.js";
import { originalPdfBytes } from "./Utils.js";   // ⭐ FIXED: import at top

export async function runOCRFallback() {
  const hasRealText = Object.values(textStore).some(
    store => store.fullText && store.fullText.trim().length > 5
  );

  if (hasRealText) {
    console.log("OCR not needed — PDF has real extractable text.");
    return;
  }

  console.log("🔍 No real text found — running OCR fallback...");

  const form = new FormData();
  form.append(
    "file",
    new Blob([originalPdfBytes], { type: "application/pdf" }),   // ⭐ FIXED
    "file.pdf"
  );

  const res = await fetch("http://127.0.0.1:8000/api/ocr", {
    method: "POST",
    body: form
  });

  const words = await res.json();
  console.log("🔍 OCR results:", words);

  for (const w of words) {
    if (!textStore[w.page]) {
      textStore[w.page] = { fullText: "", charMap: [], spans: [] };
    }

    const store = textStore[w.page];

    store.fullText += w.text + " ";

    store.charMap.push({
      char: w.text,
      x0: w.x0,
      y0: w.y0,
      x1: w.x1,
      y1: w.y1
    });

    store.spans.push({
      text: w.text,
      x0: w.x0,
      y0: w.y0,
      x1: w.x1,
      y1: w.y1
    });
  }

  console.log("🔍 OCR textStore built:", textStore);
  await renderAllPages();
}
