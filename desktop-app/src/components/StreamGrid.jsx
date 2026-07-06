import React from 'react';

export default function StreamGrid({ streams, onPlay, favorites = [], toggleFavorite }) {
  return (
    <div className="streams-grid" id="streamsGrid">
      {streams.map(stream => (
        <div key={stream.id} className="stream-card" onClick={() => onPlay(stream.id)}>
          <button 
            className={`fav-btn ${favorites.includes(stream.id) ? 'active' : ''}`}
            style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 5, background: 'rgba(0,0,0,0.5)', borderRadius: '50%' }}
            onClick={(e) => { e.stopPropagation(); toggleFavorite(stream.id); }}
            title="Toggle Favorite"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
          </button>
          {stream.logo ? (
            <img 
              className="stream-thumbnail" 
              src={stream.logo} 
              alt={stream.name} 
              onError={(e) => {
                e.target.src = 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
              }} 
            />
          ) : (
            <div className="stream-thumbnail" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: '#fc4c02' }}>
              ▶
            </div>
          )}
          <div className="stream-info">
            <h3>{stream.name}</h3>
            <div className="badges">
              <span className={`badge type-${stream.source}`}>{stream.source.toUpperCase()}</span>
              {stream.backupUrls && stream.backupUrls.length > 0 && (
                <span className="badge type-backup">+{stream.backupUrls.length}</span>
              )}
              {stream.clearKeys && <span className="badge drm">DRM Protected</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
