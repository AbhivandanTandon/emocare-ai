import logging
from typing import Optional

from groq import Groq

from app.core.config import settings

logger = logging.getLogger("emocare.llm")

_client = None


def get_client() -> Optional[Groq]:
    global _client
    if _client is None:
        if not settings.GROQ_API_KEY:
            logger.warning("GROQ_API_KEY not set — using RAG fallback")
            return None
        _client = Groq(api_key=settings.GROQ_API_KEY)
        logger.info("Groq client initialised (llama-3.3-70b-versatile)")
    return _client


async def generate_response(
    user_text: str,
    fusion_result: dict,
    kb_docs: list,
    conversation_history: list,
    transcript: Optional[str] = None,
) -> str:
    """
    Generate a clinically-informed empathetic response using Groq LLM.
    Full fusion output from RoBERTa + WavLM is passed as clinical context.
    Falls back to RAG-only if Groq is unavailable.
    """
    client = get_client()
    if client is None:
        from app.ml.rag import build_rag_response
        return build_rag_response(user_text, fusion_result, conversation_history)

    # ── Unpack fusion result ───────────────────────────────────
    label      = fusion_result.get("label",      "Neutral")
    confidence = fusion_result.get("confidence", 0.0)
    probs      = fusion_result.get("probabilities", {})
    clinical   = fusion_result.get("clinical",   {})
    metrics    = fusion_result.get("metrics",    {})
    escalation = clinical.get("escalation_level", "Low")
    rec        = clinical.get("recommendation",   "")
    agree      = clinical.get("cross_modal_agree", True)

    text_model  = fusion_result.get("text_model",  {})
    audio_model = fusion_result.get("audio_model", {})

    # ── RAG context ────────────────────────────────────────────
    kb_context = ""
    if kb_docs:
        kb_context = "\n".join(
            f"- {d.get('title', '')}: {d.get('text', '')[:250]}"
            for d in kb_docs[:3]
        )

    # ── Conversation history ───────────────────────────────────
    history_messages = []
    if conversation_history:
        for m in conversation_history[-8:]:
            history_messages.append({
                "role":    m["role"],
                "content": m["content"],
            })

    # ── Audio transcript ───────────────────────────────────────
    audio_ctx = ""
    if transcript and transcript not in (
        "[No speech detected]", "[Audio message]", user_text, ""
    ):
        audio_ctx = f'\nWhisper ASR transcript of user audio: "{transcript}"'

    # ── Cross-modal disagreement note ─────────────────────────
    modal_note = ""
    if not agree:
        modal_note = (
            f"\nIMPORTANT: The text model predicted {text_model.get('label')} "
            f"({text_model.get('confidence', 0):.0%}) while the audio model predicted "
            f"{audio_model.get('label')} ({audio_model.get('confidence', 0):.0%}). "
            f"There is cross-modal disagreement — gently probe for more context."
        )

    # ── System prompt ──────────────────────────────────────────
    system_prompt = f"""You are EmoCare AI, a clinically-informed mental health support \
assistant built on a multimodal affective computing research platform. You support users \
through empathetic, evidence-based conversations. You are NOT a licensed therapist — \
mention this only when directly relevant, not in every response.

Your responses are guided by a real-time clinical analysis from two trained ML models:
- RoBERTa (semantic/text model, weight 0.55)
- WavLM-Large (acoustic/audio model, weight 0.45)
These are fused using weighted late fusion identical to the research pipeline.

═══════════════════════════════════════════════════════════
LIVE MULTIMODAL CLINICAL ANALYSIS
═══════════════════════════════════════════════════════════
Fused prediction  : {label}  ({confidence:.1%} confidence)
Escalation level  : {escalation}

Fused probabilities:
  Neutral    {probs.get('Neutral',    0):.1%}
  Anxiety    {probs.get('Anxiety',    0):.1%}
  Depression {probs.get('Depression', 0):.1%}

Individual model outputs:
  Text model  (RoBERTa)    → {text_model.get('label',  'N/A')} \
({text_model.get('confidence',  0):.1%} confidence)
    Neutral {text_model.get('probabilities', {}).get('Neutral',    0):.1%} | \
Anxiety {text_model.get('probabilities', {}).get('Anxiety',    0):.1%} | \
Depression {text_model.get('probabilities', {}).get('Depression', 0):.1%}

  Audio model (WavLM-Large) → {audio_model.get('label', 'N/A')} \
({audio_model.get('confidence', 0):.1%} confidence)
    Neutral {audio_model.get('probabilities', {}).get('Neutral',    0):.1%} | \
Anxiety {audio_model.get('probabilities', {}).get('Anxiety',    0):.1%} | \
Depression {audio_model.get('probabilities', {}).get('Depression', 0):.1%}

Research metrics:
  Shannon entropy (fused)   : {metrics.get('shannon_entropy_fused',    0):.4f} bits
  Jensen-Shannon divergence : {metrics.get('jensen_shannon_divergence', 0):.4f}
  Prediction margin         : {metrics.get('prediction_margin',         0):.1%}
  Cross-modal agreement     : {'Yes' if agree else 'No — models disagree'}{modal_note}

Clinical recommendation from models:
  {rec}
{audio_ctx}

═══════════════════════════════════════════════════════════
RETRIEVED CBT KNOWLEDGE BASE
═══════════════════════════════════════════════════════════
{kb_context if kb_context else 'No specific techniques retrieved for this query.'}

═══════════════════════════════════════════════════════════
RESPONSE GUIDELINES
═══════════════════════════════════════════════════════════
ESCALATION BEHAVIOUR:
- LOW      → Warm, exploratory, supportive. Use CBT techniques naturally.
- MODERATE → Validate, gently introduce coping strategies. Suggest professional support.
- HIGH     → Clearly but compassionately encourage professional help. Provide resources.
- IMMINENT → IMMEDIATELY provide crisis resources:
               iCall: 9152987821
               Vandrevala Foundation: 1860-2662-345 (24x7)
               Tele-MANAS: 14416
               Emergency: 112

TONE & CONTENT:
- Do NOT start with "I'm glad you reached out", "I hear you", or any generic opener
- Do NOT reproduce model names, probabilities or technical metrics to the user
- DO acknowledge what the user is feeling based on what the models detected
- DO use specific CBT techniques from the knowledge base when relevant
- If cross-modal agreement is No, ask a gentle follow-up question to get fuller context
- If the user wrote in Hindi or mixed language, respond in the same register
- Respond in 3 to 6 sentences unless escalation is High or Imminent
- Be direct, warm and specific — not generic or formulaic"""

    # ── Build messages array ───────────────────────────────────
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history_messages)
    messages.append({"role": "user", "content": user_text})

    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.65,
            max_tokens=600,
            top_p=0.92,
        )
        text = completion.choices[0].message.content.strip()
        logger.info(
            "Groq response: %d chars | label=%s escalation=%s agreement=%s",
            len(text), label, escalation, agree,
        )
        return text

    except Exception as e:
        logger.error("Groq error: %s — falling back to RAG", e)
        from app.ml.rag import build_rag_response
        return build_rag_response(user_text, fusion_result, conversation_history)