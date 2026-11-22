import { useState, useRef } from 'react';
import { useWavesurfer } from '@wavesurfer/react';
import { mockMetrics, mockHistory, mockAnalyzeFile } from './mocks/mockData';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('analyze');
  const [selectedFile, setSelectedFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState(mockHistory);

  // Waveform container ref
  const containerRef = useRef(null);
  const { wavesurfer, isPlaying, currentTime } = useWavesurfer({
    container: containerRef,
    url: audioUrl,
    waveColor: '#646cff',
    progressColor: '#42b883',
    height: 80,
    barWidth: 2,
  });

  const onPlayPause = () => {
    wavesurfer && wavesurfer.playPause();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
    setResult(null);
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
    try {
      const data = await mockAnalyzeFile(selectedFile);
      setResult(data);
      setHistory((prev) => [data, ...prev]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ marginBottom: '2rem', borderBottom: '1px solid #333', paddingBottom: '1rem' }}>
        <h1>Deepfake Shield</h1>
        <p style={{ color: '#888' }}>Synthetic Voice & Deepfake Audio Detection Dashboard</p>
      </header>

      {/* Navigation Tabs */}
      <nav style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        {['analyze', 'history', 'benchmark'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.6rem 1.2rem',
              textTransform: 'capitalize',
              fontWeight: activeTab === tab ? 'bold' : 'normal',
              borderBottom: activeTab === tab ? '2px solid #646cff' : 'none',
              cursor: 'pointer',
            }}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* Tab 1: Analyze */}
      {activeTab === 'analyze' && (
        <section>
          <h2>Analyze Audio Clip</h2>
          <p style={{ fontSize: '0.9rem', color: '#888' }}>Supported formats: WAV, MP3, FLAC, OGG, M4A</p>
          <form onSubmit={handleAnalyze} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <input
              type="file"
              accept="audio/*,.wav,.mp3,.flac,.ogg,.m4a"
              onChange={handleFileChange}
            />

            {/* Wavesurfer Waveform Container */}
            {audioUrl && (
              <div style={{ padding: '1rem', background: '#1a1a1a', borderRadius: '8px', marginTop: '0.5rem' }}>
                <div ref={containerRef} style={{ marginBottom: '1rem' }} />
                <button
                  type="button"
                  onClick={onPlayPause}
                  style={{ padding: '0.4rem 1rem', cursor: 'pointer' }}
                >
                  {isPlaying ? 'Pause ⏸️' : 'Play Audio  ▶️'}
                </button>
                <span style={{ marginLeft: '1rem', fontSize: '0.85rem', color: '#aaa' }}>
                  Time: {currentTime.toFixed(1)}s
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={!selectedFile || loading}
              style={{ width: 'fit-content', padding: '0.6rem 1.5rem', cursor: 'pointer' }}
            >
              {loading ? 'Analyzing Audio...' : 'Run Detection'}
            </button>
          </form>

          {result && (
            <div
              style={{
                marginTop: '1.5rem',
                padding: '1.5rem',
                borderRadius: '8px',
                border: `1px solid ${result.is_deepfake ? '#ef4444' : '#22c55e'}`,
                backgroundColor: result.is_deepfake ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
              }}
            >
              <h3>{result.is_deepfake ? '⚠️ Synthetic / Deepfake Audio Detected' : '✅ Authentic Human Voice'}</h3>
              <p><strong>Audio File:</strong> {result.filename}</p>
              <p><strong>Confidence:</strong> {(result.confidence_score * 100).toFixed(1)}%</p>
              <p><strong>Processing Time:</strong> {result.processing_time_ms} ms</p>
            </div>
          )}
        </section>
      )}

      {/* Tab 2 & 3 remain the same */}
      {activeTab === 'history' && (
        <section>
          <h2>Audio Scan History</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #444' }}>
                <th style={{ padding: '0.75rem' }}>Audio File</th>
                <th style={{ padding: '0.75rem' }}>Verdict</th>
                <th style={{ padding: '0.75rem' }}>Confidence</th>
                <th style={{ padding: '0.75rem' }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ padding: '0.75rem' }}>{item.filename}</td>
                  <td style={{ padding: '0.75rem', color: item.is_deepfake ? '#ef4444' : '#22c55e' }}>
                    {item.is_deepfake ? 'Deepfake' : 'Authentic'}
                  </td>
                  <td style={{ padding: '0.75rem' }}>{(item.confidence_score * 100).toFixed(1)}%</td>
                  <td style={{ padding: '0.75rem' }}>{new Date(item.timestamp).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {activeTab === 'benchmark' && (
        <section>
          <h2>Audio Model Evaluation Metrics</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginTop: '1rem' }}>
            {Object.entries(mockMetrics).map(([key, value]) => (
              <div key={key} style={{ padding: '1.5rem', border: '1px solid #333', borderRadius: '8px' }}>
                <div style={{ textTransform: 'uppercase', fontSize: '0.85rem', color: '#888' }}>
                  {key.replace('_', ' ')}
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '0.5rem' }}>
                  {(value * 100).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default App;