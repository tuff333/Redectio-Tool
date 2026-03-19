// frontend/app/alert.js
export function showAlert(type, message, timeout = 3000) {
  // type: "info" | "success" | "warn" | "error"
  const container = document.getElementById("alertContainer") || document.body;

  const mapped = (() => {
    const t = (type || "info").toLowerCase();
    if (t === "success") return "success";
    if (t === "warn" || t === "warning") return "warning";
    if (t === "error") return "error";
    return "info";
  })();

  const el = document.createElement("div");
  el.className = `alert alert-${mapped}`;
  el.setAttribute("role", "status");
  el.style.pointerEvents = "auto";

  const text = document.createElement("span");
  text.textContent = message;

  const close = document.createElement("span");
  close.className = "alert-close";
  close.setAttribute("role", "button");
  close.setAttribute("aria-label", "Close alert");
  close.textContent = "×";

  close.addEventListener("click", () => {
    el.style.transition = "opacity 200ms ease";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 220);
  });

  el.appendChild(text);
  el.appendChild(close);
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
