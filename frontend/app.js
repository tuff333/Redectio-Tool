// ------------------------------------------------------------
// app.js — Orchestrator (initializes the entire application)
// ------------------------------------------------------------

import { initApp } from "./Events.js";
import { loadPDF } from "./PDF_Loader.js";

// ------------------------------------------------------------
// Bootstrapping
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

// ------------------------------------------------------------
// Global function for loading a PDF from FileIO
// ------------------------------------------------------------
// FileIO will call this after reading the file bytes.
// After loadPDF finishes, we dispatch a custom event so
// Events.js can attach redaction handlers to each page.
// ------------------------------------------------------------
export async function openPdfFromBytes(bytes) {
  await loadPDF(bytes);

  // Notify Events.js that PDF is ready
  document.dispatchEvent(new CustomEvent("pdf-loaded"));
}