const { app, BrowserWindow, session, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Persistent storage fallback since localStorage can clear on file://
const storePath = path.join(app.getPath('userData'), 'sportify_data.json');
function readStore() {
  try { return JSON.parse(fs.readFileSync(storePath, 'utf8')); } 
  catch(e) { return {}; }
}
function writeStore(data) {
  fs.writeFileSync(storePath, JSON.stringify(data), 'utf8');
}

let activeStreamUrl = null;
let activeStreamHeaders = null;

ipcMain.on('set-active-stream', (e, url, headers) => {
  activeStreamUrl = url;
  activeStreamHeaders = headers;
});

ipcMain.on('clear-active-stream', () => {
  activeStreamUrl = null;
  activeStreamHeaders = null;
});

ipcMain.on('get-store', (e, key) => {
  e.returnValue = readStore()[key] || null;
});
ipcMain.on('set-store', (e, key, val) => {
  const store = readStore();
  store[key] = val;
  writeStore(store);
});
ipcMain.on('remove-store', (e, key) => {
  const store = readStore();
  delete store[key];
  writeStore(store);
});

ipcMain.on('get-version', (e) => {
  e.returnValue = app.getVersion();
});

ipcMain.on('start-update', () => {
  const { autoUpdater } = require('electron-updater');
  autoUpdater.downloadUpdate();
});

ipcMain.on('open-external', (e, url) => {
  require('electron').shell.openExternal(url);
  app.quit();
});

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    title: "Sportify Premium Dashboard",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Disables CORS and Mixed Content blocking
      preload: path.join(__dirname, 'preload.js')
    },
    autoHideMenuBar: true
  });

  // Load the index.html
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist-react', 'index.html'));
  }

  // Maximize the window
  mainWindow.maximize();
  
  // Anti-Bypass / Security Measures
  mainWindow.setMenu(null); // Completely remove the top menu bar

  // Prevent DevTools
  mainWindow.webContents.on('devtools-opened', () => {
    mainWindow.webContents.closeDevTools();
    const { dialog } = require('electron');
    dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Nice Try',
      message: 'you really thought bro?',
      detail: 'Developer tools are strictly disabled for security reasons.'
    });
  });

  // Block common inspect shortcuts
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (
      input.key === 'F12' || 
      (input.control && input.shift && input.key.toLowerCase() === 'i') ||
      (input.control && input.shift && input.key.toLowerCase() === 'j') ||
      (input.control && input.key.toLowerCase() === 'u')
    ) {
      event.preventDefault();
    }
  });
}

// Hardware Acceleration Fix:
// Shaka Player frequently bugs out on Chromium when resizing/going to PiP/Fullscreen if hardware acceleration is enabled
const hwAccel = readStore()['sportify_hw_accel'];
// ENABLE it by default because MediaKeys (DRM) fails on some systems without it
if (hwAccel === false) {
  app.disableHardwareAcceleration();
}

app.whenReady().then(() => {
  // Override headers to simulate a normal browser or bypass specific blocks
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ['*://*/*'] }, (details, callback) => {
    details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36';
    
    if (activeStreamHeaders) {
      for (const [key, value] of Object.entries(activeStreamHeaders)) {
        details.requestHeaders[key] = value;
      }
    } else {
      // Spoof Origin and Referer to match the requested domain (Target URL spoofing).
      // This is crucial for Fancode CDNs which reject mismatched referers, and it bypasses localhost blocks.
      try {
        const reqUrl = new URL(details.url);
        details.requestHeaders['Origin'] = reqUrl.origin;
        details.requestHeaders['Referer'] = reqUrl.origin + '/';
      } catch (e) {}
    }

    callback({ requestHeaders: details.requestHeaders });
  });

  createWindow();

  // Auto-Updater
  const { autoUpdater } = require('electron-updater');
  autoUpdater.autoDownload = false;

  autoUpdater.on('update-available', (info) => {
    if (mainWindow) mainWindow.webContents.send('update-available', info);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow) mainWindow.webContents.send('download-progress', progressObj);
  });

  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow) mainWindow.webContents.send('update-downloaded', info);
    // Automatically install once downloaded
    autoUpdater.quitAndInstall();
  });

  autoUpdater.checkForUpdatesAndNotify();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
