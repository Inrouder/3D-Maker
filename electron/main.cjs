const { app, BrowserWindow, shell, ipcMain, safeStorage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const REPO = 'Inrouder/3D-Maker';
app.setName('3D-Maker');

function tokenPath() { return path.join(app.getPath('userData'), 'github-token.dat'); }
function readToken() {
  try {
    if (!safeStorage.isEncryptionAvailable()) return '';
    return safeStorage.decryptString(fs.readFileSync(tokenPath()));
  } catch { return ''; }
}
function saveToken(value) {
  const token = typeof value === 'string' ? value.trim() : '';
  if (!token) { try { fs.unlinkSync(tokenPath()); } catch {} return false; }
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Sichere Speicherung ist auf diesem System nicht verfügbar.');
  fs.mkdirSync(path.dirname(tokenPath()), { recursive: true });
  fs.writeFileSync(tokenPath(), safeStorage.encryptString(token), { mode: 0o600 });
  return true;
}
function versionParts(value) { return String(value || '').replace(/^v/i, '').split(/[.-]/).slice(0,3).map(n => Number.parseInt(n, 10) || 0); }
function newer(next, current) {
  const a = versionParts(next), b = versionParts(current);
  return a.some((n, i) => n > b[i] && a.slice(0, i).every((x, j) => x === b[j]));
}
async function checkUpdates() {
  const headers = { 'Accept': 'application/vnd.github+json', 'User-Agent': '3D-Maker-Updater', 'X-GitHub-Api-Version': '2022-11-28' };
  const token = readToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers, signal: AbortSignal.timeout(12000) });
  if (!response.ok) {
    if (response.status === 404) return { status: 'unavailable', message: 'Kein Release gefunden oder privates Repository nicht zugänglich. Für private Releases kann ein GitHub-Token hinterlegt werden.' };
    if (response.status === 401 || response.status === 403) return { status: 'error', message: 'GitHub-Zugriff verweigert. Bitte Token und Berechtigungen prüfen.' };
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
    title: '3D-Maker', backgroundColor: '#111318', autoHideMenuBar: true,
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
  ipcMain.handle('updates:token-present', () => Boolean(readToken()));
  ipcMain.handle('updates:set-token', (_, token) => saveToken(token));
  ipcMain.handle('updates:open-release', () => shell.openExternal(`https://github.com/${REPO}/releases/latest`));
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
