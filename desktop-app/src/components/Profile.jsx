import React from 'react';

export default function Profile({ userEmail, onLogout }) {
  const username = userEmail ? userEmail.split('@')[0] : 'Guest';
  const avatarUrl = userEmail 
    ? `https://api.dicebear.com/7.x/adventurer/svg?seed=${userEmail}` 
    : 'https://i.pravatar.cc/150?img=11';

  return (
    <div style={{ padding: '20px', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <img src={avatarUrl} alt="Avatar" style={{ width: '120px', height: '120px', borderRadius: '50%', background: 'white', marginBottom: '20px', border: '4px solid #fc4c02' }} />
      <h2>{username}</h2>
      <p style={{ color: 'gray', marginBottom: '30px' }}>{userEmail}</p>

      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px', width: '100%', maxWidth: '400px' }}>
        <h4 style={{ marginBottom: '15px' }}>Account Info</h4>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ color: 'gray' }}>Status</span>
          <span style={{ color: '#fc4c02', fontWeight: 'bold' }}>VIP ACTIVE</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
          <span style={{ color: 'gray' }}>Member Since</span>
          <span>{new Date().toLocaleDateString()}</span>
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
    </div>
  );
}
