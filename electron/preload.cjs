const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  platform: process.platform,
  syncLockState: (state) => ipcRenderer.send('sync-lock-state', state),
  getDesktopStatus: () => ipcRenderer.invoke('get-desktop-status'),
  getExnovaCaptureStatus: () => ipcRenderer.invoke('get-exnova-capture-status'),
  startExnovaCapture: () => ipcRenderer.invoke('start-exnova-capture'),
  stopExnovaCapture: () => ipcRenderer.invoke('stop-exnova-capture'),
  onExnovaCaptureStatus: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('exnova-capture-status', listener);
    return () => ipcRenderer.removeListener('exnova-capture-status', listener);
  },
  onExnovaTradeCaptured: (callback) => {
    const listener = (_event, trade) => callback(trade);
    ipcRenderer.on('exnova-trade-captured', listener);
    return () => ipcRenderer.removeListener('exnova-trade-captured', listener);
  },
  onLockStateChanged: (callback) => {
    ipcRenderer.on('lock-state-changed', (event, data) => callback(data));
  },
});
