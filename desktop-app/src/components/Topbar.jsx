import React, { useState } from 'react';
import ReportModal from './ReportModal';

export default function Topbar({ searchQuery, setSearchQuery, onOpenCustomModal, showToast, userEmail, setActiveCategory, onRefetch }) {
  const [isReportOpen, setIsReportOpen] = useState(false);
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

        <button className="icon-btn" onClick={() => setIsReportOpen(true)} title="Report Issue">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
            <line x1="4" y1="22" x2="4" y2="15"></line>
          </svg>
        </button>
        <button className="icon-btn" onClick={onRefetch} title="Refresh Streams">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6"></path>
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
            <path d="M3 22v-6h6"></path>
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
          </svg>
        </button>
        <button className="icon-btn" onClick={onOpenCustomModal} title="Play Custom Stream">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        </button>
        <div className="profile" onClick={() => setActiveCategory('profile')}>
          <img src={avatarUrl} alt="Profile" style={{ background: '#fff' }} />
          <span>{username}</span>
        </div>
      </div>
      <ReportModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} />
    </div>
  );
}
