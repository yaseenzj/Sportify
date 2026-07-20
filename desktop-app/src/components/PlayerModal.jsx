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
    let isCancelled = false;

    const teardownPlayer = async () => {
      const videoEl = videoRef.current;
      if (uiRef.current) {
        try { await uiRef.current.destroy(); } catch(e) {}
        uiRef.current = null;
      }
      if (playerRef.current) {
        try { 
          if (playerRef.current.detach) await playerRef.current.detach();
          await playerRef.current.destroy(); 
        } catch(e) {}
        playerRef.current = null;
      }
      if (videoEl) {
        videoEl.pause();
        videoEl.removeAttribute('src');
        videoEl.load();
        if (videoEl.setMediaKeys) {
          try { await videoEl.setMediaKeys(null); } catch (e) {}
        }
      }
    };

    async function initPlayer() {
      if (isCancelled) return;
      
      const allUrlsToTry = [ { url: stream.url, clearKeys: stream.clearKeys }, ...(stream.backupUrls || []) ];
      let success = false;
      
      for (let i = 0; i < allUrlsToTry.length; i++) {
        if (isCancelled) break;
        
        await teardownPlayer();
        if (isCancelled) break;

        const attempt = allUrlsToTry[i];
        const video = videoRef.current;
        const container = videoContainerRef.current;
        
        if (i === 0) setActiveSourceInfo('Connecting to Primary Source...');
        else setActiveSourceInfo(`Connecting to Backup Source ${i}...`);

        if (window.electronAPI) {
          window.electronAPI.setActiveStream(attempt.url, stream.headers || null);
        }

        const isAttemptMpd = attempt.url.includes('.mpd');
        const hasDrm = attempt.clearKeys && Object.keys(attempt.clearKeys).length > 0;
        const useHlsJs = !isAttemptMpd && !hasDrm && window.Hls && window.Hls.isSupported();

        try {
          if (useHlsJs) {
            console.log("Using hls.js for attempt:", attempt.url);
            video.controls = true;
            
            await new Promise((resolve, reject) => {
              const hls = new window.Hls({
                maxLoadingDelay: 4,
                minAutoBitrate: 0,
                lowLatencyMode: false,
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
                backBufferLength: 30
              });
              
              playerRef.current = hls;
              
              if (stream.headers) {
                hls.config.xhrSetup = function(xhr, url) {
                  for (const [key, value] of Object.entries(stream.headers)) {
                    xhr.setRequestHeader(key, value);
                  }
                };
              }

              let hasResolved = false;
              let recoveryAttempts = 0;
              
              const errorHandler = (event, data) => {
                if (data.fatal) {
                  switch (data.type) {
                    case window.Hls.ErrorTypes.NETWORK_ERROR:
                      if (!hasResolved) {
                        hasResolved = true;
                        hls.destroy();
                        reject(new Error("Network error during load"));
                        return;
                      }
                      if (recoveryAttempts < 5) {
                        recoveryAttempts++;
                        hls.startLoad();
                      } else {
                        if (showToast) showToast("Connection lost. Stream offline.");
                        setActiveSourceInfo("Stream Offline");
                      }
                      break;
                    case window.Hls.ErrorTypes.MEDIA_ERROR:
                      if (recoveryAttempts < 5) {
                        recoveryAttempts++;
                        hls.recoverMediaError();
                      } else {
                        if (!hasResolved) {
                          hasResolved = true;
                          hls.destroy();
                          reject(new Error("Media error during load"));
                          return;
                        }
                        if (showToast) showToast("Codec error. Failed to play stream.");
                        setActiveSourceInfo("Playback Error");
                      }
                      break;
                    default:
                      if (!hasResolved) {
                        hasResolved = true;
                        hls.destroy();
                        reject(new Error("Fatal error during load"));
                        return;
                      }
                      hls.destroy();
                      if (showToast) showToast("Fatal playback error occurred.");
                      setActiveSourceInfo("Fatal Error");
                      break;
                  }
                }
              };

              hls.on(window.Hls.Events.ERROR, errorHandler);

              hls.once(window.Hls.Events.MANIFEST_PARSED, (event, data) => {
                if (!hasResolved) { 
                  hasResolved = true; 
                  if (!isCancelled) {
                    setHlsLevels(hls.levels || []);
                    setCurrentLevel(hls.currentLevel);
                  }
                  resolve(hls); 
                }
              });
              
              hls.on(window.Hls.Events.LEVEL_SWITCHED, (event, data) => {
                if (!isCancelled) setCurrentLevel(data.level);
              });
              
              hls.loadSource(attempt.url);
              hls.attachMedia(video);
            });
            
          } else {
            console.log("Using Shaka Player for attempt:", attempt.url);
            video.controls = false;
            
            if (!window.shaka || !window.shaka.Player) {
              throw new Error('Shaka Player not loaded');
            }
            window.shaka.polyfill.installAll();
            if (!window.shaka.Player.isBrowserSupported()) {
              throw new Error('Browser not supported for Shaka Player');
            }

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
                retryParameters: { maxAttempts: 2, baseDelay: 1000, backoffFactor: 2, fuzzFactor: 0.5, timeout: 10000 },
                bufferingGoal: 30, rebufferingGoal: 2, bufferBehind: 30, jumpLargeGaps: true, stallEnabled: true,
                alwaysStreamText: false, lowLatencyMode: false, inaccurateManifestTolerance: 0.2
              },
              manifest: {
                retryParameters: { maxAttempts: 2, baseDelay: 1000, backoffFactor: 2, fuzzFactor: 0.5, timeout: 10000 },
                disableVideo: false, disableAudio: false,
                hls: {
                  ignoreTextStreamFailures: true, ignoreImageStreamFailures: true,
                  defaultAudioCodec: 'mp4a.40.2', defaultVideoCodec: 'avc1.42E01E', useFullSegmentsForStartTime: true
                }
              }
            };
            player.configure(playerConfig);

            player.getNetworkingEngine().clearAllRequestFilters();
            player.getNetworkingEngine().registerRequestFilter((type, request) => {
              if (stream.headers) {
                for (const [key, value] of Object.entries(stream.headers)) {
                  request.headers[key] = value;
                }
              }
            });

            player.addEventListener('error', (event) => {
              if (event.detail && event.detail.severity === 2) { 
                if (player.retryStreaming && player.retryStreaming()) {
                  console.log('Successfully retried streaming seamlessly');
                }
              }
            });

            let drmConfig = {};
            if (hasDrm) {
              drmConfig.clearKeys = attempt.clearKeys;
            }
            player.configure({ drm: drmConfig });
            
            let mimeType = undefined;
            if (attempt.url.includes('.m3u8')) {
              mimeType = 'application/x-mpegURL';
            } else if (attempt.url.includes('.mpd')) {
              mimeType = 'application/dash+xml';
            }
            
            await player.load(attempt.url, undefined, mimeType);
          }
          
          if (isCancelled) break;
          
          success = true;
          if (i === 0) setActiveSourceInfo('Playing: Main Source');
          else setActiveSourceInfo(`Playing: Backup Source ${i}`);
          
          video.muted = false;
          video.volume = 1;
          video.play().catch(e => console.error("Play failed", e));
          
          break; // Successfully loaded, exit loop
        } catch (e) {
          console.error(`Attempt ${i} failed for URL: ${attempt.url}`, e);
          // Loop will continue, teardownPlayer() at start of next iteration will clean up
        }
      }

      if (isCancelled) return;

      if (!success) {
        if (showToast) showToast('Failed to load all streams, try using VPN');
        setActiveSourceInfo('All sources offline');
      }
    }

    if (stream) {
      setHlsLevels([]);
      setCurrentLevel(-1);
      initPlayer();
    }

    return () => {
      isCancelled = true;
      teardownPlayer();
      if (window.electronAPI) {
        window.electronAPI.clearActiveStream();
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
