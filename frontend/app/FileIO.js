// ------------------------------------------------------------
// FileIO.js — Upload, drag/drop, save PDF, export/import redactions
// FIXED: Configurable backend URL + frontend fallback
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

import { openPdfFromBytes } from "../app.js";
import { downloadBlob, getRedactedFilename } from "./Utils.js";

// ------------------------------------------------------------
// CONFIGURATION: Backend URL (changeable)
// ------------------------------------------------------------
const BACKEND_URL = "http://127.0.0.1:8000";  // ← Easy to change
const USE_BACKEND = true;  // ← Set to false for frontend-only mode

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

  // Show filename in UI
  fileNameLabel.textContent = file.name;

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Load PDF into viewer
  await openPdfFromBytes(bytes);

  btnRedact.disabled = false;
  if (btnSavePdf) btnSavePdf.disabled = false;
}

// ------------------------------------------------------------
// Convert redactions map → backend list format
// ------------------------------------------------------------
function flattenRedactionsMap(map) {
  const list = [];

  for (const page in map) {
    for (const r of map[page]) {
      // Handle both old and new rect formats
      const rectData = r.rect || (r.rects && r.rects[0]) || { x0: 0, y0: 0, x1: 1, y1: 1 };
      
      list.push({
        page: Number(page),
        type: r.type || "box",
        rects: r.rects || [rectData],
        color: r.color || "#000000"
      });
    }
  }

  return list;
}

// ------------------------------------------------------------
// Save PDF (manual redactions → backend)
// FIXED: Configurable backend URL + better error handling
// ------------------------------------------------------------
export async function applyManualRedactionsAndDownload() {
  if (!pdfBytes) {
    setStatus("Upload a PDF first.");
    return;
  }

  // Check if we have any redactions
  const flatList = flattenRedactionsMap(redactions);
  if (flatList.length === 0) {
    setStatus("No redactions to apply. Draw some boxes first.");
    return;
  }

  setStatus("Applying manual redactions...");

  if (!USE_BACKEND) {
    // FRONTEND-ONLY FALLBACK: Just export redactions as JSON
    setStatus("Frontend-only mode: Exporting redactions JSON...");
    const blob = new Blob([JSON.stringify(redactions, null, 2)], { type: "application/json" });
    downloadBlob(blob, "redactions.json");
    return;
  }

  const form = new FormData();
  form.append("file", new Blob([pdfBytes], { type: "application/pdf" }), "file.pdf");
  form.append("redactions", JSON.stringify(flatList));
  form.append("scrub_metadata", "true");

  try {
    const res = await fetch(`${BACKEND_URL}/api/redact/manual`, {  // ← Use configurable URL
      method: "POST",
      body: form
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Backend error:", errorText);
      setStatus(`Manual redaction failed: ${res.status}`);
      return;
    }

    const blob = await res.blob();
    downloadBlob(blob, getRedactedFilename());
    setStatus("Manual redaction complete.");

  } catch (err) {
    console.error(err);
    setStatus("Manual redaction failed (backend not reachable). Check if backend is running.");
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
    setStatus("Redactions exported.");
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

      let map = {};

      if (Array.isArray(imported)) {
        // Convert list → map
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
      
      // Re-render to show imported redactions
      const { renderAllPages } = await import("./PDF_Loader.js");
      await renderAllPages();
      
      setStatus("Redactions imported.");
    } catch (err) {
      console.error(err);
      setStatus("Failed to import redactions.");
    }
  });
}

async function detectCompany(pdfBytes) {
  const form = new FormData();
  form.append("file", new Blob([pdfBytes], { type: "application/pdf" }), "doc.pdf");

  const res = await fetch("/api/detect-company", {
    method: "POST",
    body: form
  });

  const data = await res.json();
  return data.company_id || null;
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

    // IMPORTANT: reset to map, not list
    setRedactions({});

    setAutoRedactSuggestions([]);
    setUndoStack([]);
    setRedoStack([]);
    setSearchResults([]);
    setSearchIndex(0);
    setHighlightMode(false);

    // Clear UI
    fileNameLabel.textContent = "";
    document.getElementById("pdfPagesColumn").innerHTML = "";
    
    setStatus("Session cleared.");
  });
}