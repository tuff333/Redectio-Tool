Redact‑Tool‑K2 — Backend Architecture & Feature Overview
This document provides a complete, structured overview of the entire backend of Redact‑Tool‑K2, based on all backend files you shared.
It covers:

System architecture

PDF/OCR/text extraction

Rule engine

Template system

Auto‑redaction

Manual redaction

Suggestions engine

Company detection

API server

CLI tools

Legacy compatibility

This is the canonical reference for backend developers.

1. Backend Overview
The backend is a FastAPI‑based PDF redaction engine with:

Modern rule‑driven auto‑redaction

Legacy template‑driven auto‑redaction

Manual redaction engine

OCR fallback

Company detection

Batch and single‑file CLI tools

Unified suggestion engine

Barcode/QR detection

Full coordinate normalization (PDF → normalized → PDF)

The backend is designed to support:

COA redaction

Lab‑specific rule sets

Scanned and digital PDFs

High‑volume batch processing

Frontend auto‑suggest UI

2. Core Backend Components
backend/
│ api_server.py
│ main.py
│ company_detector.py
│ ocr_engine.py
│ pdf_engine.py
│ pdf_text_extractor.py
│ rules_engine.py (legacy)
│ suggestions.py
│ template_loader.py
│ template_compiler.py
│
├── api/
│   ├── auto_suggest.py
│   ├── company_detection.py
│   ├── ocr.py
│   ├── redact.py
│   ├── stirling_compatible.py
│   └── routes/
│       ├── redaction_barcodes.py
│
├── redaction/
│   ├── text_finder.py
│   ├── auto_redaction_engine.py
│   ├── manual_redaction_engine.py
│   ├── redaction_engine.py
│   ├── auto_detector.py (legacy)
│
└── rules/
    ├── merge_engine.py
    ├── merge_utils.py
    ├── types.py
    ├── build_rule_set.py
    ├── build_rule_set_for_document.py
3. PDF Processing Layer
3.1 TextFinder (Digital + OCR‑Aware Text Extraction)
File: backend/redaction/text_finder.py

Extracts text spans from PDFs using PyMuPDF

Falls back to OCR when needed

Normalizes coordinates to 0–1

Applies Y‑axis inversion

Groups spans into lines and blocks

Supports multi‑span regex matching

Used by:

Auto‑suggest API

Suggestions engine

CompanyDetector

AutoRedactionEngine

Output:  
TextSpan(page, text, x0, y0, x1, y1)

3.2 OCR Engine (Tesseract + Preprocessing)
File: backend/ocr_engine.py

Rasterizes PDF pages

Preprocesses images (denoise, autocontrast)

Runs Tesseract OCR

Converts pixel coords → PDF coords

Normalizes to 0–1

Caches results for performance

Used by:

TextFinder (fallback)

/api/ocr endpoint

3.3 PDF Engine (Legacy Filename Builder)
File: backend/pdf_engine.py

Generates safe filenames for legacy redaction endpoints

3.4 Legacy PDF Text Extractor
File: backend/pdf_text_extractor.py

Stub extractor for legacy endpoints

Always returns empty string

Prevents crashes in old code paths

4. Rule Engine (Modern System)
4.1 Types & Data Model
File: backend/rules/types.py

Defines typed structures for:

TextRule

LayoutRule

BarcodeZone

MergedRuleSet

Universal/default/company rule schemas

This ensures consistency across:

Rule merging

Suggestions engine

Auto‑redaction

Frontend UI

4.2 Rule Normalization & Merge Utilities
File: backend/rules/merge_utils.py

Provides:

merge_by_id() — last‑wins merging

concat_unique_strings() — anchor merging

Normalizers for:

Default regex rules

Company regex rules

Default layout rules

Company layout rules

Barcode/QR zones

4.3 Rule Merge Engine
File: backend/rules/merge_engine.py

This is the core rule engine.

Responsibilities:
Detect company from text

Load universal rules

Load default rules

Load company rules

Normalize all rule types

Merge into a final MergedRuleSet

Output includes:
Company metadata

Text rules

Anchors

Layout zones

Barcode/QR config

Barcode/QR zones

Used by:

Auto‑suggest API

Suggestions engine

Future unified auto‑redaction

4.4 Rule Builder CLI
Files:

build_rule_set.py

build_rule_set_for_document.py

Allows generating merged rule sets from text files.

5. Template System (Legacy)
5.1 Template Loader
File: backend/template_loader.py

Loads templates from: config/rules/company_rules/*.json
Normalizes:

Keywords

Aliases

Regex rules

Zones

Manual presets

Used by:

CompanyDetector

AutoRedactionEngine

CLI tools

5.2 Template Compiler
File: backend/template_compiler.py

Compiles templates into:

Regex rules

Zone rules

Manual presets

Used by:

AutoRedactionEngine

CLI batch redaction

CLI single redaction

6. Auto‑Redaction Layer
6.1 AutoRedactionEngine
File: backend/redaction/auto_redaction_engine.py

Modern auto‑redaction engine.

Features:
Uses TextFinder spans

Groups spans into blocks

Applies compiled regex rules

Applies zone rules

Deduplicates overlapping boxes

Produces AutoRedactionCandidate objects

Used by:

/api/redact/auto-suggest

CLI tools

6.2 Legacy Auto Detector
File: backend/redaction/auto_detector.py

Deprecated.
Kept only for backward compatibility.

7. Manual Redaction Layer
7.1 ManualRedactionEngine
File: backend/redaction/manual_redaction_engine.py

Full‑featured manual redaction engine.

Supports:

Box redactions

Text redactions

Polygon redactions

Ink strokes

Blur/pixelate

Highlight

Remove mode

Full‑page blackout

Metadata scrubbing

Used by:

/api/redact/manual

/stirling/api/v1/redact

CLI tools

7.2 RedactionEngine (Template/Text‑Based)
File: backend/redaction/redaction_engine.py

Simpler engine used by legacy template workflows.

8. Suggestions Engine
8.1 Suggestions Engine
File: backend/suggestions.py

Generates frontend‑ready suggestions:

Regex‑based text suggestions

Layout zone suggestions

Input:

OCR text

Spans by page

Merged rules

Output: {
  "type": "text" | "layout_zone",
  "page": 1,
  "rects": [...],
  "rule_id": "...",
  "label": "...",
  "reason": "..."
}
{
  "type": "text" | "layout_zone",
  "page": 1,
  "rects": [...],
  "rule_id": "...",
  "label": "...",
  "reason": "..."
}
14. Full Backend Pipeline (High‑Level)
PDF → TextFinder → (OCR fallback) → spans
     → Company Detection
     → Rule Engine (universal + defaults + company)
     → Suggestions Engine → frontend auto‑suggest

PDF → AutoRedactionEngine → auto candidates
PDF → ManualRedactionEngine → final redacted PDF
15. Summary
The backend of Redact‑Tool‑K2 is a modular, company‑aware, rule‑driven PDF redaction engine with:

Modern rule engine

OCR‑aware text extraction

Auto‑redaction

Manual redaction

Suggestions engine

Template compatibility

Company detection

API + CLI interfaces

Full coordinate normalization

Legacy support

It is designed for accuracy, scalability, and maintainability, supporting both modern and legacy workflows.