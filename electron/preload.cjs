const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('threeDMakerUpdates', Object.freeze({
  check: () => ipcRenderer.invoke('updates:check'),
  hasToken: () => ipcRenderer.invoke('updates:token-present'),
  setToken: token => ipcRenderer.invoke('updates:set-token', token),
  openRelease: () => ipcRenderer.invoke('updates:open-release')
}));
