// frontend/app.js

// Core DOM elements
const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const fileNameEl = document.getElementById("fileName");
const btnRedact = document.getElementById("btnRedact");
const btnClear = document.getElementById("btnClear");
const statusText = document.getElementById("statusText");
const pdfViewer = document.getElementById("pdfViewer");
const templateListEl = document.getElementById("templateList");

// Redaction toolbar elements
const btnModeSelectText = document.getElementById("btnModeSelectText");
const btnModeDrawBox = document.getElementById("btnModeDrawBox");
const btnUndo = document.getElementById("btnUndo");
const btnRedo = document.getElementById("btnRedo");
const btnApplyTemplateRedact = document.getElementById("btnApplyTemplateRedact");
const btnApplyAutoRedact = document.getElementById("btnApplyAutoRedact");

// Overlay canvas
const redactOverlay = document.getElementById("redactOverlay");
const overlayCtx = redactOverlay ? redactOverlay.getContext("2d") : null;

let currentFile = null;
let currentPdfBlobUrl = null;

// Redaction state
let redactionMode = "select-text"; // "select-text" | "draw-box"
let isDrawing = false;
let startX = 0;
let startY = 0;
let currentRect = null;

// Each rect: { x, y, w, h }
let redactions = [];
let undoStack = [];
let redoStack = [];

// -----------------------------
// Helper: set status
// -----------------------------
function setStatus(msg, isError = false) {
  statusText.textContent = msg || "";
  statusText.style.color = isError ? "#fca5a5" : "#9ca3af";
}

// -----------------------------
// Helper: resize overlay to match viewer
// -----------------------------
function resizeOverlay() {
  if (!redactOverlay) return;
  const wrapper = redactOverlay.parentElement;
  if (!wrapper) return;

  const rect = wrapper.getBoundingClientRect();
  redactOverlay.width = rect.width;
  redactOverlay.height = rect.height;

  // Re-draw existing redactions after resize
  redrawOverlay();
}

// -----------------------------
// Helper: clear overlay
// -----------------------------
function clearOverlay() {
  if (!overlayCtx || !redactOverlay) return;
  overlayCtx.clearRect(0, 0, redactOverlay.width, redactOverlay.height);
}

// -----------------------------
// Helper: redraw all redactions
// -----------------------------
function redrawOverlay() {
  clearOverlay();
  if (!overlayCtx) return;

  overlayCtx.save();
  overlayCtx.lineWidth = 2;
  overlayCtx.strokeStyle = "rgba(248, 113, 113, 0.9)"; // red outline
  overlayCtx.fillStyle = "rgba(15, 23, 42, 0.95)"; // dark fill (like black box)

  redactions.forEach((r) => {
    overlayCtx.strokeRect(r.x, r.y, r.w, r.h);
    overlayCtx.fillRect(r.x, r.y, r.w, r.h);
  });

  // If currently drawing, show live outline
  if (currentRect) {
    overlayCtx.strokeStyle = "rgba(248, 250, 252, 0.9)";
    overlayCtx.setLineDash([6, 4]);
    overlayCtx.strokeRect(currentRect.x, currentRect.y, currentRect.w, currentRect.h);
    overlayCtx.setLineDash([]);
  }

  overlayCtx.restore();
}

// -----------------------------
// Load templates (optional endpoint)
// -----------------------------
async function loadTemplates() {
  if (!templateListEl) return;

  try {
    const res = await fetch("http://127.0.0.1:8000/api/templates");
    if (!res.ok) return;

    const data = await res.json();
    templateListEl.innerHTML = "";

    (data.templates || []).forEach((tpl) => {
      const li = document.createElement("li");
      li.textContent = tpl.display_name || tpl.company_id || "Unknown";
      if (tpl.is_default) li.textContent += " (default)";
      templateListEl.appendChild(li);
    });
  } catch {
    // silently ignore if endpoint not implemented yet
  }
}

// -----------------------------
// File selection
// -----------------------------
function handleFile(file) {
  if (!file || file.type !== "application/pdf") {
    setStatus("Please select a valid PDF file.", true);
    btnRedact.disabled = true;
    currentFile = null;
    fileNameEl.textContent = "";
    pdfViewer.src = "";
    clearOverlay();
    redactions = [];
    undoStack = [];
    redoStack = [];
    updateUndoRedoButtons();
    return;
  }

  currentFile = file;
  fileNameEl.textContent = file.name;
  btnRedact.disabled = false;
  setStatus("Ready to run auto redaction.");

  if (currentPdfBlobUrl) {
    URL.revokeObjectURL(currentPdfBlobUrl);
  }
  currentPdfBlobUrl = URL.createObjectURL(file);

  // For now we still load the raw PDF in the iframe.
  // Later, this can be switched to a full PDF.js viewer URL.
  pdfViewer.src = currentPdfBlobUrl;

  // Reset overlay + redactions
  redactions = [];
  undoStack = [];
  redoStack = [];
  updateUndoRedoButtons();

  // Ensure overlay matches viewer size
  setTimeout(resizeOverlay, 100);
}

// -----------------------------
// Input change
// -----------------------------
fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  handleFile(file);
});

// -----------------------------
// Drag & drop
// -----------------------------
["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove("dragover");
  });
});

dropZone.addEventListener("drop", (e) => {
  const dt = e.dataTransfer;
  const file = dt.files[0];
  handleFile(file);
});

