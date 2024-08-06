const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onCameraStatus: (callback) =>
    ipcRenderer.on('camera-status', (event, status) => callback(status)),
  requestCameraStatus: () => ipcRenderer.send('request-camera-status'),
});
