import React, { useState, useMemo } from 'react';
import { useStreams } from './hooks/useStreams';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Hero from './components/Hero';
import StreamGrid from './components/StreamGrid';
import PlayerModal from './components/PlayerModal';
import CustomStreamModal from './components/CustomStreamModal';
import ToastContainer from './components/ToastContainer';
import Onboarding from './components/Onboarding';
import PinInput from './components/PinInput';
import Settings from './components/Settings';
import Profile from './components/Profile';
import { getStorage, setStorage, removeStorage } from './storage';

export default function App() {
  const { streams, loading, setStreams, refetch } = useStreams();
  const [isOnboarding, setIsOnboarding] = useState(() => {
    return getStorage('sportify_setup_complete') !== 'true';
  });
  
  const [isLocked, setIsLocked] = useState(() => {
    // If setup is complete and session is NOT unlocked, lock the app.
    // sessionStorage is cleared when the app is completely closed.
    return getStorage('sportify_setup_complete') === 'true' && sessionStorage.getItem('sportify_unlocked') !== 'true';
  });
  
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  const [showSplash, setShowSplash] = useState(() => {
    return getStorage('sportify_setup_complete') === 'true' && !isLocked; // Show splash only if setup is done and not locked
  });

  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [activeStreamId, setActiveStreamId] = useState(null);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = getStorage('sportify_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleOnboardingComplete = () => {
    setStorage('sportify_setup_complete', 'true');
    setIsOnboarding(false);
    setShowSplash(false);
  };

  React.useEffect(() => {
    if (!loading && showSplash) {
      const timer = setTimeout(() => {
        setShowSplash(false);
      }, 1000); // 1s aesthetic delay
      return () => clearTimeout(timer);
    }
  }, [loading, showSplash]);

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const userName = getStorage('sportify_username');
  const API_BASE = import.meta.env.VITE_API_BASE || "";

  React.useEffect(() => {
    if (userName) {
      fetch(`${API_BASE}/favorites?username=${encodeURIComponent(userName)}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && Array.isArray(data.favorites)) {
            setFavorites(data.favorites);
            setStorage('sportify_favorites', JSON.stringify(data.favorites));
          }
        })
        .catch(err => console.error("Failed to load favorites", err));
    }
  }, [userName]);

  const toggleFavorite = (streamId) => {
    setFavorites(prev => {
      let newFavs;
      if (prev.includes(streamId)) {
        newFavs = prev.filter(id => id !== streamId);
        showToast('Removed from favorites');
      } else {
        newFavs = [...prev, streamId];
        showToast('Added to favorites');
      }
      
      setStorage('sportify_favorites', JSON.stringify(newFavs));
      
      if (userName) {
        fetch(`${API_BASE}/favorites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: userName, favorites: newFavs })
        }).catch(err => console.error("Failed to sync favorites", err));
      }
      
      return newFavs;
    });
  };

  const handleCustomStreamPlay = (customStream) => {
    setStreams(prev => [...prev, customStream]);
    setIsCustomModalOpen(false);
    setActiveStreamId(customStream.id);
  };

  const filteredStreams = useMemo(() => {
    if (activeCategory === 'favorites') {
      return streams.filter(s => favorites.includes(s.id));
    }

    const categoryMap = {
      'football': ['football', 'fifa', 'soccer', 'espn', 'fox sports', 'sky sports'],
      'cricket': ['cricket', 'willow', 'sky sports cricket', 'star sports'],
      'f1': ['f1', 'formula', 'sky sports f1', 'motorsport'],
      'motogp': ['motogp', 'moto gp', 'tnt sports'],
      'golf': ['golf', 'pga']
    };

    return streams.filter(stream => {
      const nameMatch = stream.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      let langMatch = true;
      const lowerName = stream.name.toLowerCase();
      const isEnglish = lowerName.includes('eng') || lowerName.includes('uk') || lowerName.includes('us');
      const isHindi = lowerName.includes('hin') || lowerName.includes('ind');
      
      if (languageFilter === 'english') {
        langMatch = isEnglish;
      } else if (languageFilter === 'hindi') {
        langMatch = isHindi;
      } else if (languageFilter === 'others') {
        langMatch = !isEnglish && !isHindi;
      }
      
      let categoryMatch = true;
      if (activeCategory !== 'all') {
        categoryMatch = stream.category === activeCategory;
      }

      return nameMatch && langMatch && categoryMatch;
    });
  }, [streams, searchQuery, languageFilter, activeCategory, favorites]);

  const handleLogout = () => {
    removeStorage('sportify_setup_complete');
    removeStorage('sportify_username');
    setIsOnboarding(true);
    setActiveCategory('all');
  };

  return (
    <>
      {isOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}
      
      {!isOnboarding && isLocked && (
        <div className="onboarding-overlay" style={{ zIndex: 1000, background: 'rgba(0,0,0,0.95)', animation: 'fadeIn 0.4s ease-out' }}>
          <div className="onboarding-modal" style={{ textAlign: 'center', padding: '40px', animation: 'slideUp 0.4s ease-out' }}>
            <h2 className="onboarding-title">Welcome back, {getStorage('sportify_username') || 'User'}!</h2>
            <p className="onboarding-desc">Please enter your 4-digit PIN to unlock Sportify.</p>
            <div style={{ marginTop: '30px' }}>
              <PinInput 
                onComplete={(val) => {
                  const storedPin = getStorage('sportify_pin') || '0000';
                  if (val === storedPin) {
                    setIsLocked(false);
                    setPinError('');
                    sessionStorage.setItem('sportify_unlocked', 'true');
                    setShowSplash(true); // show splash after unlocking so it transitions nicely
                  } else {
                    setPinError('Incorrect PIN');
                  }
                }} 
                autoFocus={true} 
                resetOnComplete={true}
              />
              
              {pinError && <div className="auth-error" style={{ marginTop: '20px' }}>{pinError}</div>}
            </div>
          </div>
        </div>
      )}

      {!isOnboarding && !isLocked && showSplash && (
        <div className="onboarding-overlay" style={{ zIndex: 1000, background: 'var(--bg-main)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="logo" style={{ fontSize: '4rem', fontWeight: 800, marginBottom: '0', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
            <span>SPORTIFY</span>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '1.2rem', fontWeight: 500, letterSpacing: '4px', marginTop: '-10px', marginLeft: '70px' }}>
            BY ZJ
          </div>
          <div style={{ marginTop: '50px' }}>
             <div className="loading-spinner"></div>
          </div>
        </div>
      )}

      <div className={`app-layout ${isOnboarding || isLocked || showSplash ? 'blurred' : ''}`}>
        <Sidebar 
          activeCategory={activeCategory} 
          setActiveCategory={setActiveCategory} 
          showToast={showToast} 
        />
      
      <main className="main-content">
        <Topbar 
          searchQuery={searchQuery} 
          setSearchQuery={setSearchQuery} 
          onOpenCustomModal={() => setIsCustomModalOpen(true)}
          showToast={showToast}
          userEmail={userName}
          setActiveCategory={setActiveCategory}
          onRefetch={refetch}
        />
        
        {activeCategory === 'settings' ? (
          <div className="scrollable-content"><Settings /></div>
        ) : activeCategory === 'profile' ? (
          <div className="scrollable-content"><Profile userEmail={userName} onLogout={handleLogout} /></div>
        ) : (
          <div className="scrollable-content">
            <Hero />
            
            <div className="filters-section">
              <h3 className="section-title">{activeCategory === 'favorites' ? 'Your Favorites' : 'Live Channels'}</h3>
              <div className="tabs">
                <button className={`tab-btn ${languageFilter === 'all' ? 'active' : ''}`} onClick={() => setLanguageFilter('all')}>All</button>
                <button className={`tab-btn ${languageFilter === 'english' ? 'active' : ''}`} onClick={() => setLanguageFilter('english')}>English</button>
                <button className={`tab-btn ${languageFilter === 'hindi' ? 'active' : ''}`} onClick={() => setLanguageFilter('hindi')}>Hindi</button>
                <button className={`tab-btn ${languageFilter === 'others' ? 'active' : ''}`} onClick={() => setLanguageFilter('others')}>Others</button>
              </div>
            </div>

            {loading ? (
              <div className="loading-state">Loading streams...</div>
            ) : filteredStreams.length === 0 ? (
              <div className="loading-state">{activeCategory === 'favorites' ? "You haven't favorited any streams yet." : "No streams found."}</div>
            ) : (
              <StreamGrid streams={filteredStreams} onPlay={(id) => { setActiveStreamId(id); }} favorites={favorites} toggleFavorite={toggleFavorite} />
            )}
          </div>
        )}
      </main>

      {activeStreamId && (
        <PlayerModal 
          stream={streams.find(s => s.id === activeStreamId)} 
          isFavorite={favorites.includes(activeStreamId)}
          onToggleFavorite={() => toggleFavorite(activeStreamId)}
          showToast={showToast}
          onClose={() => setActiveStreamId(null)} 
        />
      )}

      {isCustomModalOpen && (
        <CustomStreamModal 
          onClose={() => setIsCustomModalOpen(false)} 
          onPlay={handleCustomStreamPlay} 
          showToast={showToast}
        />
      )}

      {toastMessage && <ToastContainer message={toastMessage} />}
    </div>
    </>
  );
}
