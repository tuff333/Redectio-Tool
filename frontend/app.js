// ------------------------------------------------------------
// app.js — Main entry point for Redectio
// All other modules are imported from here.
// ------------------------------------------------------------

// Core modules
import { initEvents } from "./app/Events.js";
import { initFileIO } from "./app/FileIO.js";
import { renderAllPages, openPdfFromBytes } from "./app/PDF_Loader.js";

// Redaction modules
import "./app/Redaction_Core.js";
import "./app/Redaction_Box.js";
import "./app/Redaction_TextSelect.js";

// Search + Template UI
import "./app/Search.js";
import "./app/Template_UI.js";

// Make openPdfFromBytes available to FileIO.js
export { openPdfFromBytes };

// ------------------------------------------------------------
// Initialize the app AFTER DOM is ready
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    console.log("Redectio App Loaded");

    // Initialize event handlers
    initEvents();

    // Initialize upload, drag/drop, save, import/export
    initFileIO();

    // PDF viewer will render pages when a PDF is loaded
});
