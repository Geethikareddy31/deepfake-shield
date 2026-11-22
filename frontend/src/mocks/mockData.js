export const mockMetrics = {
  accuracy: 0.96,
  precision: 0.95,
  recall: 0.97,
  f1_score: 0.96,
};

export const mockHistory = [
  {
    id: "scan_101",
    filename: "ceo_voice_note.wav",
    is_deepfake: true,
    confidence_score: 0.94,
    processing_time_ms: 420,
    timestamp: "2026-11-21T21:30:00Z",
  },
  {
    id: "scan_102",
    filename: "verified_call_recording.mp3",
    is_deepfake: false,
    confidence_score: 0.11,
    processing_time_ms: 310,
    timestamp: "2026-11-21T21:45:00Z",
  },
];

export const mockAnalyzeFile = (file) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const isFake = file.name.toLowerCase().includes("fake") || Math.random() > 0.5;
      resolve({
        id: `scan_${Date.now()}`,
        filename: file.name,
        is_deepfake: isFake,
        confidence_score: isFake ? 0.92 : 0.14,
        processing_time_ms: 390,
        timestamp: new Date().toISOString(),
      });
    }, 1000);
  });
};