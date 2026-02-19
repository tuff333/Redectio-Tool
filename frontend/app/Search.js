// ------------------------------------------------------------
// Search.js — Multi-span search engine (FIXED + DEEP DEBUG)
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
  console.log("🔥 performSearch() FIRED");

  if (!searchInput) {
    console.log("[Search] searchInput not found in DOM");
    return;
  }

  const query = searchInput.value.trim();
  console.log("[Search] query:", JSON.stringify(query));
  console.log("[Search] textStore keys:", Object.keys(textStore));

  if (!query) {
    console.log("[Search] Empty query → clearing results");
    setSearchResults([]);
    setSearchIndex(0);
    if (searchInfo) searchInfo.textContent = "0 / 0";
    await renderAllPages();
    return;
  }

  let regex = null;

  // /regex/ support
  if (query.startsWith("/") && query.endsWith("/")) {
    try {
      regex = new RegExp(query.slice(1, -1), "gi");
    } catch (e) {
      console.log("[Search] Invalid regex:", query, e);
      setStatus("Invalid regex.");
      return;
    }
  } else {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    regex = new RegExp(escaped, "gi");
  }

  console.log("[Search] Using regex:", regex);

  const results = [];

  // ------------------------------------------------------------
  // Multi-span search using fullText + charMap
  // ------------------------------------------------------------
  for (const page in textStore) {
    const store = textStore[page];
    if (!store || !store.fullText || !store.charMap) {
      console.log(
        `[Search] Skipping page ${page} — missing store/fullText/charMap`,
        store
      );
      continue;
    }

    const { fullText, charMap } = store;
    console.log(
      `[Search] Page ${page} fullText length:`,
      fullText.length,
      "charMap length:",
      charMap.length
    );

    const pageMatches = [];

    let match;
    while ((match = regex.exec(fullText)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      const chars = charMap.slice(start, end);
      if (!chars.length) {
        console.log(
          `[Search] Page ${page} match at ${start}-${end} but no chars in charMap slice`
        );
        continue;
      }

      const x0 = Math.min(...chars.map(c => c.x0));
      const y0 = Math.min(...chars.map(c => c.y0));
      const x1 = Math.max(...chars.map(c => c.x1));
      const y1 = Math.max(...chars.map(c => c.y1));

      pageMatches.push({ x0, y0, x1, y1 });
    }

    console.log(
      `[Search] Page ${page} matches found:`,
      pageMatches.length
    );

    if (pageMatches.length > 0) {
      results.push({
        page: Number(page),
        rects: pageMatches
      });
    }
  }

  console.log("[Search] Final results:", results);

  setSearchResults(results);

  if (!searchInfo) {
    console.log("[Search] searchInfo element not found");
    return;
  }

  if (results.length === 0) {
    searchInfo.textContent = "0 / 0";
    setSearchIndex(0);
    console.log("[Search] No results → 0 / 0");
  } else {
    setSearchIndex(0);
    searchInfo.textContent = `1 / ${results.length}`;
    console.log(`[Search] Results available → 1 / ${results.length}`);
    scrollToSearchResult(results[0]);
  }

  await renderAllPages();
}

// ------------------------------------------------------------
// scrollToSearchResult()
// ------------------------------------------------------------
export function scrollToSearchResult(result) {
  if (!result || !pageViews || !pdfScrollContainer) return;

  const view = pageViews.find(v => v.pageNumber === result.page);
  if (!view || !view.viewport || !view.wrapper) return;

  const first = result.rects?.[0];
  if (!first) return;

  const y = first.y0 * view.viewport.height;

  pdfScrollContainer.scrollTo({
    top: view.wrapper.offsetTop + y - 100,
    behavior: "smooth"
  });
}

// ------------------------------------------------------------
// updateSearchInfo()
// ------------------------------------------------------------
export function updateSearchInfo() {
  if (!searchInfo) return;

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
  if (!view || !view.overlay) return;

  const ctx = view.overlay.getContext("2d");
  if (!ctx) return;

  ctx.save();
  ctx.strokeStyle = "yellow";
  ctx.lineWidth = 2;

  const matches = searchResults.find(r => r.page === view.pageNumber);
  if (matches && matches.rects) {
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
