import { useState, useEffect } from 'react';

export function useStreams() {
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function fetchStreams() {
      try {
        // Try fetching from a remote server first so you can update streams without updating the app
        const REMOTE_JSON_URL = import.meta.env.VITE_REMOTE_JSON_URL || "";
        const REMOTE_M3U_URL = import.meta.env.VITE_REMOTE_M3U_URL || "";

        let jsonRes, m3uRes;
        
        try {
          const fetchOpts = { headers: { "x-api-key": import.meta.env.VITE_API_KEY || "" }, cache: 'no-store' };
          const t = Date.now();
          [jsonRes, m3uRes] = await Promise.allSettled([
            fetch(`${REMOTE_JSON_URL}?t=${t}`, fetchOpts).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
            fetch(`${REMOTE_M3U_URL}?t=${t}`, fetchOpts).then(r => { if (!r.ok) throw new Error(); return r.text(); })
          ]);
        } catch (e) {
          // Ignore fetch failure
        }

        const allStreams = [];

        if (jsonRes.status === 'fulfilled') {
          const data = jsonRes.value;
          for (const [key, item] of Object.entries(data)) {
            allStreams.push({
              id: `json_${key}`,
              name: key.toUpperCase(),
              url: item.url,
              clearKeys: item.clearKeys || null,
              source: 'json',
              logo: null
            });
          }
        }

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

                let source = 'm3u';
                if (line.includes('sportify-source="live"')) {
                  source = 'live';
                }

                currentStream = {
                  id: `m3u_${categoryName}_${i}`,
                  name: name,
                  logo: logo,
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
                    if (kid && key) {
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
                    existing.backupUrls.push({ url: currentStream.url, clearKeys: currentStream.clearKeys });
                  } else {
                    groupedStreams.set(groupKey, currentStream);
                    allStreams.push(currentStream);
                  }
                  
                  currentStream = null;
                }
              }
            }
          }
        }

        if (mounted) {
          setStreams(allStreams);
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
    }, 60000); // Auto-sync every 60 seconds

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);

  const refetch = async () => {
    window.location.reload();
  };

  return { streams, loading, error, setStreams, refetch };
}
