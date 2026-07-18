const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getStore: (key) => ipcRenderer.sendSync('get-store', key),
  setStore: (key, val) => { ipcRenderer.sendSync('set-store', key, val); },
  removeStore: (key) => ipcRenderer.sendSync('remove-store', key),
  getVersion: () => ipcRenderer.sendSync('get-version'),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_event, value) => callback(value)),
  onUpdateProgress: (callback) => ipcRenderer.on('download-progress', (_event, value) => callback(value)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (_event, value) => callback(value)),
  startUpdate: () => ipcRenderer.send('start-update'),
  checkUpdate: () => ipcRenderer.send('check-update'),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  setActiveStream: (url, headers) => ipcRenderer.send('set-active-stream', url, headers),
  clearActiveStream: () => ipcRenderer.send('clear-active-stream'),
  relaunchApp: () => ipcRenderer.send('relaunch-app')
});
