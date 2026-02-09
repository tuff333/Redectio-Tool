# 🚧 Frontend Audit — Redectio Tool  
Comprehensive issue report for all frontend components  
_Last updated: Feb 2026_

This document lists **every frontend file**, its **status**, **issues**, **required fixes**, and **severity**.  
Use this as the master reference for stabilizing the frontend.
---
# 🔥 CRITICAL / BROKEN COMPONENTS  
These must be fixed first. They directly break core functionality.

| Component | Status | Issues Found | Fix Required | Severity |
|----------|--------|--------------|--------------|----------|
| **Events.js** | ❌ Broken | Wrong handler signatures, duplicate listeners, attach functions called incorrectly, auto-redaction handlers not registered via cleanup system | Rewrite `attachHandlersToAllPages()`, remove duplicate `initFileIO()`, fix handler wiring | **Critical** |
| **TextLayer.js** | ❌ Broken | Wrong Y-transform, wrong normalized coords, missing pdf-init import, spans misaligned at zoom | Fix transform math, import pdf-init, correct normalization | **Critical** |
| **Redaction_Auto.js** | ❌ Broken | Frontend fallback uses wrong textStore structure, regex `.test()` bug, endpoint concatenation risk, handlers not using cleanup registry | Fix fallback to use `spans`, fix regex, fix endpoint, rewire handlers | **High** |
| **PDF_Loader.js** | ❌ Broken | WorkerSrc conflict, missing pdf-init import, textStore not cleared, annotation engine conflicts with other overlays | Remove workerSrc, import pdf-init, clear textStore, unify overlay drawing | **High** |

---

# ⚠️ MAJOR WARNINGS (Functional but unstable)

| Component | Status | Issues Found | Fix Required | Severity |
|----------|--------|--------------|--------------|----------|
| **Redaction_TextSelect.js** | ⚠ Warning | Uses DOM spans instead of textStore → inaccurate at zoom | Rewrite to use `textStore.spans` | High |
| **Redaction_Box.js** | ⚠ Warning | Normalization depends on overlay = viewport; misalignment possible | Verify scaling in PDF_Loader | Medium–High |
| **Review_Mode.js** | ⚠ Warning | Clearing manual redactions wipes search + auto overlays | Redraw in correct order instead of clearing | Medium–High |
| **Search.js** | ⚠ Warning | Missing null checks, scroll misalignment at zoom | Add guards + use viewport.height | Medium–High |
| **Template_UI.js** | ⚠ Warning | Missing null checks for rules/zones, unsafe assumptions | Add defaults + guards | Medium |

---

# ⚠️ MODERATE WARNINGS (Works but fragile)

| Component | Status | Issues Found | Fix Required | Severity |
|----------|--------|--------------|--------------|----------|
| **FileIO.js** | ⚠ Warning | textStore not reset, highlightMode reset to false, flattenRedactionsMap unsafe | Reset textStore, set highlightMode(true), validate rects | Medium |
| **AnnotationEngine.js** | ⚠ Warning | Conflicts with Redaction_Core + Search + Auto overlays | Choose single overlay system | Medium |
| **Coordinates.js** | ⚠ Warning | Assumes viewport.scale always correct | Validate against PDF_Loader | Medium |
| **DrawingTools.js** | ⚠ Warning | Tools defined but not integrated with UI | Integrate or remove | Low |

---

# ✔️ OK / SAFE COMPONENTS  
These files are stable and require no changes (except minor notes).

| Component | Status | Issues Found | Fix Required | Severity |
|----------|--------|--------------|--------------|----------|
| **styles.css** | ✔ OK (minor) | `.text-layer { display:none }` breaks selection | Change to `opacity:0` | Low |
| **app.js** | ✔ OK | No issues | None | Low |
| **pdfjs/pdf-init.js** | ✔ OK (minor) | Worker path must match PDF_Loader | Ensure consistent path | Low |
| **pdfjs/pdf.mjs / pdf.worker.mjs** | ✔ OK | Correct files | None | Low |
| **Utils.js** | ✔ OK | Solid global state | None | Low |
| **Search UI elements** | ✔ OK | No issues | None | Low |
| **Template list UI** | ✔ OK | No issues | None | Low |

---

# 🧭 Recommended Fix Order (Roadmap)

1. **Fix Events.js**  
2. **Fix TextLayer.js**  
3. **Fix PDF_Loader.js**  
4. **Fix Redaction_Auto.js**  
5. **Fix Redaction_TextSelect.js**  
6. **Fix Search.js + Review_Mode.js**  
7. **Fix FileIO.js resets**  
8. **Fix Template_UI.js guards**  
9. **Decide on overlay system (AnnotationEngine vs Redaction_Core)**  
10. **Optional: integrate DrawingTools**

---

# 🧩 Notes

- Many issues stem from **event handler duplication** and **overlay drawing conflicts**.  
- Fixing **TextLayer.js** will automatically fix:  
  - Search alignment  
  - Auto-redaction alignment  
  - Text selection accuracy  
  - Redaction box alignment  
- Fixing **Events.js** will eliminate:  
  - Double redactions  
  - Double auto-redaction toggles  
  - Ghost listeners  
  - Broken text selection  

---

# ✔ After Frontend Fixes  
We will run a **backend audit** (same format) once you share all backend files.


