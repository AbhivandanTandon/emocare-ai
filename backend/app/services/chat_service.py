import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.security import encrypt_message
from app.core.groq import generate_response
from app.db.models import Message, Session as DBSession, Alert
from app.ml.text_inference import run_text_inference
from app.ml.audio_inference import run_audio_inference
from app.ml.fusion import fuse
from app.ml.rag import query_kb
from app.ml.shap_engine import compute_text_shap
from app.websocket.manager import manager


async def get_or_create_session(
    db: AsyncSession,
    user_id: str,
    existing_session_id: Optional[str] = None,
) -> DBSession:
    if existing_session_id:
        result = await db.execute(
            select(DBSession).where(
                DBSession.id == existing_session_id,
                DBSession.user_id == user_id,
            )
        )
        session = result.scalar_one_or_none()
        if session:
            return session

    session = DBSession(id=str(uuid.uuid4()), user_id=user_id)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def process_message(
    db: AsyncSession,
    user_id: str,
    text: str,
    audio_array=None,
    transcript: Optional[str] = None,
    conversation_history: Optional[list] = None,
    existing_session_id: Optional[str] = None,
    audio_file_id: Optional[str] = None,
    encrypted_audio: Optional[str] = None,
) -> dict:
    conversation_history = conversation_history or []

    # ── Text inference (always runs) ───────────────────────────
    text_result = run_text_inference(text)

    # ── Audio inference (runs when audio provided) ─────────────
    if audio_array is not None:
        audio_result = run_audio_inference(audio_array)
    else:
        audio_result = {
            "label":         "Neutral",
            "index":         0,
            "probabilities": {"Neutral": 0.8, "Anxiety": 0.1, "Depression": 0.1},
            "confidence":    0.8,
        }

    # ── Fuse both modalities ───────────────────────────────────
    fusion    = fuse(text_result, audio_result, text)
    shap_data = compute_text_shap(text)
    kb_docs   = query_kb(text, top_k=3)

    # ── Generate response with Groq+ RAG ───────────────────
    response_text = await generate_response(
        user_text=text,
        fusion_result=fusion,
        kb_docs=kb_docs,
        conversation_history=conversation_history,
        transcript=transcript,
    )

    # ── Persist session ────────────────────────────────────────
    session = await get_or_create_session(db, user_id, existing_session_id)
    session.escalation_level = fusion["clinical"]["escalation_level"]
    session.risk_label       = fusion["label"]
    session.risk_confidence  = fusion["confidence"]
    session.artifact_json    = {
        "text_model":   text_result,
        "audio_model":  audio_result,
        "fusion":       fusion,
        "kb_docs_used": [d["id"] for d in kb_docs],
        "transcript":   transcript,
    }
    session.shap_json = shap_data

    # ── Save user message ──────────────────────────────────────
    user_prediction = dict(fusion)
    if audio_file_id:
        user_prediction["audio_file_id"] = audio_file_id

    user_msg = Message(
        id=str(uuid.uuid4()),
        session_id=session.id,
        role="user",
        encrypted_content=encrypt_message(text, user_id),
        has_audio=audio_array is not None,
        prediction_json=user_prediction,
        audio_data=encrypted_audio,   # ← encrypted in DB, never on disk
    )
    db.add(user_msg)

    # ── Save assistant message ─────────────────────────────────
    assistant_msg = Message(
        id=str(uuid.uuid4()),
        session_id=session.id,
        role="assistant",
        encrypted_content=encrypt_message(response_text, user_id),
        prediction_json={},
    )
    db.add(assistant_msg)

    await db.commit()

    # ── Crisis alert ───────────────────────────────────────────
    escalation = fusion["clinical"]["escalation_level"]
    if escalation in ("High", "Imminent"):
        alert = Alert(
            id=str(uuid.uuid4()),
            user_id=user_id,
            session_id=session.id,
            level=escalation,
            message=f"{escalation} risk detected. Transcript: {text[:200]}",
        )
        db.add(alert)
        await db.commit()

        payload = {
            "type":       "crisis_alert",
            "user_id":    user_id,
            "session_id": session.id,
            "level":      escalation,
            "message":    alert.message,
        }
        await manager.broadcast_to_role("admin",     payload)
        await manager.broadcast_to_role("therapist", payload)

    return {
        "response":        response_text,
        "fusion":          fusion,
        "shap":            shap_data,
        "kb_docs":         kb_docs,
        "session_id":      session.id,
        "message_id":      user_msg.id,
        "audio_file_id":   audio_file_id,
        "transcript":      transcript,
    }