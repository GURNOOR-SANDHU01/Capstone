# =============================================================================
# Audio Emotion Classification Pipeline
# Model     : microsoft/wavlm-large
# Pooling   : Attentive Statistics Pooling  (mean + std, attention-weighted)
# Technique : Weighted-layer aggregation across all transformer layers
# Dataset   : MELD  (wav files named  dia{D}_utt{U}.wav)
# GPU       : NVIDIA A100 / any CUDA GPU with 16 GB+ VRAM
# Reference : "Adapting WavLM for Speech Emotion Recognition" (Odyssey 2024)
#             "Attentive Statistics Pooling" (Okabe et al., Interspeech 2018)
#
# Usage
# -----
#   python wavlm_attentive_emotion_pipeline.py                    # train + evaluate
#   python wavlm_attentive_emotion_pipeline.py predict clip.wav   # emotion of one recording
# =============================================================================

import os
import sys
import random
import warnings
import shutil
import soundfile as sf
import numpy as np
import pandas as pd
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
from tqdm import tqdm

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR


from transformers import Wav2Vec2FeatureExtractor, WavLMModel

from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    classification_report, confusion_matrix,
    precision_score, recall_score, f1_score, accuracy_score,
)

warnings.filterwarnings("ignore")


# =============================================================================
# SECTION 1 — CONFIGURATION
# =============================================================================

BASE_DIR        = "/workspace"
TRAIN_AUDIO_DIR = os.path.join(BASE_DIR, "train")
DEV_AUDIO_DIR   = os.path.join(BASE_DIR, "dev")
TEST_AUDIO_DIR  = os.path.join(BASE_DIR, "test")
TRAIN_CSV_PATH  = os.path.join(BASE_DIR, "data", "train_sent_emo.csv")
DEV_CSV_PATH    = os.path.join(BASE_DIR, "data", "dev_sent_emo.csv")
TEST_CSV_PATH   = os.path.join(BASE_DIR, "data", "test_sent_emo.csv")
OUTPUT_DIR      = os.path.join(BASE_DIR, "data", "model_outputs", "wavlm_attentive")

MODEL_PATH = "/workspace/models/wavlm-large"   # 300M params, 94k hrs pre-training
PROCESSOR_PATH = "/workspace/models/wavlm-large"

CHECKPOINT_PATH      = os.path.join(OUTPUT_DIR, "wavlm_checkpoint.pt")
SAVED_MODEL_PATH     = os.path.join(OUTPUT_DIR, "wavlm_saved_model.pt")
BEST_MODEL_PATH      = os.path.join(OUTPUT_DIR, "wavlm_best_weights.pt")
LABEL_ENCODER_PATH   = os.path.join(OUTPUT_DIR, "label_encoder_classes.npy")

# ── Reproducibility ───────────────────────────────────────────────────────────
RANDOM_SEED = 42

# ── Audio ─────────────────────────────────────────────────────────────────────
TARGET_SAMPLE_RATE = 16_000
MAX_AUDIO_DURATION = 12.0           # longer clips → more prosodic context (A100 can handle)
MIN_AUDIO_DURATION = 0.1
MAX_AUDIO_SAMPLES  = int(TARGET_SAMPLE_RATE * MAX_AUDIO_DURATION)

# ── SpecAugment ───────────────────────────────────────────────────────────────
USE_SPEC_AUGMENT       = True
FREQ_MASK_PARAM        = 27         # max frequency mask width  (F in paper)
TIME_MASK_PARAM        = 100        # max time mask width       (T in paper)
NUM_FREQ_MASKS         = 2
NUM_TIME_MASKS         = 2

# ── DataLoaders ───────────────────────────────────────────────────────────────
TRAIN_BATCH_SIZE = 16               # A100 40 GB MIG can handle 16 easily
VALID_BATCH_SIZE = 32
TEST_BATCH_SIZE  = 32
NUM_WORKERS      = 4

# ── Model architecture ────────────────────────────────────────────────────────
NUM_CLASSES    = None               # auto-detected
HIDDEN_DIM     = 256                # FC head hidden dim
DROPOUT        = 0.1                # dropout in head + attentive pooling
# Weighted-layer aggregation: learn a scalar weight per transformer layer
# so the model can pick the most emotion-relevant representation depth.
USE_LAYER_WEIGHTS = True            # True = learnable weighted sum of all layers
# Freeze strategy:
#   0  → freeze entire encoder
#  -1  → full fine-tune  ← recommended with A100
UNFREEZE_LAST_N_LAYERS = -1

# ── Optimiser & scheduler ─────────────────────────────────────────────────────
LEARNING_RATE           = 3e-5      # lower than before — full fine-tune
WEIGHT_DECAY            = 1e-2
NUM_EPOCHS              = 30
EARLY_STOPPING_PATIENCE = 5
LR_WARMUP_EPOCHS        = 2         # linear warmup before cosine annealing

# ── Mixed precision ───────────────────────────────────────────────────────────
USE_AMP = True                      # torch.autocast — ~1.5× speedup on A100

# ── Hardware ──────────────────────────────────────────────────────────────────
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# ── MELD CSV columns ──────────────────────────────────────────────────────────
LABEL_COLUMN  = "Emotion"
DIALOGUE_COL  = "Dialogue_ID"
UTTERANCE_COL = "Utterance_ID"


# =============================================================================
# SECTION 2 — UTILITIES
# =============================================================================

def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark     = False


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def print_param_counts(model: nn.Module, label: str = "Model") -> None:
    total     = sum(p.numel() for p in model.parameters())
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"[{label}] Total params     : {total:,}")
    print(f"[{label}] Trainable params : {trainable:,}  ({100*trainable/total:.2f}%)")


# =============================================================================
# SECTION 3 — DATA LOADING
# =============================================================================

def build_audio_path(audio_dir: str, dialogue_id: int, utterance_id: int) -> str:
    return os.path.join(audio_dir, f"dia{dialogue_id}_utt{utterance_id}.wav")


