High‑level upgrade list
Branding & layout
Header: Change title to “Rasesh COAs PDF Redaction”.
Left sidebar:
Logo + app name
Sections:
📄 Redact COA
📚 Batch (coming)
⚙️ Settings (coming)
Templates
Save Template
Refresh Templates
Center panel: All tools (upload, search, navigation, redaction tools, auto‑redact, barcode, etc.).
Responsive behavior:
Desktop: sidebar + tools + workspace visible
Narrow: Stirling‑style tabs: Tools / Workspace.
Viewer & navigation
Fix page indicator: show current / total correctly.
Add page jump: make the current page number editable (type 6 in 1 / 10 → jump to page 6).
Ensure multi‑page scroll & zoom behave consistently when resizing.
Keyboard shortcuts
Add undo/redo: Ctrl+Z, Ctrl+Y (or Ctrl+Shift+Z).
Add shortcuts for:
Switch tool (text redaction, box redaction, pan, select)
Next/prev page
Toggle highlight mode
Make shortcuts configurable in Settings (stored in localStorage / config JSON).
Settings panel
Move Redaction Color (Current color) into Settings.
Add:
Default redaction color
Default highlight color
Keyboard shortcut editor
“Reset to defaults” option.
Search + smart suggestions
Use extracted text/OCR index to:
Show type‑ahead suggestions as user types:
C → CERTIFICATE, CBD, CBDA, CBDV, …
CE → narrowed to CERTIFICATE, etc.
Allow:
Add word to redaction list
Redact all matches
Add all matches to list
Redaction word list:
Persistent list per user (localStorage / templates).
Add/remove words anytime.
Apply list to current PDF.
Save/load lists for reuse across files.
Alerts & UX polish
Create alert.css and a small alert system:
Success / info / warning / error banners.
Positioned top‑right or top‑center.
Auto‑dismiss + close button.
Add tooltips on hover:
On buttons/icons, show short description after a small delay.
Use a shared tooltip component (CSS + small JS).
# Rasesh COAs PDF Redaction – Frontend Upgrade Roadmap

## 1. Branding and layout (Stirling-style shell)

- **Header:**
  - Rename app to **“Rasesh COAs PDF Redaction”**.
  - Keep COA‑focused tagline (Auto-detect company, Auto-redact, Manual fine-tune).

- **Left sidebar:**
  - Add logo + app name at the top.
  - Add primary navigation items:
    - 📄 **Redact COA**
    - 📚 **Batch (coming)**
    - ⚙️ **Settings (coming)**
  - Add **Templates** section:
    - **Save Template**
    - **Refresh Templates**

- **Center panel:**
  - Host all tools:
    - Upload panel
    - Search + navigation
    - Redaction tools (text, box, auto, barcode)
    - Status messages

- **Responsive behavior:**
  - Desktop: sidebar + tools + workspace visible.
  - Narrow width:
    - Switch to Stirling-like bottom/top tabs:
      - **Tools**
      - **Workspace**
    - Only one visible at a time, with smooth switching.

---

## 2. Viewer and page navigation

- **Page indicator fix:**
  - Ensure it shows `currentPage / totalPages` correctly.
  - Update on:
    - Scroll
    - Page navigation buttons
    - Direct page jumps.

- **Page jump:**
  - Make the current page number editable:
    - User can type a page number and press Enter.
    - Validate range (1–N) and jump.

- **Multi-page behavior:**
  - Confirm:
    - Scroll to view all pages works.
    - Zoom does not break overlays.
    - Resizing window keeps overlays aligned.

---

## 3. Keyboard shortcuts and Settings integration

- **Initial shortcuts:**
  - `Ctrl+Z` – Undo last redaction/action.
  - `Ctrl+Y` / `Ctrl+Shift+Z` – Redo.
  - `Ctrl+F` – Focus search.
  - `Ctrl+→` / `Ctrl+←` – Next/previous page.
  - Single-key (optional) for tools:
    - `T` – Text redaction tool.
    - `B` – Box redaction tool.
    - `H` – Highlight mode toggle.

- **Settings page:**
  - Add a **Keyboard Shortcuts** section:
    - List all actions.
    - Allow editing key bindings.
    - Store in localStorage (or config JSON).
    - Add “Reset to defaults” button.

- **Redaction color in Settings:**
  - Move **Redaction Color (Current color)** into Settings.
  - Allow:
    - Default redaction color.
    - Default highlight color.
  - Apply changes live to tools.

---

## 4. Search, suggestions, and redaction word lists

- **Search suggestions:**
  - Build an in-memory index from:
    - Extracted text layer.
    - OCR fallback words (when used).
  - As user types:
    - Show suggestions starting with the typed prefix.
    - Example:
      - Type `C` → `CERTIFICATE`, `CBD`, `CBDA`, `CBDV`, …
      - Type `CE` → narrowed to `CERTIFICATE`, etc.
  - UI:
    - Dropdown under search input.
    - Arrow keys + Enter to select.

- **Redaction from search:**
  - For a selected word:
    - **Redact this word in current page.**
    - **Redact all matches in document.**
    - **Add to redaction list.**

- **Redaction word list:**
  - Persistent list of terms:
    - Add/remove terms.
    - Apply list to current PDF (redact all matches).
    - Save list for reuse across sessions/files.
  - Storage:
    - LocalStorage initially.
    - Later: export/import as JSON template.

---

## 5. Alerts and tooltips

- **Alert system (`alert.css` + JS):**
  - Types:
    - Success (green)
    - Info (blue)
    - Warning (yellow)
    - Error (red)
  - Behavior:
    - Slide-in / fade-in.
    - Auto-dismiss after a few seconds.
    - Manual close button.
  - Use cases:
    - “Auto-redaction suggestions ready.”
    - “No matches found.”
    - “Template saved.”
    - “Backend not reachable.”

- **Tooltips on hover:**
  - Shared tooltip component:
    - Small delay before showing.
    - Positioned near cursor or button.
  - Add to:
    - All toolbar buttons.
    - Sidebar items.
    - Settings controls.
  - Content:
    - Short, action-focused descriptions.
    - Example:
      - “Draw a box to redact an area.”
      - “Search and highlight text across pages.”

---

## 6. Polishing and parity checks

- **Stirling-PDF parity checklist:**
  - Compare:
    - Layout feel (spacing, typography, iconography).
    - Tool discoverability.
    - Mobile/narrow behavior.
  - Adjust:
    - Padding, font sizes, icon sizes.
    - Hover states and active states.

- **Future enhancements (backlog):**
  - Combined auto-engine (text + barcode + OCR).
  - Per-company saved redaction profiles.
  - Multi-document workspace.
  - Dark mode toggle.
