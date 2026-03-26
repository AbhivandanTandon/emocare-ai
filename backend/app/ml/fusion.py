"""
backend/app/ml/fusion.py

Weighted late fusion matching the Colab implementation:
  f_probs = (t_probs × 0.55) + (a_probs × 0.45)

Includes:
  - Shannon entropy per modality and fused
  - Jensen-Shannon divergence
  - Prediction margin
  - Cross-modal agreement flag
  - Escalation logic
  - Clinical recommendation
"""

import re
import numpy as np
from typing import Any
import scipy.stats
from scipy.special import rel_entr

TRIAGE  = ["Neutral", "Anxiety", "Depression"]
W_TEXT  = 0.55
W_AUDIO = 0.45
N_CLS   = 3


# ── C-SSRS aligned safety keywords ──────────────────────────────────────────
_CRISIS_PATTERNS = {
    "imminent": [
        r"\bkill myself\b", r"\bend my life\b", r"\bwant to die\b",
        r"\bsuicide\b", r"\bsuicidal\b", r"\btake my life\b",
        r"\bno reason to live\b", r"\bbetter off dead\b",
    ],
    "high": [
        r"\bself.?harm\b", r"\bcut myself\b", r"\bhurt myself\b",
        r"\bnssi\b", r"\boverdose\b",
    ],
    "moderate": [
        r"\bwish i were dead\b", r"\bdon.t want to be here\b",
        r"\blife is worthless\b", r"\bno point living\b",
    ],
    "homicidal": [
        r"\bkill (him|her|them|you)\b", r"\bmurder\b",
    ],
}


def _check_safety(text: str) -> dict:
    tl = text.lower()
    flags: dict[str, Any] = {
        "imminent_flag":   False,
        "high_risk_flag":  False,
        "moderate_flag":   False,
        "homicidal_flag":  False,
        "any_safety_flag": False,
        "matched_keywords": [],
    }
    for level, patterns in _CRISIS_PATTERNS.items():
        key = {
            "imminent":   "imminent_flag",
            "high":       "high_risk_flag",
            "moderate":   "moderate_flag",
            "homicidal":  "homicidal_flag",
        }[level]
        for pat in patterns:
            if re.search(pat, tl):
                flags[key] = True
                flags["matched_keywords"].append(pat)
    flags["any_safety_flag"] = any(
        flags[k] for k in ["imminent_flag", "high_risk_flag", "moderate_flag", "homicidal_flag"]
    )
    return flags


# ── Escalation logic ──────────────────────────────────────────────────────────
def _compute_escalation(
    f_probs: np.ndarray,
    f_ent: float,
    jsd: float,
    safety: dict,
    f_cls: int,
    confidence: float,
) -> str:
    # Safety overrides always win
    if safety["imminent_flag"] or safety["homicidal_flag"]:
        return "Imminent"
    if safety["high_risk_flag"]:
        return "High"
    if safety["moderate_flag"]:
        return "Moderate"

    # Depression with high confidence
    if f_cls == 2 and confidence > 0.75:
        return "High"
    if f_cls == 2 and confidence > 0.50:
        return "Moderate"

    # Anxiety with high confidence
    if f_cls == 1 and confidence > 0.75:
        return "Moderate"

    # High entropy or modal disagreement on non-neutral prediction
    if f_cls > 0 and (f_ent > 1.2 or jsd > 0.15):
        return "Moderate"

    return "Low"


# ── Clinical recommendation text ──────────────────────────────────────────────
_CLINICAL_REC = {
    0: {
        True:  "No clinical concern detected. Routine monitoring recommended.",
        False: "Borderline neutral. 2-week follow-up assessment advised.",
    },
    1: {
        True:  "Moderate-to-high anxiety signals. GAD-7 screening recommended.",
        False: "Mild anxiety indicators. Psychoeducation and lifestyle counseling suggested.",
    },
    2: {
        True:  "Elevated depression risk detected. PHQ-9 and immediate clinician review required.",
        False: "Depressive features present. Structured clinical interview recommended.",
    },
}


