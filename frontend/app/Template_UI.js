// ------------------------------------------------------------
// Template_UI.js — Real template engine (save/load/apply)
// ------------------------------------------------------------

import {
  redactions,
  setRedactions,
  setStatus
} from "./Utils.js";

import { renderAllPages } from "./PDF_Loader.js";
import { pushUndo } from "./Redaction_Core.js";

// LocalStorage key
const TEMPLATE_KEY = "redactionTemplates";

// DOM elements
const btnSaveTemplate = document.getElementById("btnSaveTemplate");
const btnLoadTemplate = document.getElementById("btnLoadTemplate");
const templateList = document.getElementById("templateList");

// ------------------------------------------------------------
// loadTemplates()
// ------------------------------------------------------------
function loadTemplates() {
  try {
    const raw = localStorage.getItem(TEMPLATE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ------------------------------------------------------------
// saveTemplates(list)
// ------------------------------------------------------------
function saveTemplates(list) {
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(list));
}

// ------------------------------------------------------------
// refreshTemplateListUI()
// ------------------------------------------------------------
function refreshTemplateListUI() {
  const templates = loadTemplates();
  templateList.innerHTML = "";

  for (const t of templates) {
    const li = document.createElement("li");
    li.textContent = t.name;
    li.className = "template-item";

    li.addEventListener("click", () => applyTemplate(t));
    templateList.appendChild(li);
  }
}

// ------------------------------------------------------------
// saveCurrentAsTemplate()
// ------------------------------------------------------------
function saveCurrentAsTemplate() {
  const name = prompt("Enter template name:");
  if (!name) return;

  const templates = loadTemplates();

  const snapshot = [];

  for (const page in redactions) {
    for (const r of redactions[page]) {
      snapshot.push({
        page: r.page,
        rects: r.rects,
        color: r.color,
        type: r.type
      });
    }
  }

  templates.push({
    name,
    items: snapshot
  });

  saveTemplates(templates);
  refreshTemplateListUI();
  setStatus(`Template "${name}" saved.`);
}

// ------------------------------------------------------------
// applyTemplate(template)
// ------------------------------------------------------------
async function applyTemplate(template) {
  pushUndo();

  const newRedactions = structuredClone(redactions);

  for (const item of template.items) {
    const page = item.page;
    if (!newRedactions[page]) newRedactions[page] = [];

    newRedactions[page].push({
      page,
      type: item.type || "template",
      rects: item.rects,
      color: item.color || "#000000"
    });
  }

  setRedactions(newRedactions);
  await renderAllPages();

  setStatus(`Template "${template.name}" applied.`);
}

// ------------------------------------------------------------
// initTemplateUI()
// ------------------------------------------------------------
export function initTemplateUI() {
  refreshTemplateListUI();

  btnSaveTemplate?.addEventListener("click", () => {
    saveCurrentAsTemplate();
  });

  btnLoadTemplate?.addEventListener("click", () => {
    refreshTemplateListUI();
    setStatus("Templates refreshed.");
  });
}
