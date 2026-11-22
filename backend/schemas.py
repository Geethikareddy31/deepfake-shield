from datetime import datetime
from typing import List
from pydantic import BaseModel


class SegmentResult(BaseModel):
    start_sec: float
    end_sec: float
    spoof_prob: float
    flag: bool


class AnalyzeResponse(BaseModel):
    scan_id: str
    filename: str
    duration_sec: float
    verdict: str
    spoof_probability: float
    confidence: float
    segments: List[SegmentResult]
    spectrogram_base64: str


class HistoryItem(BaseModel):
    scan_id: str
    filename: str
    verdict: str
    confidence: float
    created_at: datetime

    class Config:
        from_attributes = True