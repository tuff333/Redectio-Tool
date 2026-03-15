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

// Optional: expose SaveRule globally (Template_UI already imports it)
import { saveSelectedAsRule } from "./app/SaveRule.js";
window.saveSelectedAsRule = saveSelectedAsRule;

// UI tabs
import "./app/tabs.js";

// Search suggestions
import { initSearchSuggestions } from "./app/search_suggestions.js";

// Template list loader
import { loadCompanyList } from "./app/Template_List.js";

// ------------------------------------------------------------
// Initialize AFTER DOM is ready
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  console.log("Redectio App Loaded");
  // Initialize full application
  initApp();
  // Build search suggestions index
  initSearchSuggestions();
  loadCompanyList(); // ✅ populate Detected company dropdown
});
