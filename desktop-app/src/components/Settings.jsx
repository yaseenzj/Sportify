import React, { useState } from 'react';
import { getStorage, setStorage } from '../storage';
import PinInput from './PinInput';

const CLOUDFLARE_URL = import.meta.env.VITE_API_BASE || "";

export default function Settings() {
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinStatus, setPinStatus] = useState('');
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);

  const handleUpdatePin = async () => {
    if (newPin.length !== 4 || oldPin.length !== 4) {
      setPinStatus('PINs must be exactly 4 digits');
      return;
    }
    
    setIsUpdatingPin(true);
    setPinStatus('');

    try {
      const username = getStorage('sportify_username');
      const token = getStorage('sportify_token');
      const res = await fetch(`${CLOUDFLARE_URL}/update-pin`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ username, oldPin, newPin })
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
      <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '32px', letterSpacing: '-0.5px' }}>Settings</h2>
      
      <div style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '32px' }}>
        <h3 style={{ fontSize: '1.1rem', color: '#9d4edd', marginBottom: '24px', fontWeight: '600' }}>Preferences</h3>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', alignItems: 'center' }}>
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '4px' }}>Hardware Acceleration</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Turn off if the player goes black when resizing (requires restart)</p>
          </div>
          <input 
            type="checkbox" 
            className="toggle-switch" 
            defaultChecked={getStorage('sportify_hw_accel') === true} 
            onChange={(e) => {
              setStorage('sportify_hw_accel', e.target.checked);
              alert("Please restart Sportify for the hardware acceleration changes to take effect.");
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
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', alignItems: 'center' }}>
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '4px' }}>Notifications</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Show live match alerts</p>
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
            <option value="auto">Auto (Best Available)</option>
            <option value="1080">1080p</option>
            <option value="720">720p</option>
            <option value="480">480p</option>
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
    </div>
  );
}
