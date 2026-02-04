// ------------------------------------------------------------
// FileIO.js — Upload, drag/drop, save PDF, export/import redactions
// ------------------------------------------------------------

import {
  pdfDoc,
  pdfBytes,
  redactions,
  originalFileName,

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
  setZoom,
  setOriginalFileName,
  setStatus
} from "./Utils.js";

import { loadPDF } from "./PDF_Loader.js";
import { downloadBlob, getRedactedFilename } from "./Utils.js";

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
// initFileIO()
// ------------------------------------------------------------
export function initFileIO() {
  initUploadHandlers();
  initExportImportHandlers();
  initClearSession();
  initSavePdfButton();
}

// ------------------------------------------------------------
// Upload Handlers (click + drag/drop)
// ------------------------------------------------------------
function initUploadHandlers() {
  dropZone?.addEventListener("click", () => fileInput.click());

  fileInput?.addEventListener("change", async e => {
    const file = e.target.files[0];
    if (file) await handleFileUpload(file);
  });

  dropZone?.addEventListener("dragover", e => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone?.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone?.addEventListener("drop", async e => {
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
    return;
  }

  setOriginalFileName(file.name);
  fileNameLabel.textContent = file.name;

  const bytes = new Uint8Array(await file.arrayBuffer());
  await loadPDF(bytes);

  btnRedact.disabled = false;
  if (btnSavePdf) btnSavePdf.disabled = false;
}

// ------------------------------------------------------------
// Save PDF (manual redactions → backend)
// ------------------------------------------------------------
export async function applyManualRedactionsAndDownload() {
  if (!pdfBytes) {
    setStatus("Upload a PDF first.");
    return;
  }

  setStatus("Applying manual redactions...");

  const form = new FormData();
  form.append("file", new Blob([pdfBytes], { type: "application/pdf" }), "file.pdf");
  form.append("redactions", JSON.stringify(redactions));
  form.append("scrub_metadata", "true");

  try {
    const res = await fetch("http://127.0.0.1:8000/api/redact/manual", {
      method: "POST",
      body: form
    });

    if (!res.ok) {
      setStatus("Manual redaction failed.");
      return;
    }

    const blob = await res.blob();
    downloadBlob(blob, getRedactedFilename());
    setStatus("Manual redaction complete.");

  } catch (err) {
    console.error(err);
    setStatus("Manual redaction failed (backend not reachable).");
  }
}

function initSavePdfButton() {
  btnSavePdf?.addEventListener("click", async () => {
    await applyManualRedactionsAndDownload();
  });

  btnRedact?.addEventListener("click", async () => {
    await applyManualRedactionsAndDownload();
  });
}

// ------------------------------------------------------------
// Export / Import Redactions
// ------------------------------------------------------------
function initExportImportHandlers() {
  btnExportRedactions?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(redactions, null, 2)], {
      type: "application/json"
    });
    downloadBlob(blob, "redactions.json");
  });

  btnImportRedactions?.addEventListener("click", () => {
    importRedactionsInput.click();
  });

  importRedactionsInput?.addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const imported = JSON.parse(text);

      if (!Array.isArray(imported)) {
        setStatus("Invalid redactions file.");
        return;
      }

      setRedactions(imported);
      setStatus("Redactions imported.");
    } catch {
      setStatus("Failed to import redactions.");
    }
  });
}

// ------------------------------------------------------------
// Clear Session
// ------------------------------------------------------------
function initClearSession() {
  btnClear?.addEventListener("click", () => {
    setPdfDoc(null);
    setPdfBytes(null);
    setNumPages(0);
    setPageViews([]);
    setRedactions([]);
    setAutoRedactSuggestions([]);
    setUndoStack([]);
    setRedoStack([]);
    setSearchResults([]);
    setSearchIndex(0);
    setHighlightMode(false);
    setZoom(1.0);

    setStatus("Session cleared.");
    fileNameLabel.textContent = "";
  });
}