"""
Tunes per-label thresholds for the interim text model on GoEmotions DEV and reports metrics on
the held-out TEST split (never used for tuning).

    .venv\\Scripts\\python calibrate_text_model.py

Writes text_model_pretrained/thresholds.json and text_model_pretrained/metrics.json.
Data: text_model_pretrained/data/{dev,test}.tsv + emotions.txt from google-research/goemotions.
"""
import json
import sys
from pathlib import Path

import numpy as np
import torch
from sklearn.metrics import f1_score, precision_score, recall_score
from tqdm import tqdm

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from text_backend import GOEMOTIONS_27, DEFAULT_MODEL_ID, PretrainedGoEmotions, raw_text  # noqa: E402
from transformers import AutoTokenizer  # noqa: E402

DATA = HERE / "text_model_pretrained" / "data"
OUT = HERE / "text_model_pretrained"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
GRID = np.round(np.arange(0.05, 0.951, 0.01), 2)

# Same Ekman grouping as fusion_pipeline.TEXT_TO_SHARED (GoEmotions paper)
EKMAN = {
    "anger": ["anger", "annoyance", "disapproval"],
    "disgust": ["disgust"],
    "fear": ["fear", "nervousness"],
    "joy": ["joy", "amusement", "approval", "excitement", "gratitude", "love", "optimism", "relief",
            "pride", "admiration", "desire", "caring"],
    "sadness": ["sadness", "disappointment", "embarrassment", "grief", "remorse"],
    "surprise": ["surprise", "realization", "confusion", "curiosity"],
}


def load_split(name):
    all28 = (DATA / "emotions.txt").read_text().split()
    texts, y = [], []
    for line in (DATA / f"{name}.tsv").read_text(encoding="utf-8").splitlines():
        text, ids, _ = line.split("\t")
        names = {all28[int(i)] for i in ids.split(",")}
        texts.append(text)
        y.append([1 if l in names else 0 for l in GOEMOTIONS_27])
    return texts, np.array(y)


@torch.no_grad()
def predict(model, tok, texts, bs=64):
    out = []
    for i in tqdm(range(0, len(texts), bs), desc="  predict"):
        enc = tok([raw_text(t) for t in texts[i:i + bs]], padding=True, truncation=True, max_length=128, return_tensors="pt")
        out.append(model(enc["input_ids"].to(DEVICE), enc["attention_mask"].to(DEVICE)).cpu().numpy())
    return np.concatenate(out)


def metrics(y, pred):
    return {
        "macro_f1": round(float(f1_score(y, pred, average="macro", zero_division=0)), 4),
        "micro_f1": round(float(f1_score(y, pred, average="micro", zero_division=0)), 4),
        "macro_precision": round(float(precision_score(y, pred, average="macro", zero_division=0)), 4),
        "macro_recall": round(float(recall_score(y, pred, average="macro", zero_division=0)), 4),
    }


def ekman_accuracy(y, probs):
    """Top shared emotion (max-of-group, like fusion) vs the gold groups, on rows with a non-neutral label."""
    groups = list(EKMAN)
    idx = [[GOEMOTIONS_27.index(m) for m in EKMAN[g]] for g in groups]
    rows = y.sum(axis=1) > 0
    p6 = np.stack([probs[:, m].max(axis=1) for m in idx], axis=1)
    g6 = np.stack([y[:, m].max(axis=1) for m in idx], axis=1)
    top = p6.argmax(axis=1)
    hit = g6[np.arange(len(top)), top] == 1
    return round(float(hit[rows].mean()), 4), int(rows.sum())


def main():
    print(f"[Calibrate] {DEFAULT_MODEL_ID} on {DEVICE}")
    model = PretrainedGoEmotions().to(DEVICE).eval()
    tok = AutoTokenizer.from_pretrained(DEFAULT_MODEL_ID)

    dev_x, dev_y = load_split("dev")
    test_x, test_y = load_split("test")
    dev_p = predict(model, tok, dev_x)
    test_p = predict(model, tok, test_x)

    thresholds = {}
    for j, label in enumerate(GOEMOTIONS_27):
        scores = [f1_score(dev_y[:, j], dev_p[:, j] >= t, zero_division=0) for t in GRID]
        thresholds[label] = float(GRID[int(np.argmax(scores))])
    thr = np.array([thresholds[l] for l in GOEMOTIONS_27])

    acc, n = ekman_accuracy(test_y, test_p)
    per_label = f1_score(test_y, test_p >= thr, average=None, zero_division=0)
    result = {
        "model": DEFAULT_MODEL_ID,
        "tuned_on": "GoEmotions dev (5,426)",
        "evaluated_on": "GoEmotions test (5,427), never used for tuning",
        "test_threshold_0.5": metrics(test_y, test_p >= 0.5),
        "test_tuned_thresholds": metrics(test_y, test_p >= thr),
        "test_ekman6_top1_accuracy": acc,
        "test_ekman6_rows": n,
        "test_per_label_f1": {l: round(float(f), 3) for l, f in zip(GOEMOTIONS_27, per_label)},
    }
    (OUT / "thresholds.json").write_text(json.dumps({"model": DEFAULT_MODEL_ID, "thresholds": thresholds}, indent=2))
    (OUT / "metrics.json").write_text(json.dumps(result, indent=2))
    print(json.dumps({k: v for k, v in result.items() if k != "test_per_label_f1"}, indent=2))
    worst = sorted(result["test_per_label_f1"].items(), key=lambda kv: kv[1])[:5]
    print("weakest labels:", worst)


if __name__ == "__main__":
    main()
