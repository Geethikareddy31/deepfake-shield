import { useState, useRef, useEffect } from 'react';
import { useWavesurfer } from '@wavesurfer/react';
import { analyzeAudio, fetchHistory, fetchMetrics } from './services/api';
import { mockMetrics } from './mocks/mockData';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('analyze');
  const [selectedFile, setSelectedFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [metrics, setMetrics] = useState(mockMetrics);

  const containerRef = useRef(null);
  const { wavesurfer, isPlaying, currentTime } = useWavesurfer({
    container: containerRef,
    url: audioUrl,
    waveColor: '#38bdf8',
    progressColor: '#34d399',
    height: 80,
    barWidth: 3,
    barRadius: 2,
  });

  useEffect(() => {
    fetchHistory()
      .then((data) => setHistory(Array.isArray(data) ? data : data.scans || []))
      .catch(() => console.warn('Backend history unavailable yet'));

    fetchMetrics()
      .then((data) => setMetrics(data))
      .catch(() => console.warn('Using fallback metrics'));
  }, []);

  const onPlayPause = () => {
    wavesurfer && wavesurfer.playPause();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
    setResult(null);
    setError(null);
    if (file) {
      setAudioUrl(URL.createObjectURL(file));
    } else {
      setAudioUrl(null);
    }
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const data = await analyzeAudio(selectedFile);
      setResult(data);
      const updatedHistory = await fetchHistory();
      setHistory(Array.isArray(updatedHistory) ? updatedHistory : updatedHistory.scans || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not connect to FastAPI backend. Ensure server is running on port 8000.');
    } finally {
      setLoading(false);
    }
  };

  const isFake = result?.verdict?.includes('SYNTHETIC') || result?.verdict?.includes('SCAM');

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div>
          <h1>Deepfake Shield</h1>
          <p>Advanced Forensic Audio Authenticity & Synthetic Voice Detection</p>
        </div>
        <div style={{ fontSize: '0.8rem', background: '#1e293b', padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #334155', color: '#38bdf8' }}>
          System: Ready
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="nav-tabs">
        {['analyze', 'history', 'benchmark'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* Tab 1: Analyze */}
      {activeTab === 'analyze' && (
        <div className="panel-card">
          <h2>Analyze Audio Clip</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Upload WAV, MP3, or OGG audio files for deep neural network forensic examination.
          </p>

          <form onSubmit={handleAnalyze} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="file-drop-zone">
              <input
                type="file"
                accept=".wav,.mp3,.ogg,audio/*"
                onChange={handleFileChange}
                style={{ color: '#94a3b8' }}
              />
            </div>

            {audioUrl && (
              <div style={{ padding: '1.25rem', background: '#0f172a', borderRadius: '8px', border: '1px solid #334155' }}>
                <div ref={containerRef} style={{ marginBottom: '1rem' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button type="button" onClick={onPlayPause} className="action-btn" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
                    {isPlaying ? 'Pause ⏸️' : 'Play Audio ▶️'}
                  </button>
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                    Elapsed: {currentTime.toFixed(1)}s
                  </span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={!selectedFile || loading}
              className="action-btn"
              style={{ width: 'fit-content' }}
            >
              {loading ? 'Running PyTorch Inference...' : 'Run Forensic Analysis'}
            </button>
          </form>

          {error && (
            <div style={{ marginTop: '1.25rem', padding: '1rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#f87171' }}>
              ⚠️ {error}
            </div>
          )}

          {result && (
            <div className={`verdict-box ${isFake ? 'fake' : 'authentic'}`}>
              <h3 style={{ margin: '0 0 0.75rem 0', color: isFake ? '#f87171' : '#4ade80' }}>
                {isFake ? '⚠️ Synthetic / Deepfake Audio Detected' : '✅ Genuine Human Voice Verified'}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', fontSize: '0.925rem', color: '#cbd5e1' }}>
                <p><strong>Filename:</strong> {result.filename}</p>
                <p><strong>Verdict Type:</strong> {result.verdict}</p>
                <p><strong>Confidence:</strong> {(result.confidence <= 1 ? result.confidence * 100 : result.confidence).toFixed(1)}%</p>
                {result.spoof_probability !== undefined && (
                  <p><strong>Spoof Probability:</strong> {(result.spoof_probability <= 1 ? result.spoof_probability * 100 : result.spoof_probability).toFixed(1)}%</p>
                )}
              </div>

              {result.segments && result.segments.length > 0 && (
                <div style={{ marginTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0' }}>Flagged Time Segments</h4>
                  <ul style={{ paddingLeft: '1.2rem', margin: 0, color: '#cbd5e1' }}>
                    {result.segments.map((seg, idx) => (
                      <li key={idx} style={{ color: seg.flag ? '#f87171' : '#4ade80', marginBottom: '0.25rem' }}>
                        {seg.start_sec}s – {seg.end_sec}s: Spoof Prob {(seg.spoof_prob * 100).toFixed(1)}% {seg.flag ? '(Anomaly Flagged)' : '(Clean)'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.spectrogram_base64 && (
                <div style={{ marginTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0' }}>Mel-Spectrogram Forensic Map</h4>
                  <img
                    src={`data:image/png;base64,${result.spectrogram_base64}`}
                    alt="Mel-Spectrogram"
                    style={{ width: '100%', borderRadius: '6px', border: '1px solid #334155' }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: History */}
      {activeTab === 'history' && (
        <div className="panel-card">
          <h2>SQLite Scan History</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Recent audio forensic evaluations logged in backend database.</p>
          {history.length === 0 ? (
            <p style={{ color: '#64748b', marginTop: '1.5rem' }}>No scan history recorded yet.</p>
          ) : (
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Audio File</th>
                  <th>Verdict</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item, idx) => {
                  const fakeRow = item.verdict?.includes('SYNTHETIC') || item.verdict?.includes('SCAM');
                  return (
                    <tr key={item.scan_id || idx}>
                      <td>{item.filename}</td>
                      <td style={{ color: fakeRow ? '#f87171' : '#4ade80', fontWeight: '600' }}>
                        {item.verdict}
                      </td>
                      <td>{(item.confidence <= 1 ? item.confidence * 100 : item.confidence).toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 3: Benchmark */}
      {activeTab === 'benchmark' && (
        <div className="panel-card">
          <h2>Model Evaluation Metrics</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Performance benchmarks evaluated on clean vs. compressed test datasets.</p>
          <div className="metrics-grid">
            {Object.entries(metrics).map(([key, value]) => (
              <div key={key} className="metric-card">
                <div style={{ textTransform: 'uppercase', fontSize: '0.75rem', color: '#94a3b8', letterSpacing: '0.05em' }}>
                  {key.replace('_', ' ')}
                </div>
                <div style={{ fontSize: '2.25rem', fontWeight: '700', marginTop: '0.5rem', color: '#38bdf8' }}>
                  {(value * 100).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;