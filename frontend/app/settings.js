// frontend/app/settings.js

const defaultSettings = {
  theme: "light",
  density: "comfortable",
  defaultColor: "#000000",
  aiSensitivity: 50,
  stickySearch: true,
  autoHighlight: true,
  outputPattern: "{name}_redacted",
  toolbarVisibility: {
    selection: true,
    undoRedo: true,
    zoomNav: true,
    aiDetection: true,
    applySave: true
  }
};

function loadSettings() {
  const saved = JSON.parse(localStorage.getItem("coaSettings") || "{}");
  return {
    ...defaultSettings,
    ...saved,
    toolbarVisibility: {
      ...defaultSettings.toolbarVisibility,
      ...(saved.toolbarVisibility || {})
    }
  };
}

function saveSettings(settings) {
  localStorage.setItem("coaSettings", JSON.stringify(settings));
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
}

function applyDensity(density) {
  document.body.dataset.density = density;
}

function buildPreview(pattern) {
  const name = "document";
  const date = "2025-01-01";
  const time = "12-00";
  const redacted = "_redacted";
  const rejected = "_rejected";

  let out = pattern;
  out = out.replaceAll("{name}", name);
  out = out.replaceAll("{date}", date);
  out = out.replaceAll("{time}", time);
  out = out.replaceAll("{redacted}", redacted);
  out = out.replaceAll("{rejected}", rejected);

  if (!out.endsWith(".pdf")) out += ".pdf";
  return out;
}

document.addEventListener("DOMContentLoaded", () => {
  const settings = loadSettings();

  // DOM refs
  const themeBtns = document.querySelectorAll(".theme-option");
  const densityBtns = document.querySelectorAll(".density-option");
  const colorInput = document.getElementById("settingDefaultColor");
  const aiSensitivity = document.getElementById("settingAISensitivity");
  const aiSensitivityValue = document.getElementById("settingAISensitivityValue");
  const stickySearch = document.getElementById("settingStickySearch");
  const autoHighlight = document.getElementById("settingAutoHighlight");
  const patternInput = document.getElementById("settingOutputPattern");
  const patternBtns = document.querySelectorAll(".pattern-buttons button");
  const preview = document.getElementById("settingOutputPreview");
  const toolbarItems = document.querySelectorAll(".toolbar-item");
  const tabs = document.querySelectorAll(".settings-tab");
  const panels = document.querySelectorAll(".settings-panel");

  // Apply theme + density immediately
  applyTheme(settings.theme);
  applyDensity(settings.density);

  // Auto-save helper
  function commit() {
    saveSettings(settings);
  }

  // Theme buttons
  themeBtns.forEach(btn => {
    const t = btn.dataset.theme;
    if (t === settings.theme) btn.classList.add("active");

    btn.addEventListener("click", () => {
      themeBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      settings.theme = t;
      applyTheme(t);
      commit();
    });
  });

  // Density buttons
  densityBtns.forEach(btn => {
    const d = btn.dataset.density;
    if (d === settings.density) btn.classList.add("active");

    btn.addEventListener("click", () => {
      densityBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      settings.density = d;
      applyDensity(d);
      commit();
    });
  });

  // Basic toggles
  colorInput.value = settings.defaultColor;
  if (aiSensitivity) aiSensitivity.value = String(settings.aiSensitivity ?? defaultSettings.aiSensitivity);
  stickySearch.checked = settings.stickySearch;
  autoHighlight.checked = settings.autoHighlight;
  if (aiSensitivityValue) aiSensitivityValue.textContent = String(settings.aiSensitivity ?? defaultSettings.aiSensitivity);

  colorInput.addEventListener("input", () => {
    settings.defaultColor = colorInput.value;
    commit();
  });

  aiSensitivity?.addEventListener("input", () => {
    const v = parseInt(aiSensitivity.value, 10);
    settings.aiSensitivity = Number.isFinite(v) ? v : defaultSettings.aiSensitivity;
    if (aiSensitivityValue) aiSensitivityValue.textContent = String(settings.aiSensitivity);
    commit();
  });

  stickySearch.addEventListener("change", () => {
    settings.stickySearch = stickySearch.checked;
    commit();
  });

  autoHighlight.addEventListener("change", () => {
    settings.autoHighlight = autoHighlight.checked;
    commit();
  });

  // Output pattern
  patternInput.value = settings.outputPattern;
  preview.textContent = buildPreview(settings.outputPattern);

  patternInput.addEventListener("input", () => {
    settings.outputPattern = patternInput.value;
    preview.textContent = buildPreview(settings.outputPattern);
    commit();
  });

  patternBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const token = btn.dataset.token;
      const start = patternInput.selectionStart;
      const end = patternInput.selectionEnd;
      const before = patternInput.value.slice(0, start);
      const after = patternInput.value.slice(end);

      patternInput.value = before + token + after;
      settings.outputPattern = patternInput.value;
      preview.textContent = buildPreview(settings.outputPattern);

      patternInput.focus();
      patternInput.selectionStart = patternInput.selectionEnd = start + token.length;

      commit();
    });
  });

  // Toolbar visibility
  toolbarItems.forEach(item => {
    const key = item.dataset.tool;
    const eye = item.querySelector(".btn-eye");

    const visible = settings.toolbarVisibility[key] !== false;
    eye.dataset.visible = visible ? "true" : "false";
    eye.innerHTML = visible
      ? '<i class="fa-solid fa-eye"></i>'
      : '<i class="fa-solid fa-eye-slash"></i>';

    eye.addEventListener("click", () => {
      const now = eye.dataset.visible !== "true";
      eye.dataset.visible = now ? "true" : "false";
      eye.innerHTML = now
        ? '<i class="fa-solid fa-eye"></i>'
        : '<i class="fa-solid fa-eye-slash"></i>';

      settings.toolbarVisibility[key] = now;
      commit();
    });
  });

  // Tabs
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;

      tabs.forEach(t => t.classList.remove("settings-tab-active"));
      panels.forEach(p => p.classList.add("hidden"));

      tab.classList.add("settings-tab-active");
      document.querySelector(`[data-tab-panel="${target}"]`).classList.remove("hidden");
    });
  });
});
