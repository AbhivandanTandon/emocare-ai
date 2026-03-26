"""
SHAP explainability: gradient×embedding for text, temporal occlusion for audio.
"""
import logging

import numpy as np
import torch

from app.ml.model_loader import TRIAGE, get_device, get_text_model

logger = logging.getLogger("emocare.shap")


def compute_text_shap(text: str) -> dict:
    """Gradient × embedding norm saliency for each token."""
    model, tokenizer = get_text_model()
    device = get_device()

    inputs = tokenizer(
        text, return_tensors="pt", truncation=True, max_length=128
    ).to(device)

    emb_store = {}

    def _hook(module, inp, out):
        emb_store["emb"] = out
        out.retain_grad()

    hook = model.roberta.embeddings.register_forward_hook(_hook)
    try:
        with torch.enable_grad():
            out = model(**inputs)
            pred_cls = int(out.logits.argmax())
            model.zero_grad()
            out.logits[0, pred_cls].backward()

        emb = emb_store["emb"]
        saliency = (emb.grad * emb).norm(dim=-1).squeeze().detach().cpu().numpy()
        tokens = tokenizer.convert_ids_to_tokens(
            inputs["input_ids"].squeeze().cpu().tolist()
        )
    finally:
        hook.remove()

    pairs = [
        (t.replace("Ġ", " ").strip(), float(s))
        for t, s in zip(tokens, saliency)
        if t not in ["<s>", "</s>", "<pad>", ""]
    ]

    if not pairs:
        return {"tokens": [], "scores": [], "pred_class": 0}

    clean_toks, sal_arr = zip(*pairs)
    sal_arr = np.array(sal_arr)
    sal_norm = sal_arr / (sal_arr.max() + 1e-9)

    return {
        "tokens": list(clean_toks),
        "scores": sal_arr.tolist(),
        "scores_normalized": sal_norm.tolist(),
        "pred_class": pred_cls,
        "pred_label": TRIAGE[pred_cls],
    }


def compute_audio_shap(audio_array: np.ndarray, target_class: int, n_windows: int = 20) -> dict:
    """First-order temporal occlusion approximation."""
    from app.ml.model_loader import get_audio_model

    model = get_audio_model()
    device = get_device()

    x = torch.tensor(audio_array, dtype=torch.float32).unsqueeze(0).to(device)
    with torch.no_grad():
        base_probs = torch.softmax(model(x), dim=1).cpu().numpy()[0]

    base_score = float(base_probs[target_class])
    n = len(audio_array)
    window_size = n // n_windows
    importances = []

    for i in range(n_windows):
        start = i * window_size
        end = min(start + window_size, n)
        masked = audio_array.copy()
        masked[start:end] = 0.0
        xm = torch.tensor(masked, dtype=torch.float32).unsqueeze(0).to(device)
        with torch.no_grad():
            masked_probs = torch.softmax(model(xm), dim=1).cpu().numpy()[0]
        importances.append(float(base_score - masked_probs[target_class]))

    return {
        "window_importances": importances,
        "n_windows": n_windows,
        "base_confidence": base_score,
        "target_class": target_class,
        "target_label": TRIAGE[target_class],
        "audio_duration_s": n / 16000,
    }