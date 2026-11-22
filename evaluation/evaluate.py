import sys
from pathlib import Path
import librosa
import numpy as np
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)

# Ensure project root is on sys.path so `backend` can be imported cleanly
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.detector import SAMPLE_RATE, SPOOF_THRESHOLD, get_detector

AUDIO_EXTS = {".wav", ".mp3", ".ogg", ".flac", ".m4a"}
SEGMENT_DURATION_SEC = 3.0
SEGMENT_HOP_SEC = 1.5


def build_segments(audio_path: Path, sample_rate: int = SAMPLE_RATE) -> list[dict[str, object]]:
    """Load audio at 16kHz mono and split into overlapping segments for analyze_segments()."""
    y, sr = librosa.load(str(audio_path), sr=sample_rate, mono=True)
    if y.size == 0:
        raise ValueError("Empty audio signal")

    total_sec = float(y.size) / float(sr)
    seg_len = int(SEGMENT_DURATION_SEC * sr)
    hop_len = int(SEGMENT_HOP_SEC * sr)

    segments: list[dict[str, object]] = []
    if y.size <= seg_len:
        segments.append({
            "start_sec": 0.0,
            "end_sec": round(total_sec, 2),
            "samples": y,
        })
        return segments

    start_idx = 0
    while start_idx < y.size:
        end_idx = min(start_idx + seg_len, y.size)
        seg_samples = y[start_idx:end_idx]
        if seg_samples.size > 0:
            segments.append({
                "start_sec": round(start_idx / sr, 2),
                "end_sec": round(end_idx / sr, 2),
                "samples": seg_samples,
            })
        if end_idx >= y.size:
            break
        start_idx += hop_len

    return segments


def compute_eer(y_true: np.ndarray, y_scores: np.ndarray) -> tuple[float, float]:
    """Compute Equal Error Rate (EER) and its corresponding threshold."""
    fpr, tpr, thresholds = roc_curve(y_true, y_scores, pos_label=1)
    fnr = 1.0 - tpr
    idx = int(np.nanargmin(np.abs(fnr - fpr)))
    eer = float((fpr[idx] + fnr[idx]) / 2.0)
    eer_threshold = float(thresholds[idx]) if idx < len(thresholds) else SPOOF_THRESHOLD
    return eer, eer_threshold


def collect_samples(base_dir: Path) -> list[tuple[Path, int]]:
    samples: list[tuple[Path, int]] = []
    genuine_dir = base_dir / "genuine"
    synthetic_dir = base_dir / "synthetic"

    for p in sorted(genuine_dir.glob("*")):
        if p.is_file() and p.suffix.lower() in AUDIO_EXTS:
            samples.append((p, 0))

    for p in sorted(synthetic_dir.glob("*")):
        if p.is_file() and p.suffix.lower() in AUDIO_EXTS:
            samples.append((p, 1))

    return samples


def main() -> None:
    eval_dir = Path(__file__).resolve().parent
    audio_root = eval_dir / "test_audio"
    samples = collect_samples(audio_root)

    if len(samples) < 2:
        print(f"Add audio files to {audio_root / 'genuine'} and {audio_root / 'synthetic'} first.")
        return

    detector = get_detector()
    y_true: list[int] = []
    y_scores: list[float] = []

    for audio_path, label in samples:
        try:
            segments = build_segments(audio_path, sample_rate=SAMPLE_RATE)
            spoof_prob, _, verdict, _ = detector.analyze_segments(segments)
            prob = float(spoof_prob)
            y_true.append(label)
            y_scores.append(prob)
            tag = "SYNTH" if label == 1 else "GENUINE"
            print(f"[{tag}] {audio_path.name}: spoof_prob={prob:.4f} (verdict={verdict})")
        except Exception as exc:
            print(f"[ERROR] {audio_path.name}: {exc}")

    y_true_arr = np.array(y_true, dtype=int)
    y_scores_arr = np.array(y_scores, dtype=float)

    if len(np.unique(y_true_arr)) < 2:
        print("\nNeed at least one GENUINE and one SYNTHETIC sample to compute ROC-AUC and EER.")
        return

    y_pred_th = (y_scores_arr >= SPOOF_THRESHOLD).astype(int)
    roc_auc = float(roc_auc_score(y_true_arr, y_scores_arr))
    f1 = float(f1_score(y_true_arr, y_pred_th, zero_division=0))
    precision = float(precision_score(y_true_arr, y_pred_th, zero_division=0))
    recall = float(recall_score(y_true_arr, y_pred_th, zero_division=0))
    acc = float(accuracy_score(y_true_arr, y_pred_th))
    eer, eer_thresh = compute_eer(y_true_arr, y_scores_arr)
    tn, fp, fn, tp = confusion_matrix(y_true_arr, y_pred_th, labels=[0, 1]).ravel()

    print(f"\n=== Evaluation Summary (Threshold = {SPOOF_THRESHOLD:.2f}) ===")
    print(f"Total Samples : {len(y_true_arr)} (Genuine={np.sum(y_true_arr == 0)}, Synthetic={np.sum(y_true_arr == 1)})")
    print(f"ROC-AUC       : {roc_auc:.4f}")
    print(f"EER           : {eer:.4f} (at threshold ~ {eer_thresh:.4f})")
    print(f"F1-Score      : {f1:.4f}")
    print(f"Accuracy      : {acc:.4f}")
    print(f"Precision     : {precision:.4f}")
    print(f"Recall        : {recall:.4f}")
    print(f"Confusion Mat : TP={tp}, FP={fp}, TN={tn}, FN={fn}")


if __name__ == "__main__":
    main()