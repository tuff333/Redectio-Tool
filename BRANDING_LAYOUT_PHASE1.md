# Phase 1 – Branding & Layout (Stirling-Style Shell)

This phase upgrades the UI structure to match the clean, modern, responsive layout style of Stirling-PDF while keeping the COA-focused workflow.

---

## 1. Header

### Requirements
- Rename app to **“Rasesh COAs PDF Redaction”**
- Add tagline:
  - *Auto-detect company · Auto-redact · Manual fine-tune*
- Keep user name on the right
- Optional: small logo on the left

### Deliverables
- `header.html`
- `header.css`

---

## 2. Left Sidebar

### Requirements
- Add logo + app name at the top
- Add navigation items:
  - 📄 **Redact COA**
  - 📚 **Batch (coming)**
  - ⚙️ **Settings (coming)**
- Add Templates section:
  - Save Template
  - Refresh Templates

### Behavior
- Sidebar visible on desktop
- Hidden on mobile

### Deliverables
- `sidebar.html`
- `sidebar.css`

---

## 3. Main Panel (Tools + Workspace)

### Tools Panel
Contains:
- Upload panel
- Search + navigation
- Redaction tools (text, box, auto, barcode)
- Status messages

### Workspace Panel
Contains:
- PDF viewer
- Page indicator (editable)
- Scrollable multi-page view

### Deliverables
- `tools-panel.html`
- `workspace-panel.html`
- `main-panel.css`

---

## 4. Responsive Behavior (Stirling-style)

### Desktop
- Sidebar + tools + workspace visible simultaneously

### Narrow width (<900px)
- Sidebar hidden
- Show tab bar:
  - **Tools**
  - **Workspace**
- Only one panel visible at a time
- Smooth transitions

### Deliverables
- `responsive.css`
- `tabs.js`

---

## 5. Integration Notes

- No backend changes required
- All existing JS modules remain functional
- Only structural HTML/CSS changes + small JS for tab switching

---

## Completion Criteria

- App displays Stirling-style layout on desktop
- App switches to tabbed layout on mobile
- Sidebar navigation is clean and branded
- Tools and workspace panels are visually separated
- No functional regressions
