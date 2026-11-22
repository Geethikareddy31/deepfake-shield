import base64
import io
from typing import Dict, List, Tuple
import librosa
import librosa.display
import matplotlib
import numpy as np

matplotlib.use("Agg")
import matplotlib.pyplot as plt

TARGET_SR = 16000
WINDOW_SEC = 3.0
STEP_SEC = 1.5


def load_audio_16k(file_path: str) -> Tuple[np.ndarray, float]:
    """Load audio as 16kHz mono float32 and return (samples, duration_sec)."""
    audio, _ = librosa.load(file_path, sr=TARGET_SR, mono=True)
    audio = np.asarray(audio, dtype=np.float32)
    duration_sec = float(len(audio) / TARGET_SR) if len(audio) > 0 else 0.0
    return audio, duration_sec


def get_audio_segments(
    audio: np.ndarray,
    duration_sec: float,
    window_sec: float = WINDOW_SEC,
    step_sec: float = STEP_SEC,
) -> List[Dict[str, object]]:
    """Slice audio into fixed time windows and return segment metadata + sample arrays."""
    if len(audio) == 0 or duration_sec <= 0.0:
        return []

    win_samples = int(window_sec * TARGET_SR)
    step_samples = max(1, int(step_sec * TARGET_SR))
    segments: List[Dict[str, object]] = []

    if len(audio) <= win_samples:
        padded = np.pad(audio, (0, max(0, win_samples - len(audio))), mode="constant")
        segments.append({
            "start_sec": 0.0,
            "end_sec": round(duration_sec, 2),
            "samples": padded[:win_samples].astype(np.float32),
        })
        return segments

    for start_idx in range(0, len(audio) - win_samples + 1, step_samples):
        end_idx = start_idx + win_samples
        start_sec = round(start_idx / TARGET_SR, 2)
        end_sec = round(end_idx / TARGET_SR, 2)
        segments.append({
            "start_sec": start_sec,
            "end_sec": end_sec,
            "samples": audio[start_idx:end_idx].astype(np.float32),
        })

    # Include trailing audio if the end wasn't covered
    last_end_samples = int(segments[-1]["end_sec"] * TARGET_SR) if segments else 0
    if len(audio) - last_end_samples > int(0.5 * TARGET_SR):
        tail = audio[-win_samples:]
        if len(tail) < win_samples:
            tail = np.pad(tail, (0, win_samples - len(tail)), mode="constant")
        start_sec = round(max(0.0, duration_sec - window_sec), 2)
        end_sec = round(duration_sec, 2)
        segments.append({
            "start_sec": start_sec,
            "end_sec": end_sec,
            "samples": tail[:win_samples].astype(np.float32),
        })

    return segments


def generate_mel_spectrogram_base64(audio: np.ndarray) -> str:
    """Generate a PNG Mel-spectrogram and return it as a base64 string."""
    if len(audio) == 0:
        return ""

    mel = librosa.feature.melspectrogram(y=audio, sr=TARGET_SR, n_mels=128)
    mel_db = librosa.power_to_db(mel, ref=np.max)

    fig, ax = plt.subplots(figsize=(8, 3))
    img = librosa.display.specshow(mel_db, sr=TARGET_SR, x_axis="time", y_axis="mel", ax=ax)
    ax.set_title("Mel-Spectrogram (16kHz)")
    fig.colorbar(img, ax=ax, format="%+2.0f dB")
    fig.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=120)
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")