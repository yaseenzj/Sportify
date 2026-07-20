import React, { useState, useEffect } from 'react';

export default function Hero({ onPlay }) {
  const [slides, setSlides] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [countdown, setCountdown] = useState('');
  const [localStartTime, setLocalStartTime] = useState('');

  const parseIstToLocal = (timeString) => {
    if (!timeString) return null;
    const timeParts = timeString.match(/(\d+)\s+([a-zA-Z]+)\s+(\d+)\s+(\d+):(\d+)\s+(AM|PM)/i);
    if (!timeParts) return null;

    const [_, day, monthStr, year, hourStr, minute, ampm] = timeParts;
    const month = new Date(`${monthStr} 1 2000`).getMonth();
    let hour = parseInt(hourStr, 10);
    if (ampm.toUpperCase() === 'PM' && hour < 12) hour += 12;
    if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;

    // Create a strict ISO string with IST offset (+05:30)
    const dateStr = `${year}-${(month+1).toString().padStart(2, '0')}-${day.padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minute.padStart(2, '0')}:00+05:30`;
    return new Date(dateStr);
  };

  const calculateTimeRemaining = (targetDate) => {
    if (!targetDate) return '00h 00m 00s';
    const now = new Date();
    const diff = targetDate.getTime() - now.getTime();

    if (diff <= 0) return '00h 00m 00s';

    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);

    return `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  };

  useEffect(() => {
    let mounted = true;
    fetch(import.meta.env.VITE_FANCODE_JSON_URL)
      .then(r => r.json())
      .then(data => {
        if (mounted && data && data.matches) {
          const matchesWithImages = data.matches.filter(m => m.image && m.status !== 'COMPLETED');
          
          const uniqueSlidesMap = new Map();
          matchesWithImages.forEach((match) => {
            const matchId = match.match_id || match.title;
            if (uniqueSlidesMap.has(matchId)) {
               const existing = uniqueSlidesMap.get(matchId);
               let streamUrl = "";
               if (match.streams) {
                 if (match.streams.backup) streamUrl = match.streams.backup.fancode_cdn_v1 || match.streams.backup.fancode_cdn || "";
                 if (!streamUrl) streamUrl = match.streams.primary || match.streams.fancode_cdn || "";
               }
               if (streamUrl && match.language) {
                 existing.languageUrls[match.language.toUpperCase()] = streamUrl;
               }
            } else {
               let streamUrl = "";
               if (match.streams) {
                 if (match.streams.backup) streamUrl = match.streams.backup.fancode_cdn_v1 || match.streams.backup.fancode_cdn || "";
                 if (!streamUrl) streamUrl = match.streams.primary || match.streams.fancode_cdn || "";
               }
               const lang = match.language ? match.language.toUpperCase() : 'UNKNOWN';
               match.languageUrls = {};
               if (streamUrl) match.languageUrls[lang] = streamUrl;
               uniqueSlidesMap.set(matchId, match);
            }
          });
          
          const uniqueSlides = Array.from(uniqueSlidesMap.values());
          if (uniqueSlides.length > 0) {
            setSlides(uniqueSlides.slice(0, 5)); // Take top 5 unique
          }
        }
      })
      .catch(err => console.error("Failed to load trending slides", err));

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (slides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % slides.length);
    }, 10000); 

    return () => clearInterval(interval);
  }, [slides.length]);

  useEffect(() => {
    const currentSlide = slides[currentIndex];
    if (!currentSlide || currentSlide.status === 'LIVE') return;

    const targetDate = parseIstToLocal(currentSlide.startTime);
    if (targetDate) {
      setLocalStartTime(targetDate.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }));
    }

    const timer = setInterval(() => {
      setCountdown(calculateTimeRemaining(targetDate));
    }, 1000);
    setCountdown(calculateTimeRemaining(targetDate));

    return () => clearInterval(timer);
  }, [currentIndex, slides]);

  if (slides.length === 0) {
    // Fallback if no data loaded yet
    return (
      <div className="hero-featured" style={{ background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', borderRadius: '24px' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  const currentSlide = slides[currentIndex];

  const handlePlayClick = () => {
    let streamUrl = "";
    if (currentSlide.streams) {
      if (currentSlide.streams.backup) {
        streamUrl = currentSlide.streams.backup.fancode_cdn_v1 || currentSlide.streams.backup.fancode_cdn || "";
      }
      if (!streamUrl) {
        streamUrl = currentSlide.streams.primary || currentSlide.streams.fancode_cdn || "";
      }
    }
    if (!streamUrl) return;

    if (onPlay) {
      onPlay({
        id: `fancode_${currentSlide.match_id || currentIndex}`,
        name: `${currentSlide.title} | ${currentSlide.tournament}`,
        url: streamUrl,
        source: 'live',
        category: currentSlide.category,
        clearKeys: null,
        languageUrls: currentSlide.languageUrls || {},
        language: currentSlide.languageUrls && Object.keys(currentSlide.languageUrls).length > 1 ? 'multi' : 'ENGLISH'
      });
    }
  };

  // Get next two slides for thumbnails
  const nextSlide1 = slides[(currentIndex + 1) % slides.length];
  const nextSlide2 = slides[(currentIndex + 2) % slides.length];

  return (
    <div className="hero-featured redesigned" style={{ transition: 'all 0.5s ease-in-out', position: 'relative', overflow: 'hidden', borderRadius: '24px', minHeight: '400px', display: 'flex', alignItems: 'flex-end', padding: '40px' }}>
      {slides.map((slide, index) => (
        <div
          key={slide.match_id || index}
          className="hero-bg"
          style={{ 
            backgroundImage: `url(${slide.image})`, 
            transition: 'opacity 0.8s ease-in-out', 
            position: 'absolute', 
            inset: 0, 
            backgroundSize: 'cover', 
            backgroundPosition: 'top', 
            zIndex: 1,
            opacity: index === currentIndex ? 1 : 0
          }}
        ></div>
      ))}
      <div className="hero-overlay" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 50%, transparent 100%), linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 60%)', zIndex: 2 }}></div>
      
      {/* Side Navigation Buttons */}
      <button onClick={() => setCurrentIndex(prev => (prev - 1 + slides.length) % slides.length)} style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', zIndex: 4, background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: '48px', height: '48px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(0,0,0,0.8)'} onMouseOut={e => e.currentTarget.style.background = 'rgba(0,0,0,0.5)'}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </button>
      <button onClick={() => setCurrentIndex(prev => (prev + 1) % slides.length)} style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', zIndex: 4, background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: '48px', height: '48px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(0,0,0,0.8)'} onMouseOut={e => e.currentTarget.style.background = 'rgba(0,0,0,0.5)'}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>

      <div className="hero-content" style={{ zIndex: 3, position: 'relative', maxWidth: '600px', marginLeft: '40px' }}>
        <div className="tags" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <span className="tag" style={{ background: currentSlide.status === 'LIVE' ? 'rgba(255, 59, 48, 0.2)' : 'rgba(76, 217, 100, 0.2)', color: currentSlide.status === 'LIVE' ? '#ff3b30' : '#4cd964', border: `1px solid ${currentSlide.status === 'LIVE' ? 'rgba(255, 59, 48, 0.4)' : 'rgba(76, 217, 100, 0.4)'}` }}>
            {currentSlide.status === 'LIVE' ? 'LIVE NOW' : 'UPCOMING'}
          </span>
          <span className="tag" style={{ textTransform: 'uppercase', background: 'rgba(255,255,255,0.1)' }}>{currentSlide.category}</span>
          <span className="tag" style={{ background: 'rgba(255,255,255,0.1)' }}>FEATURED</span>
        </div>
        
        <h1 className="hero-title" style={{ transition: 'opacity 0.5s ease', fontSize: '3rem', fontWeight: 800, lineHeight: 1.1, marginBottom: '16px', textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>{currentSlide.title}</h1>
        
        <p className="hero-desc" style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.8)', marginBottom: '32px', maxWidth: '500px' }}>
          {currentSlide.tournament}
        </p>

        <div className="hero-actions" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {currentSlide.status === 'LIVE' ? (
            <button className="watch-live-btn" onClick={handlePlayClick} style={{ background: '#ff3b30', color: 'white', padding: '12px 24px', borderRadius: '50px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', border: 'none', cursor: 'pointer', transition: 'all 0.3s ease' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              Watch Now
            </button>
          ) : (
            <div className="countdown-badge" style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(0,0,0,0.4)', padding: '12px 20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '4px' }}>Starts In</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'monospace', color: '#fff' }}>{countdown}</span>
              </div>
              <div style={{ width: '1px', height: '40px', background: 'rgba(255,255,255,0.1)' }}></div>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '4px' }}>Local Time</span>
                <span style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>{localStartTime || currentSlide.startTime}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
