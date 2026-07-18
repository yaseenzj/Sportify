export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const ADMIN_PASSWORD = env.ADMIN_PASSWORD;
    
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // ----------------------------------------------------
    // PUBLIC API FOR THE DESKTOP APP
    // ----------------------------------------------------
    if (url.pathname === '/api/streams/json') {
      return new Response(JSON.stringify({}), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname === '/api/streams/m3u') {
      try {
        let parsed = { all: "", football: "", cricket: "", f1: "", motogp: "", golf: "", tennis: "" };
        const fancodeOnly = url.searchParams.get('fancodeOnly') === 'true';
        
        if (env.SPORTIFY_STREAMS && !fancodeOnly) {
          const data = await env.SPORTIFY_STREAMS.get("streams_data");
          if (data) parsed = { ...parsed, ...JSON.parse(data) };
        }

        const isAdmin = url.searchParams.get('admin') === 'true';

        if (!isAdmin || fancodeOnly) {
          try {
            const extRes = await fetch(env.FANCODE_JSON_URL);
            if (extRes.ok) {
              const extJson = await extRes.json();
              const matches = extJson.matches || [];
              let injected = { all: "", football: "", cricket: "", f1: "", motogp: "", golf: "", tennis: "" };
              
              for (let i = 0; i < matches.length; i++) {
                const match = matches[i];
                let streamUrl = "";
                if (match.streams) {
                  if (match.streams.backup) {
                    streamUrl = match.streams.backup.fancode_cdn || match.streams.backup.fancode_cdn_v1 || "";
                  }
                  if (!streamUrl) {
                    streamUrl = match.streams.primary || match.streams.fancode_cdn || "";
                  }
                }
                if (!streamUrl) continue;
                
                if (match.status && match.status !== 'LIVE' && match.status !== 'UPCOMING') continue;
                
                let title = match.title || "";
                const catLower = (match.category || "").toLowerCase();
                const isNonTeamSport = catLower.includes('motorsport') || catLower.includes('formula') || catLower.includes('f1') || catLower.includes('golf') || catLower.includes('motogp');
                
                if (title.toLowerCase().includes('f1 kids')) {
                  title = 'Race';
                  match.tournament = match.tournament.replace(/f1 kids \d+/i, '').trim();
                  if (!match.tournament || match.tournament === "") {
                    match.tournament = "F1 PIRELLI BRITISH GRAND PRIX 2026";
                  }
                  
                  let mainImage = match.image;
                  for (const m of matches) {
                    if ((m.category||"").toLowerCase().includes("f1") && (m.title||"").toLowerCase() === "race" && !(m.tournament||"").toLowerCase().includes("kids")) {
                      mainImage = m.image;
                      break;
                    }
                  }
                  match.image = mainImage;
                }

                if (isNonTeamSport) {
                   title = title.replace(/\s*[-]?\s*Main Feed/gi, '').trim();
                }
                
                // Collect active match names to filter the backup M3U
                const activeMatchName = `${title} | ${match.tournament}`.toLowerCase();
                if (!globalThis.activeMatches) globalThis.activeMatches = new Set();
                globalThis.activeMatches.add(activeMatchName);
                
                // Removed language tag so duplicates group together
                const inf = `#EXTINF:-1 tvg-logo="${match.image || ''}" group-title="${match.category || ''}" sportify-source="live",${title} | ${match.tournament}`;
                const combined = inf + "\n" + streamUrl + "\n";
                
                if (catLower.includes('motorsport') || catLower.includes('formula') || catLower.includes('f1')) {
                  injected.f1 += combined + "\n";
                } else if (catLower.includes('cricket')) {
                  injected.cricket += combined + "\n";
                } else if (catLower.includes('football') || catLower.includes('soccer')) {
                  injected.football += combined + "\n";
                } else if (catLower.includes('motogp')) {
                  injected.motogp += combined + "\n";
                } else if (catLower.includes('golf')) {
                  injected.golf += combined + "\n";
                } else if (catLower.includes('tennis')) {
                  injected.tennis += combined + "\n";
                } else {
                  injected.all += combined + "\n";
                }
              }
              
              for (const key in injected) {
                if (injected[key]) {
                  parsed[key] = injected[key] + (parsed[key] || "");
                }
              }
            }
          } catch (e) {
            console.error("External JSON fetch failed", e);
          }
          
          try {
            const backupM3uRes = await fetch(env.FANCODE_M3U_URL);
            if (backupM3uRes.ok) {
              const m3uText = await backupM3uRes.text();
              const lines = m3uText.split('\n');
              let currentInf = "";
              let currentKodiProps = [];
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.startsWith('#EXTINF:')) {
                   currentInf = line;
                   currentKodiProps = [];
                   
                   const lastQuoteIdx = currentInf.lastIndexOf('"');
                   let splitCommaIdx = currentInf.indexOf(',', lastQuoteIdx !== -1 ? lastQuoteIdx : 10);
                   
                   if (splitCommaIdx !== -1) {
                     const originalName = currentInf.substring(splitCommaIdx + 1).trim();
                     
                     let prefix = currentInf.substring(0, splitCommaIdx).trim();
                     if (prefix.startsWith('#EXTINF:-1,')) {
                       prefix = prefix.replace('#EXTINF:-1,', '#EXTINF:-1').trim();
                     }
                     
                     if (!prefix.includes('sportify-source=')) {
                       prefix = prefix.replace('#EXTINF:-1', '#EXTINF:-1 sportify-source="live"');
                     }
                     
                     let newName = originalName;
                     const nameMatch = originalName.match(/(.+?)\s*\((.+?)\)$/);
                     if (nameMatch) {
                       let title = nameMatch[1];
                       const tournament = nameMatch[2];
                       
                       const catStr = currentInf.toLowerCase();
                       const isNonTeamSport = catStr.includes('formula') || catStr.includes('f1') || 
                                              catStr.includes('golf') || catStr.includes('motogp') || 
                                              catStr.includes('motorsport');
                                              
                       if (isNonTeamSport && title.toLowerCase().includes(' vs ')) {
                         title = title.split(/ vs /i)[0].trim();
                         if (title.endsWith('-')) title = title.substring(0, title.length - 1).trim();
                       }
                       
                       title = title.replace(/ vs /gi, ' Vs ');
                       
                       if (isNonTeamSport) {
                           title = title.replace(/\s*-\s*Main Feed/gi, '');
                           title = title.trim();
                       }
                       
                       // Removed language tag so it matches JSON stream names and groups together
                       newName = `${title} | ${tournament}`;
                     }
                     
                     currentInf = `${prefix},${newName}`;
                   }
                } else if (line.startsWith('#KODIPROP:')) {
                   currentKodiProps.push(line);
                } else if (line && !line.startsWith('#') && currentInf) {
                   // Check if this M3U stream belongs to an active match from JSON
                   const splitCommaIdx = currentInf.lastIndexOf(',');
                   const parsedName = splitCommaIdx !== -1 ? currentInf.substring(splitCommaIdx + 1).trim() : "";
                   
                   if (globalThis.activeMatches && globalThis.activeMatches.has(parsedName.toLowerCase())) {
                     const propsStr = currentKodiProps.length > 0 ? currentKodiProps.join('\n') + '\n' : '';
                     const combined = currentInf + "\n" + propsStr + line + "\n";
                     const catLower = currentInf.toLowerCase();
                     if (catLower.includes('motorsport') || catLower.includes('formula') || catLower.includes('f1')) {
                       parsed.f1 = combined + (parsed.f1 || "");
                     } else if (catLower.includes('cricket')) {
                       parsed.cricket = combined + (parsed.cricket || "");
                     } else if (catLower.includes('football') || catLower.includes('soccer')) {
                       parsed.football = combined + (parsed.football || "");
                     } else if (catLower.includes('motogp')) {
                       parsed.motogp = combined + (parsed.motogp || "");
                     } else if (catLower.includes('golf')) {
                       parsed.golf = combined + (parsed.golf || "");
                     } else {
                       parsed.all = combined + (parsed.all || "");
                     }
                   }
                   currentInf = "";
                   currentKodiProps = [];
                }
              }
            }
          } catch (e) {
            console.error("Backup M3U fetch failed", e);
          }
          
          globalThis.activeMatches = null; // cleanup
        }

        return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({}), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ----------------------------------------------------
    // ADMIN API FOR THE WEB DASHBOARD
    // ----------------------------------------------------
    if (url.pathname === '/api/admin/verify' && request.method === 'POST') {
      const auth = request.headers.get("Authorization");
      if (auth !== `Bearer ${ADMIN_PASSWORD}`) {
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname === '/api/admin/save' && request.method === 'POST') {
      const auth = request.headers.get("Authorization");
      if (auth !== `Bearer ${ADMIN_PASSWORD}`) {
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }
      
      if (!env.SPORTIFY_STREAMS) {
        return new Response(JSON.stringify({ error: "KV Namespace 'SPORTIFY_STREAMS' is not bound to this worker." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      try {
        const body = await request.json();
        
        // Create a daily snapshot before overwriting
        const dateStr = new Date().toISOString().split('T')[0];
        const existingBackup = await env.SPORTIFY_STREAMS.get(`streams_data_backup_${dateStr}`);
        if (!existingBackup) {
          const oldData = await env.SPORTIFY_STREAMS.get("streams_data");
          if (oldData) await env.SPORTIFY_STREAMS.put(`streams_data_backup_${dateStr}`, oldData);
        }

        await env.SPORTIFY_STREAMS.put("streams_data", JSON.stringify(body));
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ----------------------------------------------------
    // ADMIN API FOR VERSION HISTORY
    // ----------------------------------------------------
    if (url.pathname === '/api/admin/backups' && request.method === 'GET') {
      const auth = request.headers.get("Authorization");
      if (auth !== `Bearer ${ADMIN_PASSWORD}`) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      
      try {
        const list = await env.SPORTIFY_STREAMS.list({ prefix: "streams_data_backup_" });
        const backups = list.keys.map(k => ({ date: k.name.replace("streams_data_backup_", "") })).sort((a,b) => b.date.localeCompare(a.date));
        return new Response(JSON.stringify({ backups }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (url.pathname === '/api/admin/backup' && request.method === 'GET') {
      const auth = request.headers.get("Authorization");
      if (auth !== `Bearer ${ADMIN_PASSWORD}`) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      
      const date = url.searchParams.get('date');
      if (!date) return new Response("Missing date", { status: 400, headers: corsHeaders });
      
      try {
        const data = await env.SPORTIFY_STREAMS.get(`streams_data_backup_${date}`);
        if (!data) return new Response("Not found", { status: 404, headers: corsHeaders });
        
        return new Response(data, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ----------------------------------------------------
    // ADMIN WEB DASHBOARD HTML
    // ----------------------------------------------------
    if (url.pathname === '/' || url.pathname === '/admin') {
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sportify Stream Manager</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    
    
    :root {
      --bg: #09090b;
      --surface: #18181b;
      --primary: #9d4edd;
      --primary-hover: #c77dff;
      --text: #ffffff;
      --text-muted: #a1a1aa;
      --border: rgba(255,255,255,0.1);
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Outfit', sans-serif; }
    body { background-color: var(--bg); color: var(--text); min-height: 100vh; display: flex; flex-direction: column; }
    
    .container { max-width: 1000px; margin: 0 auto; padding: 40px 20px; width: 100%; }
    
    h1 { font-size: 2.5rem; margin-bottom: 8px; font-weight: 600; background: linear-gradient(90deg, #fff, #a1a1aa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    p.subtitle { color: var(--text-muted); margin-bottom: 40px; }
    
    /* Login Screen */
    #login-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; text-align: center; }
    .login-box { background: var(--surface); padding: 40px; border-radius: 16px; border: 1px solid var(--border); box-shadow: 0 20px 40px rgba(0,0,0,0.4); width: 100%; max-width: 400px; }
    .login-box input { width: 100%; background: rgba(0,0,0,0.2); border: 1px solid var(--border); padding: 14px; border-radius: 8px; color: white; font-size: 1rem; margin-top: 20px; margin-bottom: 20px; outline: none; transition: border 0.2s; }
    .login-box input:focus { border-color: var(--primary); }
    
    button { background: var(--primary); color: white; border: none; padding: 14px 24px; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: all 0.2s; width: 100%; }
    button:hover { background: var(--primary-hover); transform: translateY(-1px); }
    button.secondary { background: #3f3f46; }
    button.secondary:hover { background: #52525b; }
    
    /* Dashboard */
    .tabs { display: flex; gap: 8px; margin-bottom: 24px; overflow-x: auto; padding-bottom: 8px; }
    .tab-btn { background: var(--surface); color: var(--text-muted); padding: 10px 20px; border-radius: 20px; font-size: 0.9rem; font-weight: 500; cursor: pointer; border: 1px solid var(--border); transition: all 0.2s; white-space: nowrap; width: auto; }
    .tab-btn:hover { color: white; border-color: rgba(255,255,255,0.2); }
    .tab-btn.active { background: var(--primary); color: white; border-color: var(--primary); }
    
    .editor-container { background: var(--surface); border-radius: 12px; border: 1px solid var(--border); overflow: hidden; display: flex; flex-direction: column; height: 500px; position: relative; }
    textarea { flex: 1; background: transparent; border: none; padding: 20px; color: #d4d4d8; font-family: 'Consolas', monospace; font-size: 14px; line-height: 1.5; outline: none; resize: none; width: 100%; height: 100%; }
    
    .gui-container { flex: 1; overflow-y: auto; padding: 20px; display: none; flex-direction: column; gap: 12px; }
    .gui-card { background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 12px; transition: background 0.2s; }
    .gui-card:hover { background: rgba(255,255,255,0.06); }
    .card-header { display: flex; align-items: center; justify-content: space-between; }
    .card-title { display: flex; align-items: center; gap: 12px; font-weight: 600; font-size: 1.1rem; }
    .card-logo { width: 40px; height: 40px; border-radius: 4px; object-fit: contain; background: #000; }
    .card-actions { display: flex; gap: 8px; align-items: center; }
    .card-meta { font-size: 0.85rem; color: var(--text-muted); display: flex; gap: 12px; }
    .badge { background: rgba(157, 78, 221, 0.2); color: #c77dff; padding: 4px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; }
    
    .actions { display: flex; justify-content: flex-end; margin-top: 24px; gap: 16px; align-items: center; }
    .status { color: var(--text-muted); font-size: 0.9rem; }
    .actions button { width: auto; min-width: 150px; }
    
    .kv-warning { background: rgba(255, 77, 77, 0.1); border: 1px solid rgba(255, 77, 77, 0.2); padding: 16px; border-radius: 8px; color: #ff4d4d; margin-bottom: 24px; font-size: 0.9rem; display: none; }
    
    .modal-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); align-items: center; justify-content: center; z-index: 100; }
    .modal-content { background: var(--surface); padding: 24px; border-radius: 12px; width: 100%; max-width: 600px; border: 1px solid var(--border); max-height: 90vh; overflow-y: auto; }
    
    .source-item { background: rgba(0,0,0,0.3); border: 1px solid var(--border); padding: 12px; border-radius: 8px; margin-bottom: 12px; }
    .source-item label { display: block; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 4px; }
    .source-item input { width: 100%; background: transparent; border: 1px solid var(--border); padding: 8px; border-radius: 4px; color: white; margin-bottom: 8px; }
    .source-item .flex-row { display: flex; gap: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div id="login-screen">
      <div class="login-box">
        <h2 style="margin-bottom: 8px;">Admin Login (Beta)</h2>
        <p style="color: var(--text-muted); font-size: 0.9rem;">Enter Admin Password</p>
        <input type="password" id="password" placeholder="Password">
        <button onclick="login()">Enter Dashboard</button>
        <div id="login-error" style="color: #ff4d4d; margin-top: 16px; font-size: 0.85rem; display: none;">Invalid password</div>
      </div>
    </div>
    
    <div id="dashboard" style="display: none;">
      <h1>Sportify Stream Manager <span style="font-size: 1rem; color: var(--primary);">BETA</span></h1>
      <p class="subtitle">Visually edit your multi-source streams or edit raw M3U files directly.</p>
      
      <div id="kv-warning" class="kv-warning">
        <strong>⚠️ Cloudflare KV Not Bound!</strong><br><br>
        You need to create a KV Namespace in your Cloudflare dashboard and bind it to this worker with the variable name <code>SPORTIFY_STREAMS</code> before you can save anything!
      </div>

      <div class="tabs" id="tabs"></div>
      
      <div class="toolbar" style="display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
        <button id="mode-gui-btn" onclick="setViewMode('gui')" style="width: auto; background: var(--primary);">GUI View</button>
        <button id="mode-raw-btn" onclick="setViewMode('raw')" style="width: auto; background: #3f3f46;">Raw M3U View</button>
        <button id="mode-fc-btn" onclick="setViewMode('fancode')" style="width: auto; background: #2563eb;">Fancode View (Raw)</button>
        
        <input type="text" id="search-input" placeholder="Search streams..." style="flex: 1; min-width: 200px; padding: 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: white; outline: none;" oninput="renderGUI()">
        
        <button onclick="exportBackup()" class="secondary" style="width: auto;">Export</button>
        <input type="file" id="import-file" style="display: none;" accept=".json" onchange="importBackup(event)">
        <button onclick="document.getElementById('import-file').click()" class="secondary" style="width: auto;">Import</button>
        <button onclick="showHistoryModal()" style="width: auto; background: #ea580c;">History</button>
      </div>
      
      <div class="editor-container">
        <div id="gui-container" class="gui-container"></div>
        <textarea id="editor" placeholder="Paste #EXTM3U content here..."></textarea>
      </div>
      
      <div class="actions">
        <div class="status" id="status-msg"></div>
        <button onclick="saveData()" id="save-btn">Save Changes</button>
      </div>
    </div>
    
    <div id="history-modal" class="modal-overlay">
      <div class="modal-content" style="max-width: 400px;">
        <h3 style="margin-bottom: 16px;">Version History</h3>
        <div id="history-list" style="max-height: 300px; overflow-y: auto; margin-bottom: 16px;">Loading...</div>
        <button onclick="closeHistoryModal()" class="secondary">Close</button>
      </div>
    </div>
    
    <div id="source-modal" class="modal-overlay">
      <div class="modal-content">
        <h3 style="margin-bottom: 8px;" id="source-modal-title">Edit Sources</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 16px;">Add, edit, or remove URLs and DRM keys for this stream.</p>
        
        <textarea id="source-modal-textarea" style="width:100%; height:250px; background:rgba(0,0,0,0.3); border:1px solid var(--border); color:#fff; font-family:'Consolas', monospace; font-size: 13px; padding:12px; border-radius:8px; outline:none; resize:vertical; margin-bottom: 16px;" placeholder="Paste raw #EXTINF..."></textarea>
        
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button onclick="closeSourceModal()" class="secondary" style="width: auto;">Cancel</button>
          <button onclick="saveSourceModal()" style="width: auto;">Apply to GUI</button>
        </div>
      </div>
    </div>
  </div>

  <script>
    let currentPassword = '';
    let currentCategory = 'all';
    let viewMode = 'gui'; // 'gui', 'raw', 'fancode'
    let streamsData = { all: "", football: "", cricket: "", f1: "", motogp: "", golf: "", tennis: "" };
    let fancodeData = { all: "", football: "", cricket: "", f1: "", motogp: "", golf: "", tennis: "" };
    let parsedGroups = []; // Array of structured stream groups
    let editingGroupIndex = -1;
    
    const categories = [
      { id: 'all', name: 'All Channels' },
      { id: 'football', name: 'Football' },
      { id: 'cricket', name: 'Cricket' },
      { id: 'f1', name: 'F1' },
      { id: 'motogp', name: 'MotoGP' },
      { id: 'golf', name: 'Golf' },
      { id: 'tennis', name: 'Tennis' }
    ];

    const passwordInput = document.getElementById('password');
    passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') login(); });

    const editor = document.getElementById('editor');
    editor.addEventListener('input', (e) => {
      if (viewMode === 'raw') {
        streamsData[currentCategory] = e.target.value;
        document.getElementById('status-msg').textContent = 'Unsaved changes...';
      }
    });

    async function login() {
      currentPassword = document.getElementById('password').value;
      try {
        const verifyRes = await fetch('/api/admin/verify', { method: 'POST', headers: { 'Authorization': \`Bearer \${currentPassword}\` } });
        if (verifyRes.ok) {
          const res = await fetch('/api/streams/m3u?admin=true');
          const data = await res.json();
          streamsData = { ...streamsData, ...data };
          
          const fcRes = await fetch('/api/streams/m3u?fancodeOnly=true');
          const fcData = await fcRes.json();
          fancodeData = { ...fancodeData, ...fcData };
          
          document.getElementById('login-screen').style.display = 'none';
          document.getElementById('dashboard').style.display = 'block';
          
          renderTabs();
          switchTab('all');
        } else {
          document.getElementById('login-error').style.display = 'block';
        }
      } catch (e) {
        document.getElementById('login-error').style.display = 'block';
      }
    }

    function renderTabs() {
      const tabsContainer = document.getElementById('tabs');
      tabsContainer.innerHTML = categories.map(cat => 
        \`<button class="tab-btn \${cat.id === currentCategory ? 'active' : ''}" onclick="switchTab('\${cat.id}')">\${cat.name}</button>\`
      ).join('');
    }

    function switchTab(categoryId) {
      // If we are leaving GUI mode, serialize the parsed groups BACK to streamsData string before switching!
      if (viewMode === 'gui' && parsedGroups.length > 0) {
        streamsData[currentCategory] = serializeM3U(parsedGroups);
      }
      
      currentCategory = categoryId;
      renderTabs();
      
      if (viewMode === 'fancode') {
        editor.value = fancodeData[currentCategory] || "";
      } else if (viewMode === 'raw') {
        editor.value = streamsData[currentCategory] || "";
      } else {
        // GUI mode: parse the raw string into groups and render
        parseM3UToGroups(streamsData[currentCategory] || "");
        renderGUI();
      }
    }
    
    function setViewMode(mode) {
      // If we are leaving GUI mode, save its state back to raw string
      if (viewMode === 'gui' && mode !== 'gui') {
        streamsData[currentCategory] = serializeM3U(parsedGroups);
      }
      
      viewMode = mode;
      
      document.getElementById('mode-gui-btn').style.background = mode === 'gui' ? 'var(--primary)' : '#3f3f46';
      document.getElementById('mode-raw-btn').style.background = mode === 'raw' ? 'var(--primary)' : '#3f3f46';
      document.getElementById('mode-fc-btn').style.background = mode === 'fancode' ? '#2563eb' : '#3f3f46';
      
      document.getElementById('gui-container').style.display = mode === 'gui' ? 'flex' : 'none';
      document.getElementById('editor').style.display = mode === 'gui' ? 'none' : 'block';
      
      document.getElementById('editor').readOnly = (mode === 'fancode');
      
      switchTab(currentCategory); // Re-render content
    }

    // --- M3U PARSER & SERIALIZER ---
    function parseM3UToGroups(m3uString) {
      const lines = m3uString.split('\\n');
      const groupsMap = new Map(); // key: stream name, value: group object
      
      let currentInf = "";
      let currentKodiProps = [];
      
      for (const line of lines) {
        const tLine = line.trim();
        if (!tLine) continue;
        
        if (tLine.startsWith('#EXTINF:')) {
          currentInf = tLine;
        } else if (tLine.startsWith('#KODIPROP:')) {
          currentKodiProps.push(tLine);
        } else if (!tLine.startsWith('#') && currentInf) {
          // It's a URL line! Let's extract metadata from currentInf
          let name = currentInf.split(',').pop().trim();
          
          let logoMatch = currentInf.match(/tvg-logo="([^"]+)"/);
          let logo = logoMatch ? logoMatch[1] : "";
          
          let groupMatch = currentInf.match(/group-title="([^"]+)"/);
          let groupTitle = groupMatch ? groupMatch[1] : "";
          
          let source = { url: tLine, kodiProps: [...currentKodiProps], rawInf: currentInf };
          
          if (groupsMap.has(name)) {
            groupsMap.get(name).sources.push(source);
          } else {
            groupsMap.set(name, {
              name: name,
              logo: logo,
              groupTitle: groupTitle,
              category: currentCategory,
              sources: [source]
            });
          }
          
          currentInf = "";
          currentKodiProps = [];
        } else if (tLine.startsWith('#')) {
           // Skip other unrecognized headers
        }
      }
      
      parsedGroups = Array.from(groupsMap.values());
    }
    
    function serializeM3U(groupsArray) {
      let result = "#EXTM3U\\n";
      for (const group of groupsArray) {
        for (const source of group.sources) {
          // Reconstruct EXTINF. If we edited the name or group, we should theoretically rebuild it.
          // For safety, we keep the original rawInf if it exists, but replace the name and logo if needed.
          let inf = source.rawInf || \`#EXTINF:-1 tvg-logo="\${group.logo}" group-title="\${group.groupTitle}",\${group.name}\`;
          
          result += inf + "\\n";
          for (const prop of source.kodiProps) {
            result += prop + "\\n";
          }
          result += source.url + "\\n";
        }
      }
      return result;
    }

    // --- GUI RENDERING ---
    function renderGUI() {
      const container = document.getElementById('gui-container');
      const search = document.getElementById('search-input').value.toLowerCase();
      
      if (parsedGroups.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--text-muted);">No streams found in this category.</div>';
        return;
      }
      
      let html = '';
      parsedGroups.forEach((group, index) => {
        if (search && !group.name.toLowerCase().includes(search)) return;
        
        let catOptions = categories.map(c => 
          \`<option value="\${c.id}" \${c.id === group.category ? 'selected' : ''}>\${c.name}</option>\`
        ).join('');
        
        html += \`
          <div class="gui-card">
            <div class="card-header">
              <div class="card-title">
                <img src="\${group.logo || 'https://via.placeholder.com/40?text=TV'}" class="card-logo" onerror="this.src='https://via.placeholder.com/40?text=TV'">
                <div>
                  <div>\${group.name}</div>
                  <div class="card-meta">
                    <span>\${group.groupTitle || 'No Group'}</span>
                    <span class="badge">\${group.sources.length} Source(s)</span>
                  </div>
                </div>
              </div>
              <div class="card-actions">
                <select onchange="moveGroupCategory(\${index}, this.value)" style="padding: 8px; border-radius: 4px; background: rgba(0,0,0,0.5); color: white; border: 1px solid var(--border);">
                  \${catOptions}
                </select>
                <button onclick="openSourceModal(\${index})" class="secondary" style="padding: 8px 16px;">Edit Sources</button>
              </div>
            </div>
          </div>
        \`;
      });
      container.innerHTML = html;
    }
    
    function moveGroupCategory(index, newCategory) {
      if (newCategory === currentCategory) return;
      
      // Remove from current category's parsed groups
      const group = parsedGroups.splice(index, 1)[0];
      group.category = newCategory;
      
      // We must append this serialized group to the TARGET category's raw string
      let serialized = serializeM3U([group]);
      // Remove the #EXTM3U header from the serialization if appending
      serialized = serialized.replace('#EXTM3U\\n', '');
      
      streamsData[newCategory] = (streamsData[newCategory] || "") + "\\n" + serialized;
      
      document.getElementById('status-msg').textContent = 'Stream moved to ' + newCategory + '. Unsaved changes.';
      renderGUI();
    }

    // --- MODAL LOGIC ---
    let tempSources = [];
    
    function openSourceModal(index) {
      editingGroupIndex = index;
      const group = parsedGroups[index];
      document.getElementById('source-modal-title').textContent = "Edit Sources: " + group.name;
      
      let rawText = '';
      group.sources.forEach(src => {
        if (src.rawInf) rawText += src.rawInf + \'\\n\';
        if (src.kodiProps) {
          src.kodiProps.forEach(p => {
            rawText += p + \'\\n\';
          });
        }
        if (src.url) rawText += src.url + \'\\n\';
      });
      
      document.getElementById('source-modal-textarea').value = rawText.trim();
      document.getElementById('source-modal').style.display = 'flex';
    }
    
    function closeSourceModal() {
      document.getElementById('source-modal').style.display = 'none';
      tempSources = [];
      editingGroupIndex = -1;
    }
    
    function renderSourceModalList() {
      const list = document.getElementById('source-modal-list');
      let html = '';
      tempSources.forEach((src, i) => {
        let kid = ''; let key = '';
        src.kodiProps.forEach(p => {
           if (p.includes('keyId":"')) kid = p.match(/keyId":"([^"]+)"/)[1];
           if (p.includes('"key":"')) key = p.match(/"key":"([^"]+)"/)[1];
        });
        
        html += \`
          <div class="source-item">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
              <strong>Source \${i + 1} \${i === 0 ? '(Primary)' : '(Backup)'}</strong>
              <button onclick="removeTempSource(\${i})" style="width:auto; padding:4px 8px; font-size:0.7rem; background:#ff4d4d;">Remove</button>
            </div>
            <label>Stream URL</label>
            <input type="text" value="\${src.url}" onchange="updateTempSource(\${i}, 'url', this.value)">
            <label>ClearKey DRM (Optional)</label>
            <div class="flex-row">
              <input type="text" placeholder="Key ID (Hex)" value="\${kid}" onchange="updateTempKey(\${i}, 'kid', this.value)">
              <input type="text" placeholder="Key (Hex)" value="\${key}" onchange="updateTempKey(\${i}, 'key', this.value)">
            </div>
          </div>
        \`;
      });
      list.innerHTML = html;
    }
    
    function updateTempSource(index, field, value) {
      tempSources[index][field] = value;
    }
    
    function updateTempKey(index, type, value) {
      let kid = ''; let key = '';
      tempSources[index].kodiProps.forEach(p => {
         if (p.includes('keyId":"')) kid = p.match(/keyId":"([^"]+)"/)[1];
         if (p.includes('"key":"')) key = p.match(/"key":"([^"]+)"/)[1];
      });
      
      if (type === 'kid') kid = value;
      if (type === 'key') key = value;
      
      tempSources[index].kodiProps = [];
      if (kid && key) {
        tempSources[index].kodiProps.push('#KODIPROP:inputstream.adaptive.license_type=clearkey');
        tempSources[index].kodiProps.push(\`#KODIPROP:inputstream.adaptive.license_key={"\${kid}":"\${key}"}\`);
      }
    }
    
    function removeTempSource(index) {
      tempSources.splice(index, 1);
      renderSourceModalList();
    }
    
    function addSourceToModal() {
      // inherit rawInf from previous source if available
      const rawInf = tempSources.length > 0 ? tempSources[0].rawInf : "";
      tempSources.push({ url: "", kodiProps: [], rawInf: rawInf });
      renderSourceModalList();
    }
    
    function saveSourceModal() {
      if (editingGroupIndex !== -1) {
        // filter out empty URLs
        parsedGroups[editingGroupIndex].sources = tempSources.filter(s => s.url.trim() !== '');
        document.getElementById('status-msg').textContent = 'Sources updated. Unsaved changes.';
        renderGUI();
      }
      closeSourceModal();
    }

    // --- UTILS ---
    function exportBackup() {
      // If we are in GUI mode, serialize current tab back to streamsData before export!
      if (viewMode === 'gui') streamsData[currentCategory] = serializeM3U(parsedGroups);
      
      const formattedData = {};
      for (const key in streamsData) {
        formattedData[key] = streamsData[key] ? streamsData[key].split(/\\r?\\n/) : [];
      }
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(formattedData, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "sportify_streams_beta.json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    }

    function importBackup(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const importedData = JSON.parse(e.target.result);
          for (const key in importedData) {
            if (Array.isArray(importedData[key])) {
              importedData[key] = importedData[key].join('\\n');
            }
          }
          streamsData = { ...streamsData, ...importedData };
          switchTab(currentCategory);
          document.getElementById('status-msg').textContent = 'Backup imported! Click Save to apply.';
          document.getElementById('status-msg').style.color = '#eab308';
        } catch (err) {
          alert("Invalid backup file!");
        }
      };
      reader.readAsText(file);
      event.target.value = "";
    }
    
    async function showHistoryModal() {
      document.getElementById('history-modal').style.display = 'flex';
      const listDiv = document.getElementById('history-list');
      listDiv.innerHTML = 'Loading backups...';
      try {
        const res = await fetch('/api/admin/backups', { headers: { 'Authorization': \`Bearer \${currentPassword}\` } });
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        if (data.backups && data.backups.length > 0) {
          listDiv.innerHTML = data.backups.map(b => 
            \`<div style="display:flex; justify-content:space-between; align-items:center; padding: 8px; border-bottom: 1px solid var(--border);">
              <span>\${b.date}</span>
              <button onclick="restoreBackup('\${b.date}')" style="width:auto; padding: 6px 12px; font-size:0.8rem;">Restore</button>
            </div>\`
          ).join('');
        } else {
          listDiv.innerHTML = '<p style="color: var(--text-muted)">No backups found.</p>';
        }
      } catch(e) {
        listDiv.innerHTML = '<p style="color: #ff4d4d">Error loading backups.</p>';
      }
    }
    
    function closeHistoryModal() { document.getElementById('history-modal').style.display = 'none'; }
    
    async function restoreBackup(date) {
      if (!confirm(\`Are you sure you want to load the backup from \${date}?\`)) return;
      const btn = event.target;
      const originalText = btn.textContent;
      btn.textContent = 'Loading...';
      try {
        const res = await fetch(\`/api/admin/backup?date=\${date}\`, { headers: { 'Authorization': \`Bearer \${currentPassword}\` } });
        if (!res.ok) throw new Error('Failed to load');
        const backupData = await res.json();
        for (const key in backupData) {
          if (Array.isArray(backupData[key])) { backupData[key] = backupData[key].join('\\n'); }
        }
        streamsData = { ...streamsData, ...backupData };
        switchTab(currentCategory);
        closeHistoryModal();
        document.getElementById('status-msg').textContent = \`Backup from \${date} loaded! Click Save to apply.\`;
      } catch(e) {
        alert("Failed to fetch the backup data.");
        btn.textContent = originalText;
      }
    }

    async function saveData() {
      // Ensure current GUI state is flushed to string before saving!
      if (viewMode === 'gui') {
        streamsData[currentCategory] = serializeM3U(parsedGroups);
      }
      
      const btn = document.getElementById('save-btn');
      const status = document.getElementById('status-msg');
      btn.textContent = 'Saving...';
      btn.disabled = true;
      try {
        const res = await fetch('/api/admin/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${currentPassword}\` },
          body: JSON.stringify(streamsData)
        });
        const result = await res.json();
        if (res.ok && result.success) {
          status.textContent = 'Changes saved successfully!';
          status.style.color = '#4ade80';
          document.getElementById('kv-warning').style.display = 'none';
        } else { throw new Error(result.error || 'Unknown error'); }
      } catch (e) {
        status.textContent = 'Failed to save.';
        status.style.color = '#ff4d4d';
        if (e.message && e.message.includes('KV Namespace')) document.getElementById('kv-warning').style.display = 'block';
      }
      btn.textContent = 'Save Changes';
      btn.disabled = false;
      setTimeout(() => { if (status.textContent === 'Changes saved successfully!') { status.textContent = ''; status.style.color = 'var(--text-muted)'; } }, 3000);
    }
  </script>
</body>
</html>

`;
      `;
      
      
`;
      return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
    }

  },
  
  async scheduled(event, env, ctx) {
    if (!env.SPORTIFY_STREAMS) return;
    try {
      const data = await env.SPORTIFY_STREAMS.get("streams_data");
      if (data) {
        const dateStr = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        const backupKey = `streams_data_backup_${dateStr}`;
        await env.SPORTIFY_STREAMS.put(backupKey, data);
        
        // Clean up old backups (older than 10 days)
        const list = await env.SPORTIFY_STREAMS.list({ prefix: "streams_data_backup_" });
        const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().replace(/:/g, '-').split('.')[0];
        for (const key of list.keys) {
          const keyDate = key.name.replace("streams_data_backup_", "");
          if (keyDate < tenDaysAgo) {
            await env.SPORTIFY_STREAMS.delete(key.name);
          }
        }
      }
    } catch (e) {
      console.error("Scheduled backup failed", e);
    }
  }
};
