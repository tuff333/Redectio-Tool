from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, UploadFile
from pydantic import BaseModel

from backend.ai.local_learner import update_learned_rules
from backend.ai.train_from_pair import train_from_pair


router = APIRouter(prefix="/api/ai", tags=["AI-Training"])


class TrainingItem(BaseModel):
    label: str
    group: Optional[str] = None
    sample_text: str
    rects: List[Dict[str, Any]] = []
    page: int = 1


class LearnRequest(BaseModel):
    company_id: str
    display_name: Optional[str] = None
    items: List[TrainingItem]


@router.post("/learn")
def learn(request: LearnRequest):
    if not request.company_id:
        return {"error": "Missing company_id"}

    events = [item.dict() for item in request.items or []]
    if not events:
        return {"status": "skipped", "reason": "no training items"}

    display_name = request.display_name or request.company_id
    updated = update_learned_rules(
        company_id=request.company_id,
        display_name=display_name,
        events=events,
    )

    return {
        "status": "ok",
        "company_id": request.company_id,
        "regex_count": len(updated.get("regex", []) or []),
        "learned_version": updated.get("version", 1),
    }


class TrainPairResponse(BaseModel):
    status: str


@router.post("/train-pair")
async def train_pair(
    unredacted: UploadFile = File(...),
    redacted: UploadFile = File(...),
    company_id: Optional[str] = None,
):
    unredacted_bytes = await unredacted.read()
    redacted_bytes = await redacted.read()

    result = train_from_pair(
        unredacted_pdf_bytes=unredacted_bytes,
        redacted_pdf_bytes=redacted_bytes,
        company_hint=company_id,
    )

    return result

