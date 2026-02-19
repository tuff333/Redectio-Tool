export function showAlert(type, message, timeout = 3000) {
  const container = document.getElementById("alertContainer");
  if (!container) return;

  const alert = document.createElement("div");
  alert.className = `alert alert-${type}`;
  alert.innerHTML = `
    <span>${message}</span>
    <span class="alert-close">&times;</span>
  `;

  container.appendChild(alert);

  // Close button
  alert.querySelector(".alert-close").addEventListener("click", () => {
    fadeOut(alert);
  });

  // Auto dismiss
  setTimeout(() => fadeOut(alert), timeout);
}

function fadeOut(alert) {
  alert.style.animation = "alertFadeOut 0.25s forwards";
  setTimeout(() => alert.remove(), 250);
}
