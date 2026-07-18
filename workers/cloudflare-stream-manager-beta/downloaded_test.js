
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
        const verifyRes = await fetch('/api/admin/verify', { method: 'POST', headers: { 'Authorization': `Bearer ${currentPassword}` } });
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
        `<button class="tab-btn ${cat.id === currentCategory ? 'active' : ''}" onclick="switchTab('${cat.id}')">${cat.name}</button>`
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
      const lines = m3uString.split('\n');
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
      let result = "#EXTM3U\n";
      for (const group of groupsArray) {
        for (const source of group.sources) {
          // Reconstruct EXTINF. If we edited the name or group, we should theoretically rebuild it.
          // For safety, we keep the original rawInf if it exists, but replace the name and logo if needed.
          let inf = source.rawInf || `#EXTINF:-1 tvg-logo="${group.logo}" group-title="${group.groupTitle}",${group.name}`;
          
          result += inf + "\n";
          for (const prop of source.kodiProps) {
            result += prop + "\n";
          }
          result += source.url + "\n";
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
          `<option value="${c.id}" ${c.id === group.category ? 'selected' : ''}>${c.name}</option>`
        ).join('');
        
        html += `
          <div class="gui-card">
            <div class="card-header">
              <div class="card-title">
                <img src="${group.logo || 'https://via.placeholder.com/40?text=TV'}" class="card-logo" onerror="this.src='https://via.placeholder.com/40?text=TV'">
                <div>
                  <div>${group.name}</div>
                  <div class="card-meta">
                    <span>${group.groupTitle || 'No Group'}</span>
                    <span class="badge">${group.sources.length} Source(s)</span>
                  </div>
                </div>
              </div>
              <div class="card-actions">
                <select onchange="moveGroupCategory(${index}, this.value)" style="padding: 8px; border-radius: 4px; background: rgba(0,0,0,0.5); color: white; border: 1px solid var(--border);">
                  ${catOptions}
                </select>
                <button onclick="openSourceModal(${index})" class="secondary" style="padding: 8px 16px;">Edit Sources</button>
              </div>
            </div>
          </div>
        `;
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
      serialized = serialized.replace('#EXTM3U\n', '');
      
      streamsData[newCategory] = (streamsData[newCategory] || "") + "\n" + serialized;
      
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
        if (src.rawInf) rawText += src.rawInf + '
';
        if (src.kodiProps) {
          src.kodiProps.forEach(p => {
            rawText += p + '
';
          });
        }
        if (src.url) rawText += src.url + '
';
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
        
        html += `
          <div class="source-item">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
              <strong>Source ${i + 1} ${i === 0 ? '(Primary)' : '(Backup)'}</strong>
              <button onclick="removeTempSource(${i})" style="width:auto; padding:4px 8px; font-size:0.7rem; background:#ff4d4d;">Remove</button>
            </div>
            <label>Stream URL</label>
            <input type="text" value="${src.url}" onchange="updateTempSource(${i}, 'url', this.value)">
            <label>ClearKey DRM (Optional)</label>
            <div class="flex-row">
              <input type="text" placeholder="Key ID (Hex)" value="${kid}" onchange="updateTempKey(${i}, 'kid', this.value)">
              <input type="text" placeholder="Key (Hex)" value="${key}" onchange="updateTempKey(${i}, 'key', this.value)">
            </div>
          </div>
        `;
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
        tempSources[index].kodiProps.push(`#KODIPROP:inputstream.adaptive.license_key={"${kid}":"${key}"}`);
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
        formattedData[key] = streamsData[key] ? streamsData[key].split(/\r?\n/) : [];
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
              importedData[key] = importedData[key].join('\n');
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
        const res = await fetch('/api/admin/backups', { headers: { 'Authorization': `Bearer ${currentPassword}` } });
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        if (data.backups && data.backups.length > 0) {
          listDiv.innerHTML = data.backups.map(b => 
            `<div style="display:flex; justify-content:space-between; align-items:center; padding: 8px; border-bottom: 1px solid var(--border);">
              <span>${b.date}</span>
              <button onclick="restoreBackup('${b.date}')" style="width:auto; padding: 6px 12px; font-size:0.8rem;">Restore</button>
            </div>`
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
      if (!confirm(`Are you sure you want to load the backup from ${date}?`)) return;
      const btn = event.target;
      const originalText = btn.textContent;
      btn.textContent = 'Loading...';
      try {
        const res = await fetch(`/api/admin/backup?date=${date}`, { headers: { 'Authorization': `Bearer ${currentPassword}` } });
        if (!res.ok) throw new Error('Failed to load');
        const backupData = await res.json();
        for (const key in backupData) {
          if (Array.isArray(backupData[key])) { backupData[key] = backupData[key].join('\n'); }
        }
        streamsData = { ...streamsData, ...backupData };
        switchTab(currentCategory);
        closeHistoryModal();
        document.getElementById('status-msg').textContent = `Backup from ${date} loaded! Click Save to apply.`;
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
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentPassword}` },
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
  