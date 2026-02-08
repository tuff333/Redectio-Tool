// ------------------------------------------------------------
// Redaction_Auto.js — Unified auto-redaction engine (OCR + text)
// FIXED: Frontend fallback when backend unavailable
// ------------------------------------------------------------

import {
  autoRedactSuggestions,
  hoveredSuggestionId,
  pdfBytes,
  redactions,

  setAutoRedactSuggestions,
  setHoveredSuggestionId,
  setRedactions,
  setStatus
} from "./Utils.js";

import { renderPageView, renderAllPages } from "./PDF_Loader.js";
import { pushUndo } from "./Redaction_Core.js";
import { textStore } from "./TextLayer.js";  // ← IMPORT for frontend fallback

// ------------------------------------------------------------
// CONFIGURATION
// ------------------------------------------------------------
const BACKEND_URL = "http://127.0.0.1:8000";
const USE_BACKEND = true;  // ← Set to false for frontend-only mode

// ------------------------------------------------------------
// drawAutoRedactPreviewOnView(view)
// ------------------------------------------------------------
export function drawAutoRedactPreviewOnView(view) {
  const overlayCtx = view.overlay.getContext("2d");
  overlayCtx.save();

  const suggestions = autoRedactSuggestions.filter(
    s => s.page === view.pageNumber
  );

  for (const s of suggestions) {
    const isHovered = s.id === hoveredSuggestionId;
    const isSelected = s.selected !== false;

    overlayCtx.lineWidth = isHovered ? 3 : 2;
    overlayCtx.strokeStyle = isSelected
      ? (isHovered ? "rgba(255, 0, 0, 1.0)" : "rgba(255, 0, 0, 0.9)")
      : "rgba(255, 0, 0, 0.4)";

    overlayCtx.fillStyle = isSelected
      ? "rgba(255, 0, 0, 0.15)"
      : "rgba(255, 0, 0, 0.05)";

    for (const rect of s.rects || []) {
      const x = rect.x0 * view.overlay.width;
      const y = rect.y0 * view.overlay.height;
      const w = (rect.x1 - rect.x0) * view.overlay.width;
      const h = (rect.y1 - rect.y0) * view.overlay.height;

      overlayCtx.fillRect(x, y, w, h);
      overlayCtx.strokeRect(x, y, w, h);
    }
  }

  overlayCtx.restore();
}

// ------------------------------------------------------------
// hitTestAutoSuggestion(view, x, y)
// ------------------------------------------------------------
function hitTestAutoSuggestion(view, x, y) {
  const suggestions = autoRedactSuggestions.filter(
    s => s.page === view.pageNumber
  );

  let best = null;
  let bestArea = Infinity;

  for (const s of suggestions) {
    for (const rect of s.rects || []) {
      const rx = rect.x0 * view.overlay.width;
      const ry = rect.y0 * view.overlay.height;
      const rw = (rect.x1 - rect.x0) * view.overlay.width;
      const rh = (rect.y1 - rect.y0) * view.overlay.height;

      if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) {
        const area = rw * rh;
        if (area < bestArea) {
          best = s.id;
          bestArea = area;
        }
      }
    }
  }

  return best;
}

// ------------------------------------------------------------
// attachAutoRedactionHandlers(view)
// ------------------------------------------------------------
export function attachAutoRedactionHandlers(view) {
  const overlay = view.overlay;

  // Hover detection
  overlay.addEventListener("mousemove", e => {
    if (!autoRedactSuggestions.length) return;

    const rect = overlay.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hitId = hitTestAutoSuggestion(view, x, y);

    if (hitId !== hoveredSuggestionId) {
      setHoveredSuggestionId(hitId);
      renderPageView(view);
    }
  });

  // Click to toggle selection
  overlay.addEventListener("click", e => {
    if (!autoRedactSuggestions.length) return;

    const rect = overlay.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hitId = hitTestAutoSuggestion(view, x, y);
    if (hitId == null) return;

    const updated = autoRedactSuggestions.map(s =>
      s.id === hitId ? { ...s, selected: s.selected === false } : s
    );

    setAutoRedactSuggestions(updated);
    renderPageView(view);

    e.stopPropagation();
    e.preventDefault();
  });
}

