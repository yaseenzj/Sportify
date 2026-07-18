import React, { useState, useRef } from 'react';
import { getStorage } from '../storage';

export default function ReportModal({ isOpen, onClose }) {
  const [message, setMessage] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setStatus("Image is too large. Max 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshot(reader.result);
        setStatus('');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!message.trim()) {
      setStatus("Please describe the issue.");
      return;
    }

    setIsSubmitting(true);
    setStatus('Submitting report...');

    try {
      const username = getStorage('sportify_username') || 'Anonymous';
      
      // We send it to the Stream Manager backend which holds the SPORTIFY_STREAMS KV
      // Derive the base URL from the JSON stream URL
      const streamUrl = import.meta.env.VITE_REMOTE_JSON_URL;
      const baseUrl = streamUrl ? streamUrl.replace('/api/streams/json', '') : 'https://sportify-stream-manager.wolfytrap.workers.dev';
      
      const res = await fetch(`${baseUrl}/api/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, message, screenshot })
      });

      if (!res.ok) throw new Error("Failed to submit report.");
      
      setStatus('Report submitted successfully!');
      setTimeout(() => {
        onClose();
        setMessage('');
        setScreenshot(null);
        setStatus('');
      }, 2000);
      
    } catch (e) {
      console.error(e);
      setStatus('Error submitting report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
      <div style={{ background: '#18181b', borderRadius: '24px', width: '90%', maxWidth: '500px', padding: '32px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'white' }}>Report an Issue</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', color: '#a1a1aa', fontSize: '0.9rem', marginBottom: '8px' }}>Describe the problem</label>
          <textarea 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What went wrong?"
            rows={4}
            style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px', color: 'white', resize: 'none', outline: 'none' }}
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', color: '#a1a1aa', fontSize: '0.9rem', marginBottom: '8px' }}>Attach Screenshot (Optional)</label>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button 
              onClick={() => fileInputRef.current?.click()}
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px dashed rgba(255,255,255,0.2)', color: 'white', padding: '12px 20px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              Upload Image
            </button>
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
            
            {screenshot && (
              <div style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                <img src={screenshot} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button 
                  onClick={() => setScreenshot(null)}
                  style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer', fontSize: '12px' }}
                >✕</button>
              </div>
            )}
          </div>
        </div>

        {status && (
          <div style={{ marginBottom: '16px', color: status.includes('success') ? '#4ade80' : (status.includes('Submitting') ? '#a1a1aa' : '#ff4d4d'), fontSize: '0.9rem', textAlign: 'center' }}>
            {status}
          </div>
        )}

        <button 
          onClick={handleSubmit}
          disabled={isSubmitting}
          style={{ width: '100%', background: 'linear-gradient(90deg, #7b2cbf, #9d4edd)', color: 'white', border: 'none', padding: '16px', borderRadius: '12px', fontWeight: 600, fontSize: '1rem', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}
        >
          {isSubmitting ? 'Sending...' : 'Submit Report'}
        </button>

      </div>
    </div>
  );
}
