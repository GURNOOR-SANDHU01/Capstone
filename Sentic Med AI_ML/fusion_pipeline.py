# =============================================================================
# SenticMed - Text + Audio Emotion Fusion Pipeline
#
# Text model  : SoulScribe V8 (RoBERTa-large + BiGRU + attention),
#               27 GoEmotions labels, multi-label (sigmoid)
# Audio model : WavLM-large + attentive statistics pooling,
#               7 MELD labels incl. neutral, single-label (softmax)
#
# How one journal recording is processed (predict mode)
# -----------------------------------------------------
#   recording ──┬──> WavLM audio model ──────────────> 7 voice probabilities
#               └──> Whisper ─> transcript ─> SoulScribe ─> 27 text probabilities
#
#   1. MAP    27 text emotions -> 6 shared emotions
#             (anger, disgust, fear, joy, sadness, surprise), using the official
#             GoEmotions -> Ekman grouping. Neutral is not used anywhere: the
#             text model was deliberately trained without it.
#   2. VOICE NEUTRAL?  If the audio model's top guess is "neutral", the voice
#             carried no clear emotional cue, so the text model decides alone.
#   3. OTHERWISE  drop the audio model's neutral score and compare the two
#             models' top emotions:
#               - same emotion      -> "agree"
#               - different emotion -> "conflict"; text is trusted more
#             In both cases: fused = TEXT_WEIGHT * text + (1 - TEXT_WEIGHT) * audio
#             with TEXT_WEIGHT = 0.7, because real journal entries are closer to
#             the text model's training data than to MELD's acted TV dialogue.
#   4. OUTPUT the fused emotion, how it was decided, and the fine-grained
#             text emotions (e.g. "grief", "nervousness") for the journal view.
#
# Usage
# -----
#   python fusion_pipeline.py predict clip.wav   # one recording (CPU is fine)
#   python fusion_pipeline.py folder my_clips/   # a folder of test recordings,
#                                                # named like sad_01.wav (CPU is fine)
#   python fusion_pipeline.py evaluate           # optional: score on MELD
#                                                # (much faster with a GPU)
# =============================================================================

import os
import re
import sys
import json

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import emoji
from tqdm import tqdm
from transformers import AutoTokenizer, RobertaModel, Wav2Vec2FeatureExtractor
from sklearn.metrics import (
    accuracy_score, f1_score, precision_score, recall_score,
    classification_report, confusion_matrix,
)

# The audio training script must sit in the same folder as this file.
import wavlm_attentive_emotion_pipeline as audio_mod


# =============================================================================
# SECTION 1 - CONFIGURATION  (edit these paths to match your machine)
# =============================================================================

# --- Fusion rule ---
TEXT_WEIGHT    = 0.7          # text's share when combining; audio gets 1 - this
EXCLUDED_CLASS = "neutral"    # not used in the shared label space

# --- Text model files ---
TEXT_WEIGHTS_PATH    = "/workspace/text_model/soulscribe_v8.pt"   # state_dict
TEXT_LABELS_PATH     = "/workspace/text_model/label_list.json"
TEXT_THRESHOLDS_PATH = "/workspace/text_model/thresholds.json"
TEXT_TOKENIZER       = "roberta-large"
TEXT_MAX_LEN         = 128

# --- Audio model files (paths come from the audio training script) ---
AUDIO_WEIGHTS_PATH = audio_mod.BEST_MODEL_PATH
AUDIO_CLASSES_PATH = audio_mod.LABEL_ENCODER_PATH

# --- Whisper (speech-to-text) ---
WHISPER_MODEL = "openai/whisper-small"

# --- Optional MELD evaluation ---
DEV_CSV, DEV_AUDIO   = audio_mod.DEV_CSV_PATH, audio_mod.DEV_AUDIO_DIR
TEST_CSV, TEST_AUDIO = audio_mod.TEST_CSV_PATH, audio_mod.TEST_AUDIO_DIR
OUT_DIR      = "/workspace/fusion_outputs"
RESULTS_PATH = os.path.join(OUT_DIR, "fusion_results.json")
# Temperatures are 1.0 (no change) unless `evaluate` has fitted them on MELD dev.
PARAMS_PATH  = os.path.join(OUT_DIR, "fusion_params.json")
TEMPERATURE_GRID = np.round(np.arange(0.25, 5.01, 0.05), 2)

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
if DEVICE == "cpu":
    torch.set_num_threads(os.cpu_count() or 1)      # use every CPU core
