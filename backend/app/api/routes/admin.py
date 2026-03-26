from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.auth import get_current_user, require_role
from app.db.engine import get_db
from app.db.models import Alert, Appointment, Message
from app.db.models import Session as DBSession
from app.db.models import User

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Stats ──────────────────────────────────────────────────────

@router.get("/stats")
async def get_stats(
    _: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    total_users      = (await db.execute(select(func.count()).where(User.role == "user"))).scalar() or 0
    total_therapists = (await db.execute(select(func.count()).where(User.role == "therapist"))).scalar() or 0
    total_sessions   = (await db.execute(select(func.count(DBSession.id)))).scalar() or 0
    unacked_alerts   = (await db.execute(select(func.count()).where(Alert.is_acknowledged == False))).scalar() or 0
    pending_appts    = (await db.execute(select(func.count()).where(Appointment.status == "pending"))).scalar() or 0
    high_risk        = (await db.execute(
        select(func.count()).select_from(DBSession)
        .where(DBSession.risk_label.in_(["Anxiety", "Depression"]))
    )).scalar() or 0

    return {
        "total_users":           total_users,
        "total_therapists":      total_therapists,
        "total_sessions":        total_sessions,
        "unacknowledged_alerts": unacked_alerts,
        "pending_appointments":  pending_appts,
        "high_risk_sessions":    high_risk,
    }


# ── Users ──────────────────────────────────────────────────────

@router.get("/users")
async def list_users(
    _: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users  = result.scalars().all()
    return [
        {
            "id":         u.id,
            "email":      u.email,
            "full_name":  u.full_name,
            "role":       u.role,
            "is_active":  u.is_active,
            "created_at": u.created_at.isoformat(),
            "last_login": u.last_login.isoformat() if u.last_login else None,
        }
        for u in users
    ]


class RoleUpdate(BaseModel):
    role: str


@router.patch("/users/{user_id}/role")
async def update_role(
    user_id: str,
    body: RoleUpdate,
    _: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    if body.role not in ("user", "therapist", "admin"):
        raise HTTPException(status_code=400, detail="Invalid role")
    result = await db.execute(select(User).where(User.id == user_id))
    user   = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = body.role
    await db.commit()
    return {"status": "updated", "role": body.role}


@router.patch("/users/{user_id}/toggle")
async def toggle_active(
    user_id: str,
    _: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user   = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = not user.is_active
    await db.commit()
    return {"is_active": user.is_active}


# ── Alerts ─────────────────────────────────────────────────────

@router.get("/alerts")
async def list_alerts(
    current_user: User = Depends(require_role("admin", "therapist")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Alert).order_by(Alert.created_at.desc()).limit(50)
    )
    alerts = result.scalars().all()
    out = []
    for a in alerts:
        u = (await db.execute(select(User).where(User.id == a.user_id))).scalar_one_or_none()
        out.append({
            "id":              a.id,
            "user":            {"id": u.id, "name": u.full_name, "email": u.email} if u else None,
            "level":           a.level,
            "message":         a.message,
            "is_acknowledged": a.is_acknowledged,
            "created_at":      a.created_at.isoformat(),
        })
    return out


@router.patch("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: str,
    current_user: User = Depends(require_role("admin", "therapist")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert  = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_acknowledged = True
    alert.acknowledged_by = current_user.id
    await db.commit()
    return {"status": "acknowledged"}


# ── Patients (for therapist view) ──────────────────────────────

@router.get("/patients")
async def get_patients(
    _: User = Depends(require_role("admin", "therapist")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.role == "user", User.is_active == True)
    )
    users = result.scalars().all()
    out: list[dict] = []
    for u in users:
        latest = (await db.execute(
            select(DBSession)
            .where(DBSession.user_id == u.id)
            .order_by(DBSession.created_at.desc())
            .limit(1)
        )).scalar_one_or_none()

        msg_count = (await db.execute(
            select(func.count(Message.id))
            .join(DBSession, Message.session_id == DBSession.id)
            .where(DBSession.user_id == u.id)
        )).scalar() or 0

        out.append({
            "id":         u.id,
            "full_name":  u.full_name,
            "email":      u.email,
            "created_at": u.created_at.isoformat(),
            "last_login": u.last_login.isoformat() if u.last_login else None,
            "risk_label": latest.risk_label if latest else "Neutral",
            "escalation": latest.escalation_level if latest else "Low",
            "msg_count":  msg_count,
            # Intake info for doctor
            "intake_completed":       u.intake_completed,
            "intake_primary_concerns":u.intake_primary_concerns or [],
            "intake_share_with_doctor": u.intake_share_with_doctor,
            "intake_share_sessions":    u.intake_share_sessions,
            "intake_share_risk_scores": u.intake_share_risk_scores,
            "intake_describe_situation": u.intake_describe_situation if u.intake_share_with_doctor else None,
        })
    return out