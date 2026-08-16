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
import LanguageModal from './components/LanguageModal';
import ChangelogModal from './components/ChangelogModal';
import { getStorage, setStorage, removeStorage } from './storage';

export default function App() {
  const { streams, loading, setStreams, refetch } = useStreams();
  const [updateStatus, setUpdateStatus] = useState(null);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showChangelog, setShowChangelog] = useState(() => {
    return getStorage('sportify_last_seen_version') !== '1.26.8';
  });


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
  const [languageSelectStream, setLanguageSelectStream] = useState(null);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const [favorites, setFavorites] = useState([]);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [customCards, setCustomCards] = useState([]);

  const handleOnboardingComplete = () => {
    setStorage('sportify_setup_complete', 'true');
    sessionStorage.setItem('sportify_unlocked', 'true');
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

  React.useEffect(() => {
    const theme = getStorage('sportify_theme') || 'classic-dark';
    document.documentElement.setAttribute('data-theme', theme);
  }, []);

  React.useEffect(() => {
    if (window.electronAPI && window.electronAPI.onUpdateAvailable) {
      window.electronAPI.onUpdateAvailable((info) => {
        setUpdateStatus('available');
        setUpdateInfo(info);
      });
      window.electronAPI.onUpdateProgress((progressObj) => {
        setUpdateStatus('downloading');
        setUpdateProgress(progressObj.percent || 0);
      });
      window.electronAPI.onUpdateDownloaded(() => {
        setUpdateStatus('ready');
      });
      window.electronAPI.onUpdateNotAvailable(() => {
        alert("You are already on the latest version of Sportify!");
      });
      window.electronAPI.onUpdateError((err) => {
        alert("Error checking for updates: " + err);
      });
    }
  }, []);

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleLogout = React.useCallback(() => {
    removeStorage('sportify_setup_complete');
    removeStorage('sportify_username');
    sessionStorage.removeItem('sportify_unlocked');
    setIsOnboarding(true);
    setActiveCategory('all');
  }, []);

  const userName = getStorage('sportify_username');
  const API_BASE = import.meta.env.VITE_API_BASE || "";

  React.useEffect(() => {
    if (userName) {
      fetch(`${API_BASE}/get-user-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: userName })
      })
        .then(async res => res.json())
        .then(data => {
          if (data && Array.isArray(data.favorites)) {
            setFavorites(data.favorites);
          }
        })
        .catch(err => console.error("Failed to load user data from Cloudflare", err));
    }
  }, [userName, handleLogout]);

  React.useEffect(() => {
    const fetchRemoteData = async () => {
      try {
        const url = import.meta.env.VITE_REMOTE_JSON_URL;
        if (!url) return;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        
        const msg = data.broadcastMessage || data.broadcast_message || data.broadcast || '';
        setBroadcastMessage(msg);
        
        if (data.cards && Array.isArray(data.cards)) {
          // Normalize custom cards to match streams format
          const formattedCards = data.cards.map((c, idx) => ({
            id: c.id || `custom_card_${idx}`,
            name: c.title || c.name || "Custom Event",
            logo: c.logo || c.image || null,
            category: c.category || "all",
            status: c.status || "LIVE",
            startTime: c.startTime || "",
            url: c.url || "",
            clearKeys: c.clearKeys || null,
            languageUrls: c.languageUrls || {},
            language: c.language || "ENGLISH",
            featured: true,
            source: 'live'
          }));
          setCustomCards(formattedCards);
        }
      } catch (err) {
        console.error("Failed to fetch remote data:", err);
      }
    };
    fetchRemoteData();
  }, []);

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
      
      if (userName) {
        // Fetch current data first so we don't overwrite history
        fetch(`${API_BASE}/get-user-data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: userName })
        })
        .then(res => res.json())
        .then(data => {
          const currentHistory = data.watchHistory || [];
          return fetch(`${API_BASE}/update-user-data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: userName, data: { favorites: newFavs, watchHistory: currentHistory } })
          });
        })
        .catch(err => console.error("Failed to sync favorites to Cloudflare", err));
      }
      
      return newFavs;
    });
  };

  const handleCustomStreamPlay = (customStream) => {
    if (customStream.language === 'multi' && customStream.languageUrls && Object.keys(customStream.languageUrls).length > 1) {
      setLanguageSelectStream(customStream);
      setIsCustomModalOpen(false);
    } else {
      setStreams(prev => {
        if (prev.find(s => s.id === customStream.id)) return prev;
        return [...prev, customStream];
      });
      setIsCustomModalOpen(false);
      setActiveStreamId(customStream.id);
    }
  };

  const handleLanguageSelect = (lang, url) => {
    if (languageSelectStream) {
      const updatedStream = { ...languageSelectStream, url: url };
      setStreams(prev => {
        return prev.map(s => s.id === updatedStream.id ? updatedStream : s);
      });
      setLanguageSelectStream(null);
      setActiveStreamId(updatedStream.id);
    }
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
      'golf': ['golf', 'pga'],
      'basketball': ['basketball', 'nba']
    };

    return streams.filter(stream => {
      const nameMatch = stream.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      let langMatch = true;
      const lowerName = stream.name.toLowerCase();
      const streamLang = stream.language ? stream.language.toLowerCase() : '';
      const isEnglish = lowerName.includes('eng') || lowerName.includes('uk') || lowerName.includes('us') || streamLang.includes('eng');
      const isHindi = lowerName.includes('hin') || lowerName.includes('ind') || streamLang.includes('hin') || streamLang.includes('ind');
      
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

  const featuredStreams = useMemo(() => {
    const liveOrUpcomingCustom = customCards.filter(c => c.status === 'LIVE' || c.status === 'UPCOMING');
    const defaultFeatured = streams.filter(s => s.featured && (s.status === 'LIVE' || s.status === 'UPCOMING'));
    
    const merged = [...liveOrUpcomingCustom];
    defaultFeatured.forEach(item => {
      if (!merged.some(m => m.id === item.id)) {
        merged.push(item);
      }
    });

    return merged.slice(0, 8);
  }, [streams, customCards]);


  return (
    <>
      {updateStatus && (
        <div className="onboarding-overlay" style={{ zIndex: 9999, background: 'rgba(0,0,0,0.95)', animation: 'fadeIn 0.4s ease-out' }}>
          <div className="onboarding-modal" style={{ textAlign: 'center', padding: '40px', animation: 'slideUp 0.4s ease-out', maxWidth: '500px' }}>
            <h2 className="onboarding-title">Update Required</h2>
            <p className="onboarding-desc">A new version of Sportify is available{updateInfo?.version ? ` (v${updateInfo.version})` : ''}. You must update to continue using the app.</p>
            
            {updateStatus === 'available' && (
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '30px' }}>
                <button className="primary-btn" onClick={() => {
                  setUpdateStatus('downloading');
                  window.electronAPI.startUpdate();
                }}>
                  Auto Install
                </button>
                <button className="secondary-btn" onClick={() => {
                  window.electronAPI.openExternal('https://github.com/yaseenzj/Sportify/releases');
                }}>
                  Manual Install
                </button>
              </div>
            )}

            {updateStatus === 'downloading' && (
              <div style={{ marginTop: '30px', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--text-muted)' }}>
                  <span>Downloading update...</span>
                  <span>{Math.round(updateProgress)}%</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'var(--bg-lighter)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'var(--accent)', width: `${updateProgress}%`, transition: 'width 0.2s ease' }}></div>
                </div>
              </div>
            )}

            {updateStatus === 'ready' && (
              <div style={{ marginTop: '30px', color: 'var(--accent)', fontWeight: 'bold' }}>
                Update downloaded. Restarting...
              </div>
            )}
          </div>
        </div>
      )}

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
                    
                    const user = getStorage('sportify_username');
                    if (user) {
                      fetch(`${import.meta.env.VITE_API_BASE || ""}/update-last-active`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: user })
                      }).catch(e => console.error("Failed to update last active ping", e));
                    }
                  } else {
                    setPinError('Incorrect PIN');
                  }
                }} 
                autoFocus={true} 
                resetOnComplete={true}
              />
              
              {pinError && <div className="auth-error" style={{ marginTop: '20px' }}>{pinError}</div>}
              
              <div style={{ marginTop: '24px' }}>
                <button 
                  onClick={handleLogout}
                  style={{ 
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'var(--accent)',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    fontSize: '0.85rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    opacity: 0.8
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.opacity = '0.8'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                >
                  Sign Out
                </button>
              </div>
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
          broadcastMessage={broadcastMessage}
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
            <Hero onPlay={handleCustomStreamPlay} slides={featuredStreams} />
            
            <div className="filters-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 className="section-title" style={{ margin: 0 }}>{activeCategory === 'favorites' ? 'Your Favorites' : 'Live Channels'}</h3>
              
              {/* Language Selector Pill */}
              <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', alignItems: 'center' }}>
                <button
                  onClick={() => setLanguageFilter('all')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    background: languageFilter === 'all' ? 'var(--accent)' : 'transparent',
                    color: languageFilter === 'all' ? 'var(--accent-text)' : 'var(--text-muted)',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    outline: 'none'
                  }}
                  onMouseOver={(e) => {
                    if (languageFilter !== 'all') e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  }}
                  onMouseOut={(e) => {
                    if (languageFilter !== 'all') e.currentTarget.style.background = 'transparent';
                  }}
                >
                  All
                </button>
                <button
                  onClick={() => setLanguageFilter('english')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    background: languageFilter === 'english' ? 'var(--accent)' : 'transparent',
                    color: languageFilter === 'english' ? 'var(--accent-text)' : 'var(--text-muted)',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    outline: 'none'
                  }}
                  onMouseOver={(e) => {
                    if (languageFilter !== 'english') e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  }}
                  onMouseOut={(e) => {
                    if (languageFilter !== 'english') e.currentTarget.style.background = 'transparent';
                  }}
                >
                  English
                </button>
              </div>
            </div>

            {loading ? (
              <div className="loading-state">Loading streams...</div>
            ) : filteredStreams.length === 0 ? (
              <div className="loading-state">{activeCategory === 'favorites' ? "You haven't favorited any streams yet." : "No streams found."}</div>
            ) : (
              <StreamGrid streams={filteredStreams} onPlay={(id) => { 
                const stream = streams.find(s => s.id === id);
                if (stream && stream.language === 'multi' && stream.languageUrls && Object.keys(stream.languageUrls).length > 1) {
                  setLanguageSelectStream(stream);
                } else {
                  setActiveStreamId(id); 
                }
              }} favorites={favorites} toggleFavorite={toggleFavorite} />
            )}
          </div>
        )}
      </main>

      {activeStreamId && (
        <PlayerModal 
          key={activeStreamId}
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
          userEmail={userName}
        />
      )}

      {languageSelectStream && (
        <LanguageModal 
          stream={languageSelectStream}
          onSelectLanguage={handleLanguageSelect}
          onClose={() => setLanguageSelectStream(null)}
        />
      )}

      {toastMessage && <ToastContainer message={toastMessage} />}
      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
    </div>
    </>
  );
}
