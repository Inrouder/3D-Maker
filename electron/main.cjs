const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { REPO, releaseInfo, supportedFileArgs, associationEntries } = require('./desktop.cjs');
app.setName('3D-Maker');
let win;
const pendingFiles = [];
let picking = false;
async function checkUpdates() {
  const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers:{'Accept':'application/vnd.github+json','User-Agent':'3D-Maker-Updater','X-GitHub-Api-Version':'2022-11-28'}, signal:AbortSignal.timeout(12000)
  });
  if (!response.ok) {
    if(response.status===404)return {status:'unavailable',message:'Noch kein stabiles Release veröffentlicht. Bitte später erneut prüfen.'};
    if(response.status===403 || response.status===429)return {status:'error',message:'GitHub API-Limit erreicht. Bitte später erneut prüfen.'};
    throw new Error(`GitHub antwortet mit HTTP ${response.status}.`);
  }
  return releaseInfo(await response.json(),app.getVersion());
}
function queueFiles(args) {
  pendingFiles.push(...supportedFileArgs(args));
  if(win && !win.isDestroyed()) {
    if(win.isMinimized())win.restore();win.show();win.focus();
    win.webContents.send('files:pending');
  }
}
function createWindow() {
  win = new BrowserWindow({
    width:1440,height:900,minWidth:960,minHeight:640,title:'3D-Maker',icon:path.join(__dirname,'..','build','icon.png'),backgroundColor:'#111318',autoHideMenuBar:true,
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}
  });
  win.webContents.setWindowOpenHandler(({url})=>{if(url.startsWith('https://'))void shell.openExternal(url);return {action:'deny'};});
  win.loadFile(path.join(__dirname,'..','dist','index.html'));
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  queueFiles(process.argv.slice(app.isPackaged ? 1 : 2));
  app.on('second-instance',(_event,args)=>queueFiles(args.slice(1)));
  app.on('open-file',(event,file)=>{event.preventDefault();queueFiles([file]);});
  app.whenReady().then(()=>{
    ipcMain.handle('updates:check',async()=>{try{return await checkUpdates();}catch(error){return {status:'error',message:error.message};}});
    ipcMain.handle('updates:open-release',async()=>{
      const info=await checkUpdates();
      if(info.status!=='available' && info.status!=='current')throw new Error(info.message||'Kein Download verfügbar.');
      await shell.openExternal(info.url);
    });
    ipcMain.handle('files:pick',async()=>{
      if(picking)return;
      picking=true;
      try {
        const result=await dialog.showOpenDialog(win,{title:'Projekt oder 3D-Datei öffnen',properties:['openFile'],filters:[{name:'3D-Maker / Mesh',extensions:['3dmaker','json','stl','obj']}]});
        if(!result.canceled)queueFiles(result.filePaths);
      } finally {picking=false;}
    });
    ipcMain.handle('files:take',async()=>{
      const file=pendingFiles.shift();if(!file)return null;
      try {
        const stat=await fs.stat(file);
        if(!stat.isFile() || stat.size>512*1024*1024)throw new Error('Nur Dateien bis 512 MB können über Windows geöffnet werden.');
        const data=await fs.readFile(file);
        return {name:path.basename(file),data};
      }catch(error){return {error:`Datei konnte nicht geöffnet werden: ${error.message}`};}
    });
    ipcMain.handle('files:register',async()=>{
      if(process.platform!=='win32' || !app.isPackaged)throw new Error('Dateizuordnung ist nur in der Windows-App verfügbar.');
      // Portable apps run from a temporary extraction directory; register the launcher instead.
      const executable=process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
      const run=promisify(execFile);
      for(const entry of associationEntries(executable)) {
        await run('reg.exe',['add',entry.key,...(entry.name===null?['/ve']:['/v',entry.name]),'/t','REG_SZ','/d',entry.value,'/f'],{windowsHide:true});
      }
      return {message:'3D-Maker ist für .3dmaker, .stl und .obj registriert. Bitte in Windows als Standard auswählen.',executable};
    });
    ipcMain.handle('files:defaults',()=>{
      if(process.platform!=='win32')throw new Error('Nur unter Windows verfügbar.');
      return shell.openExternal('ms-settings:defaultapps');
    });
    createWindow();
    app.on('activate',()=>{if(!BrowserWindow.getAllWindows().length)createWindow();});
  });
}
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
