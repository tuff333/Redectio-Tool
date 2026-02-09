// ------------------------------------------------------------
// Search.js — Multi-span search engine (FIXED)
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

  // /regex/ support
  if (query.startsWith("/") && query.endsWith("/")) {
    try {
      regex = new RegExp(query.slice(1, -1), "gi");
    } catch {
      setStatus("Invalid regex.");
      return;
    }
  } else {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    regex = new RegExp(escaped, "gi");
  }

  const results = [];

  // ------------------------------------------------------------
  // Multi-span search using fullText + charMap
  // ------------------------------------------------------------
  for (const page in textStore) {
    const store = textStore[page];
    if (!store) continue;

    const { fullText, charMap } = store;
    const pageMatches = [];

    let match;
    while ((match = regex.exec(fullText)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      // Build bounding box from charMap[start..end]
      const chars = charMap.slice(start, end);

      const x0 = Math.min(...chars.map(c => c.x0));
      const y0 = Math.min(...chars.map(c => c.y0));
      const x1 = Math.max(...chars.map(c => c.x1));
      const y1 = Math.max(...chars.map(c => c.y1));

      pageMatches.push({ x0, y0, x1, y1 });
    }

    if (pageMatches.length > 0) {
      results.push({
        page: Number(page),
        rects: pageMatches
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
// scrollToSearchResult()
// ------------------------------------------------------------
export function scrollToSearchResult(result) {
  const view = pageViews.find(v => v.pageNumber === result.page);
  if (!view) return;

  const first = result.rects[0];
  const y = first.y0 * view.canvas.height;

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
// drawSearchHighlightsOnView()
// ------------------------------------------------------------
export function drawSearchHighlightsOnView(view) {
  if (!highlightMode) return;

  const ctx = view.overlay.getContext("2d");
  ctx.save();
  ctx.strokeStyle = "yellow";
  ctx.lineWidth = 2;

  const matches = searchResults.find(r => r.page === view.pageNumber);
  if (matches) {
    for (const rect of matches.rects) {
      const x = rect.x0 * view.overlay.width;
      const y = rect.y0 * view.overlay.height;
      const w = (rect.x1 - rect.x0) * view.overlay.width;
      const h = (rect.y1 - rect.y0) * view.overlay.height;

      ctx.strokeRect(x, y, w, h);
    }
  }

  ctx.restore();
}
