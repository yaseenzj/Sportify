import React, { useState } from 'react';

export default function CustomStreamModal({ onClose, onPlay, showToast }) {
  const [url, setUrl] = useState('');
  const [keyId, setKeyId] = useState('');
  const [key, setKey] = useState('');

  const handlePlay = () => {
    if (!url.trim()) {
      showToast("Please enter a valid stream URL");
      return;
    }

    const customStream = {
      id: 'custom_' + Date.now(),
      name: 'Custom Stream',
      url: url.trim(),
      source: 'custom',
      clearKeys: (keyId.trim() && key.trim()) ? { [keyId.trim()]: key.trim() } : null
    };

    onPlay(customStream);
  };

  return (
    <div className="modal active" onClick={(e) => { if (e.target.className === 'modal active') onClose(); }}>
      <div className="modal-content" style={{ height: 'auto', maxWidth: '500px' }}>
        <div className="modal-header">
          <h2>Play Custom Stream</h2>
          <button className="close-btn" onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div className="modal-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input 
            type="text" 
            className="custom-input" 
            placeholder="Stream URL (.m3u8, .mpd)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          
          <h4 style={{ marginTop: '8px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>
            DRM (ClearKey) - Optional
          </h4>
          <input 
            type="text" 
            className="custom-input" 
            placeholder="Key ID (e.g. 1234abcd...)"
            value={keyId}
            onChange={(e) => setKeyId(e.target.value)}
          />
          <input 
            type="text" 
            className="custom-input" 
            placeholder="Key (e.g. 5678efgh...)"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          
          <button className="primary-btn" style={{ marginTop: '16px', justifyContent: 'center' }} onClick={handlePlay}>
            Play Stream
          </button>
        </div>
      </div>
    </div>
  );
}
