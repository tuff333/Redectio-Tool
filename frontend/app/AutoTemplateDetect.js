import { textStore } from "./TextLayer.js";

let templates = null;

// Load templates.json
export async function loadTemplates() {
  if (!templates) {
    const res = await fetch("./templates/templates.json");
    templates = await res.json();
  }
  return templates;
}

// Detect company from first page text
export async function detectCompany() {
  await loadTemplates();

  const firstPage = textStore[1];
  if (!firstPage || !firstPage.fullText) return null;

  const text = firstPage.fullText.toLowerCase();

  for (const key in templates) {
    const t = templates[key];

    for (const id of t.identifiers) {
      if (text.includes(id.toLowerCase())) {
        return {
          templateId: key,
          company: t.company
        };
      }
    }
  }

  return null;
}
