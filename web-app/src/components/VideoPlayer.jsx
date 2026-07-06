import React, { useRef, useEffect, useState } from 'react';
import shaka from 'shaka-player/dist/shaka-player.ui.js';
import 'shaka-player/dist/controls.css';

export default function VideoPlayer({ stream }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [player, setPlayer] = useState(null);
  const [ui, setUi] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    shaka.polyfill.installAll();
    
    // Check if the browser is supported
    if (!shaka.Player.isBrowserSupported()) {
      setError('Browser not supported for encrypted DASH streams (Wait! iOS/Safari does not support this native player for MPD).');
      return;
    }

    const initPlayer = async () => {
      const newPlayer = new shaka.Player();
      await newPlayer.attach(videoRef.current);
      
      const newUi = new shaka.ui.Overlay(newPlayer, containerRef.current, videoRef.current);
      
      setPlayer(newPlayer);
      setUi(newUi);
      
      newPlayer.addEventListener('error', (e) => {
        console.error('Error code', e.detail.code, 'object', e.detail);
        setError(`Playback Error: ${e.detail.code}`);
      });
    };

    initPlayer();

    return () => {
      if (player) {
        player.destroy();
      }
      if (ui) {
        ui.destroy();
      }
    };
  }, []);

  useEffect(() => {
    if (player && stream) {
      loadStream();
    }
  }, [player, stream]);

  const loadStream = async () => {
    try {
      setError(null);
      // Reset DRM config
      player.configure({
        drm: {
          clearKeys: {}
        }
      });

      if (stream.clearKeys) {
        player.configure({
          drm: {
            clearKeys: stream.clearKeys
          }
        });
      }

      await player.load(stream.url);
      videoRef.current.play();
    } catch (e) {
      console.error('Load Error', e);
      setError(`Failed to load stream: ${e.message || e.code}`);
    }
  };

  return (
    <div className="video-player-wrapper" style={{ width: '100%', height: '100%', position: 'relative', background: '#000' }}>
      {error && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center', zIndex: 10 }}>
          <div>
            <h3 style={{ color: '#ff4d4f' }}>Playback Error</h3>
            <p>{error}</p>
            {stream?.url?.includes('.mpd') && (
               <p style={{ marginTop: '10px', fontSize: '0.9em', color: '#ccc' }}>
                 Note: iOS Safari does not natively support DASH (.mpd) streams. Try a .m3u8 stream on iOS.
               </p>
            )}
          </div>
        </div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
        <video ref={videoRef} style={{ width: '100%', height: '100%' }} autoPlay playsInline />
      </div>
    </div>
  );
}
