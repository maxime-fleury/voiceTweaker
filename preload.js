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
});
