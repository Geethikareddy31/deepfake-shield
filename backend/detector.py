import logging
from typing import Dict, List, Tuple
import numpy as np
import torch
from transformers import AutoFeatureExtractor, AutoModelForAudioClassification

logger = logging.getLogger(__name__)

MODEL_ID = "garystafford/wav2vec2-deepfake-voice-detector"
SAMPLE_RATE = 16000
SPOOF_THRESHOLD = 0.5


class VoiceDeepfakeDetector:
    def __init__(self, model_id: str = MODEL_ID) -> None:
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info("Loading model '%s' on device '%s'", model_id, self.device)
        self.feature_extractor = AutoFeatureExtractor.from_pretrained(model_id)
        self.model = AutoModelForAudioClassification.from_pretrained(model_id).to(self.device)
        self.model.eval()
        self.fake_label_idx = self._resolve_fake_label_index(self.model.config.id2label)

    @staticmethod
    def _resolve_fake_label_index(id2label: Dict[int, str]) -> int:
        """Find which class index corresponds to fake/spoof using model.config.id2label."""
        for idx, label in id2label.items():
            normalized = str(label).strip().lower()
            if any(k in normalized for k in ("fake", "spoof", "synthetic", "ai")):
                return int(idx)
        # Fallback if labels are e.g. LABEL_0 / LABEL_1
        return 1 if len(id2label) > 1 else 0

    def predict_segment_prob(self, samples: np.ndarray) -> float:
        """Return spoof probability [0.0, 1.0] for a 1D 16kHz audio segment."""
        inputs = self.feature_extractor(
            samples,
            sampling_rate=SAMPLE_RATE,
            return_tensors="pt",
            padding=True,
        )
        input_values = inputs["input_values"].to(self.device)

        with torch.no_grad():
            logits = self.model(input_values).logits
            probs = torch.softmax(logits, dim=-1)[0]

        if probs.numel() == 1:
            spoof_prob = float(torch.sigmoid(probs[0]).item())
        else:
            spoof_prob = float(probs[self.fake_label_idx].item())

        return max(0.0, min(1.0, spoof_prob))

    def analyze_segments(
        self, raw_segments: List[Dict[str, object]]
    ) -> Tuple[float, float, str, List[Dict[str, object]]]:
        """Score each segment and return (spoof_probability, confidence, verdict, formatted_segments)."""
        if not raw_segments:
            return 0.0, 0.5, "GENUINE_HUMAN", []

        scored_segments: List[Dict[str, object]] = []
        probs: List[float] = []

        for seg in raw_segments:
            prob = self.predict_segment_prob(seg["samples"])  # type: ignore[arg-type]
            prob_rounded = round(prob, 4)
            probs.append(prob)
            scored_segments.append({
                "start_sec": seg["start_sec"],
                "end_sec": seg["end_sec"],
                "spoof_prob": prob_rounded,
                "flag": bool(prob >= SPOOF_THRESHOLD),
            })

        overall_spoof_prob = round(float(np.mean(probs)), 4)
        if overall_spoof_prob >= SPOOF_THRESHOLD:
            verdict = "SYNTHETIC_SCAM"
            confidence = round(overall_spoof_prob, 4)
        else:
            verdict = "GENUINE_HUMAN"
            confidence = round(1.0 - overall_spoof_prob, 4)

        return overall_spoof_prob, confidence, verdict, scored_segments


_detector_instance: VoiceDeepfakeDetector | None = None


def get_detector() -> VoiceDeepfakeDetector:
    global _detector_instance
    if _detector_instance is None:
        _detector_instance = VoiceDeepfakeDetector()
    return _detector_instance