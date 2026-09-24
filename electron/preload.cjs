const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  platform: process.platform,
  syncLockState: (state) => ipcRenderer.send('sync-lock-state', state),
  getDesktopStatus: () => ipcRenderer.invoke('get-desktop-status'),
  onLockStateChanged: (callback) => {
    ipcRenderer.on('lock-state-changed', (event, data) => callback(data));
  },
});
