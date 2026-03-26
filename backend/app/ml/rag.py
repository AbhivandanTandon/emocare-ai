import json
import logging
from pathlib import Path
from typing import Optional

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

from app.core.config import settings

logger = logging.getLogger("emocare.rag")

_embedder: Optional[SentenceTransformer] = None
_index: Optional[faiss.IndexFlatIP] = None
_metadata: Optional[list] = None

EMBED_DIM = 384

# Crisis resource text injected when escalation is High/Imminent
CRISIS_TEXT = """
🚨 **Immediate Help Available:**
- **Emergency**: 112
- **Tele-MANAS** (24/7, free, 20 languages): **14416**
- **iCall** (TISS): 9152987821 | Mon–Sat 8am–10pm
- **Vandrevala Foundation** (24/7): 1860-2662-345
- **AASRA** (24/7): 9820466627

You don't have to face this alone. Please reach out to one of these services right now.
"""

CBT_EXERCISES = {
    "breathing": """**Try this: Box Breathing (4-4-4-4)**
1. Inhale slowly for **4 counts**
2. Hold for **4 counts**
3. Exhale for **4 counts**
4. Hold for **4 counts**
Repeat 4 times. This activates your parasympathetic nervous system.""",

    "grounding": """**Try this: 5-4-3-2-1 Grounding**
Notice: **5 things you can see**, **4 you can touch**, **3 you can hear**, **2 you can smell**, **1 you can taste**.
This anchors you in the present moment.""",

    "thought_record": """**Try this: Thought Check**
1. What's the **situation**?
2. What **thought** just went through your mind?
3. What **emotion** does it bring? (0–10 intensity)
4. What's the **evidence for** this thought?
5. What's the **evidence against** it?
6. What's a more **balanced perspective**?""",

    "activation": """**Try this: One Small Action**
Depression thrives on inaction. Pick ONE tiny task right now — even just standing up, drinking water, or stepping outside for 60 seconds.
Action comes before motivation, not after.""",
}


def load_rag():
    global _embedder, _index, _metadata

    kb_index = settings.kb_index_full_path
    kb_meta = settings.kb_meta_full_path

    if not kb_index.exists():
        logger.warning("KB FAISS index not found at %s — RAG disabled", kb_index)
        return

    _embedder = SentenceTransformer("all-MiniLM-L6-v2")
    _index = faiss.read_index(str(kb_index))
    with open(str(kb_meta), "r") as f:
        _metadata = json.load(f)

    logger.info("RAG loaded: %d KB documents", _index.ntotal)


def query_kb(query: str, top_k: int = 4, score_threshold: float = 0.25) -> list[dict]:
    if _index is None or _embedder is None or _metadata is None:
        return []

    q_vec = _embedder.encode([query], normalize_embeddings=True).astype("float32")
    k = min(top_k * 3, _index.ntotal)
    scores, indices = _index.search(q_vec, k)

    results = []
    for score, idx in zip(scores[0], indices[0]):
        if idx < 0 or score < score_threshold:
            continue
        doc = _metadata[idx]
        results.append({
            "id": doc["id"],
            "category": doc["category"],
            "title": doc["title"],
            "content": doc["content"][:600],
            "score": float(score),
        })
        if len(results) >= top_k:
            break
    return results


def build_rag_response(
    user_message: str,
    fusion_result: dict,
    conversation_history: list[dict],
    patient_name: str = "there",
) -> str:
    """Generate a CBT-informed assistant response using RAG context."""
    escalation = fusion_result["clinical"]["escalation_level"]
    label = fusion_result["label"]
    confidence = fusion_result["confidence"]

    # Emergency override
    if escalation in ("High", "Imminent"):
        return (
            f"I can hear that you're going through something very difficult right now. "
            f"Your safety is the most important thing.\n\n{CRISIS_TEXT}\n\n"
            f"I'm also alerting a mental health professional who will be in touch with you shortly."
        )

    # Get KB context
    kb_docs = query_kb(user_message, top_k=3)
    kb_context = "\n\n".join(
        f"[{d['title']}]: {d['content']}" for d in kb_docs
    ) if kb_docs else ""

    # Build history string (last 6 turns)
    history_str = ""
    for turn in conversation_history[-6:]:
        role = "User" if turn["role"] == "user" else "Assistant"
        history_str += f"{role}: {turn['content']}\n"

    # Select exercise
    exercise = ""
    if label == "Depression" and confidence > 0.55:
        exercise = "\n\n---\n" + CBT_EXERCISES["activation"]
    elif label == "Anxiety" and confidence > 0.55:
        exercise = "\n\n---\n" + CBT_EXERCISES["breathing"]
    elif escalation == "Moderate":
        exercise = "\n\n---\n" + CBT_EXERCISES["grounding"]

    # Simple template response (replace with LLM call if desired)
    if label == "Neutral":
        opening = f"I'm glad you reached out. It sounds like things are manageable right now."
    elif label == "Anxiety":
        opening = (
            f"I can sense some anxiety in what you've shared. That's completely understandable — "
            f"anxiety is your mind's alarm system, and it can feel overwhelming even when there's no immediate danger."
        )
    else:  # Depression
        opening = (
            f"Thank you for trusting me with this. What you're feeling sounds heavy, and I want you to know "
            f"that these feelings, as painful as they are, can improve with the right support."
        )

    kb_note = ""
    if kb_docs:
        kb_note = f"\n\n*Based on evidence-based mental health guidelines.*"

    disclaimer = (
        "\n\n> ⚠️ I'm an AI research assistant — not a licensed therapist. "
        "If you're struggling, please connect with a professional."
    )

    return f"{opening}{exercise}{kb_note}{disclaimer}"