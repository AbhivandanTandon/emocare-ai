import base64
import hashlib
import json
import uuid as uuid_lib

from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.auth import get_current_user
from app.core.config import settings
from app.core.security import decrypt_message
from app.db.engine import get_db
from app.db.models import Message, Session as DBSession, User
from app.ml.audio_inference import process_audio_bytes
from app.services.chat_service import process_message

router = APIRouter(prefix="/chat", tags=["chat"])


def _audio_fernet(user_id: str) -> Fernet:
    """Derive a per-user Fernet key for audio encryption."""
    raw = hashlib.sha256(
        f"audio:{settings.ENCRYPTION_KEY}:{user_id}".encode()
    ).digest()
    return Fernet(base64.urlsafe_b64encode(raw))


# ── Send message ───────────────────────────────────────────────

@router.post("/message")
async def send_message(
    text: str = Form(...),
    audio: UploadFile = File(None),
    conversation_history: str = Form(default="[]"),
    session_id: str = Form(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.consent_model:
        raise HTTPException(status_code=403, detail="Model consent required.")

    history         = json.loads(conversation_history)
    audio_array     = None
    audio_file_id   = None
    transcript      = None
    encrypted_audio = None

    if audio:
        audio_bytes = await audio.read()

        # Encrypt audio — stored in DB, never on disk
        fernet          = _audio_fernet(current_user.id)
        encrypted_audio = fernet.encrypt(audio_bytes).decode()
        audio_file_id   = str(uuid_lib.uuid4())

        # Run ASR + audio model inference
        audio_array, _, transcript = process_audio_bytes(audio_bytes)

        # Use transcript as text if no text was sent
        if not text.strip() or text == "[Audio message]":
            text = transcript or "[Audio message]"

    result = await process_message(
        db=db,
        user_id=current_user.id,
        text=text,
        audio_array=audio_array,
        transcript=transcript,
        conversation_history=history,
        existing_session_id=session_id,
        audio_file_id=audio_file_id,
        encrypted_audio=encrypted_audio,
    )
    return result


# ── Serve audio — decrypt from DB, never from disk ────────────

@router.get("/audio/{message_id}")
async def get_audio(
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Fetch message
    result = await db.execute(
        select(Message).where(Message.id == message_id)
    )
    message = result.scalar_one_or_none()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    # Verify ownership via session
    session_result = await db.execute(
        select(DBSession).where(
            DBSession.id == message.session_id,
            DBSession.user_id == current_user.id,
        )
    )
    if not session_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Access denied")

    # Check audio exists
    if not message.audio_data:
        raise HTTPException(status_code=404, detail="No audio for this message")

    # Decrypt and return
    try:
        fernet      = _audio_fernet(current_user.id)
        audio_bytes = fernet.decrypt(message.audio_data.encode())
    except Exception:
        raise HTTPException(status_code=500, detail="Audio decryption failed")

    return Response(
        content=audio_bytes,
        media_type="audio/webm",
        headers={
            "Content-Disposition": f"inline; filename=message_{message_id}.webm",
            "Cache-Control": "no-store",
        },
    )


# ── New session ────────────────────────────────────────────────

@router.post("/sessions/new")
async def new_session(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = DBSession(id=str(uuid_lib.uuid4()), user_id=current_user.id)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return {"session_id": session.id}


# ── List sessions ──────────────────────────────────────────────

@router.get("/sessions")
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DBSession)
        .where(DBSession.user_id == current_user.id)
        .order_by(DBSession.created_at.desc())
        .limit(50)
    )
    sessions = result.scalars().all()

    session_list = []
    for s in sessions:
        # First user message as preview
        first_msg_result = await db.execute(
            select(Message)
            .where(Message.session_id == s.id, Message.role == "user")
            .order_by(Message.created_at.asc())
            .limit(1)
        )
        first_msg = first_msg_result.scalar_one_or_none()
        preview = ""
        if first_msg:
            try:
                decrypted = decrypt_message(first_msg.encrypted_content, current_user.id)
                preview   = decrypted[:60] + ("..." if len(decrypted) > 60 else "")
            except Exception:
                preview = "Conversation"

        # Message count
        count_result = await db.execute(
            select(Message).where(Message.session_id == s.id)
        )
        msg_count = len(count_result.scalars().all())

        session_list.append({
            "id":               s.id,
            "preview":          preview or "New conversation",
            "risk_label":       s.risk_label,
            "escalation_level": s.escalation_level,
            "created_at":       s.created_at.isoformat(),
            "message_count":    msg_count,
            "is_escalated":     s.is_escalated,
        })

    return session_list


# ── Get session history ────────────────────────────────────────

@router.get("/history/{session_id}")
async def get_history(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DBSession).where(
            DBSession.id == session_id,
            DBSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    msgs_result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at)
    )
    messages = msgs_result.scalars().all()

    return {
        "session_id":       session_id,
        "risk_label":       session.risk_label,
        "escalation_level": session.escalation_level,
        "created_at":       session.created_at.isoformat(),
        "messages": [
            {
                "id":            m.id,
                "role":          m.role,
                "content":       decrypt_message(m.encrypted_content, current_user.id),
                "created_at":    m.created_at.isoformat(),
                "prediction":    m.prediction_json,
                "has_audio":     m.has_audio,
                # Let frontend know audio is available without exposing the data
                "audio_available": m.has_audio and m.audio_data is not None,
            }
            for m in messages
        ],
    }


# ── Delete session ─────────────────────────────────────────────

@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DBSession).where(
            DBSession.id == session_id,
            DBSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    await db.delete(session)
    await db.commit()
    return {"status": "deleted"}