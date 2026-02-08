// ------------------------------------------------------------
// Template_UI.js — Template-driven sidebar (Stirling‑style)
// ------------------------------------------------------------

import {
  setStatus,
  templateData,
  setTemplateData,
  pageViews
} from "./Utils.js";

import { renderPageView } from "./PDF_Loader.js";

// ------------------------------------------------------------
// Fetch template for detected company
// ------------------------------------------------------------
export async function loadTemplateForCompany(companyId) {
  if (!companyId) {
    setStatus("No company detected.");
    return;
  }

  try {
    const res = await fetch(`/api/templates/${companyId}`);
    const data = await res.json();

    setTemplateData(data);
    renderTemplateSidebar(data);

    applyManualPresets(data);
    setStatus(`Loaded template for ${data.display_name}.`);
  } catch (err) {
    console.error("Template load failed:", err);
    setStatus("Failed to load template.");
  }
}

// ------------------------------------------------------------
// Apply manual presets (color, mode, annotation type)
// ------------------------------------------------------------
function applyManualPresets(template) {
  const presets = template.manual_presets || {};

  if (presets.default_color) {
    const colorInput = document.getElementById("redactionColor");
    if (colorInput) colorInput.value = presets.default_color;
  }

  if (presets.default_mode) {
    window.__DEFAULT_REDACTION_MODE = presets.default_mode;
  }

  if (presets.default_annotation) {
    window.__DEFAULT_ANNOTATION_TOOL = presets.default_annotation;
  }
}

// ------------------------------------------------------------
// Render template sidebar
// ------------------------------------------------------------
export function renderTemplateSidebar(template) {
  const sidebar = document.getElementById("templateSidebar");
  if (!sidebar) return;

  sidebar.innerHTML = `
    <h3>${template.display_name}</h3>

    <h4>Auto‑Redaction Rules</h4>
    <div id="ruleList">
      ${template.rules
        .map(
          (r) => `
        <div class="rule-item">
          <input type="checkbox" class="rule-toggle" data-rule="${r.id}" checked />
          <span>${r.id}</span>
        </div>
      `
        )
        .join("")}
    </div>

    <h4>Zones</h4>
    <div id="zoneList">
      ${template.zones
        .map(
          (z) => `
        <div class="zone-item">
          <button class="zone-preview-btn" data-zone="${z.id}">
            Preview Zone: ${z.id}
          </button>
        </div>
      `
        )
        .join("")}
    </div>
  `;

  attachRuleToggleHandlers();
  attachZonePreviewHandlers(template);
}

// ------------------------------------------------------------
// Rule toggles
// ------------------------------------------------------------
function attachRuleToggleHandlers() {
  const toggles = document.querySelectorAll(".rule-toggle");

  toggles.forEach((toggle) => {
    toggle.addEventListener("change", () => {
      const ruleId = toggle.dataset.rule;
      const enabled = toggle.checked;

      if (!templateData) return;

      const rule = templateData.rules.find((r) => r.id === ruleId);
      if (rule) rule.enabled = enabled;

      setStatus(`Rule ${ruleId} ${enabled ? "enabled" : "disabled"}.`);
    });
  });
}

// ------------------------------------------------------------
// Zone preview
// ------------------------------------------------------------
function attachZonePreviewHandlers(template) {
  const buttons = document.querySelectorAll(".zone-preview-btn");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const zoneId = btn.dataset.zone;
      const zone = template.zones.find((z) => z.id === zoneId);
      if (!zone) return;

      previewZone(zone);
    });
  });
}

// ------------------------------------------------------------
// Draw zone preview on overlay canvas
// ------------------------------------------------------------
function previewZone(zone) {
  const view = pageViews.find((v) => v.pageNumber === zone.page);
  if (!view) return;

  const ctx = view.overlay.getContext("2d");
  const { viewport } = view;

  ctx.save();
  ctx.strokeStyle = "rgba(0, 150, 255, 0.9)";
  ctx.lineWidth = 3;

  const { x0, y0, x1, y1 } = zone.rect;

  const x = x0 * viewport.width;
  const y = y0 * viewport.height;
  const w = (x1 - x0) * viewport.width;
  const h = (y1 - y0) * viewport.height;

  ctx.strokeRect(x, y, w, h);

  ctx.restore();

  setStatus(`Previewed zone: ${zone.id}`);
}
