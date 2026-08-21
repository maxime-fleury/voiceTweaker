const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vt', {
  platform: process.platform,
  version: process.versions.electron,
  rvc: {
    status: () => ipcRenderer.invoke('rvc:status'),
    load: (id) => ipcRenderer.invoke('rvc:load', id),
    convert: (buf) => ipcRenderer.invoke('rvc:convert', buf),
    addUrl: (name, url) => ipcRenderer.invoke('rvc:addUrl', name, url),
    openFolder: () => ipcRenderer.invoke('rvc:openFolder'),
  },
  openLogs: () => ipcRenderer.invoke('logs:open'),
  appInfo: () => ipcRenderer.invoke('app:info'),
  openUrl: (url) => ipcRenderer.invoke('app:open', url),
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    onUpdate: (cb) => ipcRenderer.on('updater', (_e, payload) => cb(payload)),
  },
});
