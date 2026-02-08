// ------------------------------------------------------------
// Search.js — Precision search using structured textStore
// ------------------------------------------------------------

import { textStore } from "./TextLayer.js";

import {
  searchResults,
  searchIndex,
  highlightMode,

  setSearchResults,
  setSearchIndex,
  setStatus
} from "./Utils.js";

import { pageViews } from "./Utils.js";
import { renderAllPages } from "./PDF_Loader.js";

// DOM elements
const searchInput = document.getElementById("searchInput");
const searchInfo = document.getElementById("searchInfo");
const pdfScrollContainer = document.querySelector(".pdf-scroll-container");

// ------------------------------------------------------------
// performSearch()
// ------------------------------------------------------------
export async function performSearch() {
  const query = searchInput.value.trim();
  if (!query) {
    setSearchResults([]);
    setSearchIndex(0);
    searchInfo.textContent = "0 / 0";
    await renderAllPages();
    return;
  }

  let regex = null;

  // Support /regex/ syntax
  if (query.startsWith("/") && query.endsWith("/")) {
    try {
      regex = new RegExp(query.slice(1, -1), "gi");
    } catch {
      setStatus("Invalid regex.");
      return;
    }
  } else {
    // Escape regex special chars for literal search
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    regex = new RegExp(escaped, "gi");
  }

  const results = [];

  for (const page in textStore) {
    const items = textStore[page];
    if (!items) continue;

    const rects = [];

    for (const item of items) {
      const text = item.text;
      let match;

      while ((match = regex.exec(text)) !== null) {
        const start = match.index;
        const end = start + match[0].length;

        const totalWidth = item.x1 - item.x0;
        const charWidth = totalWidth / text.length;

        const x0 = item.x0 + charWidth * start;
        const x1 = item.x0 + charWidth * end;

        rects.push({
          x0,
          y0: item.y0,
          x1,
          y1: item.y1
        });
      }
    }

    if (rects.length > 0) {
      results.push({
        page: Number(page),
        rects
      });
    }
  }

  setSearchResults(results);

  if (results.length === 0) {
    searchInfo.textContent = "0 / 0";
    setSearchIndex(0);
  } else {
    setSearchIndex(0);
    searchInfo.textContent = `1 / ${results.length}`;
    scrollToSearchResult(results[0]);
  }

  await renderAllPages();
}

// ------------------------------------------------------------
// scrollToSearchResult(result)
// ------------------------------------------------------------
export function scrollToSearchResult(result) {
  const view = pageViews.find(v => v.pageNumber === result.page);
  if (!view) return;

  const firstRect = result.rects[0];
  const y = firstRect.y0 * view.canvas.height;

  // FIXED: view.container → view.wrapper
  pdfScrollContainer.scrollTo({
    top: view.wrapper.offsetTop + y - 100,
    behavior: "smooth"
  });
}

// ------------------------------------------------------------
// updateSearchInfo()
// ------------------------------------------------------------
export function updateSearchInfo() {
  if (searchResults.length === 0) {
    searchInfo.textContent = "0 / 0";
  } else {
    searchInfo.textContent = `${searchIndex + 1} / ${searchResults.length}`;
  }
}

// ------------------------------------------------------------
// drawSearchHighlightsOnView(view)
// ------------------------------------------------------------
export function drawSearchHighlightsOnView(view) {
  if (!highlightMode) return;

  const overlayCtx = view.overlay.getContext("2d");
  overlayCtx.save();
  overlayCtx.strokeStyle = "yellow";
  overlayCtx.lineWidth = 2;

  const pageMatches = searchResults.find(r => r.page === view.pageNumber);

  if (pageMatches) {
    for (const rect of pageMatches.rects) {
      const x = rect.x0 * view.overlay.width;
      const y = rect.y0 * view.overlay.height;
      const w = (rect.x1 - rect.x0) * view.overlay.width;
      const h = (rect.y1 - rect.y0) * view.overlay.height;

      overlayCtx.strokeRect(x, y, w, h);
    }
  }

  overlayCtx.restore();
}
