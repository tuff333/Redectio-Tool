from fastapi import APIRouter, UploadFile, File, Query
from fastapi.responses import JSONResponse

from backend.redaction.text_finder import TextFinder
from backend.suggestions import build_final_rules_for_document, generate_suggestions

router = APIRouter(prefix="/redact", tags=["Auto‑Suggest"])


@router.post("/template")
async def auto_suggest_template(
    file: UploadFile = File(...),
    company_id: str | None = Query(None)
):
    """
    Auto-suggest redactions using:
      - universal rules
      - defaults
      - company-specific rules (if detected or hinted)
    Uses TextFinder spans so we can return real bounding boxes.
    """
    try:
        pdf_bytes = await file.read()

        # ----------------------------------------------------
        # 1) Extract text + spans (with coordinates)
        # ----------------------------------------------------
        finder = TextFinder()
        # We assume TextFinder returns a list of span objects or dicts with:
        #   page (1-based), text, x0, y0, x1, y1  (normalized 0–1)
        spans = finder.find_text_spans(pdf_bytes, use_ocr=False, auto_ocr=True)

        spans_by_page: dict[int, list[dict]] = {}
        for s in spans:
            # Support both object-style and dict-style spans
            page = getattr(s, "page", None)
            if page is None:
                page = s.get("page", 1)

            text = getattr(s, "text", None)
            if text is None:
                text = s.get("text", "")

            x0 = getattr(s, "x0", None)
            if x0 is None:
                x0 = s.get("x0", 0.0)

            y0 = getattr(s, "y0", None)
            if y0 is None:
                y0 = s.get("y0", 0.0)

            x1 = getattr(s, "x1", None)
            if x1 is None:
                x1 = s.get("x1", 1.0)

            y1 = getattr(s, "y1", None)
            if y1 is None:
                y1 = s.get("y1", 1.0)

            page = int(page) if page is not None else 1

            spans_by_page.setdefault(page, []).append(
                {
                    "text": text or "",
                    "x0": float(x0),
                    "y0": float(y0),
                    "x1": float(x1),
                    "y1": float(y1),
                }
            )

        # Build per-page full text (for company detection + rules engine)
        pages_text: list[str] = []
        if spans_by_page:
            for page in sorted(spans_by_page.keys()):
                page_text = " ".join(s["text"] for s in spans_by_page[page] if s["text"])
                pages_text.append(page_text)
        else:
            # Fallback: no spans → empty single page
            pages_text = [""]

        full_text = " ".join(pages_text)

        # ----------------------------------------------------
        # 2) Build merged rules (universal + defaults + company)
        # ----------------------------------------------------
        final_rules = build_final_rules_for_document(full_text, company_hint=company_id)

        # ----------------------------------------------------
        # 3) Generate suggestions using spans + rules
        # ----------------------------------------------------
        ocr_result = {
            "pages": pages_text,
            "spans_by_page": spans_by_page,
        }

        # pdf_pages is unused in our implementation, keep [] for compatibility
        suggestions = generate_suggestions([], ocr_result, final_rules)

        return JSONResponse({"candidates": suggestions}, status_code=200)

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