def load_csv(
    csv_path: str,
    audio_dir: str,
    label_encoder: LabelEncoder | None = None,
    fit_encoder: bool = False,
) -> tuple:
    """Load MELD CSV, build audio paths, drop missing files, encode labels."""
    df = pd.read_csv(csv_path)
    for col in [DIALOGUE_COL, UTTERANCE_COL, LABEL_COLUMN]:
        assert col in df.columns, f"Missing column: {col}"

    df["audio_path"] = df.apply(
        lambda r: build_audio_path(audio_dir, r[DIALOGUE_COL], r[UTTERANCE_COL]), axis=1
    )
    before = len(df)
    df = df[df["audio_path"].apply(os.path.exists)].reset_index(drop=True)
    if before - len(df):
        print(f"[Data] Dropped {before - len(df)} rows (file not found) from {csv_path}")

    if fit_encoder:
        label_encoder = LabelEncoder()
        df["label"] = label_encoder.fit_transform(df[LABEL_COLUMN])
    else:
        assert label_encoder is not None
        known = set(label_encoder.classes_)
        df = df[df[LABEL_COLUMN].isin(known)].reset_index(drop=True)
        df["label"] = label_encoder.transform(df[LABEL_COLUMN])

    print(f"[Data] {len(df):5d} samples ← {csv_path}")
    return df, label_encoder


# =============================================================================
# SECTION 4 — AUDIO LOADING & SPEC-AUGMENT
# =============================================================================

def load_audio(path: str) -> torch.Tensor | None:
    """Load wav → 16 kHz mono → fixed length tensor. Returns None if too short."""
    try:
        data, sr = sf.read(path, dtype="float32")
        if data.ndim > 1:
            data = data.mean(axis=1)          # stereo → mono
        wav = torch.from_numpy(data)
        if sr != TARGET_SAMPLE_RATE:
            wav = F.interpolate(
                wav.view(1, 1, -1),
                size=int(len(wav) * TARGET_SAMPLE_RATE / sr),
                mode="linear", align_corners=False,
            ).squeeze()
        if wav.shape[0] < int(TARGET_SAMPLE_RATE * MIN_AUDIO_DURATION):
            return None
        if wav.shape[0] > MAX_AUDIO_SAMPLES:
            wav = wav[:MAX_AUDIO_SAMPLES]
        else:
            wav = F.pad(wav, (0, MAX_AUDIO_SAMPLES - wav.shape[0]))
        return wav.float()
    except Exception as e:
        print(f"[Audio] Load error '{path}': {e}")
        return None


class SpecAugment(nn.Module):
    """
    SpecAugment applied to WavLM hidden-state feature sequences.
    Masks consecutive frequency (hidden-dim) and time (sequence) bins.
    Reference: Park et al. (2019) "SpecAugment: A Simple Data Augmentation
               Method for Automatic Speech Recognition"
    Applied AFTER the feature extractor CNN, BEFORE the transformer encoder.

    Pure-PyTorch implementation — no torchaudio dependency.
    """
    def __init__(
        self,
        freq_mask_param: int = FREQ_MASK_PARAM,
        time_mask_param: int = TIME_MASK_PARAM,
        num_freq_masks:  int = NUM_FREQ_MASKS,
        num_time_masks:  int = NUM_TIME_MASKS,
    ):
        super().__init__()
        self.freq_mask_param = freq_mask_param
        self.time_mask_param = time_mask_param
        self.num_freq_masks  = num_freq_masks
        self.num_time_masks  = num_time_masks

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """x: (B, T, H) feature sequence — treat H as freq axis, T as time axis."""
        if not self.training:
            return x
        x = x.clone()   # avoid in-place modification of autograd graph
        B, T, H = x.shape

        # Frequency masking: zero consecutive hidden-dim channels
        for _ in range(self.num_freq_masks):
            f = random.randint(0, min(self.freq_mask_param, H))
            f0 = random.randint(0, H - f) if f < H else 0
            x[:, :, f0:f0 + f] = 0.0

        # Time masking: zero consecutive time frames
        for _ in range(self.num_time_masks):
            t = random.randint(0, min(self.time_mask_param, T))
            t0 = random.randint(0, T - t) if t < T else 0
            x[:, t0:t0 + t, :] = 0.0

        return x


# =============================================================================
# SECTION 5 — DATASET & DATALOADER
# =============================================================================

class MELDDataset(Dataset):
    """
    Pre-loads all waveforms into memory.  WavLMProcessor normalisation is
    applied inside the collate function so dynamic batch padding is exact.
    """
    def __init__(self, df: pd.DataFrame):
        self.samples: list[tuple[torch.Tensor, int]] = []
        skipped = 0
        for _, row in tqdm(df.iterrows(), total=len(df), desc="  Loading audio", leave=False):
            wav = load_audio(row["audio_path"])
            if wav is None:
                skipped += 1
                continue
            self.samples.append((wav, int(row["label"])))
        if skipped:
            print(f"[Dataset] Skipped {skipped} clips.")

    def __len__(self):  return len(self.samples)
    def __getitem__(self, i): return self.samples[i]


def build_collate(processor: Wav2Vec2FeatureExtractor):
    """Batch-level processor call → proper attention masks + padding."""
    def collate(batch):
        wavs, labels = zip(*batch, strict=False)
        enc = processor(
            [w.numpy() for w in wavs],
            sampling_rate=TARGET_SAMPLE_RATE,
            return_tensors="pt",
            padding=True,
            return_attention_mask=True,
        )
        return {
            "input_values"  : enc["input_values"],
            "attention_mask": enc["attention_mask"],
            "labels"        : torch.tensor(labels, dtype=torch.long),
        }
    return collate


def build_dataloaders(train_df, dev_df, test_df, processor):
    print("\n[DataLoader] Building …")
    col = build_collate(processor)
    def _dl(df, bs, shuf):
        return DataLoader(
            MELDDataset(df), batch_size=bs, shuffle=shuf,
            num_workers=NUM_WORKERS, collate_fn=col,
            pin_memory=(DEVICE == "cuda"), persistent_workers=(NUM_WORKERS > 0),
        )
    return (
        _dl(train_df, TRAIN_BATCH_SIZE, True),
        _dl(dev_df,   VALID_BATCH_SIZE, False),
        _dl(test_df,  TEST_BATCH_SIZE,  False),
    )


# =============================================================================
# SECTION 6 — ATTENTIVE STATISTICS POOLING
# =============================================================================

class AttentiveStatisticsPooling(nn.Module):
    """
    Attentive Statistics Pooling — computes attention-weighted mean AND
    standard deviation, then concatenates them into a 2×H utterance vector.

    Reference: Okabe et al. "Attentive Statistics Pooling for Deep Speaker
               Embedding" Interspeech 2018.
    Used by: Odyssey 2024 WavLM SER baseline (Diatlova et al. 2024).

    Why better than mean-pooling
    ----------------------------
    * Mean-pooling treats all frames equally — silent or noisy frames dilute
      emotion-rich frames (e.g., the stressed syllable in an angry utterance).
    * Attentive pooling learns to up-weight emotionally salient frames.
    * The standard deviation captures within-utterance variability (pitch
      contour dynamics) — a strong prosodic cue for emotion intensity.

    Input  : hidden  (B, T, H)   — frame-level encoder output
             lengths (B,)        — valid frame lengths (excludes padding)
    Output : (B, 2H)             — [weighted_mean ‖ weighted_std]
    """
    def __init__(self, hidden_size: int, dropout: float = 0.0):
        super().__init__()
        # Single-layer attention scorer: H → 1 scalar per frame
        self.attention = nn.Sequential(
            nn.Linear(hidden_size, hidden_size),
            nn.Tanh(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size, 1),
        )

    def forward(self, hidden: torch.Tensor, lengths: torch.Tensor) -> torch.Tensor:
        # ── Build padding mask ────────────────────────────────────────────────
        B, T, H = hidden.shape
        mask = (
            torch.arange(T, device=hidden.device).unsqueeze(0)   # (1, T)
            < lengths.unsqueeze(1)                                # (B, 1)
        )                                                         # (B, T)

        # ── Compute per-frame attention scores ────────────────────────────────
        scores = self.attention(hidden).squeeze(-1)               # (B, T)
        scores = scores.masked_fill(~mask, float("-inf"))
        weights = torch.softmax(scores, dim=1)                    # (B, T)
        weights = weights * mask.float()                          # zero-out padding

        # ── Weighted mean ─────────────────────────────────────────────────────
        w = weights.unsqueeze(-1)                                 # (B, T, 1)
        mu = (hidden * w).sum(dim=1)                              # (B, H)

        # ── Weighted std  (var = E[x²] - E[x]²) ─────────────────────────────
        var = (hidden ** 2 * w).sum(dim=1) - mu ** 2
        std = torch.sqrt(var.clamp(min=1e-9))                    # (B, H)

        return torch.cat([mu, std], dim=-1)                       # (B, 2H)


# =============================================================================
# SECTION 7 — MODEL
# =============================================================================

def _freeze_encoder(encoder: WavLMModel, unfreeze_last_n: int) -> None:
    """
    Freeze the CNN feature extractor always (task-agnostic stable filters).
    Optionally freeze transformer layers.
    """
    for p in encoder.feature_extractor.parameters():
        p.requires_grad = False
    for p in encoder.feature_projection.parameters():
        p.requires_grad = False

    if unfreeze_last_n == -1:
        return  # full fine-tune of transformer

    layers = encoder.encoder.layers
    for p in encoder.encoder.parameters():
        p.requires_grad = False
    if unfreeze_last_n > 0:
        for layer in layers[len(layers) - unfreeze_last_n:]:
            for p in layer.parameters():
                p.requires_grad = True
        for p in encoder.encoder.layer_norm.parameters():
            p.requires_grad = True


class WavLMEmotionClassifier(nn.Module):
    """
    WavLM-large  +  Weighted-Layer Aggregation  +  Attentive Statistics Pooling
    +  FC classifier head.

    Architecture
    ────────────
    1. WavLM CNN feature extractor  (always frozen)
    2. WavLM transformer encoder  (24 layers for large)
       ├── SpecAugment injected on frame features before encoding  (train only)
       └── All 24 hidden states collected via output_hidden_states=True
    3. Weighted-layer aggregation
       Learns a softmax-normalised scalar weight w_l for each layer l.
       Final frame repr = Σ w_l · h_l   (B, T, 1024)
       Reference: Yang et al. "SUPERB" 2021 — learnable layer weights
       consistently outperform last-layer only for non-ASR tasks.
    4. Attentive Statistics Pooling  → (B, 2048)
    5. LayerNorm → Linear(2048, 256) → GELU → Dropout → Linear(256, C)

    All design choices are grounded in the Odyssey 2024 WavLM SER paper.
    """

    def __init__(
        self,
        model_path:       str,
        num_classes:      int,
        hidden_dim:       int,
        dropout:          float,
        unfreeze_last_n:  int,
        use_layer_weights:bool,
        use_spec_augment: bool,
    ):
        super().__init__()

        self.encoder          = WavLMModel.from_pretrained(model_path, output_hidden_states=True)
        self.use_layer_weights = use_layer_weights
        self.use_spec_augment  = use_spec_augment

        _freeze_encoder(self.encoder, unfreeze_last_n)

        n_layers    = self.encoder.config.num_hidden_layers   # 24 for large
        encoder_dim = self.encoder.config.hidden_size         # 1024 for large

        # ── Weighted-layer aggregation ────────────────────────────────────────
        if use_layer_weights:
            # One learnable scalar per transformer layer (exclude embedding)
            self.layer_weights = nn.Parameter(torch.ones(n_layers))

        # ── SpecAugment (applied to CNN feature maps before transformer) ──────
        if use_spec_augment:
            self.spec_augment = SpecAugment()

        # ── Attentive statistics pooling ──────────────────────────────────────
        # Input dim = encoder_dim;  output = 2 * encoder_dim
        self.pooling = AttentiveStatisticsPooling(encoder_dim, dropout=dropout)

        # ── Classification head ───────────────────────────────────────────────
        pool_out_dim = encoder_dim * 2   # mean + std concatenated
        self.head = nn.Sequential(
            nn.LayerNorm(pool_out_dim),
            nn.Linear(pool_out_dim, hidden_dim),
            nn.GELU(),                  # GELU > ReLU for transformer-based models
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, num_classes),
        )

    # ── Frame-length helper ───────────────────────────────────────────────────
    def _hidden_lengths(
        self, attention_mask: torch.Tensor
    ) -> torch.Tensor:
        """Map input waveform attention mask → hidden-state sequence lengths."""
        return self.encoder._get_feat_extract_output_lengths(
            attention_mask.sum(dim=1)
        ).long()

    def forward(
        self,
        input_values:   torch.Tensor,
        attention_mask: torch.Tensor,
    ) -> torch.Tensor:
        """Returns raw logits (B, num_classes)."""

        # ── Encoder forward ───────────────────────────────────────────────────
        enc_out = self.encoder(
            input_values   = input_values,
            attention_mask = attention_mask,
            output_hidden_states = True,
        )
        # enc_out.hidden_states: tuple of (n_layers+1) tensors, each (B, T, H)
        # Index 0 = CNN feature projection output; 1..24 = transformer layers
        hidden_states = enc_out.hidden_states[1:]   # transformer layers only

        # ── Optional SpecAugment on frame features ────────────────────────────
        if self.use_spec_augment and self.training:
            hidden_states = tuple(self.spec_augment(h) for h in hidden_states)

        # ── Weighted-layer aggregation ────────────────────────────────────────
        if self.use_layer_weights:
            weights = torch.softmax(self.layer_weights, dim=0)   # (n_layers,)
            # Stack to (B, n_layers, T, H), multiply, sum over layers
            stacked = torch.stack(hidden_states, dim=1)           # (B, L, T, H)
            hidden  = (stacked * weights.view(1, -1, 1, 1)).sum(dim=1)  # (B, T, H)
        else:
            hidden = enc_out.last_hidden_state                    # (B, T, H)

        # ── Attentive statistics pooling ──────────────────────────────────────
        lengths = self._hidden_lengths(attention_mask)            # (B,)
        pooled  = self.pooling(hidden, lengths)                   # (B, 2H)

        return self.head(pooled)                                  # (B, C)


# =============================================================================
# SECTION 8 — LOSS: FOCAL LOSS (handles MELD class imbalance better than CE)
# =============================================================================

class FocalLoss(nn.Module):
    """
    Focal Loss with per-class alpha weighting.
    Reference: Lin et al. "Focal Loss for Dense Object Detection" ICCV 2017.

    Reduces loss contribution from easy / majority-class samples so the
    model focuses on hard-to-classify minority emotions (disgust, fear).

    FL(p_t) = -alpha_t * (1 - p_t)^gamma * log(p_t)
    gamma=2.0 is the standard recommendation from the paper.
    """
    def __init__(self, alpha: torch.Tensor | None = None, gamma: float = 2.0):
        super().__init__()
        self.alpha = alpha      # (C,) class weights
        self.gamma = gamma

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        ce_loss = F.cross_entropy(logits, targets, weight=self.alpha, reduction="none")
        pt      = torch.exp(-ce_loss)
        return ((1 - pt) ** self.gamma * ce_loss).mean()


def build_focal_loss(train_loader: DataLoader, num_classes: int) -> FocalLoss:
    """Compute inverse-frequency class weights from the training set."""
    counts = torch.zeros(num_classes)
    for batch in train_loader:
        for lbl in batch["labels"]:
            counts[lbl.item()] += 1
    weights = (1.0 / counts.clamp(min=1.0))
    weights = (weights / weights.sum() * num_classes).to(DEVICE)
    print(f"[Loss] Focal loss class weights: {weights.round(decimals=3).tolist()}")
    return FocalLoss(alpha=weights, gamma=2.0)


# =============================================================================
# SECTION 9 — TRAINING & VALIDATION LOOPS
# =============================================================================

def train_one_epoch(
    model, loader, criterion, optimizer, scaler, scheduler_warmup, device
) -> tuple:
    model.train()
    total_loss = total_correct = total_samples = 0

    pbar = tqdm(loader, desc="  Train", leave=False, dynamic_ncols=True)
    for batch in pbar:
        iv  = batch["input_values"].to(device, non_blocking=True)
        am  = batch["attention_mask"].to(device, non_blocking=True)
        lbl = batch["labels"].to(device, non_blocking=True)

        optimizer.zero_grad()
        with torch.autocast(device_type="cuda", enabled=USE_AMP):
            logits = model(iv, am)
            loss   = criterion(logits, lbl)

        scaler.scale(loss).backward()
        scaler.unscale_(optimizer)
        nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        scaler.step(optimizer)
        scaler.update()

        if scheduler_warmup is not None:
            scheduler_warmup.step()

        preds = logits.argmax(1)
        total_correct  += (preds == lbl).sum().item()
        total_samples  += lbl.size(0)
        total_loss     += loss.item() * lbl.size(0)
        pbar.set_postfix(
            loss=f"{loss.item():.4f}",
            acc =f"{total_correct/total_samples:.4f}",
        )

    return total_loss / total_samples, total_correct / total_samples


@torch.no_grad()
def evaluate(model, loader, criterion, device,
             label_names=None, print_per_class=True) -> tuple:
    """
    Validation / test pass.
    Returns (avg_loss, avg_acc, macro_f1, weighted_f1, per_class_f1_dict).
    """
    model.eval()
    total_loss = total_correct = total_samples = 0
    all_preds, all_targets = [], []

    for batch in tqdm(loader, desc="  Eval ", leave=False, dynamic_ncols=True):
        iv  = batch["input_values"].to(device, non_blocking=True)
        am  = batch["attention_mask"].to(device, non_blocking=True)
        lbl = batch["labels"].to(device, non_blocking=True)

        with torch.autocast(device_type="cuda", enabled=USE_AMP):
            logits = model(iv, am)
            loss   = criterion(logits, lbl)

        preds = logits.argmax(1)
        total_correct  += (preds == lbl).sum().item()
        total_samples  += lbl.size(0)
        total_loss     += loss.item() * lbl.size(0)
        all_preds.extend(preds.cpu().numpy())
        all_targets.extend(lbl.cpu().numpy())

    n            = total_samples
    macro_f1     = f1_score(all_targets, all_preds, average="macro",    zero_division=0)
    weighted_f1  = f1_score(all_targets, all_preds, average="weighted", zero_division=0)
    pc_f1        = f1_score(all_targets, all_preds, average=None,       zero_division=0)
    names        = label_names if label_names else [str(i) for i in range(len(pc_f1))]
    pc_f1_dict   = {name: float(s) for name, s in zip(names, pc_f1, strict=False)}

    if print_per_class:
        print("  Per-class F1:")
        for name, score in pc_f1_dict.items():
            print(f"    {name:>14s}: {score:.4f}  " + "\u2588" * int(score * 20))

    return total_loss / n, total_correct / n, macro_f1, weighted_f1, pc_f1_dict



# =============================================================================
# SECTION 10 — CHECKPOINT HELPERS
# =============================================================================

def save_checkpoint(
        path, model, optimizer, scheduler, scaler, epoch,
        best_val_acc, best_val_loss,
        best_val_f1=0.0, best_val_weighted_f1=0.0,
        train_loss_history=None,      train_acc_history=None,
        val_loss_history=None,        val_acc_history=None,
        val_f1_history=None,          val_weighted_f1_history=None,
        val_per_class_f1_history=None,
) -> None:
    torch.save({
        # ── model / optimizer state ──────────────────────────────────────────
        "model_state_dict"        : model.state_dict(),
        "optimizer_state_dict"    : optimizer.state_dict(),
        "scheduler_state_dict"    : scheduler.state_dict(),
        "scaler_state_dict"       : scaler.state_dict(),
        # ── scalars ──────────────────────────────────────────────────────────
        "epoch"                   : epoch,
        "best_val_acc"            : best_val_acc,
        "best_val_loss"           : best_val_loss,
        "best_val_f1"             : best_val_f1,
        "best_val_weighted_f1"    : best_val_weighted_f1,
        # ── full history lists ────────────────────────────────────────────────
        "train_loss_history"      : train_loss_history       or [],
        "train_acc_history"       : train_acc_history        or [],
        "val_loss_history"        : val_loss_history         or [],
        "val_acc_history"         : val_acc_history          or [],
        "val_f1_history"          : val_f1_history           or [],
        "val_weighted_f1_history" : val_weighted_f1_history  or [],
        # list of dicts {class_name: f1} — one per epoch
        "val_per_class_f1_history": val_per_class_f1_history or [],
    }, path)


def load_checkpoint(path, model, optimizer, scheduler, scaler) -> dict:
    """
    Restore all states. Returns a dict with every saved field.
    All history lists fall back to [] for old checkpoints without them.
    """
    ckpt = torch.load(path, map_location=DEVICE)
    model.load_state_dict(ckpt["model_state_dict"])
    optimizer.load_state_dict(ckpt["optimizer_state_dict"])
    scheduler.load_state_dict(ckpt["scheduler_state_dict"])
    if "scaler_state_dict" in ckpt:
        scaler.load_state_dict(ckpt["scaler_state_dict"])

    out = {
        "start_epoch"             : ckpt["epoch"] + 1,
        "best_val_acc"            : ckpt.get("best_val_acc",             0.0),
        "best_val_loss"           : ckpt.get("best_val_loss",            float("inf")),
        "best_val_f1"             : ckpt.get("best_val_f1",              0.0),
        "best_val_weighted_f1"    : ckpt.get("best_val_weighted_f1",     0.0),
        "train_loss_history"      : ckpt.get("train_loss_history",       []),
        "train_acc_history"       : ckpt.get("train_acc_history",        []),
        "val_loss_history"        : ckpt.get("val_loss_history",         []),
        "val_acc_history"         : ckpt.get("val_acc_history",          []),
        "val_f1_history"          : ckpt.get("val_f1_history",           []),
        "val_weighted_f1_history" : ckpt.get("val_weighted_f1_history",  []),
        "val_per_class_f1_history": ckpt.get("val_per_class_f1_history", []),
    }
    print(
        f"[Checkpoint] Resumed from epoch {out['start_epoch']} | "
        f"best_val_acc={out['best_val_acc']:.4f} | "
        f"best_val_loss={out['best_val_loss']:.4f} | "
        f"best_val_f1={out['best_val_f1']:.4f} | "
        f"best_val_weighted_f1={out['best_val_weighted_f1']:.4f} | "
        f"history={len(out['train_loss_history'])} epochs"
    )
    return out


# =============================================================================
# SECTION 11 — LR WARMUP SCHEDULER
# =============================================================================

class LinearWarmupScheduler:
    """
    Linear warmup over `warmup_steps` steps, then hands off to a base scheduler.
    Avoids the large-gradient spike at the start of full fine-tune.
    """
    def __init__(self, optimizer, warmup_steps: int, base_lr: float):
        self.optimizer    = optimizer
        self.warmup_steps = warmup_steps
        self.base_lr      = base_lr
        self.current_step = 0

    def step(self):
        self.current_step += 1
        if self.current_step <= self.warmup_steps:
            lr = self.base_lr * (self.current_step / max(1, self.warmup_steps))
            for pg in self.optimizer.param_groups:
                pg["lr"] = lr

    def state_dict(self): return {"current_step": self.current_step}
    def load_state_dict(self, d): self.current_step = d["current_step"]


# =============================================================================
# SECTION 12 — TRAINING PIPELINE
# =============================================================================

def run_training(model, train_loader, val_loader, device, num_classes,
                 label_names=None) -> dict:
    """
    Full training loop:
      - Focal loss with inverse-frequency class weights
      - Linear LR warmup -> CosineAnnealingLR
      - AMP mixed precision (GradScaler)
      - Checkpoint auto-resume (every epoch, includes full history)
      - Best-model tracking on val macro-F1
      - Early stopping on val macro-F1
      - Per-class F1 printed every epoch
    """
    criterion = build_focal_loss(train_loader, num_classes)

    # AdamW with differential LR: lower for encoder, higher for head
    encoder_params     = list(model.encoder.parameters())
    non_encoder_params = [p for n, p in model.named_parameters()
                          if not n.startswith("encoder.")]
    optimizer = AdamW([
        {"params": encoder_params,     "lr": LEARNING_RATE},
        {"params": non_encoder_params, "lr": LEARNING_RATE * 10},
    ], weight_decay=WEIGHT_DECAY)

    scheduler = CosineAnnealingLR(optimizer, T_max=NUM_EPOCHS - LR_WARMUP_EPOCHS, eta_min=1e-7)
    scaler    = torch.cuda.amp.GradScaler(enabled=USE_AMP)

    warmup_steps     = LR_WARMUP_EPOCHS * len(train_loader)
    warmup_scheduler = LinearWarmupScheduler(optimizer, warmup_steps, LEARNING_RATE)
    in_warmup        = True

    # ── History ───────────────────────────────────────────────────────────────
    train_loss_history:       list = []
    train_acc_history:        list = []
    val_loss_history:         list = []
    val_acc_history:          list = []
    val_f1_history:           list = []
    val_weighted_f1_history:  list = []
    val_per_class_f1_history: list = []

    # ── Checkpoint resume ─────────────────────────────────────────────────────
    start_epoch          = 0
    best_val_acc         = 0.0
    best_val_loss        = float("inf")
    best_val_f1          = 0.0
    best_val_weighted_f1 = 0.0
    no_improve           = 0

    if os.path.exists(CHECKPOINT_PATH):
        print(f"[Checkpoint] Found — resuming from '{CHECKPOINT_PATH}' ...")
        state = load_checkpoint(CHECKPOINT_PATH, model, optimizer, scheduler, scaler)
        start_epoch              = state["start_epoch"]
        best_val_acc             = state["best_val_acc"]
        best_val_loss            = state["best_val_loss"]
        best_val_f1              = state["best_val_f1"]
        best_val_weighted_f1     = state["best_val_weighted_f1"]
        train_loss_history       = state["train_loss_history"]
        train_acc_history        = state["train_acc_history"]
        val_loss_history         = state["val_loss_history"]
        val_acc_history          = state["val_acc_history"]
        val_f1_history           = state["val_f1_history"]
        val_weighted_f1_history  = state["val_weighted_f1_history"]
        val_per_class_f1_history = state["val_per_class_f1_history"]
        in_warmup = start_epoch < LR_WARMUP_EPOCHS
        # Infer no_improve from weighted-F1 history (primary tracking metric)
        if val_weighted_f1_history:
            no_improve = max(0, start_epoch - int(np.argmax(val_weighted_f1_history) + 1))
    else:
        print("[Checkpoint] None found — training from scratch.")

    # ── Epoch loop ────────────────────────────────────────────────────────────
    for epoch in range(start_epoch, NUM_EPOCHS):
        print(f"\nEpoch [{epoch+1}/{NUM_EPOCHS}]  "
              f"LR={optimizer.param_groups[0]['lr']:.2e}")

        active_warmup = warmup_scheduler if in_warmup else None
        tr_loss, tr_acc = train_one_epoch(
            model, train_loader, criterion, optimizer, scaler, active_warmup, device
        )
        vl_loss, vl_acc, vl_f1, vl_wf1, vl_pc = evaluate(
            model, val_loader, criterion, device,
            label_names=label_names, print_per_class=True,
        )

        if epoch + 1 >= LR_WARMUP_EPOCHS:
            in_warmup = False
            scheduler.step()

        train_loss_history.append(tr_loss)
        train_acc_history.append(tr_acc)
        val_loss_history.append(vl_loss)
        val_acc_history.append(vl_acc)
        val_f1_history.append(vl_f1)
        val_weighted_f1_history.append(vl_wf1)
        val_per_class_f1_history.append(vl_pc)

        print(
            f"  Train Loss: {tr_loss:.4f}  Train Acc: {tr_acc:.4f} | "
            f"Val Loss: {vl_loss:.4f}  Val Acc: {vl_acc:.4f} | "
            f"Val F1(macro): {vl_f1:.4f}  Val F1(weighted): {vl_wf1:.4f}"
        )

        # ── Improvement check: primary = val weighted-F1 ──────────────────────
        improved = vl_wf1 > best_val_weighted_f1
        if improved:
            best_val_weighted_f1 = vl_wf1
            best_val_f1          = vl_f1
            best_val_acc         = vl_acc
            best_val_loss        = vl_loss
            no_improve           = 0
            shutil.copy(CHECKPOINT_PATH, SAVED_MODEL_PATH) if os.path.exists(CHECKPOINT_PATH) else None
            torch.save(model.state_dict(), BEST_MODEL_PATH)
            print(f"  [BEST] Saved — weighted_f1={best_val_weighted_f1:.4f}  f1={best_val_f1:.4f}"
                  f"  acc={best_val_acc:.4f}  loss={best_val_loss:.4f}")
        else:
            no_improve += 1
            print(f"  No improvement ({no_improve}/{EARLY_STOPPING_PATIENCE})")

        # ── Checkpoint every epoch (full history always preserved) ────────────
        save_checkpoint(
            CHECKPOINT_PATH, model, optimizer, scheduler, scaler,
            epoch, best_val_acc, best_val_loss,
            best_val_f1=best_val_f1,
            best_val_weighted_f1=best_val_weighted_f1,
            train_loss_history=train_loss_history,
            train_acc_history=train_acc_history,
            val_loss_history=val_loss_history,
            val_acc_history=val_acc_history,
            val_f1_history=val_f1_history,
            val_weighted_f1_history=val_weighted_f1_history,
            val_per_class_f1_history=val_per_class_f1_history,
        )

        if no_improve >= EARLY_STOPPING_PATIENCE:
            print(f"\n[Early Stop] Patience {EARLY_STOPPING_PATIENCE} exceeded.")
            break

    return {
        "train_loss_history"      : train_loss_history,
        "train_acc_history"       : train_acc_history,
        "val_loss_history"        : val_loss_history,
        "val_acc_history"         : val_acc_history,
        "val_f1_history"          : val_f1_history,
        "val_weighted_f1_history" : val_weighted_f1_history,
        "val_per_class_f1_history": val_per_class_f1_history,
    }


# =============================================================================
# SECTION 13 — TEST EVALUATION
# =============================================================================

@torch.no_grad()
def collect_predictions(model, loader, criterion, device) -> tuple:
    model.eval()
    all_preds, all_targets = [], []
    total_loss = total_samples = 0

    for batch in tqdm(loader, desc="  Test", dynamic_ncols=True):
        iv  = batch["input_values"].to(device, non_blocking=True)
        am  = batch["attention_mask"].to(device, non_blocking=True)
        lbl = batch["labels"].to(device, non_blocking=True)

        with torch.autocast(device_type="cuda", enabled=USE_AMP):
            logits = model(iv, am)
            loss   = criterion(logits, lbl)

        all_preds.extend(logits.argmax(1).cpu().numpy())
        all_targets.extend(lbl.cpu().numpy())
        total_loss   += loss.item() * lbl.size(0)
        total_samples += lbl.size(0)

    return np.array(all_preds), np.array(all_targets), total_loss / total_samples


def evaluate_test_set(model, test_loader, label_encoder, device, num_classes) -> dict:
    print(f"\n[Test] Loading best weights from '{BEST_MODEL_PATH}' …")
    model.load_state_dict(torch.load(BEST_MODEL_PATH, map_location=device))
    model.to(device)

    criterion = build_focal_loss(test_loader, num_classes)
    preds, targets, test_loss = collect_predictions(model, test_loader, criterion, device)

    class_names = list(label_encoder.classes_)
    acc      = accuracy_score(targets, preds)
    prec     = precision_score(targets, preds, average="macro", zero_division=0)
    rec      = recall_score(targets, preds, average="macro", zero_division=0)
    f1_mac   = f1_score(targets, preds, average="macro",    zero_division=0)
    f1_wt    = f1_score(targets, preds, average="weighted", zero_division=0)

    print("\n" + "="*60)
    print("TEST RESULTS")
    print("="*60)
    print(f"  Test Loss           : {test_loss:.4f}")
    print(f"  Test Accuracy       : {acc:.4f}")
    print(f"  Precision (macro)   : {prec:.4f}")
    print(f"  Recall    (macro)   : {rec:.4f}")
    print(f"  F1        (macro)   : {f1_mac:.4f}")
    print(f"  F1        (weighted): {f1_wt:.4f}")
    print("="*60)

    report = classification_report(targets, preds, target_names=class_names, zero_division=0)
    print("\nClassification Report:\n"); print(report)

    rep_path = os.path.join(OUTPUT_DIR, "classification_report.txt")
    with open(rep_path, "w") as f:
        f.write(report)
    print(f"[Saved] {rep_path}")

    return {
        "test_loss": test_loss, "test_acc": acc,
        "precision": prec,      "recall"  : rec,
        "f1_macro" : f1_mac,    "f1_weighted": f1_wt,
        "preds"    : preds,     "targets" : targets,
        "class_names": class_names,
    }


# =============================================================================
# SECTION 14 — PLOTTING
# =============================================================================

def plot_training_curves(history: dict) -> None:
    tl  = history["train_loss_history"]
    vl  = history["val_loss_history"]
    ta  = history["train_acc_history"]
    va  = history["val_acc_history"]
    vf1 = history.get("val_f1_history", [])
    vwf = history.get("val_weighted_f1_history", [])

    has_f1  = len(vf1) > 0
    ncols   = 3 if has_f1 else 2
    epochs  = range(1, len(tl) + 1)
    fig, axes = plt.subplots(1, ncols, figsize=(7 * ncols, 5))

    axes[0].plot(epochs, tl, "b-o", label="Train", linewidth=2)
    axes[0].plot(epochs, vl, "r-o", label="Val",   linewidth=2)
    axes[0].set_title("Focal Loss",            fontsize=13, fontweight="bold")
    axes[0].set_xlabel("Epoch"); axes[0].set_ylabel("Loss")
    axes[0].legend(); axes[0].grid(True, alpha=0.3)

    axes[1].plot(epochs, ta, "b-o", label="Train", linewidth=2)
    axes[1].plot(epochs, va, "r-o", label="Val",   linewidth=2)
    axes[1].set_title("Accuracy",              fontsize=13, fontweight="bold")
    axes[1].set_xlabel("Epoch"); axes[1].set_ylabel("Accuracy")
    axes[1].legend(); axes[1].grid(True, alpha=0.3)

    if has_f1:
        axes[2].plot(epochs, vf1, "g-o", label="Val Macro F1",    linewidth=2)
        axes[2].plot(epochs, vwf, "m-o", label="Val Weighted F1", linewidth=2)
        axes[2].set_title("Validation F1",     fontsize=13, fontweight="bold")
        axes[2].set_xlabel("Epoch"); axes[2].set_ylabel("F1 Score")
        axes[2].legend(); axes[2].grid(True, alpha=0.3)

    plt.suptitle("WavLM-large + Attentive Pooling — Training", fontsize=14, fontweight="bold")
    plt.tight_layout()
    p = os.path.join(OUTPUT_DIR, "training_curves.png")
    plt.savefig(p, dpi=150, bbox_inches="tight"); plt.close()
    print(f"[Saved] {p}")


def plot_confusion_matrix(preds, targets, class_names) -> None:
    cm      = confusion_matrix(targets, preds)
    cm_norm = cm.astype(float) / cm.sum(axis=1, keepdims=True).clip(min=1)

    fig, ax = plt.subplots(figsize=(10, 8))
    sns.heatmap(
        cm_norm, annot=cm, fmt="d", cmap="Blues",
        xticklabels=class_names, yticklabels=class_names,
        ax=ax, linewidths=0.5,
    )
    ax.set_title("Confusion Matrix (normalised colour, raw counts)",
                 fontsize=13, fontweight="bold")
    ax.set_xlabel("Predicted"); ax.set_ylabel("True")
    plt.xticks(rotation=45, ha="right"); plt.yticks(rotation=0)
    plt.tight_layout()
    p = os.path.join(OUTPUT_DIR, "confusion_matrix.png")
    plt.savefig(p, dpi=150, bbox_inches="tight"); plt.close()
    print(f"[Saved] {p}")


def plot_test_summary(metrics: dict) -> None:
    names  = ["Test Loss","Test Acc","Precision","Recall","F1 Macro","F1 Weighted"]
    values = [metrics["test_loss"], metrics["test_acc"], metrics["precision"],
              metrics["recall"],    metrics["f1_macro"],  metrics["f1_weighted"]]
    colors = ["#e74c3c","#3498db","#2ecc71","#f39c12","#9b59b6","#1abc9c"]

    fig, ax = plt.subplots(figsize=(11, 5))
    bars = ax.bar(names, values, color=colors, edgecolor="white", linewidth=1.5)
    for bar, val in zip(bars, values, strict=False):
        ax.text(bar.get_x()+bar.get_width()/2, bar.get_height()+0.01,
                f"{val:.4f}", ha="center", va="bottom", fontsize=10, fontweight="bold")
    ax.set_title("Test Set Evaluation — WavLM-large + Attentive Pooling",
                 fontsize=13, fontweight="bold")
    ax.set_ylabel("Score")
    ax.set_ylim(0, max(values)*1.2+0.05)
    ax.grid(axis="y", alpha=0.3)
    ax.spines["top"].set_visible(False); ax.spines["right"].set_visible(False)
    plt.tight_layout()
    p = os.path.join(OUTPUT_DIR, "test_summary.png")
    plt.savefig(p, dpi=150, bbox_inches="tight"); plt.close()
    print(f"[Saved] {p}")


def plot_class_distribution(train_df, label_encoder) -> None:
    counts      = train_df["label"].value_counts().sort_index()
    class_names = label_encoder.classes_
    fig, ax = plt.subplots(figsize=(10, 4))
    bars = ax.bar(class_names, counts.values, color="#3498db", edgecolor="white")
    for bar, val in zip(bars, counts.values, strict=False):
        ax.text(bar.get_x()+bar.get_width()/2, bar.get_height()+10,
                str(val), ha="center", va="bottom", fontsize=9)
    ax.set_title("Training Set — Class Distribution", fontsize=13, fontweight="bold")
    ax.set_xlabel("Emotion"); ax.set_ylabel("Count")
    ax.grid(axis="y", alpha=0.3)
    ax.spines["top"].set_visible(False); ax.spines["right"].set_visible(False)
    plt.tight_layout()
    p = os.path.join(OUTPUT_DIR, "class_distribution.png")
    plt.savefig(p, dpi=150, bbox_inches="tight"); plt.close()
    print(f"[Saved] {p}")


def plot_layer_weights(model: WavLMEmotionClassifier, label_encoder) -> None:
    """Visualise the learned per-layer importance weights."""
    if not model.use_layer_weights:
        return
    weights = torch.softmax(model.layer_weights.detach().cpu(), dim=0).numpy()
    n = len(weights)
    fig, ax = plt.subplots(figsize=(12, 4))
    ax.bar(range(1, n+1), weights, color="#9b59b6", edgecolor="white")
    ax.set_xlabel("Transformer Layer"); ax.set_ylabel("Softmax Weight")
    ax.set_title("Learned Layer Importance Weights (WavLM-large)",
                 fontsize=13, fontweight="bold")
    ax.grid(axis="y", alpha=0.3)
    plt.tight_layout()
    p = os.path.join(OUTPUT_DIR, "layer_weights.png")
    plt.savefig(p, dpi=150, bbox_inches="tight"); plt.close()
    print(f"[Saved] {p}")


# =============================================================================
# SECTION 15 — MAIN
# =============================================================================

def main():
    print("=" * 60)
    print(" WavLM-large  +  Attentive Statistics Pooling")
    print(" Weighted-Layer Aggregation  +  Focal Loss")
    print(f" Device : {DEVICE.upper()}")
    print("=" * 60)

    set_seed(RANDOM_SEED)
    ensure_dir(OUTPUT_DIR)

    # ── Data ──────────────────────────────────────────────────────────────────
    print("\n[Data] Loading CSVs …")
    train_df, label_encoder = load_csv(TRAIN_CSV_PATH, TRAIN_AUDIO_DIR, fit_encoder=True)
    dev_df,   _             = load_csv(DEV_CSV_PATH,   DEV_AUDIO_DIR,   label_encoder=label_encoder)
    test_df,  _             = load_csv(TEST_CSV_PATH,  TEST_AUDIO_DIR,  label_encoder=label_encoder)

    np.save(LABEL_ENCODER_PATH, label_encoder.classes_)
    print(f"[Data] Label encoder → {LABEL_ENCODER_PATH}")

    num_classes = len(label_encoder.classes_) if NUM_CLASSES is None else NUM_CLASSES
    label_names = list(label_encoder.classes_)
    print(f"[Data] Classes ({num_classes}): {label_names}")

    plot_class_distribution(train_df, label_encoder)

    # ── Processor ─────────────────────────────────────────────────────────────
    print(f"\n[Feature Extractor] Loading '{PROCESSOR_PATH}' ...")
    processor = Wav2Vec2FeatureExtractor.from_pretrained(PROCESSOR_PATH)

    # ── DataLoaders ───────────────────────────────────────────────────────────
    train_loader, val_loader, test_loader = build_dataloaders(
        train_df, dev_df, test_df, processor
    )

    # ── Model ─────────────────────────────────────────────────────────────────
    print(f"\n[Model] Loading '{MODEL_PATH}' …")
    print(f"        unfreeze_last_n={UNFREEZE_LAST_N_LAYERS}  "
          f"layer_weights={USE_LAYER_WEIGHTS}  spec_augment={USE_SPEC_AUGMENT}")
    model = WavLMEmotionClassifier(
        model_path        = MODEL_PATH,
        num_classes       = num_classes,
        hidden_dim        = HIDDEN_DIM,
        dropout           = DROPOUT,
        unfreeze_last_n   = UNFREEZE_LAST_N_LAYERS,
        use_layer_weights = USE_LAYER_WEIGHTS,
        use_spec_augment  = USE_SPEC_AUGMENT,
    ).to(DEVICE)

    print_param_counts(model, "WavLM-large")

    # ── Training ──────────────────────────────────────────────────────────────
    print("\n[Training] Starting …\n")
    history = run_training(model, train_loader, val_loader, DEVICE, num_classes,
                           label_names=label_names)
    plot_training_curves(history)

    # ── Evaluation ────────────────────────────────────────────────────────────
    print("\n[Evaluation] Test set …")
    metrics = evaluate_test_set(
        model, test_loader, label_encoder, DEVICE, num_classes
    )
    plot_confusion_matrix(metrics["preds"], metrics["targets"], metrics["class_names"])
    plot_test_summary(metrics)
    plot_layer_weights(model, label_encoder)

    print(f"\n[Done] Outputs → {OUTPUT_DIR}/")
    return history, metrics


# =============================================================================
# SECTION 16 — INFERENCE (predict the emotion of one recording)
# =============================================================================
# Uses the same model class and the same load_audio() as training, so a clip is
# prepared exactly the way the model saw clips during training (16 kHz, mono,
# cut or padded to 12 s).

def load_for_inference(weights_path=BEST_MODEL_PATH, labels_path=LABEL_ENCODER_PATH,
                       device=DEVICE) -> tuple:
    """
    Builds the model, loads the fine-tuned weights and switches to eval mode.
    Returns (model, processor, label_names). Call this ONCE, then reuse the result.
    """
    label_names = [str(c) for c in np.load(labels_path, allow_pickle=True)]
    print(f"[Inference] Classes ({len(label_names)}): {label_names}")

    model = WavLMEmotionClassifier(
        model_path        = MODEL_PATH,
        num_classes       = len(label_names),
        hidden_dim        = HIDDEN_DIM,
        dropout           = DROPOUT,
        unfreeze_last_n   = UNFREEZE_LAST_N_LAYERS,
        use_layer_weights = USE_LAYER_WEIGHTS,
        use_spec_augment  = USE_SPEC_AUGMENT,
    )
    model.load_state_dict(torch.load(weights_path, map_location=device))
    model.to(device).eval()

    processor = Wav2Vec2FeatureExtractor.from_pretrained(PROCESSOR_PATH)
    print(f"[Inference] Model loaded on {device}")
    return model, processor, label_names


@torch.no_grad()
def predict_emotion(audio_path, model, processor, label_names, device=DEVICE) -> dict:
    """
    Predicts the emotion of one audio file.
    Returns {"predicted": ..., "confidence": ..., "probabilities": {...}},
    or an empty dict if the clip could not be loaded or is too short.
    """
    wav = load_audio(audio_path)
    if wav is None:
        return {}

    enc = processor(
        wav.numpy(),
        sampling_rate=TARGET_SAMPLE_RATE,
        return_tensors="pt",
        padding=True,
        return_attention_mask=True,
    )
    logits = model(enc["input_values"].to(device), enc["attention_mask"].to(device))
    probs = torch.softmax(logits.float(), dim=-1)[0].cpu()      # one probability per class

    best_index = int(probs.argmax())
    probabilities = {}
    for i in range(len(label_names)):
        probabilities[label_names[i]] = float(probs[i])

    return {
        "predicted": label_names[best_index],
        "confidence": float(probs[best_index]),
        "probabilities": probabilities,
    }


def print_prediction(result: dict) -> None:
    if not result:
        print("[Inference] No result.")
        return
    print("\n" + "=" * 45)
    print(f"  Predicted Emotion : {result['predicted'].upper()}")
    print(f"  Confidence        : {result['confidence']:.2%}")
    print("  Class Probabilities:")
    ranked = sorted(result["probabilities"].items(), key=lambda item: -item[1])
    for name, prob in ranked:
        print(f"    {name:>12s}  {prob:.4f}  " + "\u2588" * int(prob * 30))
    print("=" * 45 + "\n")


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "predict":
        model, processor, label_names = load_for_inference()
        print_prediction(predict_emotion(sys.argv[2], model, processor, label_names))
    else:
        main()
