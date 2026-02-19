// ------------------------------------------------------------
// Events.js — Central event wiring (Unified + Integrated)
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
  setSelectionMode,
  selectionMode,
  setStatus
} from "./Utils.js";

import { performSearch, updateSearchInfo, scrollToSearchResult } from "./Search.js";
import { initFileIO } from "./FileIO.js";

import { attachTextSelectionHandlers } from "./Redaction_TextSelect.js";
import { attachBoxRedactionHandlers } from "./Redaction_Box.js";

import {
  attachAutoRedactionHandlers,
  runAutoRedact,
  applyAutoRedactions,
  clearAutoRedactions
} from "./Redaction_Auto.js";

import { toggleReviewMode, toggleShowOnlyAuto } from "./Review_Mode.js";
import { pushUndo, restoreState } from "./Redaction_Core.js";
import { renderAllPages } from "./PDF_Loader.js";

// ⭐ AnnotationEngine kept ONLY for INK/HIGHLIGHT/POLYGON
import { setAnnotationTool, AnnotationTool } from "./AnnotationEngine.js";

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

const pageInput = document.getElementById("pageInput");
const pageTotal = document.getElementById("pageTotal");

// ------------------------------------------------------------
// Listener registry
// ------------------------------------------------------------
let registeredListeners = [];

export function addListener(target, event, handler) {
  if (!target) return;
  target.addEventListener(event, handler);
  registeredListeners.push({ target, event, handler });
}

export function cleanupListeners() {
  for (const { target, event, handler } of registeredListeners) {
    target.removeEventListener(event, handler);
  }
  registeredListeners = [];
}

// ------------------------------------------------------------
// Attach handlers to all page views
// ------------------------------------------------------------
function attachHandlersToAllPages() {
  for (const view of pageViews) {
    if (!view) continue;

    attachTextSelectionHandlers(view.textLayerDiv, view);
    attachBoxRedactionHandlers(view.overlay, view);
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
    const newMap = structuredClone(redactions);

    for (const r of searchResults) {
      const page = r.page;
      if (!newMap[page]) newMap[page] = [];
      newMap[page].push({
        page,
        type: "search",
        rects: r.rects,
        color: document.getElementById("redactionColor").value || "#000000"
      });
    }

    setRedactions(newMap);
    await renderAllPages();
  });
}

// ------------------------------------------------------------
// Auto-redaction controls
// ------------------------------------------------------------
function initAutoRedactionControls() {
  const btnAutoBarcodes = document.getElementById("btnAutoBarcodes");

  addListener(btnAutoBarcodes, "click", () => {
    runAutoRedact("/api/redact/auto-suggest-barcodes");
  });

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
// Undo / Redo controls
// ------------------------------------------------------------
function initUndoRedoControls() {
  addListener(btnUndo, "click", () => restoreState(undoStack, redoStack));
  addListener(btnRedo, "click", () => restoreState(redoStack, undoStack));
}

// ------------------------------------------------------------
// Redaction mode controls
// ------------------------------------------------------------
function initRedactionModeControls() {
  addListener(btnModeSelectText, "click", () => {
    setSelectionMode("text");
    setAnnotationTool(AnnotationTool.NONE);

    document.querySelectorAll(".overlay-canvas").forEach(c => {
      c.style.pointerEvents = "none";
    });

    btnModeSelectText.classList.add("btn-toggle-active");
    btnModeDrawBox.classList.remove("btn-toggle-active");

    setStatus("Tool: text-selection");
  });

  addListener(btnModeDrawBox, "click", () => {
    setSelectionMode("box");
    setAnnotationTool(AnnotationTool.NONE);

    document.querySelectorAll(".overlay-canvas").forEach(c => {
      c.style.pointerEvents = "auto";
    });

    btnModeDrawBox.classList.add("btn-toggle-active");
    btnModeSelectText.classList.remove("btn-toggle-active");

    setStatus("Tool: box-redaction");
  });
}

// ------------------------------------------------------------
// Page jump + scroll-aware page indicator
// ------------------------------------------------------------
function initPageJumpControls() {
  const scroll = document.querySelector(".pdf-scroll-container");
  if (!pageInput || !pageTotal) return;

  addListener(document, "pdf-loaded", () => {
    if (window.__PDF_DOC) {
      pageInput.value = 1;
      pageTotal.textContent = `/ ${window.__PDF_DOC.numPages}`;
    }
  });

  addListener(pageInput, "keydown", (e) => {
    if (e.key !== "Enter") return;
    if (!window.__PDF_DOC) return;

    let target = parseInt(pageInput.value, 10);
    if (isNaN(target)) return;

    target = Math.max(1, Math.min(target, window.__PDF_DOC.numPages));

    const view = pageViews.find(v => v.pageNumber === target);
    if (!view) return;

    scroll.scrollTo({
      top: view.wrapper.offsetTop - 40,
      behavior: "smooth"
    });
  });

  if (scroll) {
    addListener(scroll, "scroll", () => {
      for (const view of pageViews) {
        const rect = view.wrapper.getBoundingClientRect();
        const mid = window.innerHeight * 0.4;

        if (rect.top < mid && rect.bottom > mid) {
          pageInput.value = view.pageNumber;
          break;
        }
      }
    });
  }
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
  initPageJumpControls();

  addListener(document, "pages-rendered", () => {
    attachHandlersToAllPages();

    const mode = selectionMode;
    document.querySelectorAll(".overlay-canvas").forEach(c => {
      c.style.pointerEvents = (mode === "box") ? "auto" : "none";
    });

    const pageInfo = document.getElementById("pageInfo");
    if (pageInfo && window.__PDF_DOC) {
      pageInfo.textContent = `Page 1 / ${window.__PDF_DOC.numPages}`;
    }
  });
}
