// app/layout.js

import { initFrontend } from "../app.js";

async function loadPartial(id, path) {
  const container = document.getElementById(id);
  if (!container) return;

  try {
    const res = await fetch(path);
    if (!res.ok) {
      console.error("[layout] FAILED to load:", path, res.status);
      return;
    }
    container.innerHTML = await res.text();
    console.log("[layout] loaded:", path);
  } catch (err) {
    console.error("[layout] error fetching", path, err);
  }
}

async function initLayout() {
  const isSettings = window.location.pathname.includes("settings.html");
  const inHtmlFolder = window.location.pathname.includes("/html/");
  const partialPrefix = inHtmlFolder ? "../" : "";
  const homeHref = inHtmlFolder ? "../index.html" : "index.html";
  const redactionHref = inHtmlFolder ? "./redaction.html" : "html/redaction.html";
  const batchHref = inHtmlFolder ? "./batch-redaction.html" : "html/batch-redaction.html";
  const aiTrainingHref = inHtmlFolder ? "./training.html" : "html/training.html";
  const settingsHref = inHtmlFolder ? "settings.html" : "html/settings.html";

  // HEADER
  await loadPartial("base-header", `${partialPrefix}html/base/header.html`);

  // SIDEBAR + TOOLS
  if (isSettings) {
    await loadPartial("base-sidebar", `${partialPrefix}html/base/sidebar-nav.html`);
  } else {
    await loadPartial("base-sidebar", `${partialPrefix}html/base/sidebar-full.html`);
    await loadPartial("base-tools", `${partialPrefix}html/base/tools.html`);
  }

  // FOOTER
  await loadPartial("base-footer", `${partialPrefix}html/base/footer.html`);

  // Sidebar collapse
  document.addEventListener("click", e => {
    if (e.target.closest("#btnCollapseSidebar")) {
      document.body.classList.toggle("sidebar-collapsed");
    }
  });

  // Home button (logo)
  document.getElementById("btnHome")?.addEventListener("click", () => {
    window.location.href = homeHref;
  });

  // Floating sidebar mode
  document.addEventListener("keydown", e => {
    if (e.key === "`") {
      document.body.classList.toggle("sidebar-floating");
    }
  });

  // Initialize app AFTER layout is ready
  // Ensure Lucide icons render for any dynamically-loaded partials.
  if (window.lucide) window.lucide.createIcons();
  initFrontend();

  // Navigation highlight + routing
  const navButtons = document.querySelectorAll(".nav-item[data-nav]");
  navButtons.forEach(btn => {
    const target = btn.dataset.nav;
    const isRedaction = !isSettings && target === "redaction";
    const isSettingsPage = isSettings && target === "settings";

    if (isRedaction || isSettingsPage) btn.classList.add("nav-item-active");

    btn.addEventListener("click", () => {
      if (target === "redaction") {
        window.location.href = redactionHref;
      } else if (target === "settings") {
        window.location.href = settingsHref;
      } else if (target === "home") {
        window.location.href = homeHref;
      } else if (target === "batch-redaction") {
        window.location.href = batchHref;
      } else if (target === "ai-training") {
        window.location.href = aiTrainingHref;
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", initLayout);
