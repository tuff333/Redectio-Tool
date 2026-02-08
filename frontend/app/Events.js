// ------------------------------------------------------------
// Events.js — Central event wiring for Stirling‑style viewer
// ------------------------------------------------------------

import {
  pageViews,
  searchResults,
  searchIndex,
  highlightMode,
  redactions,
  undoStack,
  redoStack,

  setSearchIndex,
  setHighlightMode,
  setRedactions
} from "./Utils.js";

import { performSearch, updateSearchInfo, scrollToSearchResult } from "./Search.js";
import { initFileIO } from "./FileIO.js";
import { initTemplateUI } from "./Template_UI.js";

import { attachBoxRedactionHandlers } from "./Redaction_Box.js";
import { attachTextSelectionHandlers } from "./Redaction_TextSelect.js";
import {
  attachAutoRedactionHandlers,
  runAutoRedact,
  applyAutoRedactions,
  clearAutoRedactions
} from "./Redaction_Auto.js";

import { toggleReviewMode, toggleShowOnlyAuto } from "./Review_Mode.js";
import { pushUndo, restoreState } from "./Redaction_Core.js";
import { renderAllPages } from "./PDF_Loader.js";

// ------------------------------------------------------------
// DOM elements
// ------------------------------------------------------------
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

const btnUndo = document.getElementById("btnUndo");
const btnRedo = document.getElementById("btnRedo");

// ------------------------------------------------------------
// Attach handlers to every page view (Stirling‑style)
// ------------------------------------------------------------
function attachHandlersToAllPages() {
  for (const view of pageViews) {
    // Box redaction on overlay canvas
    attachBoxRedactionHandlers(view.overlay, view);

    // Text selection on text layer
    attachTextSelectionHandlers(view.textLayerDiv, view);

    // Auto‑redaction hover/click on overlay
    attachAutoRedactionHandlers(view);
  }
}

// ------------------------------------------------------------
// Search controls
// ------------------------------------------------------------
function initSearchControls() {
  btnSearchPrev?.addEventListener("click", () => {
    if (!searchResults.length) return;

    const newIndex =
      (searchIndex - 1 + searchResults.length) % searchResults.length;
    setSearchIndex(newIndex);

    updateSearchInfo();
    scrollToSearchResult(searchResults[newIndex]);
  });

  btnSearchNext?.addEventListener("click", () => {
    if (!searchResults.length) return;

    const newIndex = (searchIndex + 1) % searchResults.length;
    setSearchIndex(newIndex);

    updateSearchInfo();
    scrollToSearchResult(searchResults[newIndex]);
  });

  btnToggleHighlight?.addEventListener("click", async () => {
    setHighlightMode(!highlightMode);
    await renderAllPages();
  });

  btnSearchRedactAll?.addEventListener("click", async () => {
    if (!searchResults.length) return;

    pushUndo();

    const newRedactions = structuredClone(redactions);

    for (const r of searchResults) {
      const page = r.page;
      if (!newRedactions[page]) newRedactions[page] = [];

      newRedactions[page].push({
        page,
        type: "search",
        rects: r.rects,
        color: document.getElementById("redactionColor").value || "#000000"
      });
    }

    setRedactions(newRedactions);
    await renderAllPages();
  });
}

// ------------------------------------------------------------
// Auto‑redaction controls
// ------------------------------------------------------------
function initAutoRedactionControls() {
  btnAutoPatterns?.addEventListener("click", () =>
    runAutoRedact("/api/redact/auto-suggest")
  );

  btnAutoOCR?.addEventListener("click", () =>
    runAutoRedact("/api/redact/auto-suggest-ocr")
  );

  btnAutoApply?.addEventListener("click", async () => {
    await applyAutoRedactions();
  });

  btnAutoClear?.addEventListener("click", async () => {
    await clearAutoRedactions();
  });
}

// ------------------------------------------------------------
// Review mode controls
// ------------------------------------------------------------
function initReviewModeControls() {
  btnReviewMode?.addEventListener("click", () => {
    toggleReviewMode();
    renderAllPages();
  });

  btnShowOnlyAuto?.addEventListener("click", () => {
    toggleShowOnlyAuto();
    renderAllPages();
  });
}

// ------------------------------------------------------------
// Undo / Redo
// ------------------------------------------------------------
function initUndoRedoControls() {
  btnUndo?.addEventListener("click", () => {
    restoreState(undoStack, redoStack);
  });

  btnRedo?.addEventListener("click", () => {
    restoreState(redoStack, undoStack);
  });
}

// ------------------------------------------------------------
// Redaction mode toggles
// ------------------------------------------------------------
function initRedactionModeControls() {
  btnModeSelectText?.addEventListener("click", () => {
    btnModeSelectText.classList.add("btn-toggle-active");
    btnModeDrawBox.classList.remove("btn-toggle-active");
  });

  btnModeDrawBox?.addEventListener("click", () => {
    btnModeDrawBox.classList.add("btn-toggle-active");
    btnModeSelectText.classList.remove("btn-toggle-active");
  });
}

// ------------------------------------------------------------
// initApp()
// ------------------------------------------------------------
export function initApp() {
  initFileIO();
  initTemplateUI();
  initSearchControls();
  initAutoRedactionControls();
  initReviewModeControls();
  initUndoRedoControls();
  initRedactionModeControls();

  // Attach handlers after initial load
  document.addEventListener("pdf-loaded", () => {
    attachHandlersToAllPages();

    const pageInfo = document.getElementById("pageInfo");
    if (pageInfo && window.__PDF_DOC) {
      pageInfo.textContent = `Page 1 / ${window.__PDF_DOC.numPages}`;
    }
  });

  // Re‑attach handlers after any full re‑render (zoom, search, undo/redo)
  document.addEventListener("pages-rendered", () => {
    attachHandlersToAllPages();
  });
}
