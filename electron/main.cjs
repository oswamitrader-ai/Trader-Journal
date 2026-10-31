const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, desktopCapturer, screen } = require('electron');
const fs = require('fs');
const path = require('path');
const { setNativeLockState } = require('./windowsDaemon.cjs');
const { createExnovaCaptureService } = require('./exnovaCapture.cjs');
const { createExnovaStakeShield } = require('./exnovaStakeShield.cjs');

let mainWindow = null;
let tray = null;
let currentLockState = { isLockActive: false };
let exnovaCapture = null;
let exnovaStakeShield = null;
let exnovaTradeListenerReady = false;
const pendingExnovaTrades = [];

function sendCaptureUpdate(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function isTrustedRenderer(event) {
  return mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents;
}

function deliverExnovaTrade(trade) {
  if (!exnovaTradeListenerReady || !mainWindow || mainWindow.isDestroyed()) {
    pendingExnovaTrades.push(trade);
    if (pendingExnovaTrades.length > 100) pendingExnovaTrades.shift();
    return;
  }
  mainWindow.webContents.send('exnova-trade-captured', trade);
}

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

  mainWindow.webContents.on('did-start-loading', () => {
    exnovaTradeListenerReady = false;
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
  exnovaStakeShield?.setLockState(data);
});

ipcMain.on('subscribe-exnova-trade-captured', (event) => {
  if (!isTrustedRenderer(event)) return;
  exnovaTradeListenerReady = true;
  while (pendingExnovaTrades.length > 0 && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('exnova-trade-captured', pendingExnovaTrades.shift());
  }
});

ipcMain.handle('get-exnova-stake-shield-status', async (event) => {
  if (!isTrustedRenderer(event)) return { state: 'error', message: 'Janela do TradeLock não autorizada.', enabled: false };
  return exnovaStakeShield?.getStatus() || { state: 'disabled', message: 'Trava nativa não inicializada.', enabled: false };
});

ipcMain.handle('get-desktop-status', async () => {
  return {
    isDesktop: true,
    platform: process.platform,
    lockState: currentLockState,
  };
});

ipcMain.handle('get-exnova-capture-status', async (event) => {
  if (!isTrustedRenderer(event)) return { state: 'error', message: 'Janela do TradeLock não autorizada.', enabled: false };
  return exnovaCapture?.getStatus() || {
    state: process.platform === 'win32' ? 'idle' : 'unavailable',
    message: process.platform === 'win32' ? 'Captura desativada.' : 'Captura Exnova disponível apenas no Windows.',
    capturedCount: 0,
    lastReadAt: null,
    enabled: false,
  };
});

ipcMain.handle('start-exnova-capture', async (event) => {
  if (!isTrustedRenderer(event)) return { state: 'error', message: 'Janela do TradeLock não autorizada.', enabled: false };
  if (process.platform !== 'win32') return { state: 'unavailable', message: 'Captura Exnova disponível apenas no Windows.', enabled: false };
  return exnovaCapture.start();
});

ipcMain.handle('stop-exnova-capture', async (event) => {
  if (!isTrustedRenderer(event)) return { state: 'error', message: 'Janela do TradeLock não autorizada.', enabled: false };
  return exnovaCapture?.stop() || { state: 'idle', message: 'Captura desativada.', enabled: false };
});

app.whenReady().then(() => {
  exnovaCapture = createExnovaCaptureService({
    desktopCapturer,
    nativeImage,
    app,
    onStatus: (status) => sendCaptureUpdate('exnova-capture-status', status),
    onTrade: deliverExnovaTrade,
  });
  exnovaStakeShield = createExnovaStakeShield({
    desktopCapturer,
    screen,
    BrowserWindow,
    app,
    onStatus: (status) => sendCaptureUpdate('exnova-stake-shield-status', status),
  });
  exnovaStakeShield.start().catch((error) => {
    console.warn('[TradeLock Desktop] Não foi possível iniciar o escudo de entrada:', error.message);
  });
  setupAutoStart();
  createWindow();
  // A captura nativa começa junto com o TradeLock e só observa a janela da Exnova.
  exnovaCapture.start().catch((error) => {
    console.warn('[TradeLock Desktop] Não foi possível iniciar a captura Exnova:', error.message);
  });

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

app.on('before-quit', () => {
  exnovaCapture?.stop().catch(() => {});
  exnovaStakeShield?.stop().catch(() => {});
});
