// ------------------------------------------------------------
// suggestions.js — Connect frontend → backend auto-suggest
// ------------------------------------------------------------

export async function fetchRedactionSuggestions(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/redact/auto-suggest", {
    method: "POST",
    body: formData
  });

  if (!res.ok) {
    throw new Error("Failed to fetch suggestions");
  }

  const json = await res.json();

  // Backend returns { filename, candidates: [...] }
  const raw = json.candidates || [];

  return raw.map((c, idx) => ({
    id: idx,
    page: c.page,
    box: c.rects?.[0] || null,
    label: c.rule_id || "AUTO",
    reason: c.text || ""
  }));
}
