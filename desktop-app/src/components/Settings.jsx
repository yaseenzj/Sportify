import React, { useState } from 'react';
import { getStorage, setStorage } from '../storage';
import PinInput from './PinInput';

const CLOUDFLARE_URL = import.meta.env.VITE_API_BASE || "";

export default function Settings() {
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinStatus, setPinStatus] = useState('');
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);
  const [activeTheme, setActiveTheme] = useState(() => getStorage('sportify_theme') || 'classic-dark');

  const handleUpdatePin = async () => {
    if (newPin.length !== 4 || oldPin.length !== 4) {
      setPinStatus('PINs must be exactly 4 digits');
      return;
    }
    
    setIsUpdatingPin(true);
    setPinStatus('');

    try {
      const email = getStorage('sportify_username');
      const res = await fetch(`${CLOUDFLARE_URL}/update-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, oldPin, newPin })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update PIN');
      }

      setStorage('sportify_pin', newPin);
      setPinStatus('PIN updated successfully!');
      setOldPin('');
      setNewPin('');
    } catch (err) {
      setPinStatus(err.message);
    } finally {
      setIsUpdatingPin(false);
    }
  };

  return (
    <div style={{ padding: '32px 40px', color: 'white', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: '700', letterSpacing: '-0.5px', margin: 0 }}>Settings</h2>
        <button 
          onClick={() => {
            if (window.electronAPI) {
              window.electronAPI.checkUpdate();
              alert("Checking for updates in the background...");
            }
          }}
          style={{ 
            padding: '10px 20px', 
            background: 'rgba(255,255,255,0.1)', 
            color: 'white', 
            border: '1px solid rgba(255,255,255,0.1)', 
            borderRadius: '8px', 
            cursor: 'pointer', 
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.2)'}
          onMouseOut={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
        >
          Check for Updates
        </button>
      </div>
      
      <div style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '32px' }}>
        <h3 style={{ fontSize: '1.1rem', color: '#9d4edd', marginBottom: '24px', fontWeight: '600' }}>Preferences</h3>
        
        <div style={{ marginBottom: '32px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '4px' }}>App Theme</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Choose your visual experience</p>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {[
              { id: 'classic-dark', name: 'Classic', bg: '#141517', accent: '#fc4c02' },
              { id: 'dark-black-gradient', name: 'Darker Night', bg: '#121212', accent: '#ffffff' },
              { id: 'dark-purple-glow', name: 'Mysterious Glow', bg: '#10081d', accent: '#a372f8' },
              { id: 'midnight-purple', name: 'Midnight Star', bg: '#0c0812', accent: '#8b5cf6' }
            ].map(t => {
              const isSelected = activeTheme === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => {
                    setActiveTheme(t.id);
                    setStorage('sportify_theme', t.id);
                    document.documentElement.setAttribute('data-theme', t.id);
                  }}
                  style={{
                    flex: '1 1 calc(25% - 12px)',
                    minWidth: '140px',
                    background: isSelected ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                    border: `1.5px solid ${isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.05)'}`,
                    borderRadius: '12px',
                    padding: '16px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: isSelected ? '0 8px 24px rgba(0,0,0,0.3)' : 'none',
                    transform: isSelected ? 'scale(1.02)' : 'none'
                  }}
                  onMouseOver={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.border = '1.5px solid rgba(255,255,255,0.15)';
                      e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.border = '1.5px solid rgba(255,255,255,0.05)';
                      e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                    }
                  }}
                >
                  <div style={{ 
                    width: '36px', 
                    height: '36px', 
                    borderRadius: '50%', 
                    background: t.bg, 
                    border: '1.5px solid rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      position: 'absolute',
                      right: 0,
                      bottom: 0,
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      background: t.accent,
                      border: '1.5px solid ' + t.bg
                    }} />
                  </div>
                  <span style={{ 
                    fontSize: '0.85rem', 
                    fontWeight: isSelected ? '600' : '500', 
                    color: isSelected ? 'white' : 'var(--text-muted)',
                    textAlign: 'center'
                  }}>
                    {t.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', alignItems: 'center' }}>
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '4px' }}>Hardware Acceleration</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Keep ON for smooth UI performance (requires restart)</p>
          </div>
          <input 
            type="checkbox" 
            className="toggle-switch" 
            defaultChecked={getStorage('sportify_hw_accel') !== false} 
            onChange={(e) => {
              setStorage('sportify_hw_accel', e.target.checked);
              if (window.electronAPI) {
                if (window.confirm("App needs to restart for changes to take effect. Restart now?")) {
                  window.electronAPI.relaunchApp();
                }
              } else {
                alert("Please restart Sportify for the hardware acceleration changes to take effect.");
              }
            }}
          />
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', alignItems: 'center' }}>
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '4px' }}>Auto-play Streams</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Automatically start playing when opened</p>
          </div>
          <input type="checkbox" className="toggle-switch" defaultChecked />
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '4px' }}>Default Video Quality</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Choose the starting resolution</p>
          </div>
          <select 
            defaultValue={getStorage('sportify_default_quality') || 'auto'}
            onChange={(e) => setStorage('sportify_default_quality', e.target.value)}
            style={{ padding: '10px 16px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', outline: 'none', fontFamily: 'var(--font-family)' }}
          >
            <option value="auto" style={{ background: '#1e1e24' }}>Auto (Best Available)</option>
            <option value="1080" style={{ background: '#1e1e24' }}>1080p</option>
            <option value="720" style={{ background: '#1e1e24' }}>720p</option>
            <option value="480" style={{ background: '#1e1e24' }}>480p</option>
          </select>
        </div>


      </div>
      
      <div style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 style={{ fontSize: '1.1rem', color: '#ff4d4d', marginBottom: '24px', fontWeight: '600' }}>Security</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'flex-start' }}>
          
          <div style={{ width: '100%' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '12px' }}>Current PIN</label>
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <PinInput onComplete={(val) => setOldPin(val)} autoFocus={false} resetOnComplete={false} />
            </div>
          </div>
          
          <div style={{ width: '100%' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '12px' }}>New 4-Digit PIN</label>
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <PinInput onComplete={(val) => setNewPin(val)} autoFocus={false} resetOnComplete={false} />
            </div>
          </div>
          
          <button 
            onClick={handleUpdatePin} 
            disabled={isUpdatingPin || oldPin.length !== 4 || newPin.length !== 4}
            style={{ 
              padding: '12px 24px', 
              background: (oldPin.length === 4 && newPin.length === 4) ? 'linear-gradient(90deg, #7b2cbf 0%, #9d4edd 100%)' : 'rgba(255,255,255,0.1)', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: (oldPin.length === 4 && newPin.length === 4) ? 'pointer' : 'not-allowed', 
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
          >
            {isUpdatingPin ? 'Updating...' : 'Change PIN'}
          </button>
          
          {pinStatus && (
            <div style={{ 
              color: pinStatus.includes('success') ? '#4ade80' : '#ff4d4d', 
              fontSize: '0.9rem',
              background: pinStatus.includes('success') ? 'rgba(74, 222, 128, 0.1)' : 'rgba(255, 77, 77, 0.1)',
              padding: '12px 16px',
              borderRadius: '8px',
              border: `1px solid ${pinStatus.includes('success') ? 'rgba(74, 222, 128, 0.2)' : 'rgba(255, 77, 77, 0.2)'}`
            }}>
              {pinStatus}
            </div>
          )}
        </div>
      </div>
      <div style={{ marginTop: '40px', background: 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 style={{ fontSize: '1.1rem', color: '#4facfe', marginBottom: '16px', fontWeight: '600' }}>Changelog</h3>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.6' }}>
          <h4 style={{ color: 'white', marginBottom: '8px', fontSize: '1rem' }}>v1.26.8 (Latest)</h4>
          <ul style={{ paddingLeft: '20px', marginBottom: '24px' }}>
            <li style={{ marginBottom: '6px' }}>Added three new app themes (Darker Night, Mysterious Glow, Midnight Star) in Settings.</li>
            <li style={{ marginBottom: '6px' }}>Introduced <strong style={{color: 'white'}}>Live Alerts</strong> below the favorites section for broadcasting issues live..</li>
            <li style={{ marginBottom: '6px' }}>Performance optimizations for faster, smoother channel loading.</li>
            <li style={{ marginBottom: '6px' }}>Various UI upgrades, bug fixes, and under-the-hood polish etc.</li>
          </ul>

          <h4 style={{ color: 'white', marginBottom: '8px', fontSize: '1rem' }}>v1.7.24</h4>
          <ul style={{ paddingLeft: '20px', marginBottom: '8px' }}>
            <li style={{ marginBottom: '6px' }}>Optimized streams with an <strong style={{color: 'white'}}>Ultra-Fast Engine</strong> for zero buffering and near-instant access.</li>
            <li style={{ marginBottom: '6px' }}>Enabled <strong style={{color: 'white'}}>Background Auto-Updates</strong> so playlists refresh seamlessly without reloading.</li>
            <li style={{ marginBottom: '6px' }}>Overhauled <strong style={{color: 'white'}}>UI & Player Layout</strong> with cleaner category navigation and multi-language support.</li>
            <li style={{ marginBottom: '6px' }}>Maximized performance by reducing network and CPU/Memory overhead for a smoother experience.</li>
          </ul>
        </div>
      </div>

      <div style={{ marginTop: '40px', padding: '24px', background: 'rgba(255, 77, 77, 0.05)', borderRadius: '12px', border: '1px solid rgba(255, 77, 77, 0.1)' }}>
        <h4 style={{ color: '#ff4d4d', fontSize: '1rem', marginBottom: '8px', fontWeight: '600' }}>Legal Disclaimer</h4>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.6' }}>
          Sportify is purely a media player and management interface. We do not host, provide, or distribute any media content, streams, or copyright-protected material. Any streams, JSON URLs, or M3U playlists provided as examples or defaults in the code are sourced freely from the open-source internet. We assume zero responsibility for the content that users choose to consume or manage using this software. Use this application at your own risk.
        </p>
      </div>
    </div>
  );
}
