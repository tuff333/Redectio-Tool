// frontend/app.js

const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const fileNameEl = document.getElementById("fileName");
const btnRedact = document.getElementById("btnRedact");
const btnClear = document.getElementById("btnClear");
const statusText = document.getElementById("statusText");
const pdfViewer = document.getElementById("pdfViewer");
const templateListEl = document.getElementById("templateList");

let currentFile = null;

// -----------------------------
// Helper: set status
// -----------------------------
function setStatus(msg, isError = false) {
  statusText.textContent = msg || "";
  statusText.style.color = isError ? "#fca5a5" : "#9ca3af";
}

// -----------------------------
// Load templates (optional endpoint)
// -----------------------------
async function loadTemplates() {
  if (!templateListEl) return;

  try {
    const res = await fetch("http://127.0.0.1:8000/api/templates");
    if (!res.ok) return;

    const data = await res.json();
    templateListEl.innerHTML = "";

    (data.templates || []).forEach((tpl) => {
      const li = document.createElement("li");
      li.textContent = tpl.display_name || tpl.company_id || "Unknown";
      if (tpl.is_default) li.textContent += " (default)";
      templateListEl.appendChild(li);
    });
  } catch {
    // silently ignore if endpoint not implemented yet
  }
}

// -----------------------------
// File selection
// -----------------------------
function handleFile(file) {
  if (!file || file.type !== "application/pdf") {
    setStatus("Please select a valid PDF file.", true);
    btnRedact.disabled = true;
    currentFile = null;
    fileNameEl.textContent = "";
    pdfViewer.src = "";
    return;
  }

  currentFile = file;
  fileNameEl.textContent = file.name;
  btnRedact.disabled = false;
  setStatus("Ready to run auto redaction.");

  // Preview original PDF
  const url = URL.createObjectURL(file);
  pdfViewer.src = url;
}

// Input change
fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  handleFile(file);
});

// Drag & drop
["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove("dragover");
  });
});

dropZone.addEventListener("drop", (e) => {
  const dt = e.dataTransfer;
  const file = dt.files[0];
  handleFile(file);
});

// -----------------------------
// Redact button
// -----------------------------
btnRedact.addEventListener("click", async () => {
  if (!currentFile) {
    setStatus("No file selected.", true);
    return;
  }

  setStatus("Uploading and running redaction...");
  btnRedact.disabled = true;

  try {
    const formData = new FormData();
    formData.append("file", currentFile);

    const res = await fetch("http://127.0.0.1:8000/api/redact/single", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      setStatus("Redaction failed. Check backend logs.", true);
      btnRedact.disabled = false;
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    // Trigger download
    const a = document.createElement("a");
    a.href = url;
    a.download = "redacted.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();

    setStatus("Redaction complete. Redacted PDF downloaded.");
  } catch (err) {
    console.error(err);
    setStatus("Error during redaction. See console/backend logs.", true);
  } finally {
    btnRedact.disabled = false;
  }
});

// -----------------------------
// Clear button
// -----------------------------
btnClear.addEventListener("click", () => {
  currentFile = null;
  fileInput.value = "";
  fileNameEl.textContent = "";
  pdfViewer.src = "";
  btnRedact.disabled = true;
  setStatus("");
});

// -----------------------------
// Init
// -----------------------------
setStatus("Waiting for PDF...");
btnRedact.disabled = true;
loadTemplates();
