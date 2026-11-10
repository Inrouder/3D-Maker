const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('threeDMakerUpdates', Object.freeze({
  check: () => ipcRenderer.invoke('updates:check'),
  openRelease: () => ipcRenderer.invoke('updates:open-release')
}));
