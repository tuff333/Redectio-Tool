# Redactio COA Suite – Roadmap

Industrial‑grade, offline‑first COA redaction suite combining the best of:

- **Redectio‑Tool** (backend intelligence)  
- **Redection‑Studio** (modern UI)  
- **Stirling‑PDF** (UX patterns)  
- Local AI/ML training for per‑company redaction behavior  

---

## 1. Core vision and constraints

### 1.1 Product vision

**Redactio – Professional COA Redaction Tool**

- Industrial‑grade PDF redaction tool specialized for **Certificate of Analysis (COA)** documents.
- **AI‑powered field detection** (per company, per layout).
- **Batch and single‑file redaction**.
- **Offline‑first**, runs on:
  - Raspberry Pi
  - Older Windows laptops (e.g., Dell Vostro 3550)
  - macOS
- **Responsive UI**:
  - Desktop (Photoshop / Office 365 style)
  - Mobile (Google Docs / Stirling‑PDF style)

### 1.2 Non‑negotiable constraints

- **No cloud dependency**: all OCR, AI, and redaction logic must run locally.
- **Per‑company learning**: model adapts from user’s manual redactions and training pairs.
- **COA‑aware**: understands fields like:
  - Barcode / QR Code  
  - REPORT NO.  
  - ACCOUNT NUMBER  
  - TO: (Client Name)  
  - Phone  
  - PO#  
  - LAB NUMBER  
  - SAMPLE ID  
- **Safe output**:
  - Original: `2025-UMP-T1.pdf`
  - Redacted: `2025-UMP-T1_Redacted.pdf`
  - Same folder.

---

## 2. Source projects and what we reuse

### 2.1 Redectio‑Tool (backend brain)

**Repo:** `https://github.com/tuff333/Redectio-Tool`

We reuse and extend:

- **FastAPI backend**
- **TextFinder** (PyMuPDF + OCR fallback)
- **OCR engine** (Tesseract + preprocessing)
- **CompanyDetector**
- **Rule engine**:
  - Universal rules
  - Company rules
  - Layout rules
  - Regex rules
  - Barcode/QR zones
- **Suggestions engine**
- **AutoRedactionEngine**
- **ManualRedactionEngine**
- **Template system**
- **Batch CLI**
- **Coordinate normalization**

### 2.2 Redection‑Studio (frontend face)

**Repo:** `https://github.com/tuff333/Redection-studio`

We reuse and extend:

- Modern **React/TS** UI shell
- **Desktop layout**:
  - Left tools
  - Center viewer
  - Right sidebar
- **Mobile layout**:
  - Bottom tabs
  - Responsive panels
- **Search UI**
- **Redaction list sidebar**
- **Comment modal**
- **Settings view**
- **Local AI hooks (tesseract.js, regex PII detection)**

### 2.3 Stirling‑PDF (UX benchmark)

**Repo:** `https://github.com/Stirling-Tools/Stirling-PDF`

We copy UX patterns:

- Text redaction behavior
- Search + highlight behavior
- Tabbed responsive layout
- Keyboard shortcuts
- Tooltips
- Alerts/toasts
- Dark/light theme handling

---

## 3. Phase 1 – Baseline integration

Goal: **One app** that uses Redectio‑Tool backend + Redection‑Studio frontend with Stirling‑style UX.

### 3.1 Backend consolidation

- [ ] Create `backend/` folder (or reuse existing from Redectio‑Tool).
- [ ] Ensure FastAPI app exposes:
  - [ ] `/api/coa/detect-company`
  - [ ] `/api/coa/auto-suggest`
  - [ ] `/api/redact/manual`
  - [ ] `/api/redact/apply` (final PDF)
  - [ ] `/api/ocr`
- [ ] Wire existing modules:
  - [ ] `TextFinder`
  - [ ] `OCR engine`
  - [ ] `CompanyDetector`
  - [ ] `Rule merge engine`
  - [ ] `Suggestions engine`
  - [ ] `AutoRedactionEngine`
  - [ ] `ManualRedactionEngine`

### 3.2 Frontend consolidation

- [ ] Use **Redection‑Studio** as the base `frontend/` app.
- [ ] Replace any mock/local redaction logic with real API calls:
  - [ ] Upload → `/api/coa/detect-company`
  - [ ] Auto‑suggest → `/api/coa/auto-suggest`
  - [ ] Manual redaction → `/api/redact/manual`
  - [ ] Apply redaction → `/api/redact/apply`
- [ ] Keep:
  - [ ] Left tools (desktop)
  - [ ] Right sidebar (redaction list)
  - [ ] Mobile bottom tabs

### 3.3 Minimal working feature set

- [ ] User uploads a COA PDF.
- [ ] Backend detects company.
- [ ] Backend returns auto‑suggested redaction boxes for:
  - Barcode / QR
  - REPORT NO. value
  - ACCOUNT NUMBER value
  - Client name
  - Client address
  - Phone
  - PO#
  - LAB NUMBER
  - SAMPLE ID
- [ ] Frontend shows red boxes as preview.
- [ ] User can:
  - [ ] Select/deselect boxes.
  - [ ] Apply redaction.
- [ ] Output saved as `<original>_Redacted.pdf` in same folder.

---

## 4. Phase 2 – UX parity with Stirling‑PDF

Goal: **Make it feel as good as Stirling‑PDF (or better).**

### 4.1 Viewer and navigation

- [ ] Page indicator:
  - [ ] Show `currentPage / totalPages`.
  - [ ] Update on scroll, arrow navigation, and direct page jump.
- [ ] Multi‑page behavior:
  - [ ] Continuous scroll.
  - [ ] Zoom does not break overlays.
  - [ ] Resizing keeps overlays aligned.
- [ ] Page jump:
  - [ ] Editable page number.
  - [ ] Enter to jump.

### 4.2 Text redaction behavior

- [ ] Click‑to‑select text like Stirling‑PDF.
- [ ] Multi‑span selection (using TextFinder).
- [ ] Highlight all occurrences of a word.
- [ ] “Redact all matches” action.

### 4.3 Keyboard shortcuts

- [ ] `Ctrl+Z` – Undo last action.
- [ ] `Ctrl+Y` / `Ctrl+Shift+Z` – Redo.
- [ ] `Ctrl+F` – Focus search.
- [ ] `Ctrl+→` / `Ctrl+←` – Next/previous page.
- [ ] `T` – Text redaction tool.
- [ ] `B` – Box redaction tool.
- [ ] `H` – Highlight toggle.
- [ ] Make all shortcuts configurable in Settings.

### 4.4 Alerts and tooltips

- [ ] `alert.css` + JS/TS alert system:
  - [ ] Success / Info / Warning / Error.
  - [ ] Slide/fade in.
  - [ ] Auto‑dismiss + close button.
- [ ] Tooltips:
  - [ ] Shared component.
  - [ ] Delay before showing.
  - [ ] Applied to:
    - [ ] Toolbar buttons.
    - [ ] Sidebar items.
    - [ ] Settings controls.

---

## 5. Phase 3 – Offline AI + training

Goal: **Local AI that learns from user redactions per company.**

### 5.1 Local AI engine

- [ ] Implement `ai/` module (backend or shared):
  - [ ] Local OCR (Tesseract or PyMuPDF text + OCR fallback).
  - [ ] Local PII detection (regex + heuristics).
  - [ ] Local COA field detection (regex + layout).
- [ ] Ensure all AI runs offline.

### 5.2 Training from original + redacted PDFs

- [ ] Add “Training” workflow:
  - [ ] User selects:
    - [ ] Unredacted PDF.
    - [ ] Redacted PDF.
  - [ ] System:
    - [ ] Compares text/coordinates.
    - [ ] Learns which regions were redacted.
    - [ ] Associates them with:
      - [ ] Company.
      - [ ] Field type (if known).
- [ ] Store per‑company:
  - [ ] Learned coordinates.
  - [ ] Learned regex patterns.
  - [ ] Learned layout zones.

### 5.3 Continuous learning from manual edits

- [ ] Every time user:
  - [ ] Adds a redaction.
  - [ ] Removes a suggestion.
  - [ ] Modifies a box.
- [ ] System updates:
  - [ ] Company profile.
  - [ ] Confidence scores.
  - [ ] Future suggestions.

### 5.4 AI sensitivity

- [ ] Add sensitivity slider in Settings:
  - [ ] Controls how aggressive PII/COA detection is.
  - [ ] Affects:
    - [ ] Regex thresholds.
    - [ ] Heuristic scores.

---

## 6. Phase 4 – Batch redaction and PDF unlocking

### 6.1 Batch redaction UI

- [ ] New “Batch Redaction” page.
- [ ] User selects multiple PDFs.
- [ ] For each:
  - [ ] Detect company.
  - [ ] Auto‑suggest redactions.
  - [ ] Option:
    - [ ] Auto‑apply all.
    - [ ] Or require manual review.
- [ ] Save all as `<original>_Redacted.pdf`.

### 6.2 PDF permission bypass (offline)

- [ ] Detect if PDF is editing/printing locked.
- [ ] If locked:
  - [ ] Open pages.
  - [ ] Render each page to image.
  - [ ] Rebuild a new PDF from images.
  - [ ] Use new PDF for redaction.
- [ ] This mimics:
  - [ ] Adobe “export to Word then back to PDF”.
  - [ ] iLovePDF “unlock” behavior.
- [ ] All done locally.

---

## 7. Phase 5 – Settings, themes, and customization

### 7.1 Theme system

- [ ] Light / Dark / System default.
- [ ] Custom theme:
  - [ ] User can:
    - [ ] Pick 2–3 colors or enter hex codes.
    - [ ] Upload custom font(s).
    - [ ] Set PDF canvas background color (viewer only).
  - [ ] System:
    - [ ] Auto‑generates palette.
    - [ ] Auto‑chooses text color (white/black) based on contrast.

### 7.2 Redaction colors

- [ ] Settings:
  - [ ] Default redaction color.
  - [ ] Default highlight color.
- [ ] Color picker UI.
- [ ] Changes apply live.

### 7.3 Company profile

- [ ] Settings → Company Profile:
  - [ ] Company name.
  - [ ] Contact details.
  - [ ] Company identifiers (keywords).
  - [ ] Learned redaction areas (view + manage).

---

## 8. Phase 6 – Mobile UX refinement

Goal: **Google Docs / Google Drive‑like PDF preview on mobile.**

- [ ] Full‑width PDF preview.
- [ ] Smooth scroll.
- [ ] Pinch‑to‑zoom.
- [ ] Page snapping / indicator.
- [ ] Floating tools button:
  - [ ] Opens tools sheet (text, box, highlight, AI).
- [ ] Search:
  - [ ] Top overlay bar.
  - [ ] Suggestions from:
    - [ ] OCR text.
    - [ ] Common PII/COA terms.
    - [ ] User history.

---

## 9. Phase 7 – Polish and industrial readiness

- [ ] Confirmation dialog before applying redactions.
- [ ] Direct redaction from OCR text list (sidebar).
- [ ] Multi‑select redactions:
  - [ ] Drag selection box.
  - [ ] Shift+Click toggle.
- [ ] Freeform highlight tool:
  - [ ] Draw path.
  - [ ] Save as SVG path.
- [ ] Performance tuning:
  - [ ] Raspberry Pi.
  - [ ] Older laptops.
- [ ] Error handling:
  - [ ] Clear messages for:
    - [ ] OCR failure.
    - [ ] Locked PDFs that cannot be opened.
    - [ ] Corrupt files.

---

## 10. Tracking and status

Use this roadmap as a **living document**:

- Add `[x]` when a task is done.
- Add links to:
  - Commits
  - PRs
  - Files (e.g., `backend/redaction/auto_redaction_engine.py`)
- Add new sections for:
  - New COA fields.
  - New companies.
  - New AI models.

---