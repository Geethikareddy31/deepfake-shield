# DeepFake Shield — API Specification (`v1`)

Base URL (local): `http://localhost:8000`

---

## 1. `POST /api/v1/analyze`
Accepts a `multipart/form-data` audio file upload (`file`) and returns deepfake analysis results.

### Response JSON (`200 OK`)
```json
{
  "scan_id": "uuid",
  "filename": "sample.wav",
  "duration_sec": 12.4,
  "verdict": "SYNTHETIC_SCAM",
  "spoof_probability": 0.91,
  "confidence": 0.91,
  "segments": [
    {
      "start_sec": 0.0,
      "end_sec": 3.0,
      "spoof_prob": 0.88,
      "flag": true
    }
  ],
  "spectrogram_base64": "<png_base64>"
}