import io
import os
import subprocess
import tempfile

import librosa
import numpy as np
import torch

from app.ml.model_loader import TRIAGE, get_audio_model, get_device

SR = 16_000
MAX_LEN = SR * 30

_asr_model = None


def get_asr():
    global _asr_model
    if _asr_model is None:
        from faster_whisper import WhisperModel
        _asr_model = WhisperModel("base", device="cpu", compute_type="int8")
    return _asr_model


def _decode_bytes_to_array(audio_bytes: bytes) -> np.ndarray:
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
        f.write(audio_bytes)
        tmp_in = f.name

    tmp_out = tmp_in.replace(".webm", ".wav")
    subprocess.run(
        ["ffmpeg", "-y", "-i", tmp_in, "-acodec", "pcm_s16le",
         "-ar", str(SR), "-ac", "1", tmp_out],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    load_path = tmp_out if os.path.exists(tmp_out) else tmp_in
    arr, _ = librosa.load(load_path, sr=SR, mono=True)

    for p in [tmp_in, tmp_out]:
        try:
            os.remove(p)
        except Exception:
            pass

    arr, _ = librosa.effects.trim(arr, top_db=25)
    arr = arr[:MAX_LEN].astype(np.float32)
    std = arr.std()
    if std < 1e-8:
        raise ValueError("Audio is silent")
    return (arr - arr.mean()) / std


def transcribe(audio_array: np.ndarray) -> str:
    import soundfile as sf
    model = get_asr()
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        sf.write(f.name, audio_array, SR)
        tmp_path = f.name
    segments, _ = model.transcribe(tmp_path, language="en")
    try:
        os.remove(tmp_path)
    except Exception:
        pass
    return " ".join(s.text for s in segments).strip() or "[No speech detected]"


def run_audio_inference(audio_array: np.ndarray) -> dict:
    model = get_audio_model()
    device = get_device()

    if model is None:
        return {
            "label": "Neutral",
            "index": 0,
            "probabilities": {"Neutral": 0.8, "Anxiety": 0.1, "Depression": 0.1},
            "confidence": 0.8,
        }

    x = torch.tensor(audio_array, dtype=torch.float32).unsqueeze(0).to(device)
    with torch.no_grad():
        probs = torch.softmax(model(x), dim=1).cpu().numpy()[0]

    pred = int(np.argmax(probs))
    return {
        "label": TRIAGE[pred],
        "index": pred,
        "probabilities": {TRIAGE[i]: float(probs[i]) for i in range(3)},
        "confidence": float(probs[pred]),
    }


def process_audio_bytes(audio_bytes: bytes) -> tuple:
    arr = _decode_bytes_to_array(audio_bytes)
    transcript = transcribe(arr)
    prediction = run_audio_inference(arr)
    return arr, prediction, transcript