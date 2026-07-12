import React, { useEffect, useRef, useState } from 'react';
import { getStorage } from '../storage';

export default function PlayerModal({ stream, onClose, isFavorite, onToggleFavorite, showToast }) {
  const [activeSourceInfo, setActiveSourceInfo] = useState('');
  const [hlsLevels, setHlsLevels] = useState([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const videoRef = useRef(null);
  const videoContainerRef = useRef(null);
  const playerRef = useRef(null);
  const uiRef = useRef(null);


  useEffect(() => {
    let mounted = true;

    async function initPlayer() {
      const video = videoRef.current;
      const container = videoContainerRef.current;
      
      const isM3u8 = stream.url.includes('.m3u8');
      
      // 1. Use Hls.js for m3u8 streams without DRM (matches AuthoIPTV)
      if (isM3u8 && !stream.clearKeys && window.Hls && window.Hls.isSupported()) {
        console.log("Using hls.js for optimal HLS playback");
        video.controls = true; // Use native controls for hls.js
        
        const hls = new window.Hls({
          maxLoadingDelay: 4,
          minAutoBitrate: 0,
          lowLatencyMode: false, // Turn off low latency for better stability on IPTV
          maxBufferLength: 30, // Buffer up to 30 seconds
          maxMaxBufferLength: 60,
          backBufferLength: 30
        });
        playerRef.current = hls; // Store in same ref for cleanup
        
        // Custom headers for hls.js
        if (stream.headers) {
          hls.config.xhrSetup = function(xhr, url) {
            for (const [key, value] of Object.entries(stream.headers)) {
              xhr.setRequestHeader(key, value);
            }
          };
        }

        // Robust Hls.js Error Recovery (prevents freeze/black screen on stalls)
        let recoveryAttempts = 0;
        hls.on(window.Hls.Events.ERROR, (event, data) => {
          console.error("Hls.js error:", data);
          if (data.fatal) {
            switch (data.type) {
              case window.Hls.ErrorTypes.NETWORK_ERROR:
                console.log("Fatal network error encountered, trying to recover...");
                if (recoveryAttempts < 5) {
                  recoveryAttempts++;
                  hls.startLoad();
                } else {
                  console.error("Max network recovery attempts reached. Stream offline.");
                  if (showToast) showToast("Connection lost. Stream offline.");
                  setActiveSourceInfo("Stream Offline");
                }
                break;
              case window.Hls.ErrorTypes.MEDIA_ERROR:
                console.log("Fatal media error encountered, trying to recover...");
                if (recoveryAttempts < 5) {
                  recoveryAttempts++;
                  hls.recoverMediaError();
                } else {
                  console.error("Max media recovery attempts reached.");
                  if (showToast) showToast("Codec error. Failed to play stream.");
                  setActiveSourceInfo("Playback Error");
                }
                break;
              default:
                console.error("Unrecoverable error encountered:", data);
                hls.destroy();
                if (showToast) showToast("Fatal playback error occurred.");
                setActiveSourceInfo("Fatal Error");
                break;
            }
          }
        });

        const allUrlsToTry = [
          { url: stream.url },
          ...(stream.backupUrls || [])
        ];
        
        let success = false;
        
        for (const attempt of allUrlsToTry) {
           if (mounted && attempt === allUrlsToTry[0]) {
             setActiveSourceInfo('Connecting to Primary Source...');
           } else if (mounted) {
             const backupIndex = allUrlsToTry.indexOf(attempt);
             setActiveSourceInfo(`Connecting to Backup Source ${backupIndex}...`);
           }
           
           try {
             // Track stream in main process for referer/origin spoofing
             if (window.electronAPI) {
               window.electronAPI.setActiveStream(attempt.url, stream.headers || null);
             }
             
             // Reset recovery attempts for new URL
             recoveryAttempts = 0;

             await new Promise((resolve, reject) => {
               hls.loadSource(attempt.url);
               hls.attachMedia(video);
               
               let hasResolved = false;
               
               hls.once(window.Hls.Events.MANIFEST_PARSED, (event, data) => {
                 if (!hasResolved) { 
                   hasResolved = true; 
                   if (mounted) {
                     setHlsLevels(hls.levels || []);
                     setCurrentLevel(hls.currentLevel);
                   }
                   resolve(); 
                 }
               });
               
               hls.on(window.Hls.Events.LEVEL_SWITCHED, (event, data) => {
                 if (mounted) setCurrentLevel(data.level);
               });
               
               hls.once(window.Hls.Events.ERROR, (event, data) => {
                 if (data.fatal && !hasResolved) {
                   hasResolved = true;
                   reject(data);
                 }
               });
             });
             
             success = true;
             if (mounted) {
               if (attempt === allUrlsToTry[0]) {
                 setActiveSourceInfo('Playing: Primary Source');
               } else {
                 const backupIndex = allUrlsToTry.indexOf(attempt);
                 setActiveSourceInfo(`Playing: Backup Source ${backupIndex}`);
               }
               video.muted = false;
               video.volume = 1;
               video.play().catch(e => console.error("Play failed", e));
             }
             break;
           } catch (e) {
             console.error("HLS attempt failed", attempt.url, e);
           }
        }
        
        if (!success) {
          if (showToast) showToast('Failed to load the stream and all backups.');
          if (mounted) setActiveSourceInfo('All sources offline');
        }
        return;
      }
      
      // 2. Fallback to Shaka Player for DASH / DRM streams
      console.log("Using Shaka Player");
      video.controls = false;
      
      if (!window.shaka || !window.shaka.Player || !window.shaka.Player.isBrowserSupported()) {
        console.error('Browser not supported for Shaka Player');
        return;
      }
      window.shaka.polyfill.installAll();

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
          restrictToElementSize: false,
          restrictToScreenSize: false,
          restrictions: { maxHeight: maxHeight }
        },
        streaming: {
          retryParameters: { maxAttempts: 100, baseDelay: 1000, backoffFactor: 2, fuzzFactor: 0.5, timeout: 0 },
          bufferingGoal: 30, rebufferingGoal: 2, bufferBehind: 30, jumpLargeGaps: true, stallEnabled: true,
          alwaysStreamText: false, lowLatencyMode: false, inaccurateManifestTolerance: 0.2
        },
        manifest: {
          retryParameters: { maxAttempts: 100, baseDelay: 1000, backoffFactor: 2, fuzzFactor: 0.5, timeout: 0 },
          disableVideo: false, disableAudio: false,
          hls: {
            ignoreTextStreamFailures: true, ignoreImageStreamFailures: true,
            defaultAudioCodec: 'mp4a.40.2', defaultVideoCodec: 'avc1.42E01E', useFullSegmentsForStartTime: true
          }
        }
      };
      player.configure(playerConfig);

      player.getNetworkingEngine().registerRequestFilter((type, request) => {
        if (stream.headers) {
          for (const [key, value] of Object.entries(stream.headers)) {
            request.headers[key] = value;
          }
        }
      });

      player.addEventListener('error', async (event) => {
        if (event.detail && event.detail.severity === 2) { 
          if (player.retryStreaming && player.retryStreaming()) {
            console.log('Successfully retried streaming seamlessly');
          }
        }
      });

      const allUrlsToTry = [ { url: stream.url, clearKeys: stream.clearKeys }, ...(stream.backupUrls || []) ];
      let success = false;
      for (const attempt of allUrlsToTry) {
        try {
          if (mounted && attempt === allUrlsToTry[0]) setActiveSourceInfo('Connecting to Primary Source...');
          else if (mounted) setActiveSourceInfo(`Connecting to Backup Source ${allUrlsToTry.indexOf(attempt)}...`);

          if (window.electronAPI) {
            window.electronAPI.setActiveStream(attempt.url, stream.headers || null);
          }

          player.configure({ drm: { clearKeys: attempt.clearKeys ? attempt.clearKeys : {} } });
          
          let mimeType = attempt.url.includes('.m3u8') ? 'application/x-mpegURL' : 
                         (attempt.url.includes('.mpd') ? 'application/dash+xml' : undefined);
          await player.load(attempt.url, null, mimeType);
          success = true;
          
          if (mounted) {
            if (attempt === allUrlsToTry[0]) setActiveSourceInfo('Playing: Primary Source');
            else setActiveSourceInfo(`Playing: Backup Source ${allUrlsToTry.indexOf(attempt)}`);
          }
          break;
        } catch (e) {
          console.error('Failed to load stream attempt:', attempt.url, e);
        }
      }

      if (success) {
        if (mounted) {
          video.muted = false;
          video.volume = 1;
          video.play().catch(e => console.error("Play failed", e));
        }
      } else {
        if (showToast) showToast('Failed to load the stream and all backups. It may be offline.');
        if (mounted) setActiveSourceInfo('All sources offline');
      }
    }

    if (stream) {
      setHlsLevels([]);
      setCurrentLevel(-1);
      initPlayer();
    }

    return () => {
      mounted = false;
      if (window.electronAPI) {
        window.electronAPI.clearActiveStream();
      }
      if (uiRef.current) {
        uiRef.current.destroy();
      }
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream?.url]);

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
            {hlsLevels.length > 0 && (
              <select 
                value={currentLevel} 
                onChange={(e) => {
                  const level = parseInt(e.target.value);
                  if (playerRef.current) {
                    playerRef.current.currentLevel = level;
                    setCurrentLevel(level);
                  }
                }}
                title="Change Quality"
                style={{
                  background: 'var(--primary-color, #fc4c02)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 28px 6px 12px',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  outline: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(252, 76, 2, 0.25)',
                  appearance: 'none',
                  backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23FFFFFF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 10px center',
                  backgroundSize: '10px auto',
                  transition: 'all 0.2s ease'
                }}
              >
                <option value="-1" style={{color: 'black'}}>Auto Quality</option>
                {hlsLevels.map((level, idx) => (
                  <option key={idx} value={idx} style={{color: 'black'}}>
                    {level.height ? `${level.height}p` : `Quality ${idx + 1}`} {level.bitrate ? `(${(level.bitrate / 1000000).toFixed(1)}mb)` : ''}
                  </option>
                ))}
              </select>
            )}
            
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
