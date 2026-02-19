// ------------------------------------------------------------
// Template_Detect_Backend.js — Use backend to detect company
// and load its template into the existing Template_UI sidebar.
// Also immediately run backend auto-suggest.
// ------------------------------------------------------------

import {
  originalPdfBytes,
  setStatus,
  setCurrentCompany
} from "./Utils.js";

import { loadTemplateForCompany } from "./Template_UI.js";
import { runAutoRedact } from "./Redaction_Auto.js";

const BACKEND_URL = "http://127.0.0.1:8000";

// ------------------------------------------------------------
// detectCompanyFromBackend()
// Detect company from backend using current PDF bytes
// ------------------------------------------------------------
export async function detectCompanyFromBackend() {
  if (!originalPdfBytes || !originalPdfBytes.length) {
    setStatus("Upload a PDF first before detecting company.");
    return null;
  }

  const form = new FormData();
  form.append(
    "file",
    new Blob([originalPdfBytes], { type: "application/pdf" }),
    "file.pdf"
  );

  try {
    const res = await fetch(`${BACKEND_URL}/api/detect-company`, {
      method: "POST",
      body: form
    });

    if (!res.ok) {
      setStatus("Company detection failed.");
      return null;
    }

    const json = await res.json();
    if (!json.company_id) {
      setStatus("No matching company template found.");
      return null;
    }

    const id = json.company_id;
    const name = json.display_name || id;

    // Status + dropdown
    setStatus(`Detected company: ${name}`);
    setCurrentCompany(id, name);

    return id;
  } catch (err) {
    console.error("detectCompanyFromBackend error:", err);
    setStatus("Company detection failed (backend not reachable).");
    return null;
  }
}

// ------------------------------------------------------------
// detectAndLoadTemplateFromBackend()
// One-shot: detect company + load its template + run auto-suggest
// ------------------------------------------------------------
export async function detectAndLoadTemplateFromBackend() {
  const companyId = await detectCompanyFromBackend();
  if (!companyId) return;

  await loadTemplateForCompany(companyId);

  // 🔥 Immediately run backend auto-suggest using the same PDF
  await runAutoRedact("/api/redact/auto-suggest");
}
