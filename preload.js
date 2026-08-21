const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vt', {
  platform: process.platform,
  version: process.versions.electron,
  rvc: {
    status: () => ipcRenderer.invoke('rvc:status'),
    load: (id) => ipcRenderer.invoke('rvc:load', id),
    remove: (id) => ipcRenderer.invoke('rvc:remove', id),
    import: () => ipcRenderer.invoke('rvc:import'),
    convert: (buf, transpose) => ipcRenderer.invoke('rvc:convert', buf, transpose),
    addUrl: (name, url) => ipcRenderer.invoke('rvc:addUrl', name, url),
    openFolder: () => ipcRenderer.invoke('rvc:openFolder'),
  },
  openLogs: () => ipcRenderer.invoke('logs:open'),
  appInfo: () => ipcRenderer.invoke('app:info'),
  openUrl: (url) => ipcRenderer.invoke('app:open', url),
  sb: {
    add: () => ipcRenderer.invoke('sb:add'),
    load: (file) => ipcRenderer.invoke('sb:load', file),
    remove: (file) => ipcRenderer.invoke('sb:remove', file),
  },
  onHotkey: (cb) => ipcRenderer.on('hotkey', (_e, msg) => cb(msg)),
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    onUpdate: (cb) => ipcRenderer.on('updater', (_e, payload) => cb(payload)),
  },
});
