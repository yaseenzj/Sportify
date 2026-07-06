import React, { useState, useEffect } from 'react';

export default function Hero() {
  const [slides, setSlides] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    let mounted = true;
    fetch('https://raw.githubusercontent.com/kajju027/Fancode-Events-Json/refs/heads/main/fancode.json')
      .then(r => r.json())
      .then(data => {
        if (mounted && data && data.matches) {
          const matchesWithImages = data.matches.filter(m => m.image && m.status !== 'COMPLETED');
          if (matchesWithImages.length > 0) {
            setSlides(matchesWithImages.slice(0, 5)); // Take top 5
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

  if (slides.length === 0) {
    // Fallback if no data loaded yet
    return (
      <div className="hero-featured" style={{ background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  const currentSlide = slides[currentIndex];

  // Get next two slides for thumbnails
  const nextSlide1 = slides[(currentIndex + 1) % slides.length];
  const nextSlide2 = slides[(currentIndex + 2) % slides.length];

  return (
    <div className="hero-featured" style={{ transition: 'all 0.5s ease-in-out' }}>
      <div
        className="hero-bg"
        style={{ backgroundImage: `url(${currentSlide.image})`, transition: 'background-image 0.5s ease-in-out' }}
      ></div>
      <div className="hero-overlay"></div>
      <div className="hero-content">
        <div className="tags">
          <span className="tag">{currentSlide.status === 'LIVE' ? 'LIVE NOW' : 'UPCOMING'}</span>
          <span className="tag" style={{ textTransform: 'uppercase' }}>{currentSlide.category}</span>
          <span className="tag">TRENDING</span>
        </div>
        <h1 className="hero-title" style={{ transition: 'opacity 0.5s ease' }}>{currentSlide.title}</h1>
        <p className="hero-desc">
          {currentSlide.tournament} <br />
          <span style={{ opacity: 0.8, fontSize: '0.9rem', marginTop: '8px', display: 'inline-block' }}>Starts: {currentSlide.startTime}</span>
        </p>
        <div className="hero-footer" style={{ marginTop: '24px' }}>
          <div className="hero-price">
            <span className={`status-${currentSlide.status === 'LIVE' ? 'live' : 'upcoming'}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: currentSlide.status === 'LIVE' ? '#ff3b30' : '#4cd964', fontWeight: 600 }}>
              <span className="dot" style={{ background: currentSlide.status === 'LIVE' ? '#ff3b30' : '#4cd964', boxShadow: `0 0 8px ${currentSlide.status === 'LIVE' ? '#ff3b30' : '#4cd964'}` }}></span>
              {currentSlide.status === 'LIVE' ? 'Live Match' : 'Upcoming Match'}
            </span>
          </div>
        </div>
      </div>

      {slides.length > 1 && (
        <div className="hero-thumbnails">
          <div
            className="thumb-main"
            style={{ backgroundImage: `url(${currentSlide.image})`, transition: 'background-image 0.5s ease-in-out' }}
          ></div>
          <div className="thumb-small-group">
            <div className="thumb-small" style={{ backgroundImage: `url(${nextSlide1.image})`, transition: 'background-image 0.5s ease-in-out' }}></div>
            {slides.length > 2 && (
              <div className="thumb-small" style={{ backgroundImage: `url(${nextSlide2.image})`, transition: 'background-image 0.5s ease-in-out' }}></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
