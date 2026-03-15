// frontend/app/alert.js
export function showAlert(type, message, timeout = 3000) {
  // type: "info" | "success" | "warn" | "error"
  const containerId = "appAlertContainer";
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement("div");
    container.id = containerId;
    container.style.position = "fixed";
    container.style.right = "20px";
    container.style.top = "20px";
    container.style.zIndex = 99999;
    document.body.appendChild(container);
  }

  const el = document.createElement("div");
  el.className = `app-alert app-alert-${type || "info"}`;
  el.textContent = message;
  el.style.marginTop = "8px";
  el.style.padding = "10px 14px";
  el.style.borderRadius = "6px";
  el.style.color = "#fff";
  el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
  el.style.fontFamily = "system-ui, Arial, sans-serif";
  el.style.fontSize = "13px";

  switch (type) {
    case "success":
      el.style.background = "#2e7d32";
      break;
    case "warn":
      el.style.background = "#f57c00";
      break;
    case "error":
      el.style.background = "#c62828";
      break;
    default:
      el.style.background = "#1565c0";
  }

  container.appendChild(el);

  if (timeout > 0) {
    setTimeout(() => {
      el.style.transition = "opacity 250ms ease";
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 300);
    }, timeout);
  }

  return el;
}
