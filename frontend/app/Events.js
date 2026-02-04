// ------------------------------------------------------------
// Events.js — Central event wiring + app initialization
// ------------------------------------------------------------

import { pageViews } from "./Utils.js";

import { initZoomControls } from "./Zoom_Pan.js";
import { performSearch, updateSearchInfo, scrollToSearchResult } from "./Search.js";
import { initFileIO } from "./FileIO.js";
import { initTemplateUI } from "./Template_UI.js";

import { attachBoxRedactionHandlers } from "./Redaction_Box.js";
import { attachTextSelectionHandlers } from "./Redaction_TextSelect.js";
import { attachAutoRedactionHandlers, runAutoRedact, applyAutoRedactions, clearAutoRedactions } from "./Redaction_Auto.js";

import { toggleReviewMode, toggleShowOnlyAuto } from "./Review_Mode.js";

// DOM elements
const btnSearchPrev = document.getElementById("btnSearchPrev");
const btnSearchNext = document.getElementById("btnSearchNext");
const btnSearchRedactAll = document.getElementById("btnSearchRedactAll");
const btnToggleHighlight = document.getElementById("btnToggleHighlight");

const btnModeSelectText = document.getElementById("btnModeSelectText");
const btnModeDrawBox = document.getElementById("btnModeDrawBox");

const btnAutoPatterns = document.getElementById("btnAutoPatterns");
const btnAutoOCR = document.getElementById("btnAutoOCR");
const btnAutoApply = document.getElementById("btnAutoApply");
const btnAutoClear = document.getElementById("btnAutoClear");

const btnReviewMode = document.getElementById("btnReviewMode");
const btnShowOnlyAuto = document.getElementById("btnShowOnlyAuto");

// ------------------------------------------------------------
// initRedactionHandlers()
// ------------------------------------------------------------
function initRedactionHandlers() {
  for (const view of pageViews) {
    attachBoxRedactionHandlers(view);
    attachTextSelectionHandlers(view);
    attachAutoRedactionHandlers(view);
  }
}

// ------------------------------------------------------------
// initSearchControls()
// ------------------------------------------------------------
function initSearchControls() {
  btnSearchPrev?.addEventListener("click", () => {
    const { searchResults, searchIndex, setSearchIndex } = requireState();
    if (searchResults.length === 0) return;

    const newIndex = (searchIndex - 1 + searchResults.length) % searchResults.length;
    setSearchIndex(newIndex);

    updateSearchInfo();
    scrollToSearchResult(searchResults[newIndex]);
  });

  btnSearchNext?.addEventListener("click", () => {
    const { searchResults, searchIndex, setSearchIndex } = requireState();
    if (searchResults.length === 0) return;

    const newIndex = (searchIndex + 1) % searchResults.length;
    setSearchIndex(newIndex);

    updateSearchInfo();
    scrollToSearchResult(searchResults[newIndex]);
  });

  btnToggleHighlight?.addEventListener("click", async () => {
    const { highlightMode, setHighlightMode } = requireState();
    setHighlightMode(!highlightMode);
    await requireRender();
  });

  btnSearchRedactAll?.addEventListener("click", async () => {
    const { searchResults, redactions, setRedactions, pushUndo } = requireState();
    if (searchResults.length === 0) return;

    pushUndo();

    const newRedactions = [...redactions];
    for (const r of searchResults) {
      newRedactions.push({
        page: r.page,
        type: "search",
        rects: r.rects,
        color: document.getElementById("redactionColor").value || "#000000"
      });
    }

    setRedactions(newRedactions);
    await requireRender();
  });
}

// ------------------------------------------------------------
// initAutoRedactionControls()
// ------------------------------------------------------------
function initAutoRedactionControls() {
  btnAutoPatterns?.addEventListener("click", () =>
    runAutoRedact("http://127.0.0.1:8000/api/redact/auto-suggest")
  );

  btnAutoOCR?.addEventListener("click", () =>
    runAutoRedact("http://127.0.0.1:8000/api/redact/auto-suggest-ocr")
  );

  btnAutoApply?.addEventListener("click", async () => {
    await applyAutoRedactions();
  });

  btnAutoClear?.addEventListener("click", async () => {
    await clearAutoRedactions();
  });
}

// ------------------------------------------------------------
// initReviewModeControls()
// ------------------------------------------------------------
function initReviewModeControls() {
  btnReviewMode?.addEventListener("click", () => {
    toggleReviewMode();
  });

  btnShowOnlyAuto?.addEventListener("click", () => {
    toggleShowOnlyAuto();
  });
}

// ------------------------------------------------------------
// requireState() helper
// ------------------------------------------------------------
function requireState() {
  return require("./Utils.js");
}

// ------------------------------------------------------------
// requireRender() helper
// ------------------------------------------------------------
async function requireRender() {
  const { renderAllPages } = await import("./PDF_Loader.js");
  await renderAllPages();
}

// ------------------------------------------------------------
// initApp()
// ------------------------------------------------------------
export function initApp() {
  initFileIO();
  initTemplateUI();
  initZoomControls();
  initSearchControls();
  initAutoRedactionControls();
  initReviewModeControls();

  // Attach redaction handlers AFTER PDF loads
  document.addEventListener("pdf-loaded", () => {
    initRedactionHandlers();
  });
}