from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.api.routes.auth import get_current_user
from app.db.engine import get_db
from app.db.models import User

router = APIRouter(prefix="/users", tags=["users"])


class IntakeFormIn(BaseModel):
    age: Optional[str] = None
    gender: Optional[str] = None
    occupation: Optional[str] = None
    emergency_contact: Optional[str] = None
    primary_concerns: List[str] = []
    describe_situation: Optional[str] = None
    history_items: List[str] = []
    previous_therapy: Optional[str] = None
    share_with_doctor: bool = True
    share_sessions: bool = True
    share_audio: bool = False
    share_risk_scores: bool = True
    consent_research: bool = False
    consent_treatment: bool = False
    consent_data: bool = False
    additional_notes: Optional[str] = None


@router.post("/intake")
async def submit_intake(
    body: IntakeFormIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_user.intake_age                = body.age  # type: ignore
    current_user.intake_gender             = body.gender  # type: ignore
    current_user.intake_occupation         = body.occupation  # type: ignore
    current_user.intake_emergency_contact  = body.emergency_contact  # type: ignore
    current_user.intake_primary_concerns   = body.primary_concerns  # type: ignore
    current_user.intake_describe_situation = body.describe_situation  # type: ignore
    current_user.intake_history_items      = body.history_items  # type: ignore
    current_user.intake_previous_therapy   = body.previous_therapy  # type: ignore
    current_user.intake_share_with_doctor  = body.share_with_doctor  # type: ignore
    current_user.intake_share_sessions     = body.share_sessions  # type: ignore
    current_user.intake_share_audio        = body.share_audio  # type: ignore
    current_user.intake_share_risk_scores  = body.share_risk_scores  # type: ignore
    current_user.intake_consent_research   = body.consent_research  # type: ignore
    current_user.intake_additional_notes   = body.additional_notes  # type: ignore
    current_user.intake_completed          = True
    # Update consent fields
    current_user.consent_model             = body.consent_treatment
    current_user.consent_therapist         = body.share_with_doctor
    await db.commit()
    return {"status": "submitted"}


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id":               current_user.id,
        "email":            current_user.email,
        "full_name":        current_user.full_name,
        "role":             current_user.role,
        "intake_completed": current_user.intake_completed,
    }