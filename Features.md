# Feature Comparison – Redectio‑Tool vs Redection‑Studio vs Stirling‑PDF

This document compares all three systems at the **smallest feature level**, focusing on:

- Redaction capabilities  
- OCR  
- UI/UX  
- Search  
- Batch processing  
- AI/learning  
- Responsiveness  
- PDF handling  
- Settings & customization  

This comparison is used to build the unified **Redactio COA Suite**.

---

# 1. High‑Level Summary

| Category | Redectio‑Tool | Redection‑Studio | Stirling‑PDF |
|---------|----------------|------------------|--------------|
| Backend | ⭐⭐⭐⭐⭐ | ❌ | ❌ |
| Frontend UI | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Redaction UX | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| OCR | ⭐⭐⭐⭐⭐ | ⭐⭐ (tesseract.js) | ⭐⭐⭐⭐ |
| AI/ML | ⭐⭐⭐ (rules) | ⭐⭐ (local regex) | ❌ |
| Batch | ⭐⭐⭐⭐ | ❌ | ❌ |
| COA‑specific | ⭐⭐⭐⭐⭐ | ❌ | ❌ |
| Mobile UX | ⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |

---

# 2. Smallest‑Unit Feature Comparison

## 2.1 Redaction Features

| Feature | Redectio‑Tool | Redection‑Studio | Stirling‑PDF |
|--------|----------------|------------------|--------------|
| Text redaction | ✔ Backend | ✔ UI | ✔ Best UX |
| Box redaction | ✔ | ✔ | ✔ |
| Polygon redaction | ✔ | ❌ | ❌ |
| Freeform highlight | ✔ | ❌ | ✔ |
| Multi‑select redactions | ❌ | ❌ | ✔ |
| Drag to move redactions | ❌ | ✔ | ✔ |
| Resize redactions | ❌ | ✔ | ✔ |
| Redaction list sidebar | ✔ | ✔ | ✔ |
| Undo/Redo | ❌ | ✔ | ✔ |
| Redact all matches | ✔ | ❌ | ✔ |
| Preview before apply | ✔ | ✔ | ✔ |

---

## 2.2 OCR & Text Extraction

| Feature | Redectio‑Tool | Redection‑Studio | Stirling‑PDF |
|--------|----------------|------------------|--------------|
| Digital text extraction | ✔ PyMuPDF | ✔ PDF.js | ✔ |
| OCR fallback | ✔ Tesseract | ✔ tesseract.js | ✔ |
| Multi‑span text detection | ✔ | ❌ | ❌ |
| OCR‑aware search | ✔ | ❌ | ✔ |
| OCR‑aware auto‑suggest | ✔ | ❌ | ❌ |

---

## 2.3 COA‑Specific Detection

| Field | Redectio‑Tool | Redection‑Studio | Stirling‑PDF |
|-------|----------------|------------------|--------------|
| Company detection | ✔ | ❌ | ❌ |
| REPORT NO. | ✔ | ❌ | ❌ |
| ACCOUNT NUMBER | ✔ | ❌ | ❌ |
| Client Name | ✔ | ❌ | ❌ |
| Client Address | ✔ | ❌ | ❌ |
| Phone | ✔ | ❌ | ❌ |
| PO# | ✔ | ❌ | ❌ |
| LAB NUMBER | ✔ | ❌ | ❌ |
| SAMPLE ID | ✔ | ❌ | ❌ |
| Barcode detection | ✔ | ❌ | ✔ |
| QR detection | ✔ | ❌ | ✔ |

---

## 2.4 Search Features

| Feature | Redectio‑Tool | Redection‑Studio | Stirling‑PDF |
|--------|----------------|------------------|--------------|
| Search text | ✔ | ✔ | ✔ |
| Search suggestions | ✔ | ✔ (basic) | ✔ |
| Highlight matches | ✔ | ✔ | ✔ |
| Redact matches | ✔ | ❌ | ✔ |
| OCR‑aware search | ✔ | ❌ | ✔ |

---

## 2.5 Batch Processing

| Feature | Redectio‑Tool | Redection‑Studio | Stirling‑PDF |
|--------|----------------|------------------|--------------|
| Batch redaction | ✔ CLI | ❌ | ❌ |
| Batch auto‑suggest | ✔ | ❌ | ❌ |
| Batch output naming | ✔ | ❌ | ❌ |

---

## 2.6 PDF Handling

| Feature | Redectio‑Tool | Redection‑Studio | Stirling‑PDF |
|--------|----------------|------------------|--------------|
| PDF unlock | ❌ | ❌ | ✔ |
| PDF rebuild (image‑based) | ❌ | ❌ | ✔ |
| Save `_Redacted.pdf` | ✔ | ✔ | ✔ |
| Metadata scrub | ✔ | ❌ | ✔ |

---

## 2.7 UI/UX Features

| Feature | Redectio‑Tool | Redection‑Studio | Stirling‑PDF |
|--------|----------------|------------------|--------------|
| Desktop layout | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Mobile layout | ⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Continuous scroll | ✔ | ✔ | ✔ |
| Smooth zoom | ✔ | ✔ | ✔ |
| Page indicator | ❌ | ✔ | ✔ |
| Page jump | ❌ | ✔ | ✔ |
| Tooltips | ❌ | ✔ | ✔ |
| Alerts | ❌ | ✔ | ✔ |
| Keyboard shortcuts | ❌ | ✔ | ✔ |
| Themes | ❌ | ✔ | ✔ |

---

## 2.8 AI & Learning

| Feature | Redectio‑Tool | Redection‑Studio | Stirling‑PDF |
|--------|----------------|------------------|--------------|
| Rule‑based AI | ✔ | ✔ | ❌ |
| ML training from PDFs | ❌ | ✔ (basic) | ❌ |
| Per‑company learning | ❌ | ✔ | ❌ |
| Local AI (offline) | ✔ | ✔ | ✔ |
| Sensitivity control | ❌ | ✔ | ❌ |

---

# 3. What We Take for Redactio COA Suite

## 3.1 From Redectio‑Tool (Backend Brain)

- FastAPI backend  
- TextFinder  
- OCR engine  
- CompanyDetector  
- Rule engine  
- Suggestions engine  
- AutoRedactionEngine  
- ManualRedactionEngine  
- Batch redaction  
- Barcode/QR detection  
- COA field detection  
- Coordinate normalization  

## 3.2 From Redection‑Studio (Frontend Face)

- React/TS UI  
- Desktop Photoshop‑style layout  
- Mobile Google Docs‑style layout  
- Search UI  
- Redaction list sidebar  
- Undo/Redo  
- Alerts  
- Tooltips  
- Settings page  
- Local AI hooks  
- Theme system  

## 3.3 From Stirling‑PDF (UX Benchmark)

- Text redaction behavior  
- Search + highlight behavior  
- Keyboard shortcuts  
- Responsive tab layout  
- PDF unlock behavior  
- Smooth viewer  
- Dark/light theme  

---

# 4. Integration Summary

| Layer | Source |
|-------|--------|
| Backend | Redectio‑Tool |
| Frontend | Redection‑Studio |
| UX patterns | Stirling‑PDF |
| Mobile behavior | Google Docs |
| AI training | Custom (Studio + backend) |
| COA rules | Redectio‑Tool |
| PDF unlock | Stirling‑PDF style |

---

# 5. Roadmap Alignment

This comparison directly supports the roadmap:

- **Phase 1** → Backend + frontend merge  
- **Phase 2** → Stirling‑PDF UX parity  
- **Phase 3** → Offline AI + training  
- **Phase 4** → Batch + unlock  
- **Phase 5** → Themes + settings  
- **Phase 6** → Mobile UX  
- **Phase 7** → Industrial polish  

---

# 6. Final Notes

This comparison is a living document.  
As Redactio evolves, update:

- New COA fields  
- New companies  
- New AI models  
- New UX improvements