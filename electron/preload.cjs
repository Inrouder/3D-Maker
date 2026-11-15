const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('threeDMakerUpdates', Object.freeze({
  check:()=>ipcRenderer.invoke('updates:check'),
  openRelease:()=>ipcRenderer.invoke('updates:open-release')
}));
contextBridge.exposeInMainWorld('threeDMakerFiles', Object.freeze({
  isWindows:process.platform==='win32',
  pick:()=>ipcRenderer.invoke('files:pick'),
  take:()=>ipcRenderer.invoke('files:take'),
  register:()=>ipcRenderer.invoke('files:register'),
  defaults:()=>ipcRenderer.invoke('files:defaults'),
  onPending:callback=>{
    const listener=()=>callback();ipcRenderer.on('files:pending',listener);
    return ()=>ipcRenderer.removeListener('files:pending',listener);
  }
}));
