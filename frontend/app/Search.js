// ------------------------------------------------------------
// Search.js — Search engine + highlight rendering
// ------------------------------------------------------------

import {
  pdfDoc,
  numPages,
  zoom,
  pageViews,
  searchResults,
  searchIndex,
  highlightMode,

  setSearchResults,
  setSearchIndex,
  setStatus
} from "./Utils.js";

import { renderAllPages } from "./PDF_Loader.js";

// DOM elements
const searchInput = document.getElementById("searchInput");
const searchInfo = document.getElementById("searchInfo");
const pdfScrollContainer = document.querySelector(".pdf-scroll-container");

// ------------------------------------------------------------
// performSearch()
// ------------------------------------------------------------
export async function performSearch() {
  if (!pdfDoc) return;

  const query = searchInput.value.trim();
  let results = [];
  let index = 0;

  if (!query) {
    setSearchResults([]);
    setSearchIndex(0);
    searchInfo.textContent = "0 / 0";
    await renderAllPages();
    return;
  }

  const regex = new RegExp(query, "gi");

  for (let p = 1; p <= numPages; p++) {
    const page = await pdfDoc.getPage(p);
    const view = pageViews[p - 1];
    if (!view) continue;

    const viewport = page.getViewport({ scale: view.baseScale * zoom });
    const textContent = await page.getTextContent();

    const matchesForPage = [];

    for (const item of textContent.items) {
      if (!item.str) continue;

      const full = item.str;
      const approxCharWidth =
        (item.width * viewport.scale) / Math.max(full.length, 1);

      const words = full.split(/\s+/);
      let charOffset = 0;

      for (const word of words) {
        if (!word) {
          charOffset += 1;
          continue;
        }

        regex.lastIndex = 0;
        if (regex.test(word)) {
          const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
          const baseX = tx[4];
          const y = tx[5];
          const fontHeight = Math.hypot(tx[2], tx[3]);

          const x = baseX + charOffset * approxCharWidth;
          const width = word.length * approxCharWidth;

          const rect = {
            x0: x / viewport.width,
            y0: (viewport.height - y - fontHeight) / viewport.height,
            x1: (x + width) / viewport.width,
            y1: (viewport.height - y) / viewport.height
          };

          matchesForPage.push(rect);
        }

        charOffset += word.length + 1;
      }
    }

    if (matchesForPage.length > 0) {
      results.push({
        page: p,
        rects: matchesForPage
      });
    }
  }

  setSearchResults(results);

  if (results.length === 0) {
    searchInfo.textContent = "0 / 0";
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

  const firstRect = result.rects && result.rects[0];

  if (!firstRect) {
    view.container.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const y = firstRect.y0 * view.container.offsetHeight;

  pdfScrollContainer.scrollTo({
    top: view.container.offsetTop + y - 100,
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
  const overlayCtx = view.overlay.getContext("2d");
  overlayCtx.save();
  overlayCtx.strokeStyle = "yellow";
  overlayCtx.lineWidth = 2;

  const pageMatches = searchResults.find(r => r.page === view.pageNumber);

  if (pageMatches && pageMatches.rects) {
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