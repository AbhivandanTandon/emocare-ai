import numpy as np
import torch

from app.ml.model_loader import TRIAGE, get_device, get_text_model


def run_text_inference(text: str) -> dict:
    model, tokenizer = get_text_model()
    device = get_device()

    inputs = tokenizer(
        text, return_tensors="pt", truncation=True, padding=True, max_length=128
    ).to(device)

    with torch.no_grad():
        logits = model(**inputs).logits
        probs = torch.softmax(logits, dim=1).cpu().numpy()[0]

    pred = int(np.argmax(probs))
    return {
        "label": TRIAGE[pred],
        "index": pred,
        "probabilities": {TRIAGE[i]: float(probs[i]) for i in range(3)},
        "confidence": float(probs[pred]),
    }