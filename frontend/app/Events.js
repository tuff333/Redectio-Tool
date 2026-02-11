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
  setRedactions
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
// GLOBAL LISTENER REGISTRY (for buttons / document events)
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

// ⭐ EXPORT THESE — required by FileIO.js
export { addListener, cleanupListeners };

// ------------------------------------------------------------
// Attach handlers to every page view
// ------------------------------------------------------------
function attachHandlersToAllPages() {
  // Page views are recreated on each renderAllPages(),
  // so we attach handlers once per view here.
  for (const view of pageViews) {
    if (!view) continue;

    // Box redaction (overlay canvas)
    attachBoxRedactionHandlers(view.overlay, view);

    // Text selection (text layer div)
    attachTextSelectionHandlers(view.textLayerDiv, view);

    // Auto‑redaction hover/click (uses addListener registry)
    attachAutoRedactionHandlers(view, addListener);
  }
}

// ------------------------------------------------------------
// Search controls
// ------------------------------------------------------------
function initSearchControls() {
  addListener(btnSearchPrev, "click", () => {
    if (!searchResults.length) return;
    const newIndex =
      (searchIndex - 1 + searchResults.length) % searchResults.length;
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
    btnModeSelectText.classList.add("btn-toggle-active");
    btnModeDrawBox.classList.remove("btn-toggle-active");
  });

  addListener(btnModeDrawBox, "click", () => {
    btnModeDrawBox.classList.add("btn-toggle-active");
    btnModeSelectText.classList.remove("btn-toggle-active");
  });
}

// ------------------------------------------------------------
// initApp()
// ------------------------------------------------------------
export function initApp() {
  // File IO (upload, drag/drop, etc.) — called ONCE
  initFileIO();

  // Global controls
  initSearchControls();
  initAutoRedactionControls();
  initReviewModeControls();
  initUndoRedoControls();
  initRedactionModeControls();

  // When pages are rendered (initial load, zoom, undo/redo, etc.),
  // attach per‑page handlers to the fresh DOM nodes.
  addListener(document, "pages-rendered", () => {
    attachHandlersToAllPages();

    const pageInfo = document.getElementById("pageInfo");
    if (pageInfo && window.__PDF_DOC) {
      pageInfo.textContent = `Page 1 / ${window.__PDF_DOC.numPages}`;
    }
  });
}
