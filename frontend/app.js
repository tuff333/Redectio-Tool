// ------------------------------------------------------------
// app.js — Orchestrator (initializes the entire application)
// ------------------------------------------------------------

import { initApp } from "./app/Events.js";
import { loadPDF } from "./app/PDF_Loader.js";

// ------------------------------------------------------------
// Bootstrapping
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

// ------------------------------------------------------------
// Global function for loading a PDF from FileIO
// ------------------------------------------------------------
export async function openPdfFromBytes(bytes) {
  await loadPDF(bytes);

  // Notify Events.js that PDF is ready
  document.dispatchEvent(new CustomEvent("pdf-loaded"));
}
