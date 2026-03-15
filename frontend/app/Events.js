// frontend/app/Events.js
// Central event wiring (keeps existing UI behavior, integrates strict PII + barcode flow)

import {
  pageViews,
  searchResults,
  searchIndex,
  highlightMode,
  redactions,
  undoStack,
  redoStack,
  autoRedactSuggestions,
  setSearchIndex,
  setHighlightMode,
  setRedactions,
  setSelectionMode,
  selectionMode,
  setStatus,
  originalPdfBytes,
  setAutoRedactSuggestions,
  currentPageVisible
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
import { detectCompanyFromBackend } from "./Template_Detect_Backend.js";
import { loadTemplateForCompany } from "./Template_UI.js";

// Review + zoom
import { toggleReviewMode, toggleShowOnlyAuto } from "./Review_Mode.js";
import { initZoomControls } from "./Zoom_Pan.js";

import { pushUndo, restoreState } from "./Redaction_Core.js";
import { renderAllPages } from "./PDF_Loader.js";
import { setAnnotationTool, AnnotationTool } from "./AnnotationEngine.js";

// DOM
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
const btnAutoSuggest = document.getElementById("btnAutoSuggest");
const btnAutoBarcodes = document.getElementById("btnAutoBarcodes");
const btnPreviewZones = document.getElementById("btnPreviewZones");
const btnReviewMode = document.getElementById("btnReviewMode");
const btnShowOnlyAuto = document.getElementById("btnShowOnlyAuto");
const btnUndo = document.getElementById("btnUndo");
const btnRedo = document.getElementById("btnRedo");
const pageInput = document.getElementById("pageInput");
const pageTotal = document.getElementById("pageTotal");

// listener registry
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

// Attach per-page handlers (text select, box, auto-suggest hit‑test)
export function attachHandlersToPageViews() {
  cleanupListeners();

  for (const view of pageViews) {
    // Text selection on overlay (uses textStore internally)
    attachTextSelectionHandlers(view, addListener);

    // Box redaction + resize/move on overlay
    attachBoxRedactionHandlers(view, addListener);

    // Auto-suggest hover + click on overlay
    attachAutoRedactionHandlers(view, addListener);
  }
}

// ------------------------------------------------------------
// Search controls
// ------------------------------------------------------------
function initSearchControls() {
  if (btnSearchPrev) {
    btnSearchPrev.addEventListener("click", () => {
      if (!searchResults.length) return;
      let idx = searchIndex - 1;
      if (idx < 0) idx = searchResults.length - 1;
      setSearchIndex(idx);
      const result = searchResults[idx];
      if (result) scrollToSearchResult(result);
      updateSearchInfo();
    });
  }

  if (btnSearchNext) {
    btnSearchNext.addEventListener("click", () => {
      if (!searchResults.length) return;
      let idx = searchIndex + 1;
      if (idx >= searchResults.length) idx = 0;
      setSearchIndex(idx);
      const result = searchResults[idx];
      if (result) scrollToSearchResult(result);
      updateSearchInfo();
    });
  }

  if (btnSearchRedactAll) {
    btnSearchRedactAll.addEventListener("click", () => {
      if (!searchResults.length) return;
      pushUndo();
      const map = structuredClone(redactions || {});
      for (const r of searchResults) {
        const page = r.page;
        if (!map[page]) map[page] = [];
        map[page].push({
          page,
          type: "search",
          rects: r.rects,
          color: "#000000"
        });
      }
      setRedactions(map);
      renderAllPages();
      setStatus("Search matches redacted.");
    });
  }

  if (btnToggleHighlight) {
    btnToggleHighlight.addEventListener("click", () => {
      setHighlightMode(!highlightMode);
      btnToggleHighlight.classList.toggle("btn-toggle-active", highlightMode);
      renderAllPages();
    });
  }
}

// ------------------------------------------------------------
// Mode buttons (text vs box, annotations)
// ------------------------------------------------------------
function initModeButtons() {
  if (btnModeSelectText) {
    btnModeSelectText.addEventListener("click", () => {
      setSelectionMode("text");
      btnModeSelectText.classList.add("btn-toggle-active");
      btnModeDrawBox?.classList.remove("btn-toggle-active");
    });
  }

  if (btnModeDrawBox) {
    btnModeDrawBox.addEventListener("click", () => {
      setSelectionMode("box");
      btnModeDrawBox.classList.add("btn-toggle-active");
      btnModeSelectText?.classList.remove("btn-toggle-active");
    });
  }

  const btnRedactCurrentPage = document.getElementById("btnRedactCurrentPage");
  if (btnRedactCurrentPage) {
    btnRedactCurrentPage.addEventListener("click", () => {
      const page = currentPageVisible;
      if (!page) return;

      pushUndo();
      const newMap = structuredClone(redactions || {});
      newMap[page] = [{
        page,
        type: "box",
        rects: [{ x0: 0, y0: 0, x1: 1, y1: 1 }],
        color: document.getElementById("redactionColor")?.value || "#000000"
      }];

      setRedactions(newMap);
      renderAllPages();
      setStatus(`Redacted entire page ${page}.`);
    });
  }

  const btnAnnotHighlight = document.getElementById("btnAnnotHighlight");
  const btnAnnotNote = document.getElementById("btnAnnotNote");

  if (btnAnnotHighlight) {
    btnAnnotHighlight.addEventListener("click", () => {
      setAnnotationTool(AnnotationTool.Highlight);
    });
  }
  if (btnAnnotNote) {
    btnAnnotNote.addEventListener("click", () => {
      setAnnotationTool(AnnotationTool.Note);
    });
  }
}

// ------------------------------------------------------------
// Auto‑redaction buttons
// ------------------------------------------------------------
function initAutoButtons() {
  if (btnAutoPatterns) {
    btnAutoPatterns.addEventListener("click", async () => {
      if (!originalPdfBytes || !originalPdfBytes.length) {
        setStatus("Upload a PDF first.");
        return;
      }
      setStatus("Running pattern-based auto-suggest...");
      await runAutoRedact("/api/redact/auto-suggest");
    });
  }

  if (btnAutoOCR) {
    btnAutoOCR.addEventListener("click", async () => {
      if (!originalPdfBytes || !originalPdfBytes.length) {
        setStatus("Upload a PDF first.");
        return;
      }
      setStatus("Running OCR-based auto-suggest...");
      await runAutoRedact("/api/redact/auto-suggest-ocr");
    });
  }

  if (btnAutoSuggest) {
    btnAutoSuggest.addEventListener("click", async () => {
      if (!originalPdfBytes || !originalPdfBytes.length) {
        setStatus("Upload a PDF first.");
        return;
      }
      setStatus("Running template-based auto-suggest...");
      await runAutoRedact("/redact/template");
    });
  }

  if (btnAutoBarcodes) {
    btnAutoBarcodes.addEventListener("click", async () => {
      if (!originalPdfBytes || !originalPdfBytes.length) {
        setStatus("Upload a PDF first.");
        return;
      }
      setStatus("Detecting barcodes...");
      await runAutoRedact("/api/redact/auto-suggest-barcodes");
    });
  }

  if (btnAutoApply) {
    btnAutoApply.addEventListener("click", async () => {
      await applyAutoRedactions();
    });
  }

  if (btnAutoClear) {
    btnAutoClear.addEventListener("click", async () => {
      await clearAutoRedactions();
    });
  }

  if (btnPreviewZones) {
    btnPreviewZones.addEventListener("click", async () => {
      window.previewZonesEnabled = !window.previewZonesEnabled;
      btnPreviewZones.classList.toggle("btn-toggle-active", window.previewZonesEnabled);
      await renderAllPages();
      setStatus(window.previewZonesEnabled ? "Zone preview enabled." : "Zone preview disabled.");
    });
  }
}

// ------------------------------------------------------------
// Review mode / show-only-auto
// ------------------------------------------------------------
function initReviewButtons() {
  if (btnReviewMode) {
    btnReviewMode.addEventListener("click", async () => {
      toggleReviewMode();
      btnReviewMode.classList.toggle("btn-toggle-active");
      await renderAllPages();
    });
  }

  if (btnShowOnlyAuto) {
    btnShowOnlyAuto.addEventListener("click", async () => {
      toggleShowOnlyAuto();
      btnShowOnlyAuto.classList.toggle("btn-toggle-active");
      await renderAllPages();
    });
  }
}

// ------------------------------------------------------------
// Undo / Redo
// ------------------------------------------------------------
function initUndoRedo() {
  if (btnUndo) {
    btnUndo.addEventListener("click", () => {
      if (!undoStack.length) return;
      // Use core helper to move from undoStack → redoStack
      restoreState(undoStack, redoStack);
      setStatus("Undo.");
    });
  }

  if (btnRedo) {
    btnRedo.addEventListener("click", () => {
      if (!redoStack.length) return;
      // Use core helper to move from redoStack → undoStack
      restoreState(redoStack, undoStack);
      setStatus("Redo.");
    });
  }
}

// ------------------------------------------------------------
// Page navigation (direct page input)
// ------------------------------------------------------------
function initPageNavigation() {
  if (!pageInput || !pageTotal) return;

  pageInput.addEventListener("change", () => {
    const val = parseInt(pageInput.value, 10);
    if (!Number.isFinite(val)) return;
    const max = parseInt(pageTotal.textContent.replace("/", "").trim() || "1", 10) || 1;
    const page = Math.min(Math.max(val, 1), max);
    const view = pageViews.find(v => v.pageNumber === page);
    if (view && view.wrapper) {
      view.wrapper.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

// ------------------------------------------------------------
// Company detection (optional button)
// ------------------------------------------------------------
function initCompanyDetection() {
  const btnDetectCompany = document.getElementById("btnDetectCompany");
  if (!btnDetectCompany) return;

  btnDetectCompany.addEventListener("click", async () => {
    if (!originalPdfBytes || !originalPdfBytes.length) {
      setStatus("Upload a PDF first before detecting company.");
      return;
    }
    setStatus("Detecting company from backend...");
    const cid = await detectCompanyFromBackend();
    if (cid) {
      await loadTemplateForCompany(cid);
      setStatus(`Template loaded for company: ${cid}`);
    }
  });
}

// ------------------------------------------------------------
// initApp — called from app.js after DOMContentLoaded
// ------------------------------------------------------------
export function initApp() {
  initFileIO();

  initSearchControls();
  initModeButtons();
  initAutoButtons();
  initReviewButtons();
  initUndoRedo();
  initPageNavigation();
  initCompanyDetection();

  // Enable Zoom/Pan system
  initZoomControls();

  // Expose helper so PDF_Loader can reattach handlers after each load if needed
  window.attachHandlersToPageViews = attachHandlersToPageViews;

  // When all pages are rendered: attach handlers + update page count
  document.addEventListener("pages-rendered", () => {
    attachHandlersToPageViews();

    const total = window.__PDF_DOC?.numPages || 1;
    if (pageTotal) {
      pageTotal.textContent = `/ ${total}`;
    }
  });

  setStatus("Ready.");
}
