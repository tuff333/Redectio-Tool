// ------------------------------------------------------------
// FileIO.js — Upload, drag/drop, save PDF, export/import redactions
// FIXED: textStore reset, highlightMode default true, safe rect validation
// FIXED: double file picker (one-time init + addListener registry)
// ------------------------------------------------------------

import {
  pdfBytes,
  redactions,
  setPdfDoc,
  setPdfBytes,
  setNumPages,
  setPageViews,
  setRedactions,
  setAutoRedactSuggestions,
  setUndoStack,
  setRedoStack,
  setSearchResults,
  setSearchIndex,
  setHighlightMode,
  setStatus
} from "./Utils.js";

import { clearTextStore } from "./TextLayer.js";
import { loadPDF } from "../app.js";
import { downloadBlob, getRedactedFilename } from "./Utils.js";

// ⭐ Import global listener registry from Events.js
import { addListener } from "./Events.js";

// ⭐ One-time initialization guard
let fileIOInitialized = false;

// DOM elements
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const fileNameLabel = document.getElementById("fileName");
const btnRedact = document.getElementById("btnRedact");
const btnSavePdf = document.getElementById("btnSavePdf");
const btnClear = document.getElementById("btnClear");

const btnExportRedactions = document.getElementById("btnExportRedactions");
const btnImportRedactions = document.getElementById("btnImportRedactions");
const importRedactionsInput = document.getElementById("importRedactionsInput");

// ------------------------------------------------------------
// initFileIO() — now guaranteed to run ONCE
// ------------------------------------------------------------
export function initFileIO() {
  if (fileIOInitialized) return;   // ← prevents double initialization
  fileIOInitialized = true;

  initUploadHandlers();
  initExportImportHandlers();
  initClearSession();
  initSavePdfButton();
}

// ------------------------------------------------------------
// Upload Handlers (click + drag/drop)
// ------------------------------------------------------------
function initUploadHandlers() {
  addListener(dropZone, "click", (e) => {
    // ⭐ Prevent double file picker:
    // If the click originated on the actual file input, do nothing.
    if (e.target === fileInput || e.target.closest("input[type='file']")) {
      return;
    }

    // Ignore clicks on buttons inside the dropzone
    if (e.target.tagName === "BUTTON" || e.target.closest("button")) return;

    // Otherwise, manually trigger the file dialog
    fileInput?.click();
  });

  addListener(fileInput, "change", async (e) => {
    const file = e.target.files[0];
    if (file) await handleFileUpload(file);
  });

  addListener(dropZone, "dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  addListener(dropZone, "dragleave", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
  });

  addListener(dropZone, "drop", async (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");

    const file = e.dataTransfer.files[0];
    if (file) await handleFileUpload(file);
  });
}

// ------------------------------------------------------------
// handleFileUpload(file)
// ------------------------------------------------------------
async function handleFileUpload(file) {
  if (!file || file.type !== "application/pdf") {
    setStatus("Please upload a valid PDF file.");
    alert("Please upload a valid PDF file.");
    return;
  }

  if (fileNameLabel) fileNameLabel.textContent = file.name;

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());

    clearTextStore();
    setHighlightMode(true);

    await loadPDF(bytes);

    if (btnRedact) btnRedact.disabled = false;
    if (btnSavePdf) btnSavePdf.disabled = false;

    setStatus(`Loaded: ${file.name}`);
  } catch (err) {
    console.error("[FileIO] Error loading PDF:", err);
    setStatus("Error loading PDF");
    alert("Error loading PDF: " + err.message);
  }
}

// ------------------------------------------------------------
// SAFE rect validation
// ------------------------------------------------------------
function validateRect(rect) {
  if (!rect) return { x0: 0, y0: 0, x1: 1, y1: 1 };

  const x0 = Number(rect.x0);
  const y0 = Number(rect.y0);
  const x1 = Number(rect.x1);
  const y1 = Number(rect.y1);

  if ([x0, y0, x1, y1].some((v) => isNaN(v))) {
    return { x0: 0, y0: 0, x1: 1, y1: 1 };
  }

  return {
    x0: Math.min(Math.max(x0, 0), 1),
    y0: Math.min(Math.max(y0, 0), 1),
    x1: Math.min(Math.max(x1, 0), 1),
    y1: Math.min(Math.max(y1, 0), 1)
  };
}