def fuse(text_result: dict, audio_result: dict, text: str) -> dict:
    """
    Weighted late fusion:
        f_probs = (t_probs × W_TEXT) + (a_probs × W_AUDIO)

    Mirrors the Colab `render_clinical_dashboard` implementation.

    Returns a single flat dict consumed by:
      - chat_service.py (session persistence)
      - groq.py (LLM prompt construction)
      - frontend sidebar (probability bars, risk card, metrics)
    """
    # ── Extract probability vectors ────────────────────────────────────────
    t_probs = np.array([
        text_result["probabilities"].get("Neutral",    0.0),
        text_result["probabilities"].get("Anxiety",    0.0),
        text_result["probabilities"].get("Depression", 0.0),
    ], dtype=np.float64)

    a_probs = np.array([
        audio_result["probabilities"].get("Neutral",    0.0),
        audio_result["probabilities"].get("Anxiety",    0.0),
        audio_result["probabilities"].get("Depression", 0.0),
    ], dtype=np.float64)

    # Normalise (guard against float rounding)
    t_probs = t_probs / (t_probs.sum() + 1e-9)
    a_probs = a_probs / (a_probs.sum() + 1e-9)

    # ── Weighted fusion (matches Colab Cell 4 exactly) ─────────────────────
    f_probs = (t_probs * W_TEXT) + (a_probs * W_AUDIO)
    f_probs = f_probs / (f_probs.sum() + 1e-9)

    f_cls = int(np.argmax(f_probs))
    t_cls = int(np.argmax(t_probs))
    a_cls = int(np.argmax(a_probs))

    label      = TRIAGE[f_cls]
    confidence = float(f_probs[f_cls])

    # ── Research metrics (matches Colab viz_uncertainty) ──────────────────
    t_ent  = float(scipy.stats.entropy(t_probs, base=2))
    a_ent  = float(scipy.stats.entropy(a_probs, base=2))
    f_ent  = float(scipy.stats.entropy(f_probs, base=2))
    margin = float(sorted(f_probs)[-1] - sorted(f_probs)[-2])

    m   = 0.5 * (t_probs + a_probs)
    jsd = float(
        0.5 * np.sum(rel_entr(t_probs + 1e-9, m + 1e-9)) +
        0.5 * np.sum(rel_entr(a_probs + 1e-9, m + 1e-9))
    )

    cross_modal_agreement = bool(t_cls == a_cls)

    # ── Safety keyword check ───────────────────────────────────────────────
    safety = _check_safety(text)

    # ── Escalation level ───────────────────────────────────────────────────
    escalation = _compute_escalation(f_probs, f_ent, jsd, safety, f_cls, confidence)

    # ── Clinical recommendation ────────────────────────────────────────────
    recommendation = _CLINICAL_REC[f_cls][confidence > 0.74]

    return {
        # ── Core prediction ──────────────────────────────────────────
        "label":      label,
        "index":      f_cls,
        "confidence": confidence,

        # ── Fused per-class probabilities ────────────────────────────
        "probabilities": {
            "Neutral":    float(f_probs[0]),
            "Anxiety":    float(f_probs[1]),
            "Depression": float(f_probs[2]),
        },

        # ── Individual model outputs (for Groq prompt + frontend) ──
        "text_model": {
            "label":      TRIAGE[t_cls],
            "index":      t_cls,
            "confidence": float(t_probs[t_cls]),
            "probabilities": {
                "Neutral":    float(t_probs[0]),
                "Anxiety":    float(t_probs[1]),
                "Depression": float(t_probs[2]),
            },
        },
        "audio_model": {
            "label":      TRIAGE[a_cls],
            "index":      a_cls,
            "confidence": float(a_probs[a_cls]),
            "probabilities": {
                "Neutral":    float(a_probs[0]),
                "Anxiety":    float(a_probs[1]),
                "Depression": float(a_probs[2]),
            },
        },

        # ── Research telemetry (matches Colab dashboard) ─────────────
        "metrics": {
            "shannon_entropy_text":      t_ent,
            "shannon_entropy_audio":     a_ent,
            "shannon_entropy_fused":     f_ent,
            "jensen_shannon_divergence": jsd,
            "prediction_margin":         margin,
            "cross_modal_agreement":     cross_modal_agreement,
            "fusion_weights": {
                "text":  W_TEXT,
                "audio": W_AUDIO,
            },
        },

        # ── Clinical output ──────────────────────────────────────────
        "clinical": {
            "escalation_level":     escalation,
            "recommendation":       recommendation,
            "cross_modal_agree":    cross_modal_agreement,
            "requires_review":      f_cls > 0 or safety["any_safety_flag"],
            "flag_depression_risk": float(f_probs[2]) > 0.55,
            "flag_high_entropy":    f_ent > 1.2,
            "flag_modal_disagreement": jsd > 0.15,
            "flag_suicidal_content":   safety["imminent_flag"],
            "flag_self_harm":          safety["high_risk_flag"],
            "flag_homicidal":          safety["homicidal_flag"],
            "safety_keywords_matched": safety["matched_keywords"],
        },
    }