// -----------------------------
// Redact button (existing auto-redact)
// -----------------------------
btnRedact.addEventListener("click", async () => {
  if (!currentFile) {
    setStatus("No file selected.", true);
    return;
  }

  setStatus("Uploading and running redaction...");
  btnRedact.disabled = true;

  try {
    const formData = new FormData();
    formData.append("file", currentFile);

    const res = await fetch("http://127.0.0.1:8000/api/redact/single", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      setStatus("Redaction failed. Check backend logs.", true);
      btnRedact.disabled = false;
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    // Trigger download
    const a = document.createElement("a");
    a.href = url;
    a.download = "redacted.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();

    setStatus("Redaction complete. Redacted PDF downloaded.");
  } catch (err) {
    console.error(err);
    setStatus("Error during redaction. See console/backend logs.", true);
  } finally {
    btnRedact.disabled = false;
  }
});

// -----------------------------
// Clear button
// -----------------------------
btnClear.addEventListener("click", () => {
  currentFile = null;
  fileInput.value = "";
  fileNameEl.textContent = "";
  pdfViewer.src = "";
  btnRedact.disabled = true;
  setStatus("");

  if (currentPdfBlobUrl) {
    URL.revokeObjectURL(currentPdfBlobUrl);
    currentPdfBlobUrl = null;
  }

  redactions = [];
  undoStack = [];
  redoStack = [];
  clearOverlay();
  updateUndoRedoButtons();
});

// -----------------------------
// Redaction mode switching
// -----------------------------
function setRedactionMode(mode) {
  redactionMode = mode;

  if (btnModeSelectText && btnModeDrawBox) {
    if (mode === "select-text") {
      btnModeSelectText.classList.add("btn-toggle-active");
      btnModeDrawBox.classList.remove("btn-toggle-active");
    } else {
      btnModeDrawBox.classList.add("btn-toggle-active");
      btnModeSelectText.classList.remove("btn-toggle-active");
    }
  }
}

if (btnModeSelectText) {
  btnModeSelectText.addEventListener("click", () => {
    setRedactionMode("select-text");
  });
}

if (btnModeDrawBox) {
  btnModeDrawBox.addEventListener("click", () => {
    setRedactionMode("draw-box");
  });
}

// -----------------------------
// Undo / Redo helpers
// -----------------------------
function updateUndoRedoButtons() {
  if (btnUndo) btnUndo.disabled = undoStack.length === 0;
  if (btnRedo) btnRedo.disabled = redoStack.length === 0;
}

function pushRedaction(rect) {
  redactions.push(rect);
  undoStack.push({ type: "add", rect });
  redoStack = [];
  updateUndoRedoButtons();
  redrawOverlay();
}

if (btnUndo) {
  btnUndo.addEventListener("click", () => {
    if (undoStack.length === 0) return;
    const action = undoStack.pop();
    if (action.type === "add") {
      // remove last matching rect
      const idx = redactions.lastIndexOf(action.rect);
      if (idx !== -1) {
        redactions.splice(idx, 1);
      }
      redoStack.push(action);
    }
    updateUndoRedoButtons();
    redrawOverlay();
  });
}

if (btnRedo) {
  btnRedo.addEventListener("click", () => {
    if (redoStack.length === 0) return;
    const action = redoStack.pop();
    if (action.type === "add") {
      redactions.push(action.rect);
      undoStack.push(action);
    }
    updateUndoRedoButtons();
    redrawOverlay();
  });
}

// -----------------------------
// Overlay mouse events (draw boxes / "text" areas)
// -----------------------------
function getOverlayCoords(evt) {
  const rect = redactOverlay.getBoundingClientRect();
  const x = evt.clientX - rect.left;
  const y = evt.clientY - rect.top;
  return { x, y };
}

if (redactOverlay && overlayCtx) {
  // We allow drawing in both modes for now; semantics differ, but UX is similar.
  redactOverlay.addEventListener("mousedown", (e) => {
    if (!currentFile) return;
    // Enable pointer events for drawing
    redactOverlay.style.pointerEvents = "auto";

    isDrawing = true;
    const { x, y } = getOverlayCoords(e);
    startX = x;
    startY = y;
    currentRect = { x, y, w: 0, h: 0 };
    redrawOverlay();
  });

  redactOverlay.addEventListener("mousemove", (e) => {
    if (!isDrawing || !currentRect) return;
    const { x, y } = getOverlayCoords(e);
    currentRect.w = x - startX;
    currentRect.h = y - startY;
    redrawOverlay();
  });

  const finishDrawing = () => {
    if (!isDrawing || !currentRect) return;
    isDrawing = false;

    // Normalize rect (ensure positive width/height)
    let { x, y, w, h } = currentRect;
    if (w < 0) {
      x = x + w;
      w = Math.abs(w);
    }
    if (h < 0) {
      y = y + h;
      h = Math.abs(h);
    }

    // Ignore tiny drags
    if (w > 5 && h > 5) {
      pushRedaction({ x, y, w, h, mode: redactionMode });
    }

    currentRect = null;
    redrawOverlay();

    // After drawing, we can disable pointer events so iframe remains interactive
    redactOverlay.style.pointerEvents = "none";
  };

  redactOverlay.addEventListener("mouseup", finishDrawing);
  redactOverlay.addEventListener("mouseleave", () => {
    if (isDrawing) finishDrawing();
  });
}

// -----------------------------
// Apply Template Redaction (stub to existing auto endpoint)
// -----------------------------
if (btnApplyTemplateRedact) {
  btnApplyTemplateRedact.addEventListener("click", async () => {
    if (!currentFile) {
      setStatus("No file selected.", true);
      return;
    }

    // For now, reuse the same endpoint as auto-redact.
    // Later, this can send template ID or redaction boxes.
    setStatus("Running template-based redaction...", false);

    try {
      const formData = new FormData();
      formData.append("file", currentFile);

      const res = await fetch("http://127.0.0.1:8000/api/redact/single", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        setStatus("Template redaction failed. Check backend logs.", true);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "redacted_template.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();

      setStatus("Template redaction complete. Redacted PDF downloaded.");
    } catch (err) {
      console.error(err);
      setStatus("Error during template redaction. See console/backend logs.", true);
    }
  });
}

// -----------------------------
// Apply Auto Redact Now (same as main button, but from toolbar)
// -----------------------------
if (btnApplyAutoRedact) {
  btnApplyAutoRedact.addEventListener("click", () => {
    // Just trigger the main auto-redact button
    btnRedact.click();
  });
}

// -----------------------------
// Init
// -----------------------------
setStatus("Waiting for PDF...");
btnRedact.disabled = true;
updateUndoRedoButtons();
loadTemplates();

// Resize overlay when window changes
window.addEventListener("resize", () => {
  resizeOverlay();
});
