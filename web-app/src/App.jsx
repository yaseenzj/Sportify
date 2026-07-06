import React, { useState } from 'react';
import { PlaySquare, MonitorPlay, ShieldAlert } from 'lucide-react';
import { parseM3u } from './utils/m3uParser';
import VideoPlayer from './components/VideoPlayer';

function App() {
  const [m3uInput, setM3uInput] = useState('');
  const [streams, setStreams] = useState([]);
  const [activeStream, setActiveStream] = useState(null);

  const handleLoad = () => {
    if (!m3uInput.trim()) return;
    const parsed = parseM3u(m3uInput);
    setStreams(parsed);
    if (parsed.length > 0) {
      setActiveStream(parsed[0]);
    }
  };

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <h1>
            <MonitorPlay size={24} color="var(--accent)" />
            WebStream Player
          </h1>
          <textarea 
            className="m3u-input" 
            placeholder="Paste your M3U / #EXTINF text here..."
            value={m3uInput}
            onChange={(e) => setM3uInput(e.target.value)}
          />
          <button className="load-btn" onClick={handleLoad}>
            Load Playlist
          </button>
        </div>

        <div className="channel-list">
          {streams.map((stream) => (
            <div 
              key={stream.id} 
              className={`channel-item ${activeStream?.id === stream.id ? 'active' : ''}`}
              onClick={() => setActiveStream(stream)}
            >
              {stream.logo ? (
                <img src={stream.logo} alt={stream.name} className="channel-logo" />
              ) : (
                <div className="channel-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PlaySquare size={20} color="#64748b" />
                </div>
              )}
              <div className="channel-info">
                <div className="channel-name">{stream.name}</div>
                <div className="channel-group">
                  {stream.group} {stream.clearKeys && ' (DRM)'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="main-content">
        {activeStream ? (
          <VideoPlayer stream={activeStream} />
        ) : (
          <div className="empty-state">
            <MonitorPlay size={64} />
            <h2>No Stream Selected</h2>
            <p style={{ marginTop: '10px' }}>Paste an M3U playlist and select a channel to start playing.</p>
            <div style={{ marginTop: '30px', padding: '20px', background: 'var(--bg-card)', borderRadius: '8px', maxWidth: '400px', textAlign: 'left', fontSize: '0.9rem' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#fbbf24' }}>
                <ShieldAlert size={18} /> iOS Compatibility Note
              </h4>
              <p style={{ color: 'var(--text-muted)' }}>
                This player fully supports DASH (.mpd) with ClearKey DRM on Windows, Mac, and Android. However, iOS (iPhone) strictly blocks DASH playback in Safari. On iPhones, only standard HLS (.m3u8) streams will play.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
