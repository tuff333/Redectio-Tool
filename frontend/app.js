// ------------------------------------------------------------
// Redectio – Multi-page Scroll PDF.js Viewer + Redaction Engine
// ------------------------------------------------------------

import * as pdfjsLib from "./pdfjs/pdf.mjs";
import { TextLayerBuilder } from "./pdfjs/text_layer_builder.js";
pdfjsLib.GlobalWorkerOptions.workerSrc = "./pdfjs/pdf.worker.mjs";

// ---------- DOM elements ----------

// Upload panel
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const fileNameLabel = document.getElementById("fileName");
const statusText = document.getElementById("statusText");
const btnRedact = document.getElementById("btnRedact");
const btnClear = document.getElementById("btnClear");

// Navigation tools
const searchInput = document.getElementById("searchInput");
const btnSearchPrev = document.getElementById("btnSearchPrev");
const btnSearchNext = document.getElementById("btnSearchNext");
const btnSearchRedactAll = document.getElementById("btnSearchRedactAll");
const btnToggleHighlight = document.getElementById("btnToggleHighlight");
const searchInfo = document.getElementById("searchInfo");

// View controls
const btnZoomIn = document.getElementById("btnZoomIn");
const btnZoomOut = document.getElementById("btnZoomOut");
const btnPanMode = document.getElementById("btnPanMode");
const zoomInfo = document.getElementById("zoomInfo");

// Redaction tools
const btnModeSelectText = document.getElementById("btnModeSelectText");
const btnModeDrawBox = document.getElementById("btnModeDrawBox");
const btnUndo = document.getElementById("btnUndo");
const btnRedo = document.getElementById("btnRedo");

const btnAutoRedactMenu = document.getElementById("btnAutoRedactMenu");
const autoRedactDropdown = document.getElementById("autoRedactDropdown");
const btnAutoTemplate = document.getElementById("btnAutoTemplate");
const btnAutoPatterns = document.getElementById("btnAutoPatterns");
const btnAutoOCR = document.getElementById("btnAutoOCR");
const btnAutoApply = document.getElementById("btnAutoApply");
const btnAutoClear = document.getElementById("btnAutoClear");
const btnApplyTemplateRedact = document.getElementById("btnApplyTemplateRedact");
const btnRedactCurrentPage = document.getElementById("btnRedactCurrentPage");

const btnExportRedactions = document.getElementById("btnExportRedactions");
const btnImportRedactions = document.getElementById("btnImportRedactions");
const importRedactionsInput = document.getElementById("importRedactionsInput");

const redactionColorInput = document.getElementById("redactionColor");

// Viewer
const pdfPagesColumn = document.getElementById("pdfPagesColumn");
const pageInfo = document.getElementById("pageInfo");
const pdfScrollContainer = document.querySelector(".pdf-scroll-container");
const dropdownArea = document.querySelector(".dropdown");

// Templates (sidebar)
const templateListEl = document.getElementById("templateList");

// LEFT PANEL (for scrolling fix)
const leftPanel = document.querySelector(".left-panel");
if (leftPanel) {
  leftPanel.style.overflowY = "auto";
}

// ---------- State ----------

let pdfDoc = null;
let pdfBytes = null;
let numPages = 0;

let zoom = 1.0;
let panMode = false;

let pageViews = []; // [{ pageNumber, page, container, canvas, overlay, textLayer, baseScale }]

let redactions = []; // [{ page, type, rects, color }]
let autoRedactSuggestions = [];

let undoStack = [];
let redoStack = [];

let highlightMode = false;
let searchResults = []; // [{ page }]
let searchIndex = 0;

let currentPageVisible = 0;

// ---------- Utility ----------

function setStatus(msg) {
  statusText.textContent = msg || "";
}

function pushUndo() {
  undoStack.push(JSON.stringify(redactions));
  btnUndo.disabled = undoStack.length === 0;
  redoStack = [];
  btnRedo.disabled = true;
}

function restoreState(stackFrom, stackTo) {
  if (stackFrom.length === 0) return;
  stackTo.push(JSON.stringify(redactions));
  const state = JSON.parse(stackFrom.pop());
  redactions = state;
  btnUndo.disabled = undoStack.length === 0;
  btnRedo.disabled = redoStack.length === 0;
  renderAllPages();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function normalizeRect(x0, y0, x1, y1, width, height) {
  return {
    x0: Math.min(x0, x1) / width,
    y0: Math.min(y0, y1) / height,
    x1: Math.max(x0, x1) / width,
    y1: Math.max(y0, y1) / height
  };
}

// ---------- Templates (sidebar) ----------

async function loadTemplates() {
  if (!templateListEl) return;
  try {
    const res = await fetch("http://127.0.0.1:8000/api/templates");
    if (!res.ok) return;
    const data = await res.json();
    templateListEl.innerHTML = "";
    (data.templates || []).forEach(tpl => {
      const li = document.createElement("li");
      li.textContent = tpl.display_name || tpl.company_id || "Unknown";
      if (tpl.is_default) li.textContent += " (default)";
      templateListEl.appendChild(li);
    });
  } catch {
    // optional
  }
}

// ---------- PDF loading & rendering ----------

async function loadPDF(bytes) {
  pdfBytes = bytes;
  setStatus("Loading PDF...");
  pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
  numPages = pdfDoc.numPages;
  pageInfo.textContent = `Page 1 / ${numPages}`;
  zoom = 1.0;
  pageViews = [];
  pdfPagesColumn.innerHTML = "";

  // Ensure layout is ready so pdfPagesColumn has width
  await new Promise(requestAnimationFrame);

  await createPageViews();
  await renderAllPages();
  btnRedact.disabled = false;
  setStatus("PDF loaded.");
}

async function createPageViews() {
  let columnWidth = pdfPagesColumn.clientWidth;
  if (!columnWidth || columnWidth < 50) {
    columnWidth = pdfScrollContainer.clientWidth - 40;
  }
  if (!columnWidth || columnWidth < 200) {
    columnWidth = 800;
  }

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const fitWidthScale = columnWidth / viewport.width;

    const pageContainer = document.createElement("div");
    pageContainer.className = "page-container";

    const canvas = document.createElement("canvas");
    canvas.className = "pdf-canvas";

    const overlay = document.createElement("canvas");
    overlay.className = "overlay-canvas";

    const textLayer = document.createElement("div");
    textLayer.className = "text-layer";

    pageContainer.appendChild(canvas);
    pageContainer.appendChild(overlay);
    pageContainer.appendChild(textLayer);
    pdfPagesColumn.appendChild(pageContainer);

    const scaledViewport = page.getViewport({ scale: fitWidthScale * zoom });
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    overlay.width = scaledViewport.width;
    overlay.height = scaledViewport.height;
    textLayer.style.width = scaledViewport.width + "px";
    textLayer.style.height = scaledViewport.height + "px";

    const view = {
      pageNumber: pageNum,
      page,
      container: pageContainer,
      canvas,
      overlay,
      textLayer,
      baseScale: fitWidthScale
    };

    pageViews.push(view);
    attachRedactionDrawingHandlers(view);
  }
}

async function renderPageView(view) {
  const { page, canvas, overlay, textLayer, baseScale } = view;
  const ctx = canvas.getContext("2d");
  const overlayCtx = overlay.getContext("2d");

  const viewport = page.getViewport({ scale: baseScale * zoom });

  canvas.width = viewport.width;
  canvas.height = viewport.height;
  // Ensure page container has real height for scrolling
  view.container.style.minHeight = canvas.height + "px";
  overlay.width = viewport.width;
  overlay.height = viewport.height;
  textLayer.style.width = viewport.width + "px";
  textLayer.style.height = viewport.height + "px";

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  textLayer.innerHTML = "";

  // Single render() per page at a time
  await page.render({ canvasContext: ctx, viewport }).promise;

  // Disable text layer (PDF.js v5 compatibility)
  textLayer.innerHTML = "";
  textLayer.style.pointerEvents = "none";
  textLayer.style.opacity = "0";
  textLayer.style.display = "none";

  drawRedactionsOnView(view);
  if (highlightMode) drawSearchHighlightsOnView(view);
  drawAutoRedactPreviewOnView(view);
}

async function renderAllPages() {
  if (!pdfDoc) return;
  for (const view of pageViews) {
    await renderPageView(view);
  }
}

// ---------- Redaction drawing ----------

function drawRedactionsOnView(view) {
  const overlayCtx = view.overlay.getContext("2d");
  overlayCtx.clearRect(0, 0, view.overlay.width, view.overlay.height);

  const pageRedactions = redactions.filter(r => r.page === view.pageNumber);
  for (const r of pageRedactions) {
    overlayCtx.fillStyle = r.color || "#000000";
    for (const rect of r.rects) {
      const x = rect.x0 * view.overlay.width;
      const y = rect.y0 * view.overlay.height;
      const w = (rect.x1 - rect.x0) * view.overlay.width;
      const h = (rect.y1 - rect.y0) * view.overlay.height;
      overlayCtx.fillRect(x, y, w, h);
    }
  }
}

function drawAutoRedactPreviewOnView(view) {
  const overlayCtx = view.overlay.getContext("2d");
  overlayCtx.save();
  overlayCtx.strokeStyle = "red";
  overlayCtx.lineWidth = 2;

  const pageSuggestions = autoRedactSuggestions.filter(
    r => r.page === view.pageNumber
  );
  for (const r of pageSuggestions) {
    for (const rect of r.rects) {
      const x = rect.x0 * view.overlay.width;
      const y = rect.y0 * view.overlay.height;
      const w = (rect.x1 - rect.x0) * view.overlay.width;
      const h = (rect.y1 - rect.y0) * view.overlay.height;
      overlayCtx.strokeRect(x, y, w, h);
    }
  }

  overlayCtx.restore();
}

// ---------- Search & highlight ----------

async function performSearch() {
  if (!pdfDoc) return;
  const query = searchInput.value.trim();
  searchResults = [];
  searchIndex = 0;

  if (!query) {
    searchInfo.textContent = "0 / 0";
    await renderAllPages();
    return;
  }

  const regex = new RegExp(query, "gi");

  for (let p = 1; p <= numPages; p++) {
    const page = await pdfDoc.getPage(p);
    const text = (await page.getTextContent()).items.map(i => i.str).join(" ");
    let match;
    while ((match = regex.exec(text)) !== null) {
      searchResults.push({ page: p });
    }
  }

  if (searchResults.length === 0) {
    searchInfo.textContent = "0 / 0";
  } else {
    searchIndex = 0;
    searchInfo.textContent = `1 / ${searchResults.length}`;
    scrollToSearchResult(searchResults[0]);
  }

  await renderAllPages();
}

function scrollToSearchResult(result) {
  const view = pageViews.find(v => v.pageNumber === result.page);
  if (!view) return;
  view.container.scrollIntoView({ behavior: "smooth", block: "center" });
}

function updateSearchInfo() {
  if (searchResults.length === 0) {
    searchInfo.textContent = "0 / 0";
  } else {
    searchInfo.textContent = `${searchIndex + 1} / ${searchResults.length}`;
  }
}

function drawSearchHighlightsOnView(view) {
  const overlayCtx = view.overlay.getContext("2d");
  overlayCtx.save();
  overlayCtx.strokeStyle = "yellow";
  overlayCtx.lineWidth = 3;

  const pageMatches = searchResults.filter(r => r.page === view.pageNumber);
  for (const _ of pageMatches) {
    // Placeholder highlight box – can be refined with real text positions
    overlayCtx.strokeRect(10, 10, 150, 40);
  }

  overlayCtx.restore();
}

// ---------- Redaction drawing tools (box + text selection) ----------

function attachRedactionDrawingHandlers(view) {
  const overlay = view.overlay;
  const textLayer = view.textLayer;

  // ---------- BOX REDACTION ----------
  let drawingBox = false;
  let boxStartX = 0;
  let boxStartY = 0;
  let boxSnapshot = null; // ImageData snapshot of overlay before live preview

  overlay.addEventListener("mousedown", e => {
    if (!pdfDoc || panMode) return;
    if (!btnModeDrawBox.classList.contains("btn-toggle-active")) return;

    drawingBox = true;
    const rect = overlay.getBoundingClientRect();
    boxStartX = e.clientX - rect.left;
    boxStartY = e.clientY - rect.top;

    const ctx = overlay.getContext("2d");
    boxSnapshot = ctx.getImageData(0, 0, overlay.width, overlay.height);
  });

  overlay.addEventListener("mousemove", e => {
    if (!drawingBox) return;
    const rect = overlay.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = overlay.getContext("2d");
    // Restore snapshot instead of re-rendering the page
    if (boxSnapshot) {
      ctx.putImageData(boxSnapshot, 0, 0);
    }

    ctx.save();
    ctx.strokeStyle = redactionColorInput.value || "#000000";
    ctx.lineWidth = 2;
    ctx.strokeRect(boxStartX, boxStartY, x - boxStartX, y - boxStartY);
    ctx.restore();
  });

  overlay.addEventListener("mouseup", e => {
    if (!drawingBox) return;
    drawingBox = false;

    const rect = overlay.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;

    const norm = normalizeRect(
      boxStartX,
      boxStartY,
      endX,
      endY,
      overlay.width,
      overlay.height
    );

    pushUndo();
    redactions.push({
      page: view.pageNumber,
      type: "box",
      rects: [norm],
      color: redactionColorInput.value || "#000000"
    });

    boxSnapshot = null;
    renderPageView(view);
  });

  // ---------- TEXT SELECTION REDACTION ----------
  let selectingText = false;
  let selStartX = 0;
  let selStartY = 0;
  let selEndX = 0;
  let selEndY = 0;
  let textSelSnapshot = null;

  textLayer.style.pointerEvents = "none";

  function updateTextLayerPointerEvents() {
    if (btnModeSelectText.classList.contains("btn-toggle-active")) {
      textLayer.style.pointerEvents = "auto";
    } else {
      textLayer.style.pointerEvents = "none";
    }
  }
  updateTextLayerPointerEvents();

  btnModeSelectText.addEventListener("click", updateTextLayerPointerEvents);
  btnModeDrawBox.addEventListener("click", updateTextLayerPointerEvents);

  textLayer.addEventListener("mousedown", e => {
    if (!pdfDoc || panMode) return;
    if (!btnModeSelectText.classList.contains("btn-toggle-active")) return;

    selectingText = true;
    const rect = overlay.getBoundingClientRect();
    selStartX = e.clientX - rect.left;
    selStartY = e.clientY - rect.top;
    selEndX = selStartX;
    selEndY = selStartY;

    const ctx = overlay.getContext("2d");
    textSelSnapshot = ctx.getImageData(0, 0, overlay.width, overlay.height);

    e.preventDefault();
  });

  textLayer.addEventListener("mousemove", e => {
    if (!selectingText) return;
    const rect = overlay.getBoundingClientRect();
    selEndX = e.clientX - rect.left;
    selEndY = e.clientY - rect.top;

    const ctx = overlay.getContext("2d");
    if (textSelSnapshot) {
      ctx.putImageData(textSelSnapshot, 0, 0);
    }

    ctx.save();
    ctx.strokeStyle = "rgba(255, 215, 0, 0.9)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 2]);
    ctx.strokeRect(
      Math.min(selStartX, selEndX),
      Math.min(selStartY, selEndY),
      Math.abs(selEndX - selStartX),
      Math.abs(selEndY - selStartY)
    );
    ctx.restore();
  });

  textLayer.addEventListener("mouseup", e => {
    if (!selectingText) return;
    selectingText = false;

    const rect = overlay.getBoundingClientRect();
    selEndX = e.clientX - rect.left;
    selEndY = e.clientY - rect.top;

    const x0 = Math.min(selStartX, selEndX);
    const y0 = Math.min(selStartY, selEndY);
    const x1 = Math.max(selStartX, selEndX);
    const y1 = Math.max(selStartY, selEndY);

    const textDivs = Array.from(textLayer.querySelectorAll("span, div"));
    const selectedDivs = textDivs.filter(div => {
      const r = div.getBoundingClientRect();
      const o = overlay.getBoundingClientRect();
      const dx0 = r.left - o.left;
      const dy0 = r.top - o.top;
      const dx1 = r.right - o.left;
      const dy1 = r.bottom - o.top;

      const overlap =
        dx1 > x0 &&
        dx0 < x1 &&
        dy1 > y0 &&
        dy0 < y1;

      return overlap;
    });

    if (selectedDivs.length === 0) {
      textSelSnapshot = null;
      renderPageView(view);
      return;
    }

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    const o = overlay.getBoundingClientRect();
    for (const div of selectedDivs) {
      const r = div.getBoundingClientRect();
      const dx0 = r.left - o.left;
      const dy0 = r.top - o.top;
      const dx1 = r.right - o.left;
      const dy1 = r.bottom - o.top;

      minX = Math.min(minX, dx0);
      minY = Math.min(minY, dy0);
      maxX = Math.max(maxX, dx1);
      maxY = Math.max(maxY, dy1);
    }

    const norm = normalizeRect(
      minX,
      minY,
      maxX,
      maxY,
      overlay.width,
      overlay.height
    );

    const ctx = overlay.getContext("2d");
    if (textSelSnapshot) {
      ctx.putImageData(textSelSnapshot, 0, 0);
    }

    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 0, 0.4)";
    ctx.fillRect(
      norm.x0 * overlay.width,
      norm.y0 * overlay.height,
      (norm.x1 - norm.x0) * overlay.width,
      (norm.y1 - norm.y0) * overlay.height
    );
    ctx.restore();

    textSelSnapshot = null;

    pushUndo();
    redactions.push({
      page: view.pageNumber,
      type: "text",
      rects: [norm],
      color: redactionColorInput.value || "#000000"
    });

    renderPageView(view);
  });
}

// ---------- Pan mode ----------

let isPanning = false;
let panStartY = 0;
let scrollStartY = 0;

pdfScrollContainer.addEventListener("mousedown", e => {
  if (!panMode) return;
  isPanning = true;
  panStartY = e.clientY;
  scrollStartY = pdfScrollContainer.scrollTop;
  pdfScrollContainer.style.cursor = "grabbing";
});

document.addEventListener("mousemove", e => {
  if (!isPanning) return;
  const dy = e.clientY - panStartY;
  pdfScrollContainer.scrollTop = scrollStartY - dy;
});

document.addEventListener("mouseup", () => {
  if (isPanning) {
    isPanning = false;
    pdfScrollContainer.style.cursor = panMode ? "grab" : "default";
  }
});

// Explicit wheel-based scrolling for PDF viewer (scroll fix)
pdfScrollContainer.addEventListener(
  "wheel",
  e => {
    // Let normal browser behavior happen, but also ensure scrollTop changes
    pdfScrollContainer.scrollTop += e.deltaY;
  },
  { passive: true }
);

// ---------- Auto-redaction ----------

async function runAutoRedact(endpoint) {
  if (!pdfBytes) {
    setStatus("Upload a PDF first.");
    return;
  }

  setStatus("Running auto-redaction...");
  const form = new FormData();
  form.append("file", new Blob([pdfBytes], { type: "application/pdf" }), "file.pdf");

  try {
    const res = await fetch(endpoint, { method: "POST", body: form });
    if (!res.ok) {
      setStatus("Auto-redaction failed.");
      return;
    }

    const json = await res.json();
    autoRedactSuggestions = json.candidates || [];
    btnAutoApply.disabled = autoRedactSuggestions.length === 0;
    btnAutoClear.disabled = autoRedactSuggestions.length === 0;

    await renderAllPages();
    setStatus("Auto-redaction suggestions ready.");
  } catch (err) {
    console.error(err);
    setStatus("Auto-redaction failed (backend not reachable).");
  }
}

btnAutoTemplate.addEventListener("click", async () => {
  if (!pdfBytes) {
    setStatus("Upload a PDF first.");
    return;
  }
  setStatus("Running template auto-redaction...");
  const form = new FormData();
  form.append("file", new Blob([pdfBytes], { type: "application/pdf" }), "file.pdf");

  try {
    const res = await fetch("http://127.0.0.1:8000/api/redact/single", {
      method: "POST",
      body: form
    });
    if (!res.ok) {
      setStatus("Template redaction failed.");
      return;
    }
    const blob = await res.blob();
    downloadBlob(blob, "redacted_template.pdf");
    setStatus("Template redaction complete.");
  } catch (err) {
    console.error(err);
    setStatus("Template redaction failed (backend not reachable).");
  }
});

btnAutoPatterns.addEventListener("click", () =>
  runAutoRedact("http://127.0.0.1:8000/api/redact/auto-suggest")
);
btnAutoOCR.addEventListener("click", () =>
  runAutoRedact("http://127.0.0.1:8000/api/redact/auto-suggest-ocr")
);

btnAutoApply.addEventListener("click", async () => {
  if (autoRedactSuggestions.length === 0) return;
  pushUndo();
  redactions = redactions.concat(autoRedactSuggestions);
  autoRedactSuggestions = [];
  btnAutoApply.disabled = true;
  btnAutoClear.disabled = true;
  await renderAllPages();
  setStatus("Auto-redaction suggestions applied.");
});

btnAutoClear.addEventListener("click", async () => {
  autoRedactSuggestions = [];
  btnAutoApply.disabled = true;
  btnAutoClear.disabled = true;
  await renderAllPages();
  setStatus("Auto-redaction suggestions cleared.");
});

// ---------- Template redaction (toolbar button) ----------

btnApplyTemplateRedact.addEventListener("click", async () => {
  if (!pdfBytes) {
    setStatus("Upload a PDF first.");
    return;
  }
  setStatus("Applying template redaction...");
  const form = new FormData();
  form.append("file", new Blob([pdfBytes], { type: "application/pdf" }), "file.pdf");

  try {
    const res = await fetch("http://127.0.0.1:8000/api/redact/single", {
      method: "POST",
      body: form
    });
    if (!res.ok) {
      setStatus("Template redaction failed.");
      return;
    }
    const blob = await res.blob();
    downloadBlob(blob, "redacted_template.pdf");
    setStatus("Template redaction complete.");
  } catch (err) {
    console.error(err);
    setStatus("Template redaction failed (backend not reachable).");
  }
});

// ---------- Manual redaction apply ----------

btnRedact.addEventListener("click", async () => {
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
    downloadBlob(blob, "redacted_manual.pdf");
    setStatus("Manual redaction complete.");
  } catch (err) {
    console.error(err);
    setStatus("Manual redaction failed (backend not reachable).");
  }
});

// ---------- Redact entire current page ----------

btnRedactCurrentPage.addEventListener("click", async () => {
  if (!pdfDoc || numPages === 0) {
    setStatus("Upload a PDF first.");
    return;
  }
  if (!currentPageVisible) currentPageVisible = 1;

  pushUndo();
  redactions.push({
    page: currentPageVisible,
    type: "page",
    rects: [],
    color: redactionColorInput.value || "#000000"
  });

  await renderAllPages();
  setStatus(`Page ${currentPageVisible} fully redacted.`);
});

// ---------- Clear session ----------

btnClear.addEventListener("click", () => {
  pdfDoc = null;
  pdfBytes = null;
  numPages = 0;
  pageViews = [];
  redactions = [];
  autoRedactSuggestions = [];
  undoStack = [];
  redoStack = [];
  searchResults = [];
  searchIndex = 0;
  highlightMode = false;
  zoom = 1.0;
  panMode = false;

  fileInput.value = "";
  fileNameLabel.textContent = "";
  pdfPagesColumn.innerHTML = "";
  pageInfo.textContent = "Page 0 / 0";
  zoomInfo.textContent = "100%";
  searchInfo.textContent = "0 / 0";
  btnRedact.disabled = true;
  setStatus("Session cleared.");
});

// ---------- Export / Import redaction map ----------

btnExportRedactions.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(redactions, null, 2)], {
    type: "application/json"
  });
  downloadBlob(blob, "redactions.json");
});

btnImportRedactions.addEventListener("click", () => {
  importRedactionsInput.click();
});

importRedactionsInput.addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  try {
    const imported = JSON.parse(text);
    if (Array.isArray(imported)) {
      pushUndo();
      redactions = imported;
      await renderAllPages();
      setStatus("Redactions imported.");
    } else {
      setStatus("Invalid redaction map.");
    }
  } catch {
    setStatus("Failed to parse redaction map.");
  }
});

// ---------- Mode toggles ----------

btnModeSelectText.addEventListener("click", () => {
  btnModeSelectText.classList.add("btn-toggle-active");
  btnModeDrawBox.classList.remove("btn-toggle-active");
});

btnModeDrawBox.addEventListener("click", () => {
  btnModeDrawBox.classList.add("btn-toggle-active");
  btnModeSelectText.classList.remove("btn-toggle-active");
});

btnToggleHighlight.addEventListener("click", async () => {
  highlightMode = !highlightMode;
  await renderAllPages();
});

// Undo / Redo
btnUndo.addEventListener("click", () => restoreState(undoStack, redoStack));
btnRedo.addEventListener("click", () => restoreState(redoStack, undoStack));

// Zoom
btnZoomIn.addEventListener("click", async () => {
  zoom *= 1.1;
  zoomInfo.textContent = `${Math.round(zoom * 100)}%`;
  await renderAllPages();
});

btnZoomOut.addEventListener("click", async () => {
  zoom /= 1.1;
  zoomInfo.textContent = `${Math.round(zoom * 100)}%`;
  await renderAllPages();
});

// Pan mode toggle
btnPanMode.addEventListener("click", () => {
  panMode = !panMode;
  btnPanMode.classList.toggle("btn-toggle-active", panMode);
  pdfScrollContainer.style.cursor = panMode ? "grab" : "default";
});

// ---------- Search events ----------

searchInput.addEventListener("input", () => {
  performSearch();
});

btnSearchPrev.addEventListener("click", async () => {
  if (searchResults.length === 0) return;
  searchIndex = (searchIndex - 1 + searchResults.length) % searchResults.length;
  updateSearchInfo();
  scrollToSearchResult(searchResults[searchIndex]);
  await renderAllPages();
});

btnSearchNext.addEventListener("click", async () => {
  if (searchResults.length === 0) return;
  searchIndex = (searchIndex + 1) % searchResults.length;
  updateSearchInfo();
  scrollToSearchResult(searchResults[searchIndex]);
  await renderAllPages();
});

btnSearchRedactAll.addEventListener("click", async () => {
  if (searchResults.length === 0) return;
  pushUndo();
  for (const r of searchResults) {
    redactions.push({
      page: r.page,
      type: "page",
      rects: [],
      color: redactionColorInput.value || "#000000"
    });
  }
  await renderAllPages();
  setStatus("All search matches redacted (full pages).");
});

// ---------- Auto-redact dropdown hover ----------

dropdownArea.addEventListener("mouseenter", () => {
  autoRedactDropdown.classList.remove("hidden");
});
dropdownArea.addEventListener("mouseleave", () => {
  autoRedactDropdown.classList.add("hidden");
});

// ---------- File upload & drag/drop ----------

dropZone.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.type !== "application/pdf") {
    setStatus("Please select a PDF file.");
    return;
  }
  fileNameLabel.textContent = file.name;
  const bytes = await file.arrayBuffer();
  await loadPDF(bytes);
});

dropZone.addEventListener("dragover", e => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});
dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});
dropZone.addEventListener("drop", async e => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (!file || file.type !== "application/pdf") {
    setStatus("Please drop a PDF file.");
    return;
  }
  fileNameLabel.textContent = file.name;
  const bytes = await file.arrayBuffer();
  await loadPDF(bytes);
});

// ---------- Keyboard shortcuts ----------

document.addEventListener("keydown", async e => {
  if (e.ctrlKey && e.key === "z") {
    e.preventDefault();
    restoreState(undoStack, redoStack);
  } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "z") {
    e.preventDefault();
    restoreState(redoStack, undoStack);
  } else if (e.ctrlKey && e.key.toLowerCase() === "f") {
    e.preventDefault();
    searchInput.focus();
  } else if (e.key === "+" || (e.ctrlKey && e.key === "=")) {
    e.preventDefault();
    zoom *= 1.1;
    zoomInfo.textContent = `${Math.round(zoom * 100)}%`;
    await renderAllPages();
  } else if (e.key === "-" || (e.ctrlKey && e.key === "-")) {
    e.preventDefault();
    zoom /= 1.1;
    zoomInfo.textContent = `${Math.round(zoom * 100)}%`;
    await renderAllPages();
  }
});

// ---------- Track current visible page ----------

pdfScrollContainer.addEventListener("scroll", () => {
  let bestPage = 1;
  let bestOffset = Infinity;

  for (const view of pageViews) {
    const rect = view.container.getBoundingClientRect();
    const containerRect = pdfScrollContainer.getBoundingClientRect();
    const offset = Math.abs(rect.top - containerRect.top - 50);

    if (offset < bestOffset) {
      bestOffset = offset;
      bestPage = view.pageNumber;
    }
  }

  currentPageVisible = bestPage;

  if (numPages > 0) {
    pageInfo.textContent = `Page ${currentPageVisible} / ${numPages}`;
  } else {
    pageInfo.textContent = "Page 0 / 0";
  }
});

// ---------- Init ----------

setStatus("Waiting for PDF...");
btnRedact.disabled = true;
btnUndo.disabled = true;
btnRedo.disabled = true;
loadTemplates();