// ------------------------------------------------------------
// FRONTEND FALLBACK: Simple pattern matching using textStore
// ------------------------------------------------------------
function generateFrontendSuggestions() {
  const suggestions = [];
  let id = 0;
  
  // Common COA patterns to redact
  const patterns = [
    { regex: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, label: "DATE" },  // Dates
    { regex: /\b\d+\.\d+%\b/g, label: "PERCENTAGE" },           // Percentages like 24.5%
    { regex: /\b[A-Z]{2,}-\d{4,}\b/g, label: "BATCH_ID" },       // Batch IDs
    { regex: /\b\d{3}-\d{2}-\d{4}\b/g, label: "SSN" },          // SSN-like
  ];
  
  for (const pageNum in textStore) {
    const items = textStore[pageNum];
    if (!items) continue;
    
    for (const item of items) {
      for (const pattern of patterns) {
        if (pattern.regex.test(item.text)) {
          suggestions.push({
            id: id++,
            page: parseInt(pageNum),
            type: "text",
            rects: [{
              x0: item.x0,
              y0: item.y0,
              x1: item.x1,
              y1: item.y1
            }],
            text: item.text,
            pattern_id: pattern.label,
            color: "#000000",
            selected: true
          });
          break; // Only match first pattern
        }
      }
    }
  }
  
  return suggestions;
}

// ------------------------------------------------------------
// runAutoRedact(endpoint)
// FIXED: Frontend fallback when backend unavailable
// ------------------------------------------------------------
export async function runAutoRedact(endpoint) {
  if (!pdfBytes) {
    setStatus("Upload a PDF first.");
    return;
  }

  if (!USE_BACKEND) {
    // FRONTEND FALLBACK
    setStatus("Running frontend auto-redaction...");
    const suggestions = generateFrontendSuggestions();
    
    setAutoRedactSuggestions(suggestions);
    
    const btnApply = document.getElementById("btnAutoApply");
    const btnClear = document.getElementById("btnAutoClear");
    
    if (btnApply) btnApply.disabled = suggestions.length === 0;
    if (btnClear) btnClear.disabled = suggestions.length === 0;
    
    await renderAllPages();
    setStatus(`Frontend auto-redaction: ${suggestions.length} suggestions.`);
    return;
  }

  setStatus("Running auto-redaction...");

  const form = new FormData();
  form.append(
    "file",
    new Blob([pdfBytes], { type: "application/pdf" }),
    "file.pdf"
  );

  try {
    const res = await fetch(`${BACKEND_URL}${endpoint}`, { 
      method: "POST", 
      body: form 
    });

    if (!res.ok) {
      setStatus("Auto-redaction failed.");
      return;
    }

    const json = await res.json();
    const raw = json.candidates || [];

    const suggestions = raw.map((c, idx) => ({
      ...c,
      id: idx,
      selected: true
    }));

    setAutoRedactSuggestions(suggestions);

    const btnApply = document.getElementById("btnAutoApply");
    const btnClear = document.getElementById("btnAutoClear");

    if (btnApply) btnApply.disabled = suggestions.length === 0;
    if (btnClear) btnClear.disabled = suggestions.length === 0;

    await renderAllPages();
    setStatus("Auto-redaction suggestions ready.");
  } catch (err) {
    console.error(err);
    setStatus("Auto-redaction failed (backend not reachable).");
  }
}

// ------------------------------------------------------------
// applyAutoRedactions()
// ------------------------------------------------------------
export async function applyAutoRedactions() {
  const selected = autoRedactSuggestions.filter(s => s.selected !== false);

  if (!selected.length) {
    setStatus("No auto-redaction suggestions selected.");
    return;
  }

  pushUndo();

  const newRedactions = structuredClone(redactions);

  for (const s of selected) {
    const page = s.page;
    if (!newRedactions[page]) newRedactions[page] = [];
    newRedactions[page].push({
      page,
      type: "auto",
      rects: s.rects,
      color: "#000000"
    });
  }

  setRedactions(newRedactions);

  setAutoRedactSuggestions([]);
  setHoveredSuggestionId(null);

  const btnApply = document.getElementById("btnAutoApply");
  const btnClear = document.getElementById("btnAutoClear");

  if (btnApply) btnApply.disabled = true;
  if (btnClear) btnClear.disabled = true;

  await renderAllPages();
  setStatus("Auto-redaction suggestions applied.");
}

// ------------------------------------------------------------
// clearAutoRedactions()
// ------------------------------------------------------------
export async function clearAutoRedactions() {
  setAutoRedactSuggestions([]);
  setHoveredSuggestionId(null);

  const btnApply = document.getElementById("btnAutoApply");
  const btnClear = document.getElementById("btnAutoClear");

  if (btnApply) btnApply.disabled = true;
  if (btnClear) btnClear.disabled = true;

  await renderAllPages();
  setStatus("Auto-redaction suggestions cleared.");
}