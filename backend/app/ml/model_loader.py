"""
Singleton loader — models are loaded once at startup.
"""
import logging
from pathlib import Path
from typing import Optional

import torch
import torch.nn as nn
from transformers import AutoModelForSequenceClassification, AutoTokenizer, WavLMModel

from app.core.config import settings

logger = logging.getLogger("emocare.ml")

# ── Device & Global Config ─────────────────────────────────────────────────
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
TRIAGE = ["Neutral", "Anxiety", "Depression"]
W_TEXT = 0.55
W_AUDIO = 0.45
N_CLS = 3
MASK_FILL = -1e4


# ── Audio model architecture (must match training) ─────────────────────────
class AttentivePool(nn.Module):
    def __init__(self, dim):
        super().__init__()
        self.attn = nn.Sequential(
            nn.Linear(dim, 256), nn.Tanh(), nn.Dropout(0.3), nn.Linear(256, 1)
        )

    def forward(self, h, feat_mask=None):
        s = self.attn(h)
        if feat_mask is not None:
            fill = torch.tensor(MASK_FILL, dtype=s.dtype, device=s.device)
            s = s.masked_fill(feat_mask.unsqueeze(-1) == 0, fill)
        w = torch.softmax(s, dim=1)
        mean = (w * h).sum(1)
        var = (w * (h - mean.unsqueeze(1)).pow(2)).sum(1)
        return torch.cat([mean, var.clamp(min=0).sqrt()], dim=-1)


class SERHead(nn.Module):
    def __init__(self, dim, drop=0.4):
        super().__init__()
        self.pool = AttentivePool(dim)
        self.bn = nn.BatchNorm1d(dim * 2)
        self.mlp = nn.Sequential(
            nn.Linear(dim * 2, 512), nn.GELU(), nn.Dropout(drop),
            nn.Linear(512, 256), nn.GELU(), nn.Dropout(drop * 0.5),
            nn.Linear(256, N_CLS),
        )

    def forward(self, h, feat_mask=None):
        pooled = self.pool(h, feat_mask)
        pooled = self.bn(pooled.float()).to(h.dtype)
        return self.mlp(pooled)


class SERModel(nn.Module):
    def __init__(self, backbone, hidden_dim):
        super().__init__()
        self.backbone = backbone
        self.head = SERHead(hidden_dim)

    def forward(self, x, raw_mask=None):
        out = self.backbone(
            input_values=x, attention_mask=raw_mask
        ).last_hidden_state
        return self.head(out, None)


# ── Singleton containers ───────────────────────────────────────────────────
_text_model: Optional[AutoModelForSequenceClassification] = None
_text_tokenizer: Optional[AutoTokenizer] = None
_audio_model: Optional[SERModel] = None


def load_models():
    global _text_model, _text_tokenizer, _audio_model

    text_path = settings.text_model_full_path
    audio_path = settings.audio_model_full_path

    logger.info("Loading text model from %s", text_path)
    _text_tokenizer = AutoTokenizer.from_pretrained(str(text_path))
    _text_model = AutoModelForSequenceClassification.from_pretrained(
        str(text_path)
    ).to(DEVICE)
    _text_model.eval()
    logger.info("Text model (RoBERTa) ready on %s", DEVICE)

    logger.info("Loading audio model from %s", audio_path)
    bb = WavLMModel.from_pretrained("microsoft/wavlm-large")
    _audio_model = SERModel(bb, 1024).to(DEVICE)
    ckpt = torch.load(str(audio_path), map_location=DEVICE, weights_only=False)
    _audio_model.load_state_dict(ckpt["state"])
    _audio_model.eval()
    logger.info(
        "Audio model (WavLM-Large) ready — F1=%.2f%%",
        ckpt.get("f1", 0) * 100,
    )


def get_text_model():
    return _text_model, _text_tokenizer


def get_audio_model():
    return _audio_model


def get_device():
    return DEVICE