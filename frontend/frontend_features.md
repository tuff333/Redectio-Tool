Redact‑Tool‑K2 — Frontend Architecture & Feature Overview
The frontend of Redact‑Tool‑K2 is a full PDF redaction workstation, built entirely in vanilla JavaScript, PDF.js, and modular UI components.
It provides:

High‑fidelity PDF rendering

Manual redaction (box + text selection + annotation)

Auto‑redaction (backend + frontend patterns)

Template‑driven auto‑suggest

Company detection UI

OCR fallback

Search + highlight

Undo/redo

Review mode

Redaction map import/export

Zoom + pan

Sidebar template editor

Fully reactive overlay pipeline

This document is the canonical reference for frontend developers.

1. Frontend Overview
frontend/
│ index.html
│ app.js
│ run_app.cmd
│
├── app/
│   Utils.js
│   Events.js
│   FileIO.js
│   PDF_Loader.js
│   TextLayer.js
│   text_layer_builder.js
│   Search.js
│   search_suggestions.js
│   Redaction_Core.js
│   Redaction_Box.js
│   Redaction_TextSelect.js
│   Redaction_Auto.js
│   AnnotationEngine.js
│   Coordinates.js
│   DrawingTools.js
│   Review_Mode.js
│   Template_UI.js
│   Template_List.js
│   Template_Detect_Backend.js
│   OCR_Fallback.js
│   tabs.js
│   suggestions.js
│
├── css/
│   style.css
│   parts/*.css
│
└── pdfjs/
    pdf-init.js
    pdf.mjs
    pdf.worker.mjs
The frontend is a modular engine, not a simple viewer.
Each module handles a specific subsystem.

2. Core Rendering Pipeline
2.1 PDF.js Initialization
File: pdfjs/pdf-init.js

Loads local PDF.js build (pdf.mjs, pdf.worker.mjs)

Sets worker path

Exposes window.pdfjsLib

2.2 PDF Loader
File: app/PDF_Loader.js

This is the heart of the rendering system.

Responsibilities:
Load PDF bytes into PDF.js

Create page views (canvas + text layer + overlay)

Render pages at current zoom

Build text layer

Draw redactions, search highlights, auto‑suggest previews

Dispatch pages-rendered event

Trigger OCR fallback if needed

Page View Structure:
Each page has:

canvas — PDF bitmap

textLayerDiv — invisible text spans for search + text selection

overlay — redaction + highlight + annotation drawing

wrapper — container with correct dimensions

viewport — PDF.js viewport with scale

Key APIs:
loadPDF(pdfBytes)

renderPageView(view)

renderAllPages()

2.3 Text Layer Engine
File: app/TextLayer.js

Builds a custom text layer compatible with:

Multi‑span search

Text‑selection redaction

OCR fallback

Auto‑suggest patterns

Features:
Extracts text via PDF.js getTextContent()

Computes absolute + normalized coordinates

Builds:

fullText

charMap (per‑character bounding boxes)

spans (per‑span bounding boxes)

Output stored in: textStore[pageNumber] = {
  fullText,
  charMap,
  spans
}
2.4 OCR Fallback
File: app/OCR_Fallback.js

Triggered when:

PDF.js text layer contains no meaningful text

Behavior:
Sends PDF to backend /api/ocr

Receives OCR words with normalized coordinates

Populates textStore

Re-renders pages

3. Redaction Engine (Frontend)
The frontend supports three redaction modes:

Box redaction (Adobe-style)

Text-selection redaction

Annotation redaction (ink, highlight, polygon)

All redactions are stored in: redactions = {
  1: [ { type, rects, color }, ... ],
  2: [ ... ],
  ...
}
Undo/redo is supported.

3.1 Core Redaction Engine
File: app/Redaction_Core.js

Responsibilities:
Maintain redaction map

Undo/redo stacks

Draw redactions on overlay

Restore state safely

Key APIs:
pushUndo()

restoreState(fromStack, toStack)

drawRedactionsOnView(view)

3.2 Box Redaction Engine
File: app/Redaction_Box.js

Implements Adobe-style draggable + resizable boxes.

Features:
Draw new box

Move existing box

Resize via 8 handles

Shift‑drag for perfect squares

Hit‑testing for handles + body

Normalized coordinate conversion

Undo/redo integration

UI:
Yellow fill

Blue outline

White resize handles

3.3 Text Selection Redaction
File: app/Redaction_TextSelect.js

Features:
Drag to select text region

Uses charMap to find intersecting characters

Groups characters into rows

Produces multiple rects per selection

Adds redaction entries

Undo/redo integration

3.4 Annotation Redaction
File: app/AnnotationEngine.js

Supports:

Ink

Highlight

Polygon

Behavior:
Captures strokes

Converts to normalized rect

Saves as redaction entry

Does NOT draw on overlay (unified pipeline handles drawing)

4. Auto‑Redaction Engine
4.1 AutoRedactionEngine (Frontend + Backend)
File: app/Redaction_Auto.js

Two modes:
A. Backend auto‑redaction
Uses:

/redact/template

/api/redact/auto-suggest

/api/redact/auto-suggest-ocr

B. Frontend fallback patterns:
Dates

Percentages

Batch IDs

SSNs

Features:
Hover highlight

Click to toggle selection

Apply selected suggestions

Clear suggestions

Draw preview on overlay

5. Search System
5.1 Multi‑Span Search
File: app/Search.js

Features:
Full regex support (/pattern/)

Multi‑span matching using fullText + charMap

Normalized bounding boxes

Highlight on overlay

Scroll to match

Search navigation (prev/next)

Redact all matches

5.2 Search Suggestions
File: app/search_suggestions.js

Features:
Builds word index after pages-rendered

Suggests words as user types

Click suggestion → run search

6. Review Mode
File: app/Review_Mode.js

Features:
Dim entire page

Optionally dim manual redactions only

Highlight auto‑redactions

Integrated into overlay pipeline

7. Template System
7.1 Template Loader UI
File: app/Template_UI.js

Features:
Load template from backend

Render sidebar:

Rule toggles

Zone preview buttons

Apply manual presets (color, mode)

Preview zones on overlay

7.2 Template List
File: app/Template_List.js

Fetches /api/templates

Populates company dropdown

On change:

Load template

Run auto‑suggest

7.3 Backend Company Detection
File: app/Template_Detect_Backend.js

Sends PDF to /company/detect

Updates dropdown + status

Loads template + runs auto‑suggest

8. File IO System
File: app/FileIO.js

Features:
Drag/drop PDF

File picker

Load PDF into viewer

Store original bytes for backend

Export redactions → JSON

Import redactions ← JSON

Apply manual redactions → download redacted PDF

Clear session

9. Event System
File: app/Events.js

This is the central controller of the entire frontend.

Responsibilities:
Register all event listeners

Manage listener cleanup

Initialize:

File IO

Search controls

Auto‑redaction controls

Review mode controls

Undo/redo

Redaction mode switching

Page jump

Attach handlers to each page:

Text selection

Box redaction

Auto‑redaction hover/click

Exports:
initApp() — main entrypoint

addListener() — global listener registry

cleanupListeners()

10. Coordinate & Drawing Utilities
10.1 Coordinate Converter
File: app/Coordinates.js

Converts:

Screen → PDF

PDF → screen

PDF rect → screen rect

Handles viewport scale

10.2 Drawing Tools
File: app/DrawingTools.js

Defines optional annotation tools:

Ink

Highlight

Underline

Polygon

Shapes

Used by AnnotationEngine.

11. Zoom + Pan System
File: app/Zoom_Pan.js

Features:
Zoom in/out

Pan mode (grab)

Scroll tracking → update page indicator

Redraw overlays after zoom

Maintain scroll position

12. UI Structure
12.1 index.html
Defines:

Sidebar (upload, templates, redaction map)

Left panel (search, redaction tools)

Viewer panel (PDF pages)

Top bar

Status text

Buttons for all tools

12.2 CSS Architecture
Located in:
css/style.css
css/parts/*.css
Organized into:
Variables

Layout

Sidebar

Topbar

Viewer

Inputs

Buttons

Alerts

Suggestions

Responsive layout

Dark theme with accent blue.

13. Application Startup
13.1 app.js
Loads PDF.js

Initializes:

initApp()

Search suggestions

Template list

13.2 run_app.cmd
Starts:

Backend (port 8000)

Frontend (port 5500)

Opens browser

14. Full Frontend Pipeline
PDF Upload
    ↓
FileIO loads PDF bytes
    ↓
PDF_Loader renders pages
    ↓
TextLayer builds textStore
    ↓
OCR_Fallback (if needed)
    ↓
Events attach handlers
    ↓
User interacts:
    - Box redaction
    - Text selection
    - Annotation
    - Search + highlight
    - Auto‑suggest
    - Template preview
    - Review mode
    - Undo/redo
    - Zoom/pan
    ↓
Redactions stored in Utils.redactions
    ↓
Manual apply → backend /api/redact/manual
    ↓
Download final redacted PDF
15. Summary
The frontend of Redact‑Tool‑K2 is a full-featured PDF redaction workstation, providing:

High‑fidelity PDF rendering

Manual + auto redaction

Template‑driven suggestions

OCR fallback

Search + highlight

Review mode

Undo/redo

Zoom/pan

Redaction map import/export

Company detection UI

Clean modular architecture

It integrates tightly with the backend rule engine and redaction engines to deliver a complete COA redaction solution.