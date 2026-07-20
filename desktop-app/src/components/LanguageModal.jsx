import React from 'react';

export default function LanguageModal({ stream, onSelectLanguage, onClose }) {
  if (!stream || !stream.languageUrls) return null;

  return (
    <div className="onboarding-overlay" onClick={onClose} style={{ zIndex: 1100, background: 'rgba(0,0,0,0.8)', animation: 'fadeIn 0.3s ease-out', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', inset: 0 }}>
      <div className="onboarding-modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', padding: '30px', animation: 'slideUp 0.3s ease-out', maxWidth: '400px', width: '90%', background: 'var(--bg-card)', borderRadius: '24px', border: '1px solid var(--border)' }}>
        <h2 className="onboarding-title" style={{ fontSize: '1.5rem', marginBottom: '10px' }}>Select Language</h2>
        <p className="onboarding-desc" style={{ marginBottom: '24px' }}>Choose a language for this stream</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {Object.entries(stream.languageUrls).map(([lang, url]) => (
            <button 
              key={lang} 
              className="primary-btn" 
              style={{ padding: '12px', fontSize: '1.1rem', textTransform: 'capitalize' }}
              onClick={() => onSelectLanguage(lang, url)}
            >
              {lang.toLowerCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
