// ------------------------------------------------------------
// FileIO.js — Upload, drag/drop, save PDF, export/import redactions
// FIXED: Click handler and event listeners
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

import { loadPDF } from "../app.js";
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
// FIXED: Added proper click handler and event propagation
// ------------------------------------------------------------
function initUploadHandlers() {
  // FIXED: Direct click on dropzone opens file dialog
  dropZone?.addEventListener("click", (e) => {
    // Don't trigger if clicking on buttons inside dropzone
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
      return;
    }
    console.log("[FileIO] Dropzone clicked, opening file dialog");
    fileInput?.click();
  });

  // File input change handler
  fileInput?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file) {
      console.log("[FileIO] File selected:", file.name);
      await handleFileUpload(file);
    }
  });

  // Drag over
  dropZone?.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add("dragover");
  });

  // Drag leave
  dropZone?.addEventListener("dragleave", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove("dragover");
  });

  // Drop
  dropZone?.addEventListener("drop", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove("dragover");

    const file = e.dataTransfer.files[0];
    if (file) {
      console.log("[FileIO] File dropped:", file.name);
      await handleFileUpload(file);
    }
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

  // Show filename in UI
  if (fileNameLabel) {
    fileNameLabel.textContent = file.name;
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    console.log("[FileIO] PDF loaded, size:", bytes.length, "bytes");

    // Load PDF into viewer
    await loadPDF(bytes);

    // Enable buttons
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
// ------------------------------------------------------------
export async function applyManualRedactionsAndDownload() {
  if (!pdfBytes) {
    setStatus("Upload a PDF first.");
    alert("Please upload a PDF first.");
    return;
  }

  // Check if we have any redactions
  const flatList = flattenRedactionsMap(redactions);
  if (flatList.length === 0) {
    setStatus("No redactions to apply. Draw some boxes first.");
    alert("No redactions to apply. Draw some boxes first.");
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
    importRedactionsInput?.click();
  });

  importRedactionsInput?.addEventListener("change", async (e) => {
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

// ------------------------------------------------------------
// Clear Session
// ------------------------------------------------------------
function initClearSession() {
  btnClear?.addEventListener("click", () => {
    setPdfDoc(null);
    setPdfBytes(null);
    setNumPages(0);
    setPageViews([]);

    // Reset to map, not list
    setRedactions({});

    setAutoRedactSuggestions([]);
    setUndoStack([]);
    setRedoStack([]);
    setSearchResults([]);
    setSearchIndex(0);
    setHighlightMode(false);

    // Clear UI
    if (fileNameLabel) fileNameLabel.textContent = "";
    const pdfContainer = document.getElementById("pdfPagesColumn");
    if (pdfContainer) pdfContainer.innerHTML = "";
    
    setStatus("Session cleared.");
  });
}
