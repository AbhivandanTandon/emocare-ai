from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.auth import get_current_user, require_role
from app.core.audit import log_event
from app.core.security import decrypt_message
from app.db.engine import get_db
from app.db.models import Message, Session as DBSession, User

router = APIRouter(prefix="/therapist", tags=["therapist"])


@router.get("/sessions")
async def escalated_sessions(
    current_user: User = Depends(require_role("therapist", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """All sessions that are escalated High/Imminent."""
    result = await db.execute(
        select(DBSession)
        .where(DBSession.escalation_level.in_(["High", "Imminent"]))
        .order_by(DBSession.created_at.desc())
        .limit(50)
    )
    sessions = result.scalars().all()
    return [
        {
            "id": s.id,
            "user_id": s.user_id,
            "risk_label": s.risk_label,
            "escalation_level": s.escalation_level,
            "confidence": s.risk_confidence,
            "created_at": s.created_at.isoformat(),
            "assigned_therapist_id": s.assigned_therapist_id,
            "shap": s.shap_json,
            "artifact": s.artifact_json,
        }
        for s in sessions
    ]


@router.get("/session/{session_id}/transcript")
async def get_transcript(
    session_id: str,
    current_user: User = Depends(require_role("therapist", "admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(DBSession).where(DBSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404)

    # Check consent
    user_result = await db.execute(select(User).where(User.id == session.user_id))
    patient = user_result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404)
    if not patient.consent_therapist and session.escalation_level not in ("High", "Imminent"):
        raise HTTPException(status_code=403, detail="Patient has not consented to therapist access.")

    msgs_result = await db.execute(
        select(Message).where(Message.session_id == session_id).order_by(Message.created_at)
    )
    messages = msgs_result.scalars().all()

    log_event("THERAPIST_TRANSCRIPT_VIEW", current_user.id, "therapist", target_id=session_id)

    return {
        "session_id": session_id,
        "patient_id": session.user_id,
        "escalation_level": session.escalation_level,
        "shap": session.shap_json,
        "artifact": session.artifact_json,
        "messages": [
            {
                "role": m.role,
                "content": decrypt_message(m.encrypted_content, session.user_id),
                "created_at": m.created_at.isoformat(),
                "prediction": m.prediction_json,
            }
            for m in messages
        ],
    }


@router.post("/session/{session_id}/assign")
async def assign_session(
    session_id: str,
    current_user: User = Depends(require_role("therapist", "admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(DBSession).where(DBSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404)

    session.assigned_therapist_id = current_user.id
    session.is_escalated = True
    await db.commit()
    log_event("SESSION_ASSIGNED", current_user.id, "therapist", target_id=session_id)
    return {"status": "assigned"}