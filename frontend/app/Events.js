// ------------------------------------------------------------
// Events.js — Central event wiring
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
  setRedactions,
  setSelectionMode
} from "./Utils.js";

import { performSearch, updateSearchInfo, scrollToSearchResult } from "./Search.js";
import { initFileIO } from "./FileIO.js";

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
// GLOBAL LISTENER REGISTRY
// ------------------------------------------------------------
let registeredListeners = [];

function addListener(target, event, handler) {
  if (!target) return;
  target.addEventListener(event, handler);
  registeredListeners.push({ target, event, handler });
}

function cleanupListeners() {
  for (const { target, event, handler } of registeredListeners) {
    target.removeEventListener(event, handler);
  }
  registeredListeners = [];
}

export { addListener, cleanupListeners };

// ------------------------------------------------------------
// Attach handlers to every page view
// ------------------------------------------------------------
function attachHandlersToAllPages() {
  for (const view of pageViews) {
    if (!view) continue;

    attachBoxRedactionHandlers(view.overlay, view);

    setTimeout(() => {
      attachTextSelectionHandlers(view.textLayerDiv, view);
    }, 0);

    attachAutoRedactionHandlers(view, addListener);
  }
}

// ------------------------------------------------------------
// Search controls
// ------------------------------------------------------------
function initSearchControls() {
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    addListener(searchInput, "input", () => performSearch());
  }

  const searchBtn = document.getElementById("searchBtn");
  if (searchBtn) {
    addListener(searchBtn, "click", () => performSearch());
  }

  addListener(btnSearchPrev, "click", () => {
    if (!searchResults.length) return;
    const newIndex = (searchIndex - 1 + searchResults.length) % searchResults.length;
    setSearchIndex(newIndex);
    updateSearchInfo();
    scrollToSearchResult(searchResults[newIndex]);
  });

  addListener(btnSearchNext, "click", () => {
    if (!searchResults.length) return;
    const newIndex = (searchIndex + 1) % searchResults.length;
    setSearchIndex(newIndex);
    updateSearchInfo();
    scrollToSearchResult(searchResults[newIndex]);
  });

  addListener(btnToggleHighlight, "click", async () => {
    setHighlightMode(!highlightMode);
    await renderAllPages();
  });

  addListener(btnSearchRedactAll, "click", async () => {
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
  addListener(btnAutoPatterns, "click", () =>
    runAutoRedact("/api/redact/auto-suggest")
  );

  addListener(btnAutoOCR, "click", () =>
    runAutoRedact("/api/redact/auto-suggest-ocr")
  );

  addListener(btnAutoApply, "click", async () => {
    await applyAutoRedactions();
  });

  addListener(btnAutoClear, "click", async () => {
    await clearAutoRedactions();
  });
}

// ------------------------------------------------------------
// Review mode controls
// ------------------------------------------------------------
function initReviewModeControls() {
  addListener(btnReviewMode, "click", () => {
    toggleReviewMode();
    renderAllPages();
  });

  addListener(btnShowOnlyAuto, "click", () => {
    toggleShowOnlyAuto();
    renderAllPages();
  });
}

// ------------------------------------------------------------
// Undo / Redo
// ------------------------------------------------------------
function initUndoRedoControls() {
  addListener(btnUndo, "click", () => restoreState(undoStack, redoStack));
  addListener(btnRedo, "click", () => restoreState(redoStack, undoStack));
}

// ------------------------------------------------------------
// Redaction mode toggles
// ------------------------------------------------------------
function initRedactionModeControls() {
  addListener(btnModeSelectText, "click", () => {
    setSelectionMode("text");
    btnModeSelectText.classList.add("btn-toggle-active");
    btnModeDrawBox.classList.remove("btn-toggle-active");
  });

  addListener(btnModeDrawBox, "click", () => {
    setSelectionMode("box");
    btnModeDrawBox.classList.add("btn-toggle-active");
    btnModeSelectText.classList.remove("btn-toggle-active");
  });
}

// ------------------------------------------------------------
// initApp()
// ------------------------------------------------------------
export function initApp() {
  initFileIO();

  initSearchControls();
  initAutoRedactionControls();
  initReviewModeControls();
  initUndoRedoControls();
  initRedactionModeControls();

  addListener(document, "pages-rendered", () => {
    attachHandlersToAllPages();

    const pageInfo = document.getElementById("pageInfo");
    if (pageInfo && window.__PDF_DOC) {
      pageInfo.textContent = `Page 1 / ${window.__PDF_DOC.numPages}`;
    }
  });
}
