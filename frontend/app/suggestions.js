// C:\projects\redact-tool-K2\frontend\app\suggestions.js
// ------------------------------------------------------------
// suggestions.js — Normalize backend suggestions for frontend use
// ------------------------------------------------------------

export function normalizeBackendCandidates(json) {
  // Accepts backend JSON { candidates: [...] } or array
  const raw = Array.isArray(json) ? json : (json?.candidates || json?.suggestions || []);
  const out = [];

  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    const page = c.page || c.p || 1;
    const rects = c.rects || (c.box ? [c.box] : []);
    const text = c.text || c.reason || c.label || "";
    const label = c.rule_id || c.label || (c.group ? c.group.toUpperCase() : "AUTO");
    const group = c.group || c.type || "auto";

    out.push({
      id: i,
      page,
      rects,
      text,
      label,
      group,
      selected: true,
      color: "#000000"
    });
  }

  return out;
}
