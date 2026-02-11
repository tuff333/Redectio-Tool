// ------------------------------------------------------------
// app.js — Main entry point for Redectio
// All other modules are imported from here.
// ------------------------------------------------------------

// Core modules
import "./pdfjs/pdf-init.js";
import { initApp } from "./app/Events.js";
import { loadPDF } from "./app/PDF_Loader.js"; // ← correct import
//import { initFileIO } from "./app/FileIO.js"; // imported but NOT called here
//import { renderAllPages, loadPDF } from "./app/PDF_Loader.js";

// Redaction modules
import "./app/Redaction_Core.js";
import "./app/Redaction_Box.js";
import "./app/Redaction_TextSelect.js";

// Search + Template UI
import "./app/Search.js";
import "./app/Template_UI.js";

// Make loadPDF available to FileIO.js
export { loadPDF };

// ------------------------------------------------------------
// Initialize the app AFTER DOM is ready
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  console.log("Redectio App Loaded");

  // Initialize event handlers + FileIO (initApp internally calls initFileIO)
  initApp();

  // IMPORTANT:
  // Do NOT call initFileIO() here, because initApp() already calls it.
  // Calling it twice causes duplicate handlers and double file picker.
  // initFileIO();
});
