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
        const FANCODE_JSON_URL = import.meta.env.VITE_FANCODE_JSON_URL || "";

        let m3uRes, fancodeRes;
        
        try {
          const fetchOpts = { headers: { "x-api-key": import.meta.env.VITE_API_KEY || "" }, cache: 'no-store' };
          
          const fetchPromises = [
            fetch(REMOTE_M3U_URL, fetchOpts).then(r => { if (!r.ok) throw new Error(); return r.text(); })
          ];
          
          if (FANCODE_JSON_URL) {
            fetchPromises.push(
              fetch(FANCODE_JSON_URL, { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(); return r.json(); })
            );
          }

          const results = await Promise.allSettled(fetchPromises);
          m3uRes = results[0];
          if (FANCODE_JSON_URL) {
            fancodeRes = results[1];
          }
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

        if (fancodeRes && fancodeRes.status === 'fulfilled' && fancodeRes.value && fancodeRes.value.matches) {
          const groupedMatches = new Map();
          
          fancodeRes.value.matches.forEach((match, index) => {
            let streamUrl = "";
            if (match.streams) {
              if (match.streams.backup) {
                streamUrl = match.streams.backup.fancode_cdn_v1 || match.streams.backup.fancode_cdn || "";
              }
              if (!streamUrl) {
                streamUrl = match.streams.primary || match.streams.fancode_cdn || "";
              }
            }
            if (streamUrl) {
              let mappedCat = match.category ? match.category.toLowerCase() : 'fancode';
              if (mappedCat === 'formula 1') mappedCat = 'f1';
              
              const matchId = match.match_id || index;
              const lang = match.language ? match.language.toUpperCase() : 'UNKNOWN';
              
              if (groupedMatches.has(matchId)) {
                const existing = groupedMatches.get(matchId);
                existing.languageUrls[lang] = streamUrl;
              } else {
                groupedMatches.set(matchId, {
                  id: `fancode_${matchId}`,
                  name: `${match.title} | ${match.tournament}`,
                  url: streamUrl, // default url
                  source: 'live',
                  category: mappedCat,
                  logo: match.image || null,
                  clearKeys: null,
                  backupUrls: [],
                  languageUrls: { [lang]: streamUrl }
                });
              }
            }
          });
          
          const newFancodeStreams = Array.from(groupedMatches.values()).map(stream => {
            if (Object.keys(stream.languageUrls).length > 1) {
              stream.language = 'multi';
            } else {
              stream.language = Object.keys(stream.languageUrls)[0] || 'ENGLISH';
            }
            return stream;
          });
          
          allStreams.unshift(...newFancodeStreams);
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
            // Fancode streams are now included in allStreams natively, 
            // so we only need to preserve 'custom_' streams from state.
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
