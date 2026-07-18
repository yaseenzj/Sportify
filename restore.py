import re
import os

with open('workers/cloudflare-stream-manager-beta/html_content_recovered.html', 'r', encoding='utf8') as f:
    html_content = f.read()

# Apply CSS Fixes
html_content = html_content.replace(
    "@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');",
    ""
)
html_content = html_content.replace(
    "<title>Sportify Stream Manager</title>",
    '<title>Sportify Stream Manager</title>\n  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">'
)

# Apply ClearKey Fixes (from my earlier replace logic)
html_content = html_content.replace(
    '''        let kid = ''; let key = '';
        src.kodiProps.forEach(p => {
           if (p.includes('license_key=')) {
              try {
                let obj = JSON.parse(p.split('license_key=')[1]);
                if (obj.keyId && obj.key) { kid = obj.keyId; key = obj.key; }
                else { kid = Object.keys(obj)[0]; key = obj[kid]; }
              } catch(e) {}
           }
        });''',
    '''        let clearkeyStr = '';
        src.kodiProps.forEach(p => {
           if (p.includes('license_key=')) {
              let rawKey = p.split('license_key=')[1].trim();
              try {
                let obj = JSON.parse(rawKey);
                if (obj.keyId && obj.key) { clearkeyStr = obj.keyId + ":" + obj.key; }
                else { let k = Object.keys(obj)[0]; clearkeyStr = k + ":" + obj[k]; }
              } catch(e) {
                clearkeyStr = rawKey;
              }
           }
        });'''
)

html_content = html_content.replace(
    '''            <label>ClearKey DRM (Only if needed for MPD)</label>
            <div class="flex-row">
              <input type="text" placeholder="Key ID (Hex)" value="${kid}" onchange="updateTempKey(${i}, 'kid', this.value)">
              <input type="text" placeholder="Key (Hex)" value="${key}" onchange="updateTempKey(${i}, 'key', this.value)">
            </div>''',
    '''            <label>ClearKey DRM (KID:KEY format)</label>
            <div class="flex-row">
              <input type="text" placeholder="e.g. 363cacff89...:6353982823..." value="${clearkeyStr}" onchange="updateTempKey(${i}, this.value)">
            </div>'''
)

html_content = html_content.replace(
    '''    function updateTempKey(index, type, value) {
      let kid = ''; let key = '';
      tempSources[index].kodiProps.forEach(p => {
         if (p.includes('license_key=')) {
            try {
              let obj = JSON.parse(p.split('license_key=')[1]);
              if (obj.keyId && obj.key) { kid = obj.keyId; key = obj.key; }
              else { kid = Object.keys(obj)[0]; key = obj[kid]; }
            } catch(e) {}
         }
      });
      
      if (type === 'kid') kid = value;
      if (type === 'key') key = value;
      
      tempSources[index].kodiProps = [];
      if (kid && key) {
        tempSources[index].kodiProps.push('#KODIPROP:inputstream.adaptive.license_type=clearkey');
        tempSources[index].kodiProps.push(`#KODIPROP:inputstream.adaptive.license_key={"${kid}":"${key}"}`);
      }
    }''',
    '''    function updateTempKey(index, value) {
      tempSources[index].kodiProps = [];
      if (value && value.includes(':')) {
        tempSources[index].kodiProps.push('#KODIPROP:inputstream.adaptive.license_type=clearkey');
        tempSources[index].kodiProps.push(`#KODIPROP:inputstream.adaptive.license_key=${value.trim()}`);
      }
    }'''
)

# Escape backticks inside HTML, except we don't need to do any weird replace if we do it cleanly.
html_content = html_content.replace('\\`', '`') # remove old escapes
html_content = html_content.replace('\\$', '$') # remove old escapes
html_content = html_content.replace('`', '\\`') # escape all
html_content = html_content.replace('$', '\\$') # escape all

# Now read beta worker
with open('workers/cloudflare-stream-manager-beta/index.js', 'r', encoding='utf8') as f:
    beta = f.read()

beta_start = beta.find('const html = `')
beta_end = beta.find('return new Response(html, { headers:')

if beta_start == -1 or beta_end == -1:
    print("Could not find boundaries in beta!")
    exit(1)

# Remove the trailing spaces/newlines
while beta[beta_end-1] in (' ', '\n', '`', ';'):
    beta_end -= 1

new_beta = beta[:beta_start] + 'const html = `\n' + html_content + '\n`;\n      ' + beta[beta_end:]

with open('workers/cloudflare-stream-manager-beta/index.js', 'w', encoding='utf8') as f:
    f.write(new_beta)

print("Beta worker RESTORED and fixed successfully!")
