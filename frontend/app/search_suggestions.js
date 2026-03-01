import { textStore } from "./TextLayer.js";
import { performSearch } from "./Search.js";

let suggestionsReady = false;
let suggestionWords = [];   // flat list of unique words

export function initSearchSuggestions() {
  const input = document.getElementById("searchInput");
  const box = document.getElementById("searchSuggestions");

  if (!input || !box) {
    console.warn("[Suggestions] searchInput or searchSuggestions not found in DOM");
    return;
  }

  // ------------------------------------------------------------
  // Build suggestions index once, after pages are rendered
  // ------------------------------------------------------------
  document.addEventListener("pages-rendered", () => {
    console.log("[Suggestions] pages-rendered fired, building word index…");

    const wordSet = new Set();

    for (const page in textStore) {
      const store = textStore[page];
      if (!store || !store.fullText) continue;

      // Split on whitespace, strip basic punctuation
      const rawWords = store.fullText.split(/\s+/);

      for (let w of rawWords) {
        w = w.trim();
        if (!w) continue;

        // remove leading/trailing punctuation like commas, periods, etc.
        w = w.replace(/^[^\w]+|[^\w]+$/g, "");
        if (!w) continue;

        wordSet.add(w);
      }
    }

    suggestionWords = Array.from(wordSet);
    suggestionsReady = true;

    console.log("[Suggestions] index built. Unique words:", suggestionWords.length);
    console.log("[Suggestions] sample:", suggestionWords.slice(0, 30));
  });

  // ------------------------------------------------------------
  // Input handler
  // ------------------------------------------------------------
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();

    if (!suggestionsReady) {
      console.log("[Suggestions] not ready yet (no pages-rendered or empty textStore)");
      box.classList.add("hidden");
      return;
    }

    if (!q) {
      box.classList.add("hidden");
      return;
    }

    // Filter words that start with the query
    const matches = suggestionWords
      .filter(w => w.toLowerCase().startsWith(q))
      .slice(0, 20);

    console.log("[Suggestions] query:", q, "matches:", matches.length);

    box.innerHTML = "";

    if (!matches.length) {
      box.classList.add("hidden");
      return;
    }

    matches.forEach(word => {
      const item = document.createElement("div");
      item.className = "suggestion-item";
      item.textContent = word;

      item.addEventListener("click", () => {
        input.value = word;   // put chosen word into search box
        box.classList.add("hidden");
        performSearch();      // run search with that word
      });

      box.appendChild(item);
    });

    box.classList.remove("hidden");
  });
}
