const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getStore: (key) => ipcRenderer.sendSync('get-store', key),
  setStore: (key, val) => ipcRenderer.send('set-store', key, val),
  removeStore: (key) => ipcRenderer.send('remove-store', key),
  getVersion: () => ipcRenderer.sendSync('get-version'),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_event, value) => callback(value)),
  onUpdateProgress: (callback) => ipcRenderer.on('download-progress', (_event, value) => callback(value)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (_event, value) => callback(value)),
  startUpdate: () => ipcRenderer.send('start-update'),
  openExternal: (url) => ipcRenderer.send('open-external', url)
});
