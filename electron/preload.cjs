/**
 * Electron Preload Script
 */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  setAlwaysOnTop: (value) => ipcRenderer.send('set-always-on-top', value),
  closeWindow: () => ipcRenderer.send('close-window'),
})
