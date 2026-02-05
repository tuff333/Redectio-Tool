// ------------------------------------------------------------
// Redaction_Auto.js — Unified auto-redaction engine (OCR + text)
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

import { textStore } from "./TextLayer.js";
import { renderPageView, renderAllPages } from "./PDF_Loader.js";
import { pushUndo } from "./Redaction_Core.js";
import { downloadBlob, getRedactedFilename } from "./Utils.js";

// ------------------------------------------------------------
// drawAutoRedactPreviewOnView(view)
// ------------------------------------------------------------
export function drawAutoRedactPreviewOnView(view) {
  const overlayCtx = view.overlay.getContext("2d");
  overlayCtx.save();

  const suggestions = autoRedactSuggestions.filter(s => s.page === view.pageNumber);

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
  const suggestions = autoRedactSuggestions.filter(s => s.page === view.pageNumber);

  // Highest priority: hovered suggestion wins
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
// runAutoRedact(endpoint)
// ------------------------------------------------------------
export async function runAutoRedact(endpoint) {
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
    const raw = json.candidates || [];

    // Assign unique IDs
    const suggestions = raw.map((c, idx) => ({
      ...c,
      id: idx,
      selected: true
    }));

    setAutoRedactSuggestions(suggestions);

    document.getElementById("btnAutoApply").disabled = suggestions.length === 0;
    document.getElementById("btnAutoClear").disabled = suggestions.length === 0;

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

  document.getElementById("btnAutoApply").disabled = true;
  document.getElementById("btnAutoClear").disabled = true;

  await renderAllPages();
  setStatus("Auto-redaction suggestions applied.");
}

// ------------------------------------------------------------
// clearAutoRedactions()
// ------------------------------------------------------------
export async function clearAutoRedactions() {
  setAutoRedactSuggestions([]);
  setHoveredSuggestionId(null);

  document.getElementById("btnAutoApply").disabled = true;
  document.getElementById("btnAutoClear").disabled = true;

  await renderAllPages();
  setStatus("Auto-redaction suggestions cleared.");
}
