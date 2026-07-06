export function parseM3u(m3uData) {
  const lines = m3uData.split('\n');
  const streams = [];
  let currentStream = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      const lastQuoteIdx = line.lastIndexOf('"');
      let splitCommaIdx = line.indexOf(',', lastQuoteIdx !== -1 ? lastQuoteIdx : 10);
      let name = 'Unknown Channel';
      if (splitCommaIdx !== -1) {
         name = line.substring(splitCommaIdx + 1).trim();
      } else {
         const nameMatch = line.match(/,(.+)$/);
         name = nameMatch ? nameMatch[1].trim() : 'Unknown Channel';
      }

      const logoMatch = line.match(/tvg-logo="([^"]+)"/);
      const logo = logoMatch ? logoMatch[1] : '';
      const groupMatch = line.match(/group-title="([^"]+)"/);
      const group = groupMatch ? groupMatch[1] : 'Uncategorized';

      currentStream = {
        id: `stream_${i}`,
        name,
        logo,
        group,
        url: '',
        clearKeys: null
      };
    } else if (line.startsWith('#KODIPROP:inputstream.adaptive.license_key=')) {
      if (currentStream) {
        const keyData = line.split('=')[1];
        if (keyData) {
          const [kid, key] = keyData.split(':');
          if (kid && key) {
             currentStream.clearKeys = { [kid]: key };
          }
        }
      }
    } else if (!line.startsWith('#')) {
       if (currentStream) {
         currentStream.url = line;
         streams.push(currentStream);
         currentStream = null;
       }
    }
  }

  return streams;
}