TEXT_BATCH_SIZE  = 64 if DEVICE == "cuda" else 16
AUDIO_BATCH_SIZE = 16 if DEVICE == "cuda" else 4


# =============================================================================
# SECTION 2 - LABEL MAPPING  (27 GoEmotions labels -> 6 shared labels)
# =============================================================================
# Official Ekman grouping from the GoEmotions paper (Demszky et al., 2020).
# Every one of the 27 text labels belongs to exactly one group.

TEXT_TO_SHARED = {
    "anger":    ["anger", "annoyance", "disapproval"],
    "disgust":  ["disgust"],
    "fear":     ["fear", "nervousness"],
    "joy":      ["joy", "amusement", "approval", "excitement", "gratitude",
                 "love", "optimism", "relief", "pride", "admiration",
                 "desire", "caring"],
    "sadness":  ["sadness", "disappointment", "embarrassment", "grief", "remorse"],
    "surprise": ["surprise", "realization", "confusion", "curiosity"],
}


def shared_classes_from_audio(audio_classes):
    """The 6 shared classes, in the audio model's order, without neutral."""
    return [c for c in audio_classes if c != EXCLUDED_CLASS]


def build_group_index(text_labels, shared_classes):
    """For each shared class, the column numbers of its text labels."""
    return [[text_labels.index(m) for m in TEXT_TO_SHARED[c]] for c in shared_classes]


def text27_to_shared(text_probs, groups):
    """
    Text probabilities (N, 27) -> 6-class distribution (N, 6).

    Step 1: each group takes the probability of its strongest member.
            (Max, not sum: the 27 sigmoid outputs are independent, and a sum
            would let "joy", with 12 members, win just by having more labels.)
    Step 2: divide by the row total so each row sums to 1.
    """
    out = np.zeros((text_probs.shape[0], len(groups)))
    for j, members in enumerate(groups):
        out[:, j] = text_probs[:, members].max(axis=1)
    out = np.clip(out, 1e-6, None)
    return out / out.sum(axis=1, keepdims=True)


# =============================================================================
# SECTION 3 - PROBABILITY HELPERS
# =============================================================================

def softmax(x):
    x = x - x.max(axis=1, keepdims=True)
    e = np.exp(x)
    return e / e.sum(axis=1, keepdims=True)


def apply_temperature_to_probs(probs, t):
    """Sharpens (t < 1) or softens (t > 1) a probability distribution."""
    return softmax(np.log(np.clip(probs, 1e-9, None)) / t)


def load_params():
    """Fitted temperatures if `evaluate` has been run, otherwise 1.0 (no change)."""
    if os.path.exists(PARAMS_PATH):
        with open(PARAMS_PATH) as f:
            return json.load(f)
    return {"text_temperature": 1.0, "audio_temperature": 1.0}


# =============================================================================
# SECTION 4 - THE FUSION RULE
# =============================================================================

def fuse_predictions(text_probs, audio_logits, text_labels, audio_classes, params):
    """
    Applies the fusion rule to N recordings at once.

    text_probs   : (N, 27) sigmoid outputs of the text model
    audio_logits : (N, 7)  raw outputs of the audio model (neutral included)

    Returns a dict of arrays: fused probabilities (N, 6), the fused / text /
    audio top emotion indices, and the decision taken for each recording:
    "voice_neutral" (text decided alone), "agree" or "conflict".
    """
    shared = shared_classes_from_audio(audio_classes)
    groups = build_group_index(text_labels, shared)
    neutral_idx = audio_classes.index(EXCLUDED_CLASS)
    keep = [audio_classes.index(c) for c in shared]

    # Text: 27 -> 6, then calibrate
    p_text = apply_temperature_to_probs(text27_to_shared(text_probs, groups),
                                        params["text_temperature"])

    # Audio: calibrate over all 7, note whether neutral won, then keep the 6
    p_audio7 = softmax(audio_logits / params["audio_temperature"])
    voice_neutral = p_audio7.argmax(axis=1) == neutral_idx
    p_audio = p_audio7[:, keep]
    p_audio = p_audio / p_audio.sum(axis=1, keepdims=True)

    text_top = p_text.argmax(axis=1)
    audio_top = p_audio.argmax(axis=1)

    # Combine: text weighted more; if the voice was neutral, text decides alone
    fused = TEXT_WEIGHT * p_text + (1.0 - TEXT_WEIGHT) * p_audio
    fused[voice_neutral] = p_text[voice_neutral]

    decision = np.where(voice_neutral, "voice_neutral",
                        np.where(text_top == audio_top, "agree", "conflict"))
    return {
        "shared_classes": shared,
        "p_text": p_text, "p_audio": p_audio, "p_fused": fused,
        "text_top": text_top, "audio_top": audio_top,
        "fused_top": fused.argmax(axis=1), "decision": decision,
    }


