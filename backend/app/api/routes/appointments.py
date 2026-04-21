import hashlib
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.auth import get_current_user, require_role
from app.core.email import (
    send_appointment_cancelled_email,
    send_appointment_confirmed_email,
    send_appointment_request_email,
    send_new_appointment_notification,
    send_thank_you_email,
)
from app.core.config import settings
from app.db.engine import get_db
from app.db.models import Appointment, User

router = APIRouter(prefix="/appointments", tags=["appointments"])


class AppointmentIn(BaseModel):
    scheduled_at: str
    notes: Optional[str] = ""
    doctor_id: Optional[str] = None


class AppointmentUpdate(BaseModel):
    status: str
    doctor_id: Optional[str] = None
    notes: Optional[str] = None
    cancel_reason: Optional[str] = None


# ── User: request ──────────────────────────────────────────────

@router.post("")
async def request_appointment(
    body: AppointmentIn,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dt = datetime.fromisoformat(body.scheduled_at)
    scheduled_str = dt.strftime("%B %d, %Y at %I:%M %p")

    appt = Appointment(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        therapist_id=body.doctor_id,
        scheduled_at=dt,
        scheduled_display=scheduled_str,
        status="pending",
        notes=body.notes,
    )
    db.add(appt)
    await db.commit()
    await db.refresh(appt)

    doctor_name = "To be assigned"
    dr = None
    if body.doctor_id:
        dr = (await db.execute(select(User).where(User.id == body.doctor_id))).scalar_one_or_none()
        if dr:
            doctor_name = dr.full_name

    background_tasks.add_task(send_appointment_request_email,
        to=current_user.email,
        user_name=current_user.full_name,
        doctor_name=doctor_name,
        scheduled_at=scheduled_str,
        notes=body.notes or "",
    )

    # Notify Admin
    background_tasks.add_task(send_new_appointment_notification,
        to=settings.MAIL_USERNAME,
        role="admin",
        user_name=current_user.full_name,
        doctor_name=doctor_name,
        scheduled_at=scheduled_str,
        notes=body.notes or "",
    )

    # Notify Therapist if selected
    if body.doctor_id and dr:
        background_tasks.add_task(send_new_appointment_notification,
            to=dr.email,
            role="therapist",
            user_name=current_user.full_name,
            doctor_name=doctor_name,
            scheduled_at=scheduled_str,
            notes=body.notes or "",
        )

    return {"id": appt.id, "status": "pending"}


# ── User: own appointments ─────────────────────────────────────

@router.get("/mine")
async def my_appointments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Appointment)
        .where(Appointment.user_id == current_user.id)
        .order_by(Appointment.scheduled_at.desc())
    )
    appts = result.scalars().all()
    out = []
    for a in appts:
        doctor = None
        if a.therapist_id:
            dr = (await db.execute(select(User).where(User.id == a.therapist_id))).scalar_one_or_none()
            if dr:
                doctor = {"id": dr.id, "name": dr.full_name, "email": dr.email}
        out.append({
            "id":           a.id,
            "scheduled_at": a.scheduled_at.isoformat(),
            "status":       a.status,
            "notes":        a.notes,
            "doctor":       doctor,
            "created_at":   a.created_at.isoformat(),
        })
    return out


# ── Admin: all appointments ────────────────────────────────────

@router.get("/all")
async def all_appointments(
    _: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Appointment).order_by(Appointment.scheduled_at.desc())
    )
    appts = result.scalars().all()
    out = []
    for a in appts:
        u = (await db.execute(select(User).where(User.id == a.user_id))).scalar_one_or_none()
        doctor = None
        if a.therapist_id:
            dr = (await db.execute(select(User).where(User.id == a.therapist_id))).scalar_one_or_none()
            if dr:
                doctor = {"id": dr.id, "name": dr.full_name}
        out.append({
            "id":           a.id,
            "user":         {"id": u.id, "name": u.full_name, "email": u.email} if u else None,
            "doctor":       doctor,
            "scheduled_at": a.scheduled_at.isoformat(),
            "status":       a.status,
            "notes":        a.notes,
            "created_at":   a.created_at.isoformat(),
        })
    return out


# ── Doctor: own appointments ───────────────────────────────────

@router.get("/doctor")
async def doctor_appointments(
    current_user: User = Depends(require_role("therapist", "admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Appointment)
        .where(Appointment.therapist_id == current_user.id)
        .order_by(Appointment.scheduled_at)
    )
    appts = result.scalars().all()
    out = []
    for a in appts:
        u = (await db.execute(select(User).where(User.id == a.user_id))).scalar_one_or_none()
        out.append({
            "id":           a.id,
            "user":         {"id": u.id, "name": u.full_name, "email": u.email} if u else None,
            "scheduled_at": a.scheduled_at.isoformat(),
            "status":       a.status,
            "notes":        a.notes,
            "created_at":   a.created_at.isoformat(),
        })
    return out


# ── Admin: update (assign doctor, confirm, cancel) ─────────────

@router.patch("/{appointment_id}")
async def update_appointment(
    appointment_id: str,
    body: AppointmentUpdate,
    background_tasks: BackgroundTasks,
    _: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appt   = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if body.doctor_id:
        appt.therapist_id = body.doctor_id
    if body.notes:
        appt.notes = body.notes
    appt.status = body.status
    await db.commit()
    await db.refresh(appt)

    u  = (await db.execute(select(User).where(User.id == appt.user_id))).scalar_one_or_none()
    doctor_name = "Your assigned doctor"
    dr = None
    if appt.therapist_id:
        dr = (await db.execute(select(User).where(User.id == appt.therapist_id))).scalar_one_or_none()
        if dr:
            doctor_name = dr.full_name

    # Use the stored local-time display string; fall back to UTC format
    scheduled_str = appt.scheduled_display or appt.scheduled_at.strftime("%B %d, %Y at %I:%M %p")

    def _gmeet_link(appt_id: str) -> str:
        """Derive a stable, Google-Meet-formatted link from the appointment UUID."""
        h = hashlib.sha256(appt_id.encode()).hexdigest()
        # Google Meet codes look like: abc-defg-hij
        part1 = h[0:3]
        part2 = h[3:7]
        part3 = h[7:10]
        return f"https://meet.google.com/{part1}-{part2}-{part3}"

    if u:
        if body.status == "confirmed":
            meeting_link = _gmeet_link(appt.id)
            
            # Send to User
            background_tasks.add_task(send_appointment_confirmed_email,
                to=u.email, user_name=u.full_name,
                doctor_name=doctor_name, scheduled_at=scheduled_str,
                meeting_link=meeting_link,
            )
            
            # Send to Doctor
            if dr:
                background_tasks.add_task(send_appointment_confirmed_email,
                    to=dr.email, user_name=u.full_name,
                    doctor_name=doctor_name, scheduled_at=scheduled_str,
                    meeting_link=meeting_link,
                )

        elif body.status == "cancelled":
            background_tasks.add_task(send_appointment_cancelled_email,
                to=u.email, user_name=u.full_name,
                scheduled_at=scheduled_str, reason=body.cancel_reason or "",
            )

        elif body.status == "completed":
            background_tasks.add_task(send_thank_you_email,
                to=u.email, user_name=u.full_name
            )

    return {"status": appt.status, "id": appt.id}


# ── List doctors (for booking form) ───────────────────────────

@router.get("/doctors")
async def list_doctors(
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.role == "therapist", User.is_active == True)
    )
    doctors = result.scalars().all()
    return [{"id": d.id, "name": d.full_name, "email": d.email} for d in doctors]