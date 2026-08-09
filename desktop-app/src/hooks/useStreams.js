import { useState, useEffect } from 'react';

export function useStreams() {
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function fetchStreams() {
      try {
        const CACHE_KEY = 'sportify_streams_cache';
        const CACHE_TIME = 15 * 60 * 1000; // 15 minutes
        
        const cachedStr = localStorage.getItem(CACHE_KEY);
        if (cachedStr) {
          try {
            const cached = JSON.parse(cachedStr);
            if (Date.now() - cached.timestamp < CACHE_TIME) {
              if (mounted) {
                setStreams(prev => {
                  const customStreams = prev.filter(s => s.id.startsWith('custom_'));
                  const newMap = new Map();
                  cached.streams.forEach(s => newMap.set(s.id, s));
                  customStreams.forEach(s => newMap.set(s.id, s));
                  return Array.from(newMap.values());
                });
                setLoading(false);
              }
              return;
            }
          } catch (e) {
            // ignore JSON parse error
          }
        }

        const REMOTE_M3U_URL = import.meta.env.VITE_REMOTE_M3U_URL || "";
        const SONYLIV_JSON_URL = import.meta.env.VITE_SONYLIV_JSON_URL || "";
        const SONYLIV_M3U_URL = import.meta.env.VITE_SONYLIV_M3U_URL || "";
        const FANCODE_JSON_URL = import.meta.env.VITE_FANCODE_NEW_JSON_URL || "";
        const FANCODE_M3U_URL = import.meta.env.VITE_FANCODE_NEW_M3U_URL || "";

        let m3uRes, sonylivJsonRes, sonylivM3uRes, fancodeJsonRes, fancodeM3uRes;
        
        try {
          const fetchOpts = { headers: { "x-api-key": import.meta.env.VITE_API_KEY || "" }, cache: 'no-store' };
          
          const fetchPromises = [
            fetch(REMOTE_M3U_URL, fetchOpts).then(r => { if (!r.ok) throw new Error(); return r.text(); })
          ];

          if (SONYLIV_JSON_URL) {
            fetchPromises.push(
              fetch(SONYLIV_JSON_URL, { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(); return r.json(); })
            );
          }
          if (SONYLIV_M3U_URL) {
            fetchPromises.push(
              fetch(SONYLIV_M3U_URL, { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(); return r.text(); })
            );
          }
          if (FANCODE_JSON_URL) {
            fetchPromises.push(
              fetch(FANCODE_JSON_URL, { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(); return r.json(); })
            );
          }
          if (FANCODE_M3U_URL) {
            fetchPromises.push(
              fetch(FANCODE_M3U_URL, { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(); return r.text(); })
            );
          }

          const results = await Promise.allSettled(fetchPromises);
          m3uRes = results[0];
          let index = 1;
          if (SONYLIV_JSON_URL) sonylivJsonRes = results[index++];
          if (SONYLIV_M3U_URL) sonylivM3uRes = results[index++];
          if (FANCODE_JSON_URL) fancodeJsonRes = results[index++];
          if (FANCODE_M3U_URL) fancodeM3uRes = results[index++];
        } catch (e) {
          // Ignore fetch failure
        }

        const allStreams = [];


        if (m3uRes.status === 'fulfilled') {
          const m3uTextData = m3uRes.value;
          
          let categoryMap = {};
          try {
            // Try parsing as JSON (new categorized format)
            categoryMap = JSON.parse(m3uTextData);
          } catch(e) {
            // Fallback to old format where the entire response is a single M3U string
            categoryMap = { 'all': m3uTextData };
          }
          
          const groupedStreams = new Map();
          
          const normalizeName = (name) => {
            // Removes trailing numbers or languages in parentheses/brackets e.g. (1), (ENGLISH), [HINDI]
            return name.replace(/\s*[\(\[][a-zA-Z0-9\s]+[\)\]]\s*$/, '').trim();
          };

          for (const [categoryName, m3uContent] of Object.entries(categoryMap)) {
            if (typeof m3uContent !== 'string') continue;
            
            const lines = m3uContent.split('\n');
            let currentStream = null;

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              if (line.startsWith('#EXTINF:')) {
                const nameMatch = line.match(/,(.+)$/);
                const name = nameMatch ? nameMatch[1].trim() : 'Unknown Stream';
                const logoMatch = line.match(/tvg-logo="([^"]+)"/);
                const logo = logoMatch ? logoMatch[1] : null;

                const langMatch = line.match(/tvg-language="([^"]+)"/i);
                const language = langMatch ? langMatch[1] : null;

                const vpnMatch = line.match(/tvg-vpn="([^"]+)"/i);
                const vpn = vpnMatch ? vpnMatch[1] : null;

                let source = 'm3u';
                if (line.includes('sportify-source="live"')) {
                  source = 'live';
                }

                currentStream = {
                  id: `m3u_${categoryName}_${i}`,
                  name: name,
                  logo: logo,
                  language: language,
                  vpn: vpn,
                  source: source,
                  category: categoryName,
                  clearKeys: null,
                  backupUrls: []
                };
              } else if (line.startsWith('#KODIPROP:inputstream.adaptive.license_key=')) {
                if (currentStream) {
                  const keyStr = line.split('=')[1];
                  if (keyStr) {
                    const [kid, key] = keyStr.split(':');
                    if (kid && key && kid.length === 32 && key.length === 32) {
                      currentStream.clearKeys = { [kid]: key };
                    }
                  }
                }
              } else if (line && !line.startsWith('#')) {
                if (currentStream) {
                  currentStream.url = line.split('|')[0].trim();
                  
                  const normName = normalizeName(currentStream.name);
                  const groupKey = `${currentStream.category}_${normName.toLowerCase()}`;
                  
                  if (groupedStreams.has(groupKey)) {
                    const existing = groupedStreams.get(groupKey);
                    
                    const newLang = currentStream.language ? currentStream.language.toUpperCase() : 'UNKNOWN';
                    
                    if (!existing.languageUrls) existing.languageUrls = {};
                    
                    // If existing stream had a valid language but languageUrls wasn't populated yet
                    if (existing.language && existing.language !== 'UNKNOWN' && existing.language !== 'multi' && Object.keys(existing.languageUrls).length === 0) {
                      existing.languageUrls[existing.language] = existing.url;
                    }

                    // If incoming stream has a different valid language, add to language options
                    if (newLang !== 'UNKNOWN' && existing.language !== 'UNKNOWN' && newLang !== existing.language && !existing.languageUrls[newLang]) {
                       existing.languageUrls[newLang] = currentStream.url;
                       existing.language = 'multi';
                    } else {
                       existing.backupUrls.push({ url: currentStream.url, clearKeys: currentStream.clearKeys });
                    }
                  } else {
                    currentStream.languageUrls = {};
                    if (currentStream.language && currentStream.language.toUpperCase() !== 'UNKNOWN') {
                       currentStream.language = currentStream.language.toUpperCase();
                       currentStream.languageUrls[currentStream.language] = currentStream.url;
                    } else {
                       currentStream.language = 'UNKNOWN';
                    }
                    groupedStreams.set(groupKey, currentStream);
                    allStreams.push(currentStream);
                  }
                  
                  currentStream = null;
                }
              }
            }
          }
        }
        
        if (sonylivJsonRes && sonylivJsonRes.status === 'fulfilled' && sonylivM3uRes && sonylivM3uRes.status === 'fulfilled') {
          const jsonData = sonylivJsonRes.value;
          const m3uTextData = sonylivM3uRes.value;
          
          if (jsonData && jsonData.matches) {
            // Parse M3U into array of { name, url }
            const m3uStreams = [];
            const lines = m3uTextData.split('\n');
            let currentName = null;
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              if (line.startsWith('#EXTINF:')) {
                const nameMatch = line.match(/,(.+)$/);
                currentName = nameMatch ? nameMatch[1].trim() : '';
              } else if (currentName && line && !line.startsWith('#')) {
                m3uStreams.push({ name: currentName, url: line.split('|')[0].trim() });
                currentName = null;
              }
            }

            // Fuzzy match helper
            const getTokens = (str) => str.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
            const calculateSimilarity = (str1, str2) => {
              const tokens1 = getTokens(str1);
              const tokens2 = getTokens(str2);
              if (tokens1.length === 0 || tokens2.length === 0) return 0;
              let matches = 0;
              for (const t1 of tokens1) {
                if (tokens2.includes(t1)) matches++;
              }
              return matches / Math.min(tokens1.length, tokens2.length); // Use min for better substring matching
            };

            const matchedStreams = [];
            jsonData.matches.forEach(match => {
              if (!match.isLive) return;
              const targetTitle = match.match_name || match.event_name || "";
              
              let bestMatch = null;
              let bestScore = 0;

              for (const m3uStream of m3uStreams) {
                const score = calculateSimilarity(targetTitle, m3uStream.name);
                if (score > bestScore) {
                  bestScore = score;
                  bestMatch = m3uStream;
                }
              }

              // Threshold for fuzzy match
              if (bestMatch && bestScore > 0.4) {
                matchedStreams.push({
                  id: `sonyliv_${match.contentId}`,
                  name: `${match.match_name}${match.event_name ? ` | ${match.event_name}` : ''}`,
                  logo: match.src || null,
                  language: match.audioLanguageName || 'UNKNOWN',
                  vpn: null,
                  source: 'live',
                  category: match.event_category ? match.event_category.toLowerCase() : 'all',
                  url: bestMatch.url,
                  clearKeys: null,
                  backupUrls: [],
                  languageUrls: {},
                  status: match.isLive ? 'LIVE' : 'UPCOMING',
                  featured: true
                });
              }
            });

            allStreams.unshift(...matchedStreams);
          }
        }
        
        if (fancodeJsonRes && fancodeJsonRes.status === 'fulfilled' && fancodeM3uRes && fancodeM3uRes.status === 'fulfilled') {
          const jsonData = fancodeJsonRes.value;
          const m3uTextData = fancodeM3uRes.value;
          
          if (jsonData && jsonData.matches) {
            // Parse Fancode M3U into array of { logo, url }
            const m3uStreams = [];
            const lines = m3uTextData.split('\n');
            let currentLogo = null;
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              if (line.startsWith('#EXTINF:')) {
                const logoMatch = line.match(/tvg-logo="([^"]+)"/);
                currentLogo = logoMatch ? logoMatch[1] : '';
              } else if (currentLogo && line && !line.startsWith('#')) {
                m3uStreams.push({ logo: currentLogo, url: line.split('|')[0].trim() });
                currentLogo = null;
              }
            }

            const matchedStreams = [];
            jsonData.matches.forEach(match => {
              // The user asked to only show if isLive is true or status is LIVE. The json has "status": "LIVE" or "status": "UPCOMING" and "isLive" field doesn't seem to be explicitly in the snippet but let's check status.
              if (match.status !== 'LIVE' && match.isLive !== true) return;
              
              const targetLogo = match.src || "";
              
              let backupUrlObj = null;
              for (const m3uStream of m3uStreams) {
                if (m3uStream.logo === targetLogo && m3uStream.logo !== "") {
                  backupUrlObj = m3uStream;
                  break;
                }
              }

              const streamUrl = match.adfree_url || (backupUrlObj ? backupUrlObj.url : null);
              if (!streamUrl) return;

              matchedStreams.push({
                id: `fancode_${match.match_id || match.contentId || Math.random().toString(36).substring(7)}`,
                name: match.title,
                logo: match.src || null,
                language: match.audioLanguageName || 'UNKNOWN',
                vpn: null,
                source: 'live',
                category: match.event_category ? match.event_category.toLowerCase() : 'all',
                url: streamUrl,
                clearKeys: null,
                backupUrls: backupUrlObj && streamUrl !== backupUrlObj.url ? [{ url: backupUrlObj.url }] : [],
                languageUrls: {},
                status: 'LIVE',
                featured: true
              });
            });

            allStreams.unshift(...matchedStreams);
          }
        }

        if (mounted) {
          // Cache the final array
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
              timestamp: Date.now(),
              streams: allStreams
            }));
          } catch (e) {}

          setStreams(prev => {
            // Preserve 'custom_' streams from state.
            const customStreams = prev.filter(s => s.id.startsWith('custom_'));
            
            // Ensure no duplicates just in case
            const newStreamMap = new Map();
            allStreams.forEach(s => newStreamMap.set(s.id, s));
            customStreams.forEach(s => newStreamMap.set(s.id, s));
            
            return Array.from(newStreamMap.values());
          });
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          console.error(err);
          setError(err);
          setLoading(false);
        }
      }
    }

    fetchStreams();

    const intervalId = setInterval(() => {
      if (mounted) fetchStreams();
    }, 15 * 60 * 1000); // Auto-sync every 15 minutes instead of 15 seconds

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);

  const refetch = async () => {
    localStorage.removeItem('sportify_streams_cache');
    window.location.reload();
  };

  return { streams, loading, error, setStreams, refetch };
}