// ------------------------------------------------------------
// Convert redactions map → backend list format
// ------------------------------------------------------------
function flattenRedactionsMap(map) {
  const list = [];

  for (const page in map) {
    for (const r of map[page]) {
      const rects = Array.isArray(r.rects)
        ? r.rects.map(validateRect)
        : [validateRect(r.rect)];

      list.push({
        page: Number(page),
        type: r.type || "box",
        rects,
        color: r.color || "#000000"
      });
    }
  }

  return list;
}

// ------------------------------------------------------------
// Save PDF (manual redactions → backend)
// ------------------------------------------------------------
export async function applyManualRedactionsAndDownload() {
  if (!pdfBytes) {
    setStatus("Upload a PDF first.");
    alert("Please upload a PDF first.");
    return;
  }

  const flatList = flattenRedactionsMap(redactions);
  if (flatList.length === 0) {
    setStatus("No redactions to apply.");
    alert("No redactions to apply.");
    return;
  }

  setStatus("Applying manual redactions...");

  const form = new FormData();
  form.append("file", new Blob([pdfBytes], { type: "application/pdf" }), "file.pdf");
  form.append("redactions", JSON.stringify(flatList));
  form.append("scrub_metadata", "true");

  try {
    const res = await fetch("http://127.0.0.1:8000/api/redact/manual", {
      method: "POST",
      body: form
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Backend error:", errorText);
      setStatus(`Manual redaction failed: ${res.status}`);
      alert(`Redaction failed: ${res.status}`);
      return;
    }

    const blob = await res.blob();
    downloadBlob(blob, getRedactedFilename(fileNameLabel?.textContent || "document.pdf"));
    setStatus("Manual redaction complete.");
  } catch (err) {
    console.error(err);
    setStatus("Manual redaction failed (backend not reachable).");
    alert("Backend not reachable. Is the server running on port 8000?");
  }
}

function initSavePdfButton() {
  addListener(btnSavePdf, "click", async () => {
    await applyManualRedactionsAndDownload();
  });

  addListener(btnRedact, "click", async () => {
    await applyManualRedactionsAndDownload();
  });
}

// ------------------------------------------------------------
// Export / Import Redactions
// ------------------------------------------------------------
function initExportImportHandlers() {
  addListener(btnExportRedactions, "click", () => {
    const blob = new Blob([JSON.stringify(redactions, null, 2)], {
      type: "application/json"
    });
    downloadBlob(blob, "redactions.json");
    setStatus("Redactions exported.");
  });

  addListener(btnImportRedactions, "click", () => {
    importRedactionsInput?.click();
  });

  addListener(importRedactionsInput, "change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const imported = JSON.parse(text);

      let map = {};

      if (Array.isArray(imported)) {
        for (const r of imported) {
          const page = r.page;
          if (!map[page]) map[page] = [];
          map[page].push(r);
        }
      } else if (typeof imported === "object") {
        map = imported;
      } else {
        setStatus("Invalid redactions file.");
        return;
      }

      setRedactions(map);

      const { renderAllPages } = await import("./PDF_Loader.js");
      await renderAllPages();

      setStatus("Redactions imported.");
    } catch (err) {
      console.error(err);
      setStatus("Failed to import redactions.");
    }
  });
}

// ------------------------------------------------------------
// Clear Session
// ------------------------------------------------------------
function initClearSession() {
  addListener(btnClear, "click", () => {
    setPdfDoc(null);
    setPdfBytes(null);
    setNumPages(0);
    setPageViews([]);

    setRedactions({});
    setAutoRedactSuggestions([]);
    setUndoStack([]);
    setRedoStack([]);
    setSearchResults([]);
    setSearchIndex(0);

    clearTextStore();
    setHighlightMode(true);

    if (fileNameLabel) fileNameLabel.textContent = "";
    const pdfContainer = document.getElementById("pdfPagesColumn");
    if (pdfContainer) pdfContainer.innerHTML = "";

    setStatus("Session cleared.");
  });
}
