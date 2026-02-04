// ------------------------------------------------------------
// Template_UI.js — Template sidebar + template redaction
// ------------------------------------------------------------

import {
  pdfBytes,
  setStatus
} from "./Utils.js";

import { downloadBlob, getRedactedFilename } from "./Utils.js";

// DOM elements
const templateListEl = document.getElementById("templateList");
const btnApplyTemplateRedact = document.getElementById("btnApplyTemplateRedact");

// ------------------------------------------------------------
// loadTemplates()
// ------------------------------------------------------------
export async function loadTemplates() {
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
    // optional: silent fail
  }
}

// ------------------------------------------------------------
// applyTemplateRedaction()
// ------------------------------------------------------------
export async function applyTemplateRedaction() {
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
    downloadBlob(blob, getRedactedFilename());
    setStatus("Template redaction complete.");

  } catch (err) {
    console.error(err);
    setStatus("Template redaction failed (backend not reachable).");
  }
}

// ------------------------------------------------------------
// initTemplateUI()
// ------------------------------------------------------------
export function initTemplateUI() {
  loadTemplates();

  btnApplyTemplateRedact?.addEventListener("click", async () => {
    await applyTemplateRedaction();
  });
}