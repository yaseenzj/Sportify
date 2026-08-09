import React from 'react';
import { setStorage } from '../storage';

export default function ChangelogModal({ onClose }) {
  return (
    <div className="onboarding-overlay" style={{ zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div 
        style={{
          background: 'var(--bg-card)',
          borderRadius: '16px',
          padding: '32px',
          width: '90%',
          maxWidth: '600px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          position: 'relative'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            width: '64px', 
            height: '64px', 
            borderRadius: '50%', 
            background: 'rgba(255, 255, 255, 0.05)',
            color: 'var(--accent)',
            marginBottom: '16px',
            border: '1px solid var(--border-color)'
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '8px' }}>Update Successful!</h2>
          <p style={{ color: 'var(--text-muted)' }}>Welcome to Sportify v1.8.10. Here's what's new.</p>
        </div>

        <div style={{ 
          background: 'rgba(0,0,0,0.2)', 
          padding: '24px', 
          borderRadius: '12px',
          maxHeight: '300px',
          overflowY: 'auto',
          border: '1px solid rgba(255,255,255,0.05)',
          marginBottom: '24px'
        }}>
          <h4 style={{ color: 'white', marginBottom: '12px', fontSize: '1rem' }}>v1.8.10 Highlights</h4>
          <ul style={{ paddingLeft: '20px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
            <li style={{ marginBottom: '8px' }}>Added new, sleek custom app themes (Darker Night, Mysterious Glow, Midnight Star) and a Theme Selector in Settings.</li>
            <li style={{ marginBottom: '8px' }}>Introduced a new <strong style={{color: 'white'}}>Live Alerts</strong> system so you'll never miss an important match or update.</li>
            <li style={{ marginBottom: '8px' }}>Performance optimizations for faster, smoother channel loading.</li>
            <li style={{ marginBottom: '8px' }}>Various UI upgrades, bug fixes, and under-the-hood polish.</li>
          </ul>
        </div>

        <button 
          onClick={() => {
            // Mark version as seen
            setStorage('sportify_last_seen_version', '1.8.10');
            onClose();
          }}
          style={{ 
            width: '100%', 
            padding: '14px', 
            background: 'var(--accent)', 
            color: '#fff', 
            border: 'none', 
            borderRadius: '8px', 
            fontSize: '1rem', 
            fontWeight: '600', 
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'var(--accent-hover)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'var(--accent)'}
        >
          Awesome, Let's Go!
        </button>
      </div>
    </div>
  );
}
