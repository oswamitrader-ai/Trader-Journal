const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');
const { setNativeLockState } = require('./windowsDaemon.cjs');

let mainWindow = null;
let tray = null;
let currentLockState = { isLockActive: false };

const isDev = process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL !== undefined || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'TradeLock Desktop — Trava Anti-Fúria Nativa',
    backgroundColor: '#000000',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Remove menu padrão do Electron para ficar 100% limpo em Dark Theme
  Menu.setApplicationMenu(null);

  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000';
  const indexPath = path.join(__dirname, '../dist/index.html');

  if (isDev) {
    mainWindow.loadURL(devUrl).catch(() => {
      console.log('🔗 [TradeLock Electron] Servidor dev offline. Carregando interface local...');
      if (fs.existsSync(indexPath)) {
        mainWindow.loadFile(indexPath);
      } else {
        setTimeout(() => mainWindow.loadURL(devUrl).catch(() => {}), 2000);
      }
    });
  } else {
    mainWindow.loadFile(indexPath);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('🚀 [TradeLock Desktop] Janela principal iniciada com sucesso.');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Configura autostart no sistema Windows
function setupAutoStart() {
  if (process.platform === 'win32') {
    app.setLoginItemSettings({
      openAtLogin: true,
      name: 'TradeLock Desktop',
    });
  }
}

// IPC Listener do Frontend React
ipcMain.on('sync-lock-state', (event, data) => {
  if (!data) return;
  const isStopHit = Boolean(data.isStopHit);
  const isMaxTradesHit = Boolean(data.isMaxTradesHit);
  const isSubBlocked = Boolean(data.isSubBlocked);
  const isLockActive = isStopHit || isMaxTradesHit || isSubBlocked;

  currentLockState = {
    isStopHit,
    isMaxTradesHit,
    isSubBlocked,
    isLockActive,
    todayPnl: data.todayPnl || 0,
    dailyLossLimit: data.dailyLossLimit || 0,
    updatedAt: Date.now(),
  };

  // Aplica blindagem nativa do Windows Daemon
  setNativeLockState(isLockActive, data.blockedDomains || []);
});

ipcMain.handle('get-desktop-status', async () => {
  return {
    isDesktop: true,
    platform: process.platform,
    lockState: currentLockState,
  };
});

app.whenReady().then(() => {
  setupAutoStart();
  createWindow();

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
