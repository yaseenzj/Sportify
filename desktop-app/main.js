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

function createWindow() {
  const win = new BrowserWindow({
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
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, 'dist-react', 'index.html'));
  }

  // Maximize the window
  win.maximize();
  
  // Anti-Bypass / Security Measures
  win.setMenu(null); // Completely remove the top menu bar

  // Prevent DevTools
  win.webContents.on('devtools-opened', () => {
    win.webContents.closeDevTools();
    const { dialog } = require('electron');
    dialog.showMessageBox(win, {
      type: 'warning',
      title: 'Nice Try',
      message: 'you really thought bro?',
      detail: 'Developer tools are strictly disabled for security reasons.'
    });
  });

  // Block common inspect shortcuts
  win.webContents.on('before-input-event', (event, input) => {
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
// Disable it by default to prevent black screens.
if (hwAccel !== true) {
  app.disableHardwareAcceleration();
}

app.whenReady().then(() => {
  // Override headers to simulate a normal browser or bypass specific blocks
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36';
    
    // Many IPTV servers block referers from web domains. By deleting it or keeping it empty, it acts like a direct player.
    delete details.requestHeaders['Origin'];
    delete details.requestHeaders['Referer'];

    callback({ requestHeaders: details.requestHeaders });
  });

  createWindow();

  // Auto-Updater
  const { autoUpdater } = require('electron-updater');
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
