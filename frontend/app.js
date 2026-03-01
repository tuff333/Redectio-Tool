// ------------------------------------------------------------
// app.js — Main entry point for Redectio
// ------------------------------------------------------------

// Load PDF.js worker config
import "./pdfjs/pdf-init.js";

// Central event wiring
import { initApp } from "./app/Events.js";

// Export loadPDF for FileIO.js
export { loadPDF } from "./app/PDF_Loader.js";

import { showAlert } from "./app/alert.js";
window.showAlert = showAlert; // make globally accessible

import "./app/tabs.js";
import { initSearchSuggestions } from "./app/search_suggestions.js";
import { loadCompanyList } from "./app/Template_List.js";

// ------------------------------------------------------------
// Initialize AFTER DOM is ready
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  console.log("Redectio App Loaded");
  initApp();
  initSearchSuggestions();
  loadCompanyList(); // ✅ populate Detected company dropdown
});