# =============================================================================
# SECTION 5 - TEXT MODEL
# =============================================================================

class SoulScribeV8(nn.Module):
    """Same architecture as the trained text model (copied unchanged)."""
    def __init__(self):
        super().__init__()
        self.roberta = RobertaModel.from_pretrained("roberta-large", output_hidden_states=True)
        self.gru = nn.GRU(input_size=1024, hidden_size=512, num_layers=1,
                          bidirectional=True, batch_first=True)
        self.attn = nn.Linear(1024, 1)
        self.dropout = nn.Dropout(0.3)
        self.projection = nn.Sequential(
            nn.Linear(1024, 512), nn.ReLU(), nn.Dropout(0.2), nn.Linear(512, 27),
        )
        self.temperature = nn.Parameter(torch.tensor(1.0))

    def forward(self, input_ids, attention_mask):
        output = self.roberta(input_ids=input_ids, attention_mask=attention_mask)
        hidden_states = torch.stack(output.hidden_states[-4:]).mean(0)
        x = hidden_states * attention_mask.unsqueeze(-1).float()
        gru_out, _ = self.gru(x)
        attn_scores = self.attn(gru_out).squeeze(-1)
        attn_weights = torch.softmax(attn_scores.masked_fill(attention_mask == 0, -1e9), dim=1)
        context = torch.sum(gru_out * attn_weights.unsqueeze(-1), dim=1)
        context = self.dropout(context)
        logits = self.projection(context) / self.temperature
        return torch.sigmoid(logits)


