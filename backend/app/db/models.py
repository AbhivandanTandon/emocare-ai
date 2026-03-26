import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey,
    Integer, String, Text, JSON, Enum as SAEnum
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.engine import Base


def _now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str]      = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str]   = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str]       = mapped_column(String(255), nullable=False)
    role: Mapped[str]    = mapped_column(SAEnum("user", "therapist", "admin", name="user_role"), default="user")
    is_active: Mapped[bool]        = mapped_column(Boolean, default=True)
    consent_model: Mapped[bool]    = mapped_column(Boolean, default=False)
    consent_therapist: Mapped[bool]= mapped_column(Boolean, default=False)
    created_at: Mapped[datetime]   = mapped_column(DateTime(timezone=True), default=_now)
    last_login: Mapped[datetime]   = mapped_column(DateTime(timezone=True), nullable=True)

    # Intake form fields
    intake_age: Mapped[str]               = mapped_column(String(10),  nullable=True)
    intake_gender: Mapped[str]            = mapped_column(String(50),  nullable=True)
    intake_occupation: Mapped[str]        = mapped_column(String(200), nullable=True)
    intake_emergency_contact: Mapped[str] = mapped_column(String(300), nullable=True)
    intake_primary_concerns: Mapped[dict] = mapped_column(JSON, default=list)
    intake_describe_situation: Mapped[str]= mapped_column(Text, nullable=True)
    intake_history_items: Mapped[dict]    = mapped_column(JSON, default=list)
    intake_previous_therapy: Mapped[str]  = mapped_column(Text, nullable=True)
    intake_share_with_doctor: Mapped[bool]= mapped_column(Boolean, default=True)
    intake_share_sessions: Mapped[bool]   = mapped_column(Boolean, default=True)
    intake_share_audio: Mapped[bool]      = mapped_column(Boolean, default=False)
    intake_share_risk_scores: Mapped[bool]= mapped_column(Boolean, default=True)
    intake_consent_research: Mapped[bool] = mapped_column(Boolean, default=False)
    intake_additional_notes: Mapped[str]  = mapped_column(Text, nullable=True)
    intake_completed: Mapped[bool]        = mapped_column(Boolean, default=False)

    sessions:     Mapped[list["Session"]]     = relationship(back_populates="user")
    alerts:       Mapped[list["Alert"]]       = relationship(back_populates="user")
    appointments: Mapped[list["Appointment"]] = relationship(back_populates="user", foreign_keys="Appointment.user_id")


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str]       = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str]  = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime]      = mapped_column(DateTime(timezone=True), default=_now)
    escalation_level: Mapped[str]     = mapped_column(String(20), default="Low")
    risk_label: Mapped[str]           = mapped_column(String(30), default="Neutral")
    risk_confidence: Mapped[float]    = mapped_column(Float, default=0.0)
    is_escalated: Mapped[bool]        = mapped_column(Boolean, default=False)
    assigned_therapist_id: Mapped[str]= mapped_column(String(36), nullable=True)
    artifact_json: Mapped[dict]       = mapped_column(JSON, default=dict)
    shap_json: Mapped[dict]           = mapped_column(JSON, default=dict)

    user:     Mapped["User"]          = relationship(back_populates="sessions")
    messages: Mapped[list["Message"]] = relationship(back_populates="session", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str]         = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"), index=True)
    role: Mapped[str]       = mapped_column(SAEnum("user", "assistant", name="msg_role"))
    encrypted_content: Mapped[str] = mapped_column(Text, nullable=False)
    has_audio: Mapped[bool]        = mapped_column(Boolean, default=False)

    # Encrypted audio stored in DB — no filesystem
    audio_data: Mapped[str]        = mapped_column(Text, nullable=True)

    prediction_json: Mapped[dict]  = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime]   = mapped_column(DateTime(timezone=True), default=_now)

    session: Mapped["Session"] = relationship(back_populates="messages")


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[str]      = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    session_id: Mapped[str]       = mapped_column(String(36), nullable=True)
    level: Mapped[str]            = mapped_column(String(20), default="High")
    message: Mapped[str]          = mapped_column(Text)
    is_acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    acknowledged_by: Mapped[str]  = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime]  = mapped_column(DateTime(timezone=True), default=_now)

    user: Mapped["User"] = relationship(back_populates="alerts")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int]      = mapped_column(Integer, primary_key=True, autoincrement=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    action: Mapped[str]  = mapped_column(String(100))
    user_id: Mapped[str] = mapped_column(String(36), nullable=True)
    role: Mapped[str]    = mapped_column(String(20), nullable=True)
    target_id: Mapped[str]= mapped_column(String(36), nullable=True)
    ip: Mapped[str]      = mapped_column(String(50), nullable=True)
    detail: Mapped[dict] = mapped_column(JSON, default=dict)


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[str]         = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str]    = mapped_column(ForeignKey("users.id"), index=True)
    therapist_id: Mapped[str]    = mapped_column(String(36), nullable=True)
    scheduled_at: Mapped[datetime]= mapped_column(DateTime(timezone=True))
    status: Mapped[str]          = mapped_column(
        SAEnum("pending", "confirmed", "completed", "cancelled", name="appt_status"),
        default="pending"
    )
    notes: Mapped[str]      = mapped_column(Text, nullable=True)
    scheduled_display: Mapped[str] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    user: Mapped["User"] = relationship(back_populates="appointments", foreign_keys=[user_id])