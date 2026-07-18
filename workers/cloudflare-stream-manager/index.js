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
                if (match.status && match.status !== 'LIVE' && match.status !== 'UPCOMING') continue;
                
                let streamUrl = "";
                if (match.streams) {
                  if (match.status === 'LIVE' && match.streams.backup) {
                    streamUrl = match.streams.backup.fancode_cdn_v1 || match.streams.backup.fancode_cdn || "";
                  } else if (match.status === 'UPCOMING') {
                    streamUrl = match.streams.primary || match.streams.fancode_cdn || "";
                  }
                  
                  if (!streamUrl) {
                    streamUrl = match.streams.primary || match.streams.fancode_cdn || (match.streams.backup ? (match.streams.backup.fancode_cdn_v1 || match.streams.backup.fancode_cdn) : "");
                  }
                }
                if (!streamUrl) continue;
                
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
    // PUBLIC API FOR REPORTING
    // ----------------------------------------------------
    if (url.pathname === '/api/report' && request.method === 'POST') {
      try {
        const { username, message, screenshot } = await request.json();
        if (!message) return new Response(JSON.stringify({ error: "Missing message" }), { status: 400, headers: corsHeaders });
        
        const reportId = `report_${Date.now()}`;
        const reportData = { username, message, screenshot, timestamp: new Date().toISOString() };
        
        await env.SPORTIFY_STREAMS.put(reportId, JSON.stringify(reportData));
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
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
    // ADMIN API FOR REPORTS
    // ----------------------------------------------------
    if (url.pathname === '/api/admin/reports' && request.method === 'GET') {
      const auth = request.headers.get("Authorization");
      if (auth !== `Bearer ${ADMIN_PASSWORD}`) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      
      try {
        const list = await env.SPORTIFY_STREAMS.list({ prefix: "report_" });
        const reports = [];
        for (const key of list.keys) {
          const data = await env.SPORTIFY_STREAMS.get(key.name);
          if (data) {
             const parsed = JSON.parse(data);
             parsed.id = key.name;
             reports.push(parsed);
          }
        }
        reports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return new Response(JSON.stringify({ reports }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (url.pathname === '/api/admin/delete-report' && request.method === 'POST') {
      const auth = request.headers.get("Authorization");
      if (auth !== `Bearer ${ADMIN_PASSWORD}`) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      
      try {
        const { id } = await request.json();
        if (!id) return new Response("Missing id", { status: 400, headers: corsHeaders });
        await env.SPORTIFY_STREAMS.delete(id);
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
            
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
            
            /* Dashboard */
            .tabs { display: flex; gap: 8px; margin-bottom: 24px; overflow-x: auto; padding-bottom: 8px; }
            .tab-btn { background: var(--surface); color: var(--text-muted); padding: 10px 20px; border-radius: 20px; font-size: 0.9rem; font-weight: 500; cursor: pointer; border: 1px solid var(--border); transition: all 0.2s; white-space: nowrap; width: auto; }
            .tab-btn:hover { color: white; border-color: rgba(255,255,255,0.2); }
            .tab-btn.active { background: var(--primary); color: white; border-color: var(--primary); }
            
            .editor-container { background: var(--surface); border-radius: 12px; border: 1px solid var(--border); overflow: hidden; display: flex; flex-direction: column; height: 500px; }
            textarea { flex: 1; background: transparent; border: none; padding: 20px; color: #d4d4d8; font-family: 'Consolas', monospace; font-size: 14px; line-height: 1.5; outline: none; resize: none; }
            
            .actions { display: flex; justify-content: flex-end; margin-top: 24px; gap: 16px; align-items: center; }
            .status { color: var(--text-muted); font-size: 0.9rem; }
            .actions button { width: auto; min-width: 150px; }
            
            .kv-warning { background: rgba(255, 77, 77, 0.1); border: 1px solid rgba(255, 77, 77, 0.2); padding: 16px; border-radius: 8px; color: #ff4d4d; margin-bottom: 24px; font-size: 0.9rem; display: none; }
          </style>
        </head>
        <body>
          <div class="container">
            <div id="login-screen">
              <div class="login-box">
                <h2 style="margin-bottom: 8px;">Admin Login</h2>
                <p style="color: var(--text-muted); font-size: 0.9rem;">Enter Admin Password</p>
                <input type="password" id="password" placeholder="Password">
                <button onclick="login()">Enter Dashboard</button>
                <div id="login-error" style="color: #ff4d4d; margin-top: 16px; font-size: 0.85rem; display: none;">Invalid password</div>
              </div>
            </div>
            
            <div id="dashboard" style="display: none;">
              <h1>Sportify Stream Manager</h1>
              <p class="subtitle">Paste your M3U playlists into the correct categories below.</p>
              
              <div id="kv-warning" class="kv-warning">
                <strong>⚠️ Cloudflare KV Not Bound!</strong><br><br>
                You need to create a KV Namespace in your Cloudflare dashboard and bind it to this worker with the variable name <code>SPORTIFY_STREAMS</code> before you can save anything!
              </div>

              <div class="tabs" id="tabs">
                <!-- Tabs generated by JS -->
              </div>
              
              <div id="toolbar" style="display: flex; gap: 8px; margin-bottom: 16px;">
                <button id="view-toggle-btn" onclick="toggleViewMode()" style="width: auto; background: #2563eb;">Show Fancode Links</button>
                <input type="text" id="search-input" placeholder="Search in this category..." style="flex: 1; padding: 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: white; outline: none;" oninput="handleSearch()">
                <button onclick="exportBackup()" style="width: auto;">Export Backup</button>
                <input type="file" id="import-file" style="display: none;" accept=".json" onchange="importBackup(event)">
                <button onclick="document.getElementById('import-file').click()" style="width: auto; background: #3f3f46;">Import Backup</button>
                <button onclick="showHistoryModal()" style="width: auto; background: #9333ea;">Version History</button>
              </div>
              
              <div id="editor-section">
                <div class="editor-container">
                  <textarea id="editor" placeholder="Paste #EXTM3U content here..."></textarea>
                </div>
                
                <div class="actions">
                  <div class="status" id="status-msg"></div>
                  <button onclick="saveData()" id="save-btn">Save Changes</button>
                </div>
              </div>
              
              <div id="reports-section" style="display: none;">
                <div id="reports-list" style="display: flex; flex-direction: column; gap: 16px;">
                  <p style="color: var(--text-muted)">Loading reports...</p>
                </div>
              </div>
            </div>
            
            <div id="history-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); align-items: center; justify-content: center; z-index: 100;">
              <div style="background: var(--surface); padding: 24px; border-radius: 12px; width: 100%; max-width: 400px; border: 1px solid var(--border);">
                <h3 style="margin-bottom: 16px;">Version History</h3>
                <div id="history-list" style="max-height: 300px; overflow-y: auto; margin-bottom: 16px;">Loading...</div>
                <button onclick="closeHistoryModal()" style="background: #3f3f46;">Close</button>
              </div>
            </div>
          </div>

          <script>
            let currentPassword = '';
            let currentCategory = 'all';
            let viewMode = 'manual'; // 'manual' or 'fancode'
            let streamsData = { all: "", football: "", cricket: "", f1: "", motogp: "", golf: "", tennis: "" };
            let fancodeData = { all: "", football: "", cricket: "", f1: "", motogp: "", golf: "", tennis: "" };
            
            const categories = [
              { id: 'all', name: 'All Channels' },
              { id: 'football', name: 'Football' },
              { id: 'cricket', name: 'Cricket' },
              { id: 'f1', name: 'F1' },
              { id: 'motogp', name: 'MotoGP' },
              { id: 'golf', name: 'Golf' },
              { id: 'tennis', name: 'Tennis' },
              { id: 'reports', name: 'Reports ⚠️' }
            ];

            const passwordInput = document.getElementById('password');
            passwordInput.addEventListener('keypress', (e) => {
              if (e.key === 'Enter') login();
            });

            const editor = document.getElementById('editor');
            editor.addEventListener('input', (e) => {
              if (viewMode === 'manual') {
                streamsData[currentCategory] = e.target.value;
                document.getElementById('status-msg').textContent = 'Unsaved changes...';
              }
            });

            async function login() {
              currentPassword = document.getElementById('password').value;
              
              // Try to verify password
              try {
                const verifyRes = await fetch('/api/admin/verify', {
                  method: 'POST',
                  headers: { 'Authorization': \`Bearer \${currentPassword}\` }
                });
                
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
                  throw new Error('Invalid password');
                }
              } catch (e) {
                document.getElementById('login-error').style.display = 'block';
              }
            }

            function renderTabs() {
              const tabsContainer = document.getElementById('tabs');
              tabsContainer.innerHTML = '';
              
              categories.forEach(cat => {
                const btn = document.createElement('button');
                btn.className = 'tab-btn' + (currentCategory === cat.id ? ' active' : '');
                btn.textContent = cat.name;
                btn.onclick = () => switchTab(cat.id);
                tabsContainer.appendChild(btn);
              });
            }

            function toggleViewMode() {
              viewMode = viewMode === 'manual' ? 'fancode' : 'manual';
              const btn = document.getElementById('view-toggle-btn');
              if (viewMode === 'fancode') {
                btn.textContent = 'Show Manual Links';
                btn.style.background = '#059669';
                editor.readOnly = true;
                document.getElementById('save-btn').disabled = true;
                document.getElementById('save-btn').style.opacity = '0.5';
              } else {
                btn.textContent = 'Show Fancode Links';
                btn.style.background = '#2563eb';
                editor.readOnly = false;
                document.getElementById('save-btn').disabled = false;
                document.getElementById('save-btn').style.opacity = '1';
              }
              switchTab(currentCategory);
            }

            function switchTab(id) {
              currentCategory = id;
              renderTabs();
              
              if (id === 'reports') {
                document.getElementById('editor-section').style.display = 'none';
                document.getElementById('toolbar').style.display = 'none';
                document.getElementById('reports-section').style.display = 'block';
                loadReports();
                return;
              }
              
              document.getElementById('editor-section').style.display = 'block';
              document.getElementById('toolbar').style.display = 'flex';
              document.getElementById('reports-section').style.display = 'none';
              
              const dataSource = viewMode === 'fancode' ? fancodeData : streamsData;
              editor.value = dataSource[id] || "";
              document.getElementById('search-input').value = ""; // clear search
            }
            
            async function loadReports() {
              const listDiv = document.getElementById('reports-list');
              listDiv.innerHTML = '<p style="color: var(--text-muted)">Loading reports...</p>';
              try {
                const res = await fetch('/api/admin/reports', {
                  headers: { 'Authorization': `Bearer ${currentPassword}` }
                });
                if (!res.ok) throw new Error('Failed to load reports');
                const data = await res.json();
                
                if (data.reports && data.reports.length > 0) {
                  listDiv.innerHTML = data.reports.map(r => `
                    <div style="background: var(--surface); padding: 20px; border-radius: 12px; border: 1px solid var(--border);">
                      <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                        <strong style="color: var(--primary)">${r.username}</strong>
                        <span style="color: var(--text-muted); font-size: 0.85rem;">${new Date(r.timestamp).toLocaleString()}</span>
                      </div>
                      <p style="margin-bottom: 16px; white-space: pre-wrap;">${r.message}</p>
                      ${r.screenshot ? `<img src="${r.screenshot}" style="max-width: 100%; border-radius: 8px; margin-bottom: 16px; border: 1px solid var(--border);" />` : ''}
                      <div>
                        <button onclick="deleteReport('${r.id}')" style="background: #ff4d4d; width: auto; padding: 8px 16px; font-size: 0.9rem;">Delete Report</button>
                      </div>
                    </div>
                  `).join('');
                } else {
                  listDiv.innerHTML = '<p style="color: var(--text-muted)">No reports found. You\\'re all caught up!</p>';
                }
              } catch (e) {
                listDiv.innerHTML = '<p style="color: #ff4d4d">Error loading reports.</p>';
              }
            }
            
            async function deleteReport(id) {
              if (!confirm('Are you sure you want to delete this report?')) return;
              try {
                const res = await fetch('/api/admin/delete-report', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentPassword}` },
                  body: JSON.stringify({ id })
                });
                if (res.ok) {
                  loadReports();
                } else {
                  alert("Failed to delete report.");
                }
              } catch (e) {
                alert("Error deleting report.");
              }
            }

            function handleSearch() {
              const query = document.getElementById('search-input').value.toLowerCase();
              if (!query) return;
              const text = editor.value;
              const index = text.toLowerCase().indexOf(query);
              if (index !== -1) {
                editor.setSelectionRange(index, index + query.length);
                const lines = text.substr(0, index).split('\\n');
                editor.scrollTop = Math.max(0, (lines.length - 3) * 21);
              }
            }

            function exportBackup() {
              const formattedData = {};
              for (const key in streamsData) {
                // Split long M3U strings into an array of lines so the JSON is readable
                formattedData[key] = streamsData[key] ? streamsData[key].split(/\\r?\\n/) : [];
              }
              const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(formattedData, null, 2));
              const downloadAnchorNode = document.createElement('a');
              downloadAnchorNode.setAttribute("href", dataStr);
              downloadAnchorNode.setAttribute("download", "sportify_streams_backup.json");
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
                  // Convert array of lines back into a single string
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
                const res = await fetch('/api/admin/backups', {
                  headers: { 'Authorization': \`Bearer \${currentPassword}\` }
                });
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
                  listDiv.innerHTML = '<p style="color: var(--text-muted)">No backups found in Cloudflare.</p>';
                }
              } catch(e) {
                listDiv.innerHTML = '<p style="color: #ff4d4d">Error loading backups.</p>';
              }
            }
            
            function closeHistoryModal() {
              document.getElementById('history-modal').style.display = 'none';
            }
            
            async function restoreBackup(date) {
              if (!confirm(\`Are you sure you want to load the backup from \${date}? This will overwrite your unsaved changes in the editor.\`)) return;
              
              const btn = event.target;
              const originalText = btn.textContent;
              btn.textContent = 'Loading...';
              
              try {
                const res = await fetch(\`/api/admin/backup?date=\${date}\`, {
                  headers: { 'Authorization': \`Bearer \${currentPassword}\` }
                });
                if (!res.ok) throw new Error('Failed to load');
                const backupData = await res.json();
                
                // Convert array of lines back to single string just like importBackup
                for (const key in backupData) {
                  if (Array.isArray(backupData[key])) {
                    backupData[key] = backupData[key].join('\\n');
                  }
                }
                
                streamsData = { ...streamsData, ...backupData };
                switchTab(currentCategory);
                closeHistoryModal();
                
                document.getElementById('status-msg').textContent = \`Backup from \${date} loaded! Click Save to apply.\`;
                document.getElementById('status-msg').style.color = '#eab308';
              } catch(e) {
                alert("Failed to fetch the backup data.");
                btn.textContent = originalText;
              }
            }

            async function saveData() {
              const btn = document.getElementById('save-btn');
              const status = document.getElementById('status-msg');
              
              btn.textContent = 'Saving...';
              btn.disabled = true;
              
              try {
                const res = await fetch('/api/admin/save', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': \`Bearer \${currentPassword}\`
                  },
                  body: JSON.stringify(streamsData)
                });
                
                const result = await res.json();
                
                if (res.ok && result.success) {
                  status.textContent = 'Changes saved successfully!';
                  status.style.color = '#4ade80'; // green
                  document.getElementById('kv-warning').style.display = 'none';
                } else {
                  throw new Error(result.error || 'Unknown error');
                }
              } catch (e) {
                console.error(e);
                status.textContent = 'Failed to save.';
                status.style.color = '#ff4d4d'; // red
                
                if (e.message && e.message.includes('KV Namespace')) {
                  document.getElementById('kv-warning').style.display = 'block';
                }
              }
              
              btn.textContent = 'Save Changes';
              btn.disabled = false;
              
              setTimeout(() => {
                if (status.textContent === 'Changes saved successfully!') {
                  status.textContent = '';
                  status.style.color = 'var(--text-muted)';
                }
              }, 3000);
            }
          </script>
        </body>
        </html>
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
