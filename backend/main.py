import logging
import os
import tempfile
import uuid
from typing import List
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from audio_utils import generate_mel_spectrogram_base64, get_audio_segments, load_audio_16k
from db import ScanRecord, get_db, init_db
from detector import get_detector
from schemas import AnalyzeResponse, HistoryItem

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".wav", ".mp3", ".m4a", ".flac", ".ogg", ".mpeg", ".mpg", ".aac"}
app = FastAPI(title="DeepFake Shield API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    # Preload model so first request isn't slow if network/cache is ready
    try:
        get_detector()
    except Exception as exc:
        logger.warning("Model preload skipped on startup: %s", exc)


@app.post("/api/v1/analyze", response_model=AnalyzeResponse)
async def analyze_audio(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> AnalyzeResponse:
    filename = file.filename or "uploaded_audio.wav"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio format '{ext}'. Supported: {sorted(ALLOWED_EXTENSIONS)}",
        )

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            content = await file.read()
            if not content:
                raise HTTPException(status_code=400, detail="Uploaded file is empty.")
            tmp.write(content)
            temp_path = tmp.name

        audio, duration_sec = load_audio_16k(temp_path)
        raw_segments = get_audio_segments(audio, duration_sec)
        detector = get_detector()
        spoof_prob, confidence, verdict, segments = detector.analyze_segments(raw_segments)
        spectrogram_b64 = generate_mel_spectrogram_base64(audio)

        scan_id = str(uuid.uuid4())
        record = ScanRecord(
            scan_id=scan_id,
            filename=filename,
            duration_sec=round(duration_sec, 2),
            verdict=verdict,
            spoof_probability=spoof_prob,
            confidence=confidence,
        )
        db.add(record)
        db.commit()

        return AnalyzeResponse(
            scan_id=scan_id,
            filename=filename,
            duration_sec=round(duration_sec, 2),
            verdict=verdict,
            spoof_probability=spoof_prob,
            confidence=confidence,
            segments=segments,
            spectrogram_base64=spectrogram_b64,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error analyzing audio file '%s'", filename)
        raise HTTPException(status_code=500, detail=f"Failed to analyze audio: {exc}") from exc
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass


@app.get("/api/v1/history", response_model=List[HistoryItem])
def get_history(limit: int = 20, db: Session = Depends(get_db)) -> List[HistoryItem]:
    records = (
        db.query(ScanRecord)
        .order_by(ScanRecord.created_at.desc())
        .limit(limit)
        .all()
    )
    return records