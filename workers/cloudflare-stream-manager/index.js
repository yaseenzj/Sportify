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
      try {
        if (request.method === 'POST') {
          const auth = request.headers.get("Authorization");
          if (auth !== `Bearer ${ADMIN_PASSWORD}`) {
            return new Response("Unauthorized", { status: 401, headers: corsHeaders });
          }
          const body = await request.json();
          await env.SPORTIFY_STREAMS.put("streams_data", JSON.stringify(body));
          return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        let parsed = { broadcastMessage: "", cards: [] };
        if (env.SPORTIFY_STREAMS) {
          const data = await env.SPORTIFY_STREAMS.get("streams_data");
          if (data) parsed = { ...parsed, ...JSON.parse(data) };
        }

        let cardsParsed = [];
        if (parsed.cards) {
          try {
            cardsParsed = typeof parsed.cards === 'string' ? JSON.parse(parsed.cards) : parsed.cards;
          } catch (e) {}
        }

        return new Response(JSON.stringify({ 
          broadcastMessage: parsed.broadcastMessage,
          cards: cardsParsed
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ broadcastMessage: "", cards: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (url.pathname === '/api/streams/m3u') {
      try {
        let parsed = { all: "", football: "", cricket: "", basketball: "", f1: "", motogp: "", tennis: "", golf: "", cards: "" };
        
        if (env.SPORTIFY_STREAMS) {
          const data = await env.SPORTIFY_STREAMS.get("streams_data");
          if (data) parsed = { ...parsed, ...JSON.parse(data) };
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

        // Push to GitHub Gist if configured
        if (env.GITHUB_TOKEN && env.GIST_ID) {
          try {
            await fetch(`https://api.github.com/gists/${env.GIST_ID}`, {
              method: 'PATCH',
              headers: {
                'Authorization': `token ${env.GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Sportify-Stream-Manager'
              },
              body: JSON.stringify({
                files: {
                  'streams.json': {
                    content: JSON.stringify(body)
                  }
                }
              })
            });
          } catch (gistErr) {
            console.error("Failed to push to GitHub Gist:", gistErr);
          }
        }

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
          <link rel="icon" type="image/png" href="data:image/png;base64,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">
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
            .editor-wrapper { position: relative; flex: 1; display: flex; }
            .backdrop { position: absolute; top: 0; left: 0; right: 0; bottom: 0; padding: 20px; font-family: 'Consolas', monospace; font-size: 14px; line-height: 1.5; color: transparent; pointer-events: none; white-space: pre-wrap; word-wrap: break-word; overflow-y: scroll; z-index: 1; }
            .backdrop mark { background: rgba(234, 179, 8, 0.6); color: transparent; }
            #editor { position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 2; background: transparent; border: none; padding: 20px; color: #d4d4d8; font-family: 'Consolas', monospace; font-size: 14px; line-height: 1.5; outline: none; resize: none; overflow-y: scroll; }

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
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <h1 style="margin-bottom: 0;">Sportify Admin Panel</h1>
                <button onclick="showBroadcastModal()" style="width: auto; background: #eab308; color: #000; display: flex; align-items: center; gap: 8px;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                  Set Alerts
                </button>
              </div>
              <p class="subtitle">If you see this you're an Admin lol</p>
              
              <div id="kv-warning" class="kv-warning">
                <strong>⚠️ Cloudflare KV Not Bound!</strong><br><br>
                You need to create a KV Namespace in your Cloudflare dashboard and bind it to this worker with the variable name <code>SPORTIFY_STREAMS</code> before you can save anything!
              </div>

              <div class="tabs" id="tabs">
                <!-- Tabs generated by JS -->
              </div>
              
              <div id="toolbar" style="display: flex; gap: 8px; margin-bottom: 16px;">
                <div style="flex: 1; display: flex; align-items: center; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding-right: 8px; overflow: hidden;">
                  <input type="text" id="search-input" placeholder="Search in this category..." style="flex: 1; padding: 10px; background: transparent; color: white; outline: none; border: none;" oninput="handleSearchInput()" onkeydown="handleSearchKey(event)">
                  <span id="search-info" style="color: var(--text-muted); font-size: 0.85rem; margin-right: 8px; pointer-events: none;"></span>
                  <button onclick="nextSearchMatch(-1)" style="width: 24px; height: 24px; padding: 0; background: transparent; color: var(--text-muted); display: flex; align-items: center; justify-content: center; min-width: unset; margin-right: 4px;" title="Previous (Shift+Enter)">▲</button>
                  <button onclick="nextSearchMatch(1)" style="width: 24px; height: 24px; padding: 0; background: transparent; color: var(--text-muted); display: flex; align-items: center; justify-content: center; min-width: unset;" title="Next (Enter)">▼</button>
                </div>
                <button onclick="exportBackup()" style="width: auto;">Export Backup</button>
                <input type="file" id="import-file" style="display: none;" accept=".json" onchange="importBackup(event)">
                <button onclick="document.getElementById('import-file').click()" style="width: auto; background: #3f3f46;">Import Backup</button>
                <button onclick="showHistoryModal()" style="width: auto; background: #9333ea;">Version History</button>
              </div>
              
              <div id="editor-section">
                <div class="editor-container">
                  <div class="editor-wrapper">
                    <div id="editor-backdrop" class="backdrop"></div>
                    <textarea id="editor" placeholder="Paste #EXTM3U content here..." onscroll="syncScroll()" oninput="updateBackdrop()"></textarea>
                  </div>
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
            
            <div id="broadcast-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); align-items: center; justify-content: center; z-index: 100;">
              <div style="background: var(--surface); padding: 24px; border-radius: 12px; width: 100%; max-width: 400px; border: 1px solid var(--border);">
                <h3 style="margin-bottom: 16px;">Set Alerts Message</h3>
                <textarea id="broadcast-input" placeholder="this will be shown to every user.." rows="4" style="width: 100%; background: rgba(0,0,0,0.2); border: 1px solid var(--border); padding: 12px; border-radius: 8px; color: white; resize: none; margin-bottom: 16px; outline: none;"></textarea>
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                  <button onclick="closeBroadcastModal()" style="width: auto; background: #3f3f46;">Cancel</button>
                  <button onclick="saveBroadcast(event)" style="width: auto; background: #eab308; color: #000;">Send Alert</button>
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
            let streamsData = { all: "", football: "", cricket: "", basketball: "", f1: "", motogp: "", tennis: "", golf: "", broadcastMessage: "", cards: "" };
            
            const categories = [
              { id: 'reports', name: 'Reports ⚠️' },
              { id: 'all', name: 'All Channels' },
              { id: 'cards', name: 'Featured Cards 🎴' },
              { id: 'basketball', name: 'Basketball' },
              { id: 'f1', name: 'F1' },
              { id: 'football', name: 'Football' },
              { id: 'motogp', name: 'MotoGP' },
              { id: 'cricket', name: 'Cricket' },
              { id: 'tennis', name: 'Tennis' },
              { id: 'golf', name: 'Golf' }
            ];

            const passwordInput = document.getElementById('password');
            passwordInput.addEventListener('keypress', (e) => {
              if (e.key === 'Enter') login();
            });

            const editor = document.getElementById('editor');
            editor.addEventListener('input', (e) => {
              streamsData[currentCategory] = e.target.value;
              document.getElementById('status-msg').textContent = 'Unsaved changes...';
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
                  
                  document.getElementById('login-screen').style.display = 'none';
                  document.getElementById('dashboard').style.display = 'block';
                  
                  renderTabs();
                  switchTab('reports');
                  fetchReportsCount();
                } else {
                  throw new Error('Invalid password');
                }
              } catch (e) {
                document.getElementById('login-error').style.display = 'block';
              }
            }

            async function fetchReportsCount() {
              try {
                const res = await fetch('/api/admin/reports', {
                  headers: { 'Authorization': \`Bearer \${currentPassword}\` }
                });
                if (res.ok) {
                  const data = await res.json();
                  const count = data.reports ? data.reports.length : 0;
                  const reportsCat = categories.find(c => c.id === 'reports');
                  if (reportsCat) {
                    reportsCat.name = \`Reports ⚠️ (\${count})\`;
                    renderTabs();
                  }
                }
              } catch (e) {}
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
              
              if (id === 'cards' && !streamsData[id]) {
                streamsData[id] = JSON.stringify([
                  {
                    "id": "custom_card_1",
                    "title": "Example Live Match",
                    "tournament": "Champions League",
                    "logo": "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=600",
                    "category": "football",
                    "status": "LIVE",
                    "startTime": "16 Aug 2026 20:00:00 PM",
                    "url": "https://example.com/stream.m3u8"
                  }
                ], null, 2);
              }
              editor.value = streamsData[id] || "";
              document.getElementById('search-input').value = ""; // clear search
              updateBackdrop();
            }
            
            async function loadReports() {
              const listDiv = document.getElementById('reports-list');
              listDiv.innerHTML = '<p style="color: var(--text-muted)">Loading reports...</p>';
              try {
                const res = await fetch('/api/admin/reports', {
                  headers: { 'Authorization': \`Bearer \${currentPassword}\` }
                });
                if (!res.ok) throw new Error('Failed to load reports');
                const data = await res.json();
                
                if (data.reports && data.reports.length > 0) {
                  listDiv.innerHTML = data.reports.map(r => \`
                    <div style="background: var(--surface); padding: 20px; border-radius: 12px; border: 1px solid var(--border);">
                      <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                        <strong style="color: var(--primary)">\${r.username}</strong>
                        <span style="color: var(--text-muted); font-size: 0.85rem;">\${new Date(r.timestamp).toLocaleString()}</span>
                      </div>
                      <p style="margin-bottom: 16px; white-space: pre-wrap;">\${r.message}</p>
                      \${r.screenshot ? \`<img src="\${r.screenshot}" style="max-width: 100%; border-radius: 8px; margin-bottom: 16px; border: 1px solid var(--border);" />\` : ''}
                      <div>
                        <button onclick="deleteReport('\${r.id}')" style="background: #ff4d4d; width: auto; padding: 8px 16px; font-size: 0.9rem;">Delete Report</button>
                      </div>
                    </div>
                  \`).join('');
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
                  headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${currentPassword}\` },
                  body: JSON.stringify({ id })
                });
                if (res.ok) {
                  loadReports();
                  fetchReportsCount();
                } else {
                  alert("Failed to delete report.");
                }
              } catch (e) {
                alert("Error deleting report.");
              }
            }

            function escapeHTML(str) {
              return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            }

            function syncScroll() {
              const editor = document.getElementById('editor');
              const backdrop = document.getElementById('editor-backdrop');
              backdrop.scrollTop = editor.scrollTop;
              backdrop.scrollLeft = editor.scrollLeft;
            }

            let searchMatches = [];
            let currentSearchIndex = -1;

            function updateBackdrop() {
              const query = document.getElementById('search-input').value.toLowerCase();
              const text = document.getElementById('editor').value;
              const backdrop = document.getElementById('editor-backdrop');
              
              searchMatches = [];
              if (!query) {
                backdrop.innerHTML = escapeHTML(text) + (text.endsWith('\\n') ? '<br/>' : '');
                document.getElementById('search-info').textContent = '';
                return;
              }
              
              let html = '';
              let lastIdx = 0;
              let lowerText = text.toLowerCase();
              let idx = lowerText.indexOf(query);
              
              let matchIndex = 0;
              while (idx !== -1) {
                searchMatches.push(idx);
                html += escapeHTML(text.substring(lastIdx, idx));
                // Highlight the active match differently
                const isCurrent = matchIndex === currentSearchIndex;
                html += \`<mark style="background: \${isCurrent ? 'rgba(234, 179, 8, 0.9)' : 'rgba(234, 179, 8, 0.5)'};">\${escapeHTML(text.substring(idx, idx + query.length))}</mark>\`;
                lastIdx = idx + query.length;
                idx = lowerText.indexOf(query, lastIdx);
                matchIndex++;
              }
              html += escapeHTML(text.substring(lastIdx));
              if (text.endsWith('\\n')) html += '<br/>';
              
              backdrop.innerHTML = html;
              
              const info = document.getElementById('search-info');
              if (searchMatches.length > 0) {
                info.textContent = \`\${currentSearchIndex + 1} of \${searchMatches.length}\`;
              } else {
                info.textContent = '0 matches';
              }
            }

            function handleSearchInput() {
              currentSearchIndex = 0;
              updateBackdrop();
              scrollToMatch();
            }

            function handleSearchKey(event) {
              if (event.key === 'Enter') {
                event.preventDefault();
                nextSearchMatch(event.shiftKey ? -1 : 1);
              }
            }

            function nextSearchMatch(dir) {
              if (searchMatches.length === 0) return;
              currentSearchIndex += dir;
              if (currentSearchIndex < 0) currentSearchIndex = searchMatches.length - 1;
              if (currentSearchIndex >= searchMatches.length) currentSearchIndex = 0;
              updateBackdrop();
              scrollToMatch();
            }

            function scrollToMatch() {
              if (currentSearchIndex >= 0 && currentSearchIndex < searchMatches.length) {
                const text = document.getElementById('editor').value;
                const index = searchMatches[currentSearchIndex];
                const lines = text.substr(0, index).split('\\n');
                document.getElementById('editor').scrollTop = Math.max(0, (lines.length - 3) * 21);
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

            function showBroadcastModal() {
              document.getElementById('broadcast-input').value = streamsData.broadcastMessage || "";
              document.getElementById('broadcast-modal').style.display = 'flex';
            }
            
            function closeBroadcastModal() {
              document.getElementById('broadcast-modal').style.display = 'none';
            }
            
            async function saveBroadcast(event) {
              const btn = event ? event.target : null;
              if (btn) {
                btn.disabled = true;
                btn.textContent = 'Sending...';
              }
              
              streamsData.broadcastMessage = document.getElementById('broadcast-input').value;
              
              try {
                const res = await fetch('/api/streams/json', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentPassword },
                  body: JSON.stringify(streamsData)
                });
                if (res.ok) {
                  closeBroadcastModal();
                  const statusMsg = document.getElementById('status-msg');
                  statusMsg.textContent = 'Alerts sent successfully!';
                  statusMsg.style.color = '#22c55e';
                  setTimeout(() => { statusMsg.textContent = ''; }, 3000);
                } else {
                  alert('Failed to send alerts');
                }
              } catch(e) {
                alert('Error sending alerts');
              }
              
              if (btn) {
                btn.disabled = false;
                btn.textContent = 'Send Alert';
              }
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
