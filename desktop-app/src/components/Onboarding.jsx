import React, { useState } from 'react';
import { setStorage, getStorage } from '../storage';
import PinInput from './PinInput';

// For local testing without Cloudflare backend yet, we can mock it, 
// but we will write the real fetch logic assuming the backend is deployed.
// Replace this with your actual deployed Cloudflare Worker URL later.
const CLOUDFLARE_URL = import.meta.env.VITE_API_BASE || ""; 

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(1);
  const [authMode, setAuthMode] = useState('signup'); // 'signup' or 'login'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleNext = () => {
    setStep(2);
  };

  const handleAuth = async () => {
    setErrorMsg('');
    if (!username || !password || (authMode === 'signup' && !accessCode)) {
      setErrorMsg('Please fill all fields');
      return;
    }

    setIsLoading(true);
    
    const isMockMode = false; 

    try {
      if (isMockMode) {
        // Mock validation logic
        await new Promise(r => setTimeout(r, 1000));
        if (authMode === 'signup' && accessCode !== 'BETATESTERZJ') {
          throw new Error('Invalid Access Code! Only authorized users can join.');
        }
        if (authMode === 'login' && username !== 'admin') {
          throw new Error('Invalid credentials');
        }
        setStorage('sportify_username', username);
        setStep(3);
        return;
      }

      // REAL CLOUDFLARE FETCH LOGIC
      
      const endpoint = authMode === 'signup' ? '/register' : '/login';
      const bodyData = authMode === 'signup' 
        ? { username, password, accessCode }
        : { username, password };

      const res = await fetch(`${CLOUDFLARE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Server error');
      }

      // Success!
      if (data.username) setStorage('sportify_username', data.username);
      else setStorage('sportify_username', username);
      
      if (data.token) setStorage('sportify_token', data.token);
      
      // If backend returns a pin (login), save it and skip step 3, else go to step 3
      if (authMode === 'login' && data.pin) {
        setStorage('sportify_pin', data.pin);
        onComplete();
      } else {
        setStep(3);
      }
      
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinishSetup = async () => {
    try {
      const username = getStorage('sportify_username');
      const token = getStorage('sportify_token');
      if (username && token) {
        await fetch(`${CLOUDFLARE_URL}/update-pin`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ username, oldPin: "0000", newPin: pin })
        });
      }
    } catch (err) {
      console.error("Failed to sync initial PIN to server", err);
    }
    setStorage('sportify_pin', pin);
    onComplete();
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal">
        {/* Decorative background elements */}
        <div className="decor-dot dot-1"></div>
        <div className="decor-dot dot-2"></div>
        <div className="decor-dot dot-3"></div>

        <div className="onboarding-content">
          {step === 1 ? (
            <>
              <div className="onboarding-graphic">
                <h4 className="graphic-title">Connect your sports</h4>
                <div className="graphic-grid">
                  <div className="graphic-item">
                    <div className="icon-wrapper" style={{ background: '#0e7a0d' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 12l3-2.5-1-4-4 1.5-1 4 3 1z"></path></svg>
                    </div>
                    <span>Football</span>
                  </div>
                  <div className="graphic-item">
                    <div className="icon-wrapper" style={{ background: '#e04402' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                    </div>
                    <span>Motorsports</span>
                  </div>
                  <div className="graphic-item">
                    <div className="icon-wrapper" style={{ background: '#00529b' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="8" y1="12" x2="16" y2="12"></line><line x1="12" y1="8" x2="12" y2="16"></line></svg>
                    </div>
                    <span>Cricket</span>
                  </div>
                  <div className="graphic-item">
                    <div className="icon-wrapper" style={{ background: '#333' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    </div>
                    <span>Custom M3U</span>
                  </div>
                </div>
                
                <div className="graphic-floating-card">
                  <span className="floating-badge">HOT</span>
                  <img src="https://images.unsplash.com/photo-1579952363873-27f3bade9f55?q=80&w=200&auto=format&fit=crop" alt="Sports" />
                  <div className="floating-info">
                    <h5>Live Events</h5>
                    <p>Added 32 channels</p>
                  </div>
                </div>
              </div>

              <div className="onboarding-pagination">
                <span className="dot active"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </div>

              <h2 className="onboarding-title">Sportify Setup</h2>
              <p className="onboarding-desc">
                Install Sportify to start streaming your favorite sports channels instantly in high quality.
              </p>

              <div className="onboarding-actions" style={{ justifyContent: 'center' }}>
                <button className="onboarding-btn-next" onClick={handleNext}>
                  Next <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                </button>
              </div>
            </>
          ) : step === 2 ? (
            <div className="auth-step-container">
              <div className="onboarding-pagination" style={{ alignSelf: 'center' }}>
                <span className="dot"></span>
                <span className="dot active"></span>
                <span className="dot"></span>
              </div>
              
              <h2 className="onboarding-title">Secure Access</h2>
              <p className="onboarding-desc" style={{ marginBottom: '16px' }}>
                You must be authorized to enter the vault.
              </p>

              <div className="auth-tabs">
                <button className={authMode === 'signup' ? 'active' : ''} onClick={() => {setAuthMode('signup'); setErrorMsg('');}}>Sign Up</button>
                <button className={authMode === 'login' ? 'active' : ''} onClick={() => {setAuthMode('login'); setErrorMsg('');}}>Log In</button>
              </div>

              <div className="auth-form">
                <input 
                  type="text" 
                  placeholder="Username" 
                  className="auth-input" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <input 
                  type="password" 
                  placeholder="Password" 
                  className="auth-input" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {authMode === 'signup' && (
                  <>
                    <input 
                      type="text" 
                      placeholder="Beta Access Code" 
                      className="auth-input access-code" 
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                    />
                  </>
                )}

                {errorMsg && <div className="auth-error">{errorMsg}</div>}

                <div className="onboarding-actions" style={{ marginTop: '24px' }}>
                  <button className="onboarding-btn-back" onClick={() => setStep(1)}>
                    Back
                  </button>
                  <button className="onboarding-btn-next" onClick={handleAuth} disabled={isLoading}>
                    {isLoading ? 'Verifying...' : (authMode === 'signup' ? 'Continue' : 'Log In')}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="auth-step-container">
              <div className="onboarding-pagination" style={{ alignSelf: 'center' }}>
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot active"></span>
              </div>
              
              <h2 className="onboarding-title">Set Master PIN</h2>
              <p className="onboarding-desc" style={{ marginBottom: '16px' }}>
                Create a 4-digit PIN to secure your dashboard. You'll need this every time you open the app.
              </p>

              <div className="auth-form" style={{ alignItems: 'center' }}>
                <PinInput onComplete={(pinValue) => setPin(pinValue)} autoFocus={true} />
              
                <button 
                  className="onboarding-btn-next" 
                  onClick={handleFinishSetup}
                  style={{ marginTop: '20px', width: '100%', opacity: pin.length === 4 ? 1 : 0.5 }}
                  disabled={pin.length !== 4}
                >
                  Enter Dashboard <span style={{ fontSize: '1.2rem' }}>→</span>
                </button>

                {errorMsg && <div className="auth-error">{errorMsg}</div>}

                <div className="onboarding-actions" style={{ marginTop: '24px' }}>
                  <button className="onboarding-btn-back" onClick={() => setStep(2)}>
                    Back
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
