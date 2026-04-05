const { app, BrowserWindow, ipcMain, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');

let win;

const shipsPath = path.join(__dirname, 'ships.json');
const shipData = JSON.parse(fs.readFileSync(shipsPath, 'utf8'));

const historyPath = path.join(app.getPath('userData'), 'scan-history.json');
const boundsPath = path.join(app.getPath('userData'), 'window-bounds.json');

function loadBounds() {
  try {
    return JSON.parse(fs.readFileSync(boundsPath, 'utf8'));
  } catch {
    return { width: 350, height: 380 };
  }
}

function saveBounds() {
  if (win) fs.writeFileSync(boundsPath, JSON.stringify(win.getBounds()));
}

function loadHistory() {
  try {
    return JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  } catch {
    return [];
  }
}

function saveHistory(history) {
  fs.writeFileSync(historyPath, JSON.stringify(history));
}

ipcMain.handle('get-ship-db', () => shipData);
ipcMain.handle('read-clipboard', () => clipboard.readText());
ipcMain.handle('get-scan-history', () => loadHistory());
ipcMain.handle('save-scan', (_e, scan) => {
  const history = loadHistory();
  history.push(scan);
  saveHistory(history);
  return history;
});

ipcMain.handle('toggle-on-top', () => {
  const current = win.isAlwaysOnTop();
  win.setAlwaysOnTop(!current);
  return !current;
});

ipcMain.handle('close-app', () => {
  win.close();
});

ipcMain.handle('delete-scan', (_e, index) => {
  const history = loadHistory();
  if (index >= 0 && index < history.length) {
    history.splice(index, 1);
    saveHistory(history);
  }
  return history;
});

ipcMain.handle('screenshot', async () => {
  const image = await win.capturePage();
  clipboard.writeImage(image);
});

function createWindow() {
  const bounds = loadBounds();
  win = new BrowserWindow({
    ...bounds,
    alwaysOnTop: true,
    resizable: true,
    frame: false,
    icon: path.join(__dirname, 'icon.png'),
    title: 'D-Scan Checker',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.setMenuBarVisibility(false);

  win.on('close', saveBounds);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});
