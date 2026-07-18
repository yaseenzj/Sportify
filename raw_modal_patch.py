import re
import os

with open('workers/cloudflare-stream-manager-beta/index.js', 'r', encoding='utf8') as f:
    orig = f.read()

# Replace HTML
orig = orig.replace(
    '''        <div id="source-modal-list"></div>
        
        <button onclick="addSourceToModal()" class="secondary" style="margin-bottom: 16px; width: 100%; border: 1px dashed var(--border); background: transparent;">+ Add Backup Source</button>''',
    '''        <textarea id="source-modal-textarea" style="width:100%; height:250px; background:rgba(0,0,0,0.3); border:1px solid var(--border); color:#fff; font-family:'Consolas', monospace; font-size: 13px; padding:12px; border-radius:8px; outline:none; resize:vertical; margin-bottom: 16px;" placeholder="Paste raw #EXTINF..."></textarea>'''
)

# Replace JS logic
orig = orig.replace(
    '''    function openSourceModal(index) {
      editingGroupIndex = index;
      const group = parsedGroups[index];
      document.getElementById('source-modal-title').textContent = "Edit Sources: " + group.name;
      
      // Deep clone sources for editing
      tempSources = JSON.parse(JSON.stringify(group.sources));
      renderSourceModalList();
      document.getElementById('source-modal').style.display = 'flex';
    }''',
    '''    function openSourceModal(index) {
      editingGroupIndex = index;
      const group = parsedGroups[index];
      document.getElementById('source-modal-title').textContent = "Edit Sources: " + group.name;
      
      let rawText = '';
      group.sources.forEach(src => {
        if (src.rawInf) rawText += src.rawInf + '\\n';
        if (src.kodiProps) {
          src.kodiProps.forEach(p => {
            rawText += p + '\\n';
          });
        }
        if (src.url) rawText += src.url + '\\n';
      });
      
      document.getElementById('source-modal-textarea').value = rawText.trim();
      document.getElementById('source-modal').style.display = 'flex';
    }'''
)

orig = orig.replace(
    '''    function saveSourceModal() {
      parsedGroups[editingGroupIndex].sources = tempSources;
      renderGroupsList();
      closeSourceModal();
    }''',
    '''    function saveSourceModal() {
      const rawText = document.getElementById('source-modal-textarea').value;
      const tempParsed = parseM3UToGroups(rawText);
      
      if (tempParsed.length > 0) {
        let allSources = [];
        tempParsed.forEach(g => {
          allSources = allSources.concat(g.sources);
        });
        parsedGroups[editingGroupIndex].sources = allSources;
        if (tempParsed[0].name) parsedGroups[editingGroupIndex].name = tempParsed[0].name;
        if (tempParsed[0].logo) parsedGroups[editingGroupIndex].logo = tempParsed[0].logo;
        if (tempParsed[0].groupTitle) parsedGroups[editingGroupIndex].groupTitle = tempParsed[0].groupTitle;
      } else {
        parsedGroups[editingGroupIndex].sources = [];
      }
      
      renderGroupsList();
      closeSourceModal();
    }'''
)

with open('workers/cloudflare-stream-manager-beta/index.js', 'w', encoding='utf8') as f:
    f.write(orig)
print("Updated successfully!")
