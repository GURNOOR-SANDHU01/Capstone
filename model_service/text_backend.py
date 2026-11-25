"""
Interim text-emotion model, used until the team's SoulScribe V8 weights are installed.

SamLowe/roberta-base-go_emotions (MIT licence): RoBERTa-base fine-tuned on GoEmotions,
28 labels (27 emotions + neutral), multi-label sigmoid.

`PretrainedGoEmotions` mimics SoulScribeV8's interface exactly:
    model(input_ids, attention_mask) -> sigmoid probabilities, shape (N, 27), neutral removed
so fusion_pipeline.text_predict / fuse_predictions / pick_fine_grained run unchanged.

Per-label thresholds are tuned on the GoEmotions dev split by calibrate_text_model.py.
"""
import json
from pathlib import Path

import torch
import torch.nn as nn
from transformers import AutoModelForSequenceClassification, AutoTokenizer

DEFAULT_MODEL_ID = "SamLowe/roberta-base-go_emotions"
HERE = Path(__file__).resolve().parent
DEFAULT_THRESHOLDS = HERE / "text_model_pretrained" / "thresholds.json"

# Canonical GoEmotions order (emotions.txt) without neutral: the 27 labels SoulScribe V8 outputs
GOEMOTIONS_27 = [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring", "confusion",
    "curiosity", "desire", "disappointment", "disapproval", "disgust", "embarrassment",
    "excitement", "fear", "gratitude", "grief", "joy", "love", "nervousness", "optimism",
    "pride", "realization", "relief", "remorse", "sadness", "surprise",
]


class PretrainedGoEmotions(nn.Module):
    def __init__(self, model_id=DEFAULT_MODEL_ID):
        super().__init__()
        self.inner = AutoModelForSequenceClassification.from_pretrained(model_id)
        id2label = {int(k): v for k, v in self.inner.config.id2label.items()}
        by_name = {v: k for k, v in id2label.items()}
        missing = [l for l in GOEMOTIONS_27 if l not in by_name]
        if missing:
            raise ValueError(f"{model_id} is missing GoEmotions labels: {missing}")
        # column order = GOEMOTIONS_27, whatever order the checkpoint uses
        self.register_buffer("keep", torch.tensor([by_name[l] for l in GOEMOTIONS_27]), persistent=False)

    @torch.no_grad()
    def forward(self, input_ids, attention_mask):
        logits = self.inner(input_ids=input_ids, attention_mask=attention_mask).logits
        return torch.sigmoid(logits.float())[:, self.keep]


def load_pretrained_text_model(device, model_id=DEFAULT_MODEL_ID, thresholds_path=DEFAULT_THRESHOLDS):
    """Returns (model, tokenizer, labels, thresholds) like fusion_pipeline.load_text_model()."""
    model = PretrainedGoEmotions(model_id).to(device).eval()
    tokenizer = AutoTokenizer.from_pretrained(model_id)
    path = Path(thresholds_path)
    if path.exists():
        thresholds = json.loads(path.read_text())["thresholds"]
        thresholds = [float(thresholds[l]) for l in GOEMOTIONS_27]
    else:
        thresholds = [0.5] * len(GOEMOTIONS_27)
    import numpy as np
    return model, tokenizer, list(GOEMOTIONS_27), np.array(thresholds)


def raw_text(text):
    """This checkpoint was trained on raw Reddit text: keep case and punctuation (only trim)."""
    return " ".join(str(text).split())
