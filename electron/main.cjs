const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('node:path');
const REPO = 'Inrouder/3D-Maker';
app.setName('3D-Maker');

function versionParts(value) { return String(value || '').replace(/^v/i, '').split(/[.-]/).slice(0,3).map(n => Number.parseInt(n, 10) || 0); }
function newer(next, current) {
  const a = versionParts(next), b = versionParts(current);
  return a.some((n, i) => n > b[i] && a.slice(0, i).every((x, j) => x === b[j]));
}
async function checkUpdates() {
  const headers = { 'Accept': 'application/vnd.github+json', 'User-Agent': '3D-Maker-Updater', 'X-GitHub-Api-Version': '2022-11-28' };
  const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers, signal: AbortSignal.timeout(12000) });
  if (!response.ok) {
    if (response.status === 404) return { status: 'unavailable', message: 'Noch kein öffentliches GitHub Release veröffentlicht. Ein Versions-Tag mit angehängter Windows-EXE ist erforderlich.' };
    if (response.status === 401 || response.status === 403) return { status: 'error', message: 'GitHub API-Limit erreicht oder Zugriff nicht möglich. Bitte später erneut prüfen.' };
    return { status: 'error', message: `GitHub antwortet mit HTTP ${response.status}.` };
  }
  const release = await response.json();
  const currentVersion = app.getVersion();
  return {
    status: newer(release.tag_name, currentVersion) ? 'available' : 'current',
    currentVersion,
    latestVersion: release.tag_name,
    title: release.name || release.tag_name,
    notes: String(release.body || '').slice(0, 2500),
    url: `https://github.com/${REPO}/releases/latest`,
    publishedAt: release.published_at || null
  };
}
function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 960, minHeight: 640,
    title: '3D-Maker', icon: path.join(__dirname, '..', 'build', 'icon.png'), backgroundColor: '#111318', autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false, contextIsolation: true, sandbox: true
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}
app.whenReady().then(() => {
  ipcMain.handle('updates:check', async () => {
    try { return await checkUpdates(); }
    catch (e) { return { status: 'error', message: e instanceof Error ? e.message : 'Updateprüfung fehlgeschlagen.' }; }
  });
  ipcMain.handle('updates:open-release', () => shell.openExternal(`https://github.com/${REPO}/releases/latest`));
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
