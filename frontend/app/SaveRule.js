// C:\projects\redact-tool-K2\frontend\app\SaveRule.js
// ------------------------------------------------------------
// SaveRule.js — Frontend helper to save selected suggestions as a company rule
// ------------------------------------------------------------

const BACKEND_URL = "http://127.0.0.1:8000";

function normalizeForSave({ companyId, displayName, suggestions }) {
  // suggestions: array of { id, page, rects, text, label, group }
  return {
    company_id: companyId || `company_${Date.now()}`,
    display_name: displayName || companyId || "Unnamed Company",
    created_at: new Date().toISOString(),
    rules: suggestions.map((s, idx) => ({
      id: `${s.label || s.group || "rule"}_${Date.now()}_${idx}`,
      label: s.label || s.group || "AUTO",
      group: s.group || "auto",
      sample_text: s.text || "",
      rects: s.rects || [],
      page: s.page || 1,
      action: "suggest"
    }))
  };
}

export async function saveSelectedAsRule(payload) {
  // payload: { companyId, displayName, suggestions }
  const body = normalizeForSave(payload);

  const form = new FormData();
  form.append("rule", JSON.stringify(body));

  const res = await fetch(`${BACKEND_URL}/api/templates/save-rule`, {
    method: "POST",
    body: form
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Save failed: ${res.status} ${txt}`);
  }

  return await res.json();
}
