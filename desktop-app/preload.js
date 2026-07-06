const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getStore: (key) => ipcRenderer.sendSync('get-store', key),
  setStore: (key, val) => ipcRenderer.send('set-store', key, val),
  removeStore: (key) => ipcRenderer.send('remove-store', key)
});
