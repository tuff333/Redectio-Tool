// frontend/app/Redaction_Auto.js
// Unified auto-redaction engine (backend + EXTENDED PII fallback)
// Option B: Preview stays RED, applied redactions ALWAYS BLACK
// Layout zones are NOT auto-selected; require explicit previewZonesEnabled flag.

import {
  autoRedactSuggestions,
  hoveredSuggestionId,
  redactions,
  originalPdfBytes,
  setAutoRedactSuggestions,
  setHoveredSuggestionId,
  setRedactions,
  setStatus
} from "./Utils.js";

import { renderPageView, renderAllPages } from "./PDF_Loader.js";
import { pushUndo } from "./Redaction_Core.js";
import { textStore } from "./TextLayer.js";

const BACKEND_URL = "http://127.0.0.1:8000";
const USE_BACKEND = true;

// Option B — EXTENDED PII: keep strict filter ON, but broaden patterns
const STRICT_PII_ONLY = true;
const ATTEMPT_BARCODE = true;

// Toggle controlled by UI (default false). When true, layout zones are shown as suggestions.
window.previewZonesEnabled = false;

// ------------------------------------------------------------
// PREVIEW (always RED)
// ------------------------------------------------------------
export function drawAutoRedactPreviewOnView(view) {
  const ctx = view.overlay.getContext("2d");
  ctx.save();

  const suggestions = (autoRedactSuggestions || []).filter(s => s.page === view.pageNumber);

  for (const s of suggestions) {
    const hovered = s.id === hoveredSuggestionId;
    const selected = s.selected !== false;

    ctx.lineWidth = hovered ? 3 : 2;
    ctx.strokeStyle = selected
      ? (hovered ? "rgba(255,0,0,1)" : "rgba(255,0,0,0.9)")
      : "rgba(255,0,0,0.4)";

    ctx.fillStyle = selected
      ? "rgba(255,0,0,0.15)"
      : "rgba(255,0,0,0.05)";

    for (const r of s.rects || []) {
      const x = r.x0 * view.overlay.width;
      const y = r.y0 * view.overlay.height;
      const w = (r.x1 - r.x0) * view.overlay.width;
      const h = (r.y1 - r.y0) * view.overlay.height;
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    }
  }

  ctx.restore();
}

// ------------------------------------------------------------
// HIT TEST
// ------------------------------------------------------------
function hitTest(view, x, y) {
  let best = null;
  let bestArea = Infinity;

  for (const s of (autoRedactSuggestions || []).filter(s => s.page === view.pageNumber)) {
    for (const r of s.rects || []) {
      const rx = r.x0 * view.overlay.width;
      const ry = r.y0 * view.overlay.height;
      const rw = (r.x1 - r.x0) * view.overlay.width;
      const rh = (r.y1 - r.y0) * view.overlay.height;
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
// ATTACH HANDLERS
// ------------------------------------------------------------
export function attachAutoRedactionHandlers(view, addListener) {
  const overlay = view.overlay;

  addListener(overlay, "mousemove", e => {
    if (!autoRedactSuggestions || !autoRedactSuggestions.length) return;
    const rect = overlay.getBoundingClientRect();
    const id = hitTest(view, e.clientX - rect.left, e.clientY - rect.top);
    if (id !== hoveredSuggestionId) {
      setHoveredSuggestionId(id);
      renderPageView(view);
    }
  });

  addListener(overlay, "click", e => {
    if (!autoRedactSuggestions || !autoRedactSuggestions.length) return;
    const rect = overlay.getBoundingClientRect();
    const id = hitTest(view, e.clientX - rect.left, e.clientY - rect.top);
    if (id == null) return;

    const color = document.getElementById("redactionColor")?.value || "#000000";

    const updated = (autoRedactSuggestions || []).map(s =>
      s.id === id
        ? { ...s, selected: s.selected === false ? true : false, color }
        : s
    );

    setAutoRedactSuggestions(updated);
    renderPageView(view);

    e.stopPropagation();
    e.preventDefault();
  });
}

// ------------------------------------------------------------
// EXTENDED PII PATTERNS (frontend fallback)
// ------------------------------------------------------------
function generateStrictPII() {
  const out = [];
  let id = 0;

  // Option B — more aggressive, but still anchored around labels
  const patterns = [
    // REPORT NO (A&L style)
    { label: "REPORT_NO", regex: /\bC[0-9A-Z]{4,6}-[0-9A-Z]{4,6}\b/gi, group: "report" },

    // ACCOUNT NUMBER (3–10 digits)
    { label: "ACCOUNT_NO", regex: /ACCOUNT NUMBER[:\s]*([0-9]{3,10})/gi, group: "account" },

    // TO / CLIENT NAME (line after TO: or same line)
    { label: "CLIENT_NAME", regex: /\bTO[:\s]+([A-Z][A-Za-z0-9'’\-. ]{2,80})/g, group: "name" },

    // PHONE (client + lab)
    { label: "CLIENT_PHONE", regex: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, group: "phone" },

    // EMAIL
    { label: "CLIENT_EMAIL", regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, group: "email" },

    // ADDRESS (looser, but still starts with number + street)
    { label: "CLIENT_ADDRESS", regex: /\b\d{1,6}\s+[A-Z][A-Za-z0-9\s,'\-.]{6,160}\b/g, group: "address" },

    // PO#
    { label: "PO_NUMBER", regex: /PO#[:\s]*([A-Za-z0-9\- ]{2,60})/gi, group: "po" },

    // CATEGORY
    { label: "CATEGORY", regex: /CATEGORY[:\s]*([A-Za-z0-9 &\/\-\(\)]{3,60})/gi, group: "category" },

    // LAB NUMBER
    { label: "LAB_NUMBER", regex: /LAB NUMBER[:\s]*([0-9A-Za-z\-]{4,20})/gi, group: "lab" },

    // SAMPLE ID
    { label: "SAMPLE_ID", regex: /SAMPLE ID[:\s]*([A-Za-z0-9\-]{3,60})/gi, group: "sample" }
  ];

  for (const page in textStore) {
    const spans = textStore[page]?.spans || [];
    for (const span of spans) {
      const text = span.text || "";
      const trimmed = text.trim();

      // ignore pure date-like spans to avoid false positives
      if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(trimmed)) continue;

      for (const p of patterns) {
        try {
          const matches = [...(text.matchAll(p.regex) || [])];
          for (const m of matches) {
            const value = m[1] || m[0];
            out.push({
              id: id++,
              page: Number(page),
              rects: [{ x0: span.x0, y0: span.y0, x1: span.x1, y1: span.y1 }],
              text: value,
              label: p.label,
              group: p.group,
              selected: true,
              color: "#000000"
            });
          }
        } catch {
          continue;
        }
      }
    }
  }

  // dedupe
  const seen = new Set();
  const dedup = [];
  for (const s of out) {
    const key = `${s.page}|${s.rects[0].x0.toFixed(4)}|${s.rects[0].y0.toFixed(4)}|${s.text}`;
    if (!seen.has(key)) {
      seen.add(key);
      dedup.push(s);
    }
  }

  return dedup;
}

// ------------------------------------------------------------
// NORMALIZE BACKEND SUGGESTION
// ------------------------------------------------------------
function normalizeBackend(raw, idx) {
  const rects = (raw.rects || raw.box ? (raw.rects || [raw.box]) : []).map(r => ({
    x0: r.x0 ?? r.left ?? 0,
    y0: r.y0 ?? r.top ?? 0,
    x1: r.x1 ?? r.right ?? 0,
    y1: r.y1 ?? r.bottom ?? 0
  }));

  // Do NOT filter barcode boxes — they are often thin
  const filtered = rects;

  const group = (raw.group || raw.type || "").toString().toLowerCase();
  const isBarcodeLike =
    group.includes("barcode") ||
    group.includes("qr") ||
    (raw.type || "").toString().toLowerCase() === "barcode";

  return {
    id: idx,
    page: raw.page || raw.p || 1,
    rects: filtered,
    text: raw.text || raw.reason || raw.label || raw.value || "",
    // Ensure barcode suggestions get a label
    label: raw.rule_id ||
      raw.label ||
      (isBarcodeLike ? "BARCODE" : ""),
    group,
    selected: raw.selected !== false,
    color: raw.color || "#000000",
    type: raw.type || ""
  };
}

// ------------------------------------------------------------
// RUN AUTO REDACT
// ------------------------------------------------------------
export async function runAutoRedact(endpoint) {
  if (!originalPdfBytes || !originalPdfBytes.length) {
    setStatus("Upload a PDF first.");
    return;
  }

  const isBarcodeOnly = endpoint && endpoint.includes("auto-suggest-barcodes");

  if (isBarcodeOnly) {
    setStatus("Detecting barcodes...");
  } else {
    setStatus("Running Auto Suggest...");
  }

  const form = new FormData();
  form.append("file", new Blob([originalPdfBytes], { type: "application/pdf" }), "file.pdf");

  let raw = [];

  if (USE_BACKEND) {
    try {
      const res = await fetch(
        `${BACKEND_URL}${endpoint.startsWith("/") ? endpoint : "/" + endpoint}`,
        { method: "POST", body: form }
      );
      if (res && res.ok) {
        const json = await res.json();
        raw = json.candidates || json.suggestions || json.results || [];
        if (json && json.ok && Array.isArray(json.suggestions)) {
          raw = json.suggestions;
        }
      } else {
        console.warn("Primary auto-suggest failed:", res && res.status);
      }
    } catch (e) {
      console.warn("Primary auto-suggest error:", e);
    }

    // Extra barcode call ONLY when not already in barcode-only mode
    if (ATTEMPT_BARCODE && !isBarcodeOnly) {
      try {
        const br = await fetch(
          `${BACKEND_URL}/api/redact/auto-suggest-barcodes`,
          { method: "POST", body: form }
        ).catch(() => null);
        if (br && br.ok) {
          const j = await br.json();
          const more = j.candidates || j.suggestions || j.results || [];
          raw = raw.concat(more);
        }
      } catch (e) {
        console.warn("Barcode endpoint error:", e);
      }
    }

    // OCR fallback for report number (skip for barcode-only)
    if (!isBarcodeOnly) {
      try {
        const ocrRes = await fetch(
          `${BACKEND_URL}/api/redact/ocr-report`,
          { method: "POST", body: form }
        ).catch(() => null);
        if (ocrRes && ocrRes.ok) {
          const j = await ocrRes.json();
          if (j && j.candidate) raw.push(j.candidate);
        }
      } catch (e) {
        // ignore
      }
    }
  }

  // normalize
  let backend = (raw || [])
    .map((c, i) => normalizeBackend(c, i))
    .filter(s => (s.rects || []).length);

  // remove layout zones unless previewZonesEnabled is true
  // BUT: in barcode-only mode, keep barcode/QR zones even if previewZonesEnabled is false
  backend = backend.filter(s => {
    const label = (s.label || "").toString().toLowerCase();
    const ruleId = (s.rule_id || "").toString().toLowerCase();
    const isZone = label.includes("zone") || ruleId.includes("zone");
    const isBarcodeGroup =
      (s.group || "").includes("barcode") ||
      (s.group || "").includes("qr") ||
      (s.type || "").toLowerCase() === "barcode";

    if (isZone) {
      if (isBarcodeOnly && isBarcodeGroup) {
        return true;
      }
      if (!window.previewZonesEnabled) {
        return false;
      }
    }
    return true;
  });

  // STRICT PII filter
  if (isBarcodeOnly) {
    // Barcode mode → allow ONLY barcode/QR suggestions
    backend = backend.filter(s => {
      const g = (s.group || "").toString().toLowerCase();
      const t = (s.type || "").toString().toLowerCase();
      const l = (s.label || "").toString().toLowerCase();
      return g.includes("barcode") || g.includes("qr") || t === "barcode" || l.includes("barcode") || l.includes("qr");
    });
  } else if (STRICT_PII_ONLY) {
    // Extended PII: allow all key client identifiers + barcode
    const allowed = /report|account|license|name|phone|email|address|batch|lot|sample|coa|barcode|lab|client|po|category/;
    backend = backend.filter(s =>
      allowed.test((s.group || "") + " " + (s.label || ""))
    );
  }

  // supplement with frontend EXTENDED PII when missing
  // NEVER add PII suggestions in barcode-only mode
  const frontend = (STRICT_PII_ONLY && !isBarcodeOnly) ? generateStrictPII() : [];
  const merged = [...backend];
  let nextId = merged.length;

  for (const f of frontend) {
    const dup = merged.find(
      m =>
        m.page === f.page &&
        m.text === f.text &&
        (m.rects || []).some(
          r =>
            Math.abs(r.x0 - f.rects[0].x0) < 0.001 &&
            Math.abs(r.y0 - f.rects[0].y0) < 0.001
        )
    );
    if (!dup) {
      f.id = nextId++;
      merged.push(f);
    }
  }

  setAutoRedactSuggestions(merged);
  const btnApply = document.getElementById("btnAutoApply");
  const btnClear = document.getElementById("btnAutoClear");
  if (btnApply) btnApply.disabled = merged.length === 0;
  if (btnClear) btnClear.disabled = merged.length === 0;

  await renderAllPages();
  setStatus(isBarcodeOnly ? "Barcode detection complete." : "Auto-suggestions ready.");
}

// ------------------------------------------------------------
// APPLY (always BLACK)
// ------------------------------------------------------------
export async function applyAutoRedactions() {
  const selected = (autoRedactSuggestions || []).filter(s => s.selected !== false);
  if (!selected.length) {
    setStatus("No auto-redaction suggestions selected.");
    return;
  }

  pushUndo();
  const newMap = structuredClone(redactions || {});

  for (const s of selected) {
    const page = s.page;
    if (!newMap[page]) newMap[page] = [];
    newMap[page].push({
      page,
      type: "auto",
      rects: s.rects,
      color: s.color || document.getElementById("redactionColor")?.value || "#000000"
    });
  }

  setRedactions(newMap);
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
// CLEAR
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
