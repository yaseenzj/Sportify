import React, { useState, useEffect } from 'react';

import avatarMale1 from '../assets/avatars/male1.svg';
import avatarMale2 from '../assets/avatars/male2.svg';
import avatarFemale1 from '../assets/avatars/female1.svg';
import avatarFemale2 from '../assets/avatars/female2.svg';

const AVATARS = [
  avatarMale1,
  avatarMale2,
  avatarFemale1,
  avatarFemale2
];

const CLOUDFLARE_URL = import.meta.env.VITE_API_BASE || "";

export default function Profile({ userEmail, onLogout }) {
  const username = userEmail ? userEmail.split('@')[0] : 'Guest';
  
  const [profile, setProfile] = useState({
    nickname: username,
    joinedAt: new Date().toISOString(),
    avatar: null
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [editAvatar, setEditAvatar] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!username || username === 'Guest') {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    fetch(`${CLOUDFLARE_URL}/get-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    })
    .then(res => res.json())
    .then(data => {
      setProfile({
        nickname: data.nickname || username,
        joinedAt: data.joinedAt || new Date().toISOString(),
        avatar: data.avatar || AVATARS[0]
      });
    })
    .catch(err => console.error("Failed to load profile", err))
    .finally(() => setIsLoading(false));
  }, [username]);

  const handleEdit = () => {
    setEditNickname(profile.nickname);
    setEditAvatar(profile.avatar || AVATARS[0]);
    setIsEditing(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetch(`${CLOUDFLARE_URL}/update-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username, 
          nickname: editNickname, 
          avatar: editAvatar 
        })
      });
      
      setProfile({ ...profile, nickname: editNickname, avatar: editAvatar });
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to save profile", err);
    } finally {
      setIsSaving(false);
    }
  };

  const displayAvatar = profile.avatar || AVATARS[0];

  if (isLoading) {
    return (
      <div style={{ padding: '40px', color: 'white', textAlign: 'center' }}>
        <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      {isEditing ? (
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '30px', borderRadius: '12px', width: '100%', maxWidth: '450px' }}>
          <h3 style={{ marginBottom: '20px', textAlign: 'center' }}>Edit Profile</h3>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: 'gray', marginBottom: '10px' }}>Choose Avatar</label>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              {AVATARS.map((src, i) => (
                <img 
                  key={i} 
                  src={src} 
                  alt="Avatar option" 
                  onClick={() => setEditAvatar(src)}
                  style={{ 
                    width: '70px', 
                    height: '70px', 
                    borderRadius: '50%', 
                    background: 'white', 
                    cursor: 'pointer',
                    border: editAvatar === src ? '4px solid #fc4c02' : '4px solid transparent',
                    transition: 'border 0.2s'
                  }} 
                />
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', color: 'gray', marginBottom: '8px' }}>Nickname</label>
            <input 
              type="text" 
              className="auth-input"
              value={editNickname}
              onChange={(e) => setEditNickname(e.target.value)}
              style={{ width: '100%', padding: '12px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '15px' }}>
            <button 
              onClick={() => setIsEditing(false)}
              className="secondary-btn"
              style={{ flex: 1, padding: '12px' }}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="primary-btn"
              style={{ flex: 1, padding: '12px' }}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <img src={displayAvatar} alt="Avatar" style={{ width: '120px', height: '120px', borderRadius: '50%', background: 'white', marginBottom: '20px', border: '4px solid #fc4c02' }} />
          <h2>{profile.nickname}</h2>
          <p style={{ color: 'gray', marginBottom: '30px' }}>@{username}</p>

          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px', width: '100%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h4 style={{ margin: 0 }}>Account Info</h4>
              <button 
                onClick={handleEdit}
                style={{ background: 'transparent', color: '#fc4c02', border: '1px solid #fc4c02', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Edit
              </button>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ color: 'gray' }}>Status</span>
              <span style={{ color: '#fc4c02', fontWeight: 'bold' }}>BETA MODE</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
              <span style={{ color: 'gray' }}>Member Since</span>
              <span>{new Date(profile.joinedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
            </div>
            
            <button 
              onClick={onLogout}
              style={{ width: '100%', padding: '12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', transition: 'background 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.background = '#dc2626'}
              onMouseOut={(e) => e.currentTarget.style.background = '#ef4444'}
            >
              Log Out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