def clean_text(text):
    """
    Same preprocessing as the training CSV's cleaned_text column
    (checked: reproduces 99.999% of training rows exactly).
    """
    text = str(text).replace("\u0092", "'").replace("’", "'")
    text = emoji.demojize(text.lower())
    text = re.sub(r"[^a-z_:\s]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def load_text_model():
    model = SoulScribeV8()
    model.load_state_dict(torch.load(TEXT_WEIGHTS_PATH, map_location=DEVICE))
    model.to(DEVICE).eval()
    tokenizer = AutoTokenizer.from_pretrained(TEXT_TOKENIZER)
    with open(TEXT_LABELS_PATH) as f:
        labels = json.load(f)
    with open(TEXT_THRESHOLDS_PATH) as f:
        thresholds = np.array(json.load(f))

    # Same safety step as routes/predict.py: the model has 27 outputs, so if the
    # label file also lists "neutral", drop it (and its threshold) to keep the
    # label order lined up with the model's output columns.
    if "neutral" in labels:
        keep = [i for i, label in enumerate(labels) if label != "neutral"]
        labels = [labels[i] for i in keep]
        thresholds = thresholds[keep]
    if len(labels) != 27 or len(thresholds) != 27:
        raise ValueError(f"Expected 27 text labels and thresholds, got "
                         f"{len(labels)} labels and {len(thresholds)} thresholds")
    return model, tokenizer, labels, thresholds


@torch.no_grad()
def text_predict(model, tokenizer, texts):
    """Returns sigmoid probabilities, shape (N, 27)."""
    all_probs = []
    for start in tqdm(range(0, len(texts), TEXT_BATCH_SIZE), desc="  Text model"):
        batch = [clean_text(t) for t in texts[start:start + TEXT_BATCH_SIZE]]
        enc = tokenizer(batch, padding=True, truncation=True,
                        max_length=TEXT_MAX_LEN, return_tensors="pt")
        probs = model(enc["input_ids"].to(DEVICE), enc["attention_mask"].to(DEVICE))
        all_probs.append(probs.float().cpu().numpy())
    return np.concatenate(all_probs, axis=0)


# =============================================================================
# SECTION 6 - AUDIO MODEL
# =============================================================================

def load_audio_model():
    classes = [str(c) for c in np.load(AUDIO_CLASSES_PATH, allow_pickle=True)]
    model = audio_mod.WavLMEmotionClassifier(
        model_path=audio_mod.MODEL_PATH,
        num_classes=len(classes),
        hidden_dim=audio_mod.HIDDEN_DIM,
        dropout=audio_mod.DROPOUT,
        unfreeze_last_n=audio_mod.UNFREEZE_LAST_N_LAYERS,
        use_layer_weights=audio_mod.USE_LAYER_WEIGHTS,
        use_spec_augment=audio_mod.USE_SPEC_AUGMENT,
    )
    model.load_state_dict(torch.load(AUDIO_WEIGHTS_PATH, map_location=DEVICE))
    model.to(DEVICE).eval()
    processor = Wav2Vec2FeatureExtractor.from_pretrained(audio_mod.PROCESSOR_PATH)
    return model, processor, classes


@torch.no_grad()
def audio_predict(model, processor, waveforms):
    """
    waveforms: list of 1-D tensors from audio_mod.load_audio().
    Returns raw logits for all 7 audio classes, shape (N, 7).
    Same preprocessing as training.
    """
    all_logits = []
    for start in tqdm(range(0, len(waveforms), AUDIO_BATCH_SIZE), desc="  Audio model"):
        batch = waveforms[start:start + AUDIO_BATCH_SIZE]
        enc = processor([w.numpy() for w in batch], sampling_rate=audio_mod.TARGET_SAMPLE_RATE,
                        return_tensors="pt", padding=True, return_attention_mask=True)
        logits = model(enc["input_values"].to(DEVICE), enc["attention_mask"].to(DEVICE))
        all_logits.append(logits.float().cpu().numpy())
    return np.concatenate(all_logits, axis=0)


# =============================================================================
# SECTION 7 - PREDICT MODE (one recording) and FOLDER MODE (a test set)
# =============================================================================

AUDIO_EXTENSIONS = (".wav", ".flac", ".ogg")


def load_everything():
    """Loads Whisper and both models once, so a whole folder reuses them."""
    from transformers import pipeline
    # chunk_length_s=30: Whisper only hears 30 s at a time; this makes the pipeline
    # cut longer recordings into 30 s pieces instead of dropping everything after 30 s.
    asr = pipeline("automatic-speech-recognition", model=WHISPER_MODEL,
                   chunk_length_s=30,
                   device=0 if DEVICE == "cuda" else -1)
    text_model, tokenizer, text_labels, thresholds = load_text_model()
    audio_model, processor, audio_classes = load_audio_model()
    return {
        "asr": asr, "text_model": text_model, "tokenizer": tokenizer,
        "text_labels": text_labels, "thresholds": thresholds,
        "audio_model": audio_model, "processor": processor,
        "audio_classes": audio_classes, "params": load_params(),
    }


def split_sentences(text):
    """Same sentence split as routes/predict.py (split BEFORE cleaning removes the punctuation)."""
    sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', text.strip()) if s.strip()]
    return sentences if sentences else [text]


SUBTLE_BOOST_LABELS = {"realization", "relief", "optimism", "caring", "pride"}
FINE_TOP_K = 3


def pick_fine_grained(probs, labels, thresholds, top_k=FINE_TOP_K):
    """
    Same rule as predict_emotions() in routes/predict.py, so a spoken entry and a
    typed entry show fine-grained emotions the same way:
      1. a label counts if its probability reaches its threshold
         (subtle labels get a 15% lower threshold)
      2. if fewer than top_k labels counted, fill up with the highest-scoring ones
    Returns a list of (label, score), strongest first.
    """
    fine = []
    for i in range(len(labels)):
        threshold = thresholds[i] * 0.85 if labels[i] in SUBTLE_BOOST_LABELS else thresholds[i]
        if probs[i] >= threshold:
            fine.append((labels[i], float(probs[i])))

    if len(fine) < top_k:
        already = [label for label, _ in fine]
        top_indices = np.argsort(probs)[-top_k:][::-1]
        for i in top_indices:
            if labels[i] not in already:
                fine.append((labels[i], float(probs[i])))

    fine.sort(key=lambda x: -x[1])
    return fine


def analyse_recording(b, wav_path):
    """Runs the full pipeline on one recording and returns a result dict."""
    wav = audio_mod.load_audio(wav_path)
    if wav is None:
        raise ValueError("Recording is too short to analyse.")
    transcript = b["asr"](wav_path)["text"].strip()

    audio_logits = audio_predict(b["audio_model"], b["processor"], [wav])

    # No words to read (silence, or only noise): the text model has nothing to
    # judge, so the voice decides alone.
    if not re.search(r"[A-Za-z]", transcript):
        shared = shared_classes_from_audio(b["audio_classes"])
        p_audio7 = softmax(audio_logits / b["params"]["audio_temperature"])[0]
        voice_raw = b["audio_classes"][int(p_audio7.argmax())]
        keep = [b["audio_classes"].index(c) for c in shared]
        voice_says = shared[int(np.argmax(p_audio7[keep]))]
        return {
            "transcript": transcript,
            "emotion": voice_raw,              # can be "neutral" only in this case
            "decision": "no_speech",
            "text_says": None,
            "voice_says": voice_says,
            "voice_raw": voice_raw,
            "fused_scores": {},
            "fine_grained_emotions": [],
        }

    # Same as routes/predict.py: score each sentence, then average. One long
    # transcript in a single pass would be cut off at TEXT_MAX_LEN tokens.
    sentences = split_sentences(transcript)
    sentence_probs = text_predict(b["text_model"], b["tokenizer"], sentences)
    text_probs = sentence_probs.mean(axis=0, keepdims=True)
    r = fuse_predictions(text_probs, audio_logits, b["text_labels"],
                         b["audio_classes"], b["params"])
    shared = r["shared_classes"]

    fine = pick_fine_grained(text_probs[0], b["text_labels"], b["thresholds"])

    return {
        "transcript": transcript,
        "emotion": shared[int(r["fused_top"][0])],
        "decision": str(r["decision"][0]),
        "text_says": shared[int(r["text_top"][0])],
        # voice's top guess among the 6 shared emotions (used for scoring)
        "voice_says": shared[int(r["audio_top"][0])],
        # voice's raw top guess, which can be neutral (shown for information)
        "voice_raw": (EXCLUDED_CLASS if r["decision"][0] == "voice_neutral"
                      else shared[int(r["audio_top"][0])]),
        "fused_scores": {c: round(float(p), 4) for c, p in zip(shared, r["p_fused"][0])},
        "fine_grained_emotions": [{"label": l, "score": round(s, 4)} for l, s in fine],
    }


def predict(wav_path):
    # Command-line use only: this loads all three models every time it runs.
    # A server must call load_everything() ONCE at startup and then
    # analyse_recording(bundle, wav_path) for each request.
    result = analyse_recording(load_everything(), wav_path)
    print(json.dumps(result, indent=2))
    return result


def run_folder(folder):
    """
    Scores a folder of self-recorded clips. Each file name must start with the
    intended emotion followed by an underscore, e.g. sad_01.wav, fear_03.wav.
    Accepted names: anger, disgust, fear, joy, sadness, surprise
    (also: angry, sad, happy, scared, surprised, disgusted).

    Writes folder_results.csv into the same folder and prints the accuracy of
    text alone, voice alone and the fused output.
    """
    aliases = {"angry": "anger", "sad": "sadness", "happy": "joy", "scared": "fear",
               "afraid": "fear", "surprised": "surprise", "disgusted": "disgust"}
    files = sorted(f for f in os.listdir(folder) if f.lower().endswith(AUDIO_EXTENSIONS))
    if not files:
        print(f"No {AUDIO_EXTENSIONS} files found in {folder}")
        return

    b = load_everything()
    shared = shared_classes_from_audio(b["audio_classes"])
    rows = []
    for name in tqdm(files, desc="Recordings"):
        intended = name.split("_")[0].lower()
        intended = aliases.get(intended, intended)
        if intended not in shared:
            print(f"  Skipping {name}: '{intended}' is not one of {shared}")
            continue
        try:
            r = analyse_recording(b, os.path.join(folder, name))
        except Exception as e:
            print(f"  Skipping {name}: {e}")
            continue
        rows.append({
            "file": name, "intended": intended, "transcript": r["transcript"],
            "text_says": r["text_says"] or "none", "voice_says": r["voice_says"],
            "voice_raw": r["voice_raw"], "decision": r["decision"],
            "fused": r["emotion"],
            "text_correct": r["text_says"] == intended,
            "voice_correct": r["voice_says"] == intended,
            "fused_correct": r["emotion"] == intended,
            "fine_grained": "; ".join(f"{e['label']} {e['score']:.2f}"
                                      for e in r["fine_grained_emotions"]),
        })

    df = pd.DataFrame(rows)
    out_csv = os.path.join(folder, "folder_results.csv")
    df.to_csv(out_csv, index=False)

    print("\n" + "=" * 60)
    print(f"Scored {len(df)} recordings")
    for name in ["text", "voice", "fused"]:
        y_true = df["intended"]
        y_pred = df["fused"] if name == "fused" else df[f"{name}_says"]
        label = "fused" if name == "fused" else f"{name}-only"
        print(f"  {label:>10s} accuracy: {df[f'{name}_correct'].mean():.3f}   "
              f"macro-F1: {f1_score(y_true, y_pred, labels=shared, average='macro', zero_division=0):.3f}")
    print("  decisions:", df["decision"].value_counts().to_dict())
    print(f"[Saved] {out_csv}")


# =============================================================================
# SECTION 8 - OPTIONAL: EVALUATE ON MELD (dev for calibration, test for results)
# =============================================================================

def score_meld_split(csv_path, audio_dir, shared, audio_classes, text_bundle, audio_bundle,
                     cache_path):
    """
    Runs both models on every non-neutral MELD utterance with a readable clip.
    The text model reads MELD's own transcript. Results are cached to .npz;
    delete the cache file to force a rerun.
    """
    if os.path.exists(cache_path):
        d = np.load(cache_path)
        return d["text_probs"], d["audio_logits"], d["labels"]

    df = pd.read_csv(csv_path, encoding="utf-8", encoding_errors="replace")
    texts, waves, labels, skipped = [], [], [], 0
    for _, row in tqdm(df.iterrows(), total=len(df), desc="  Loading clips"):
        if row["Emotion"] not in shared:                 # skips neutral
            skipped += 1
            continue
        path = audio_mod.build_audio_path(audio_dir, row["Dialogue_ID"], row["Utterance_ID"])
        wav = audio_mod.load_audio(path) if os.path.exists(path) else None
        if wav is None:
            skipped += 1
            continue
        texts.append(row["Utterance"])
        waves.append(wav)
        labels.append(shared.index(row["Emotion"]))
    print(f"[Data] {len(labels)} utterances kept, {skipped} skipped <- {csv_path}")

    text_probs = text_predict(text_bundle[0], text_bundle[1], texts)
    audio_logits = audio_predict(audio_bundle[0], audio_bundle[1], waves)
    labels = np.array(labels)
    np.savez(cache_path, text_probs=text_probs, audio_logits=audio_logits, labels=labels)
    return text_probs, audio_logits, labels


def fit_temperature(probs_fn, labels):
    """Temperature with the lowest negative log-likelihood on the dev set."""
    best_t, best_nll = 1.0, float("inf")
    for t in TEMPERATURE_GRID:
        p = probs_fn(t)
        nll = -np.mean(np.log(np.clip(p[np.arange(len(labels)), labels], 1e-9, None)))
        if nll < best_nll:
            best_t, best_nll = float(t), nll
    return best_t


def compute_metrics(labels, preds):
    return {
        "accuracy":        float(accuracy_score(labels, preds)),
        "macro_precision": float(precision_score(labels, preds, average="macro", zero_division=0)),
        "macro_recall":    float(recall_score(labels, preds, average="macro", zero_division=0)),
        "macro_f1":        float(f1_score(labels, preds, average="macro", zero_division=0)),
        "weighted_f1":     float(f1_score(labels, preds, average="weighted", zero_division=0)),
    }


def evaluate():
    global TEXT_WEIGHT
    os.makedirs(OUT_DIR, exist_ok=True)
    text_bundle = load_text_model()
    audio_bundle = load_audio_model()
    text_labels, audio_classes = text_bundle[2], audio_bundle[2]
    shared = shared_classes_from_audio(audio_classes)
    groups = build_group_index(text_labels, shared)
    print(f"[Setup] device={DEVICE} | shared classes={shared} | text weight={TEXT_WEIGHT}")

    dev = score_meld_split(DEV_CSV, DEV_AUDIO, shared, audio_classes, text_bundle,
                           audio_bundle, os.path.join(OUT_DIR, "dev_scores.npz"))
    test = score_meld_split(TEST_CSV, TEST_AUDIO, shared, audio_classes, text_bundle,
                            audio_bundle, os.path.join(OUT_DIR, "test_scores.npz"))

    # Calibration on dev (labels are 6-class; audio is fitted over its 7 outputs)
    dev_text6 = text27_to_shared(dev[0], groups)
    dev_labels7 = np.array([audio_classes.index(shared[i]) for i in dev[2]])
    params = {
        "text_temperature": fit_temperature(
            lambda t: apply_temperature_to_probs(dev_text6, t), dev[2]),
        "audio_temperature": fit_temperature(
            lambda t: softmax(dev[1] / t), dev_labels7),
    }
    with open(PARAMS_PATH, "w") as f:
        json.dump(params, f, indent=2)
    print(f"[Calibration] {params}")

    # Test results with the fixed rule
    labels = test[2]
    r = fuse_predictions(test[0], test[1], text_labels, audio_classes, params)
    results = {
        "n_test": int(len(labels)),
        "shared_classes": shared,
        "text_weight": TEXT_WEIGHT,
        "calibration": params,
        "text_only": compute_metrics(labels, r["text_top"]),
        "audio_only": compute_metrics(labels, r["audio_top"]),
        "fused": compute_metrics(labels, r["fused_top"]),
        "fused_per_class_f1": dict(zip(shared, f1_score(
            labels, r["fused_top"], average=None, labels=list(range(len(shared))),
            zero_division=0).round(4).tolist())),
        "decisions": {},
    }
    for name in ["agree", "conflict", "voice_neutral"]:
        m = r["decision"] == name
        entry = {"count": int(m.sum()), "share": round(float(m.mean()), 4)}
        if m.any():
            entry["fused_accuracy"] = round(float((r["fused_top"][m] == labels[m]).mean()), 4)
            entry["text_accuracy"] = round(float((r["text_top"][m] == labels[m]).mean()), 4)
            entry["audio_accuracy"] = round(float((r["audio_top"][m] == labels[m]).mean()), 4)
        results["decisions"][name] = entry

    # For reference only: how the fused score changes with other text weights
    chosen = TEXT_WEIGHT
    sweep = {}
    for w in np.round(np.arange(0.5, 1.001, 0.1), 1):
        TEXT_WEIGHT = float(w)
        rw = fuse_predictions(test[0], test[1], text_labels, audio_classes, params)
        sweep[str(w)] = round(compute_metrics(labels, rw["fused_top"])["macro_f1"], 4)
    TEXT_WEIGHT = chosen
    results["macro_f1_by_text_weight"] = sweep

    with open(RESULTS_PATH, "w") as f:
        json.dump(results, f, indent=2)
    with open(os.path.join(OUT_DIR, "classification_reports.txt"), "w") as f:
        for name, key in [("TEXT ONLY", "text_top"), ("AUDIO ONLY", "audio_top"),
                          ("FUSED", "fused_top")]:
            f.write(f"===== {name} =====\n")
            f.write(classification_report(labels, r[key], target_names=shared, zero_division=0))
            f.write("\n")
    save_confusion_matrix(labels, r["fused_top"], shared,
                          os.path.join(OUT_DIR, "confusion_fused.png"))

    for name in ["text_only", "audio_only", "fused"]:
        m = results[name]
        print(f"{name:>11s}: acc {m['accuracy']:.4f} | macro-F1 {m['macro_f1']:.4f} | "
              f"weighted-F1 {m['weighted_f1']:.4f}")
    print(f"  decisions: {results['decisions']}")
    print(f"[Saved] {OUT_DIR}/")


def save_confusion_matrix(labels, preds, classes, path):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import seaborn as sns
    cm = confusion_matrix(labels, preds, labels=list(range(len(classes))))
    cm_norm = cm.astype(float) / cm.sum(axis=1, keepdims=True).clip(min=1)
    fig, ax = plt.subplots(figsize=(8, 6.5))
    sns.heatmap(cm_norm, annot=cm, fmt="d", cmap="Blues",
                xticklabels=classes, yticklabels=classes, ax=ax, linewidths=0.5)
    ax.set_title("MELD test - fused prediction", fontsize=13, fontweight="bold")
    ax.set_xlabel("Predicted")
    ax.set_ylabel("True")
    plt.tight_layout()
    plt.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "predict":
        predict(sys.argv[2])
    elif len(sys.argv) >= 3 and sys.argv[1] == "folder":
        run_folder(sys.argv[2])
    elif len(sys.argv) >= 2 and sys.argv[1] == "evaluate":
        evaluate()
    else:
        print("Usage:\n  python fusion_pipeline.py predict clip.wav\n"
              "  python fusion_pipeline.py folder my_recordings/\n"
              "  python fusion_pipeline.py evaluate")
