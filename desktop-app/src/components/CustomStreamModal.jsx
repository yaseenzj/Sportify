import React, { useState, useEffect } from 'react';

export default function CustomStreamModal({ onClose, onPlay, showToast }) {
  const [url, setUrl] = useState('');
  const [clearKeyFormat, setClearKeyFormat] = useState('');
  const [history, setHistory] = useState([]);

  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('sportify_custom_history');
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (e) {
      console.error("Failed to load history", e);
    }
  }, []);

  const saveToHistory = (streamUrl, keyStr) => {
    const newItem = {
      id: Date.now().toString(),
      url: streamUrl,
      clearKey: keyStr,
      timestamp: Date.now()
    };
    
    // Remove existing entry with same url if it exists, to bring it to top
    const filtered = history.filter(item => item.url !== streamUrl);
    const updated = [newItem, ...filtered].slice(0, 50); // keep last 50
    
    setHistory(updated);
    localStorage.setItem('sportify_custom_history', JSON.stringify(updated));
  };

  const removeFromHistory = (id) => {
    const updated = history.filter(item => item.id !== id);
    setHistory(updated);
    localStorage.setItem('sportify_custom_history', JSON.stringify(updated));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('sportify_custom_history');
  };

  const getFilename = (fullUrl) => {
    try {
      const urlObj = new URL(fullUrl);
      const parts = urlObj.pathname.split('/');
      return parts[parts.length - 1] || 'stream';
    } catch {
      return fullUrl.split('/').pop() || 'stream';
    }
  };

  const handlePlay = (playUrl, playKey) => {
    const finalUrl = (playUrl || url).trim();
    const finalKey = (playKey !== undefined ? playKey : clearKeyFormat).trim();

    if (!finalUrl) {
      showToast("Please enter a valid stream URL");
      return;
    }

    let parsedClearKeys = null;
    if (finalKey) {
      if (finalKey.includes(':')) {
        const [kid, key] = finalKey.split(':');
        if (kid && key) {
          parsedClearKeys = { [kid.trim()]: key.trim() };
        } else {
          showToast("Invalid ClearKey format. Use kid:key");
          return;
        }
      } else {
        showToast("Invalid ClearKey format. Use kid:key");
        return;
      }
    }

    saveToHistory(finalUrl, finalKey);

    const customStream = {
      id: 'custom_' + Date.now(),
      name: getFilename(finalUrl) || 'Custom Stream',
      url: finalUrl,
      source: 'custom',
      clearKeys: parsedClearKeys
    };

    onPlay(customStream);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handlePlay();
    }
  };

  return (
    <div className="modal active" onClick={(e) => { if (e.target.className === 'modal active') onClose(); }}>
      <div className="modal-content" style={{ height: 'auto', maxHeight: '90vh', maxWidth: '600px', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <h2>Play Custom Stream</h2>
          <button className="close-btn" onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div className="modal-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          <input 
            type="text" 
            className="custom-input" 
            placeholder="Stream URL (.m3u8, .mpd)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          
          <h4 style={{ marginTop: '8px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>
            DRM (ClearKey) - Optional
          </h4>
          <input 
            type="text" 
            className="custom-input" 
            placeholder="kid:key (e.g. 1234...abcd:5678...efgh)"
            value={clearKeyFormat}
            onChange={(e) => setClearKeyFormat(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          
          <button className="primary-btn" style={{ marginTop: '8px', justifyContent: 'center' }} onClick={() => handlePlay()}>
            Play Stream
          </button>

          {history.length > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Stream History</h3>
                <button 
                  onClick={clearHistory}
                  style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#ff4757', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}
                >
                  Clear History
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {history.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div 
                      style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, overflow: 'hidden', cursor: 'pointer' }}
                      onClick={() => handlePlay(item.url, item.clearKey || '')}
                      title="Click to play"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {getFilename(item.url)}
                        </span>
                        {item.clearKey && (
                          <span style={{ fontSize: '0.65rem', background: '#3498db', color: 'white', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                            DRM
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.url}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginLeft: '12px' }}>
                      <button 
                        onClick={() => {
                          setUrl(item.url);
                          setClearKeyFormat(item.clearKey || '');
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        title="Edit in inputs"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      </button>
                      <button 
                        onClick={() => removeFromHistory(item.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        title="Remove from history"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
