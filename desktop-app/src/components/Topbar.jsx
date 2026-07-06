import React from 'react';

export default function Topbar({ searchQuery, setSearchQuery, onOpenCustomModal, showToast, userEmail, setActiveCategory, onRefetch }) {
  const username = userEmail ? userEmail.split('@')[0] : 'Guest';
  const avatarUrl = userEmail 
    ? `https://api.dicebear.com/7.x/adventurer/svg?seed=${userEmail}` 
    : 'https://i.pravatar.cc/150?img=11';

  return (
    <div className="topbar">
      <div className="search-container">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input 
          type="text" 
          placeholder="Search channels..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      
      <div className="user-actions">
        <button className="icon-btn" onClick={onRefetch} title="Sync/Reload Streams">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
        </button>
        <button className="icon-btn" onClick={() => showToast('No new notifications')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
          <span className="badge-dot"></span>
        </button>
        <button className="icon-btn" onClick={onOpenCustomModal} title="Play Custom Stream">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        </button>
        <div className="profile" onClick={() => setActiveCategory('profile')}>
          <img src={avatarUrl} alt="Profile" style={{ background: '#fff' }} />
          <span>{username}</span>
        </div>
      </div>
    </div>
  );
}
