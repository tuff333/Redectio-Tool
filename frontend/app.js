// ------------------------------------------------------------
// app.js — Main entry point for Redectio
// ------------------------------------------------------------

// Load PDF.js worker config
import "./pdfjs/pdf-init.js";

// Central event wiring
import { initApp } from "./app/Events.js";

// Export loadPDF for FileIO.js
export { loadPDF } from "./app/PDF_Loader.js";

// Alerts
import { showAlert } from "./app/alert.js";
window.showAlert = showAlert;

// Optional: expose SaveRule globally
import { saveSelectedAsRule } from "./app/SaveRule.js";
window.saveSelectedAsRule = saveSelectedAsRule;

// UI tabs
import "./app/tabs.js";

// Search suggestions
import { initSearchSuggestions } from "./app/search_suggestions.js";

// Template list loader
import { loadCompanyList } from "./app/Template_List.js";

// Plugin system
import { loadPluginsIntoUI, runPlugin } from "./app/plugin.js";
window.runPlugin = runPlugin; // optional: expose globally if needed

// ------------------------------------------------------------
// Apply settings (color, highlight, sticky search, theme, density)
// ------------------------------------------------------------
function applySettings() {
  const settings = JSON.parse(localStorage.getItem("coaSettings") || "{}");

  // Theme + density (so home page matches Settings)
  if (settings.theme) {
    document.body.dataset.theme = settings.theme;
  }
  if (settings.density) {
    document.body.dataset.density = settings.density;
  }

  // Default redaction color
  if (settings.defaultColor) {
    const colorInput = document.getElementById("redactionColor");
    if (colorInput) colorInput.value = settings.defaultColor;
  }

  // Auto highlight toggle
  if (settings.autoHighlight === false) {
    const btn = document.getElementById("btnToggleHighlight");
    if (btn) btn.classList.remove("btn-toggle-active");
  }

  // Sticky search toggle (if user disables it)
  if (settings.stickySearch === false) {
    window.__DISABLE_STICKY_SEARCH = true;
  }
}

// ------------------------------------------------------------
// Public init called AFTER layout/partials are loaded
// ------------------------------------------------------------
export function initFrontend() {
  console.log("Redectio App Loaded");

  // Apply user settings FIRST
  applySettings();

  // Initialize full application
  initApp();

  // Build search suggestions index
  initSearchSuggestions();

  // Populate company dropdown
  loadCompanyList();

  // Load plugin buttons into Tools panel
  loadPluginsIntoUI();
}
