import React, { useEffect, useRef, useState } from 'react';
import { getStorage } from '../storage';

export default function PlayerModal({ stream, onClose, isFavorite, onToggleFavorite, showToast }) {
  const [activeSourceInfo, setActiveSourceInfo] = useState('');
  const videoRef = useRef(null);
  const videoContainerRef = useRef(null);
  const playerRef = useRef(null);
  const uiRef = useRef(null);


  useEffect(() => {
    let mounted = true;

    async function initPlayer() {
      if (!window.shaka || !window.shaka.Player || !window.shaka.Player.isBrowserSupported()) {
        console.error('Browser not supported for Shaka Player');
        return;
      }

      window.shaka.polyfill.installAll();

      const video = videoRef.current;
      const container = videoContainerRef.current;

      const player = new window.shaka.Player(video);
      playerRef.current = player;
      
      const ui = new window.shaka.ui.Overlay(player, container, video);
      uiRef.current = ui;

      const uiConfig = {
        addSeekBar: true,
        controlPanelElements: [
          "play_pause", "rewind", "fast_forward", "mute", "volume", "spacer", "time_and_duration", "quality", "fullscreen", "overflow_menu"
        ],
        overflowMenuButtons: ["quality", "language", "playback_rate"]
      };
      ui.configure(uiConfig);

      const defaultQuality = getStorage('sportify_default_quality') || 'auto';
      let maxHeight = 1080;
      if (defaultQuality !== 'auto') {
        maxHeight = parseInt(defaultQuality, 10);
      }

      const playerConfig = {
        abr: {
          enabled: true,
          defaultBandwidthEstimate: 100000000, // 100 Mbps to force highest quality start
          restrictToElementSize: false,
          restrictToScreenSize: false,
          restrictions: {
            maxHeight: maxHeight
          }
        },
        streaming: {
          bufferingGoal: 5,
          rebufferingGoal: 2,
          bufferBehind: 10,
          jumpLargeGaps: true,
          alwaysStreamText: true,
          lowLatencyMode: true
        },
        manifest: {
          disableVideo: false,
          disableAudio: false,
          hls: {
            ignoreTextStreamFailures: true,
            ignoreImageStreamFailures: true,
            defaultAudioCodec: 'mp4a.40.2',
            defaultVideoCodec: 'avc1.42E01E',
            useFullSegmentsForStartTime: true
          }
        }
      };

      player.configure(playerConfig);

      const allUrlsToTry = [
        { url: stream.url, clearKeys: stream.clearKeys },
        ...(stream.backupUrls || [])
      ];

      let success = false;
      for (const attempt of allUrlsToTry) {
        try {
          if (mounted && attempt === allUrlsToTry[0]) {
            setActiveSourceInfo('Connecting to Primary Source...');
          } else if (mounted) {
            const backupIndex = allUrlsToTry.indexOf(attempt);
            setActiveSourceInfo(`Connecting to Backup Source ${backupIndex}...`);
          }

          player.configure({
            drm: { clearKeys: attempt.clearKeys ? attempt.clearKeys : {} }
          });
          
          let mimeType = attempt.url.includes('.m3u8') ? 'application/x-mpegURL' : 
                         (attempt.url.includes('.mpd') ? 'application/dash+xml' : undefined);
          await player.load(attempt.url, null, mimeType);
          success = true;
          
          if (mounted) {
            if (attempt === allUrlsToTry[0]) {
              setActiveSourceInfo('Playing: Primary Source');
            } else {
              const backupIndex = allUrlsToTry.indexOf(attempt);
              setActiveSourceInfo(`Playing: Backup Source ${backupIndex}`);
            }
          }
          console.log(`Successfully loaded stream: ${attempt.url}`);
          break; // successfully loaded
        } catch (e) {
          console.error('Failed to load stream attempt:', attempt.url, e);
          // Try the next backup URL if available
        }
      }

      if (success) {
        if (mounted) {
          video.muted = false;
          video.volume = 1; // Explicitly unmute and set max volume
          video.play().catch(e => console.error("Play failed", e));
        }
      } else {
        if (showToast) {
          showToast('Failed to load the stream and all backups. It may be offline.');
        }
        if (mounted) {
          setActiveSourceInfo('All sources offline');
        }
      }
    }

    if (stream) {
      initPlayer();
    }

    return () => {
      mounted = false;
      if (uiRef.current) {
        uiRef.current.destroy();
      }
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, [stream, showToast]);

  if (!stream) return null;

  return (
    <div className="modal active" onClick={(e) => { if (e.target.className.includes('modal active')) onClose(); }}>
      <div className="modal-content">
        <div className="modal-header">
          <div>
            <h2 id="modalTitle">{stream.name}</h2>
            {activeSourceInfo && (
              <div style={{ fontSize: '0.8rem', color: '#9d4edd', marginTop: '4px', fontWeight: '500' }}>
                {activeSourceInfo}
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className={`fav-btn ${isFavorite ? 'active' : ''}`} onClick={onToggleFavorite} title="Toggle Favorite">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </button>
            
            <button className="close-btn" onClick={() => onClose()}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>
        <div className="player-container" ref={videoContainerRef}>
          <video id="video" ref={videoRef} autoPlay></video>
        </div>
      </div>
    </div>
  );
}
