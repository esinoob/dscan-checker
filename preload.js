const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dscan', {
  readClipboard: () => ipcRenderer.invoke('read-clipboard'),
  getShipDb: () => ipcRenderer.invoke('get-ship-db'),
  getScanHistory: () => ipcRenderer.invoke('get-scan-history'),
  saveScan: (scan) => ipcRenderer.invoke('save-scan', scan),
  screenshot: () => ipcRenderer.invoke('screenshot'),
  toggleOnTop: () => ipcRenderer.invoke('toggle-on-top')
});
