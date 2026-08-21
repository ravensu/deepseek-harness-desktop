'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dshDesktop', {
  info: () => ipcRenderer.invoke('desktop:info'),
  onStatus: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('harness:status', listener);
    return () => ipcRenderer.removeListener('harness:status', listener);
  },
  onLog: (callback) => {
    const listener = (_event, entry) => callback(entry);
    ipcRenderer.on('harness:log', listener);
    return () => ipcRenderer.removeListener('harness:log', listener);
  },
  /** Core management bridge used by the in-settings dsh plugin. */
  core: {
    overview: () => ipcRenderer.invoke('core:overview'),
    checkHarness: () => ipcRenderer.invoke('core:checkHarness'),
    installHarness: (version) => ipcRenderer.invoke('core:installHarness', version),
    restoreSeed: () => ipcRenderer.invoke('core:restoreSeed'),
    restartHarness: () => ipcRenderer.invoke('core:restartHarness'),
    checkShellUpdate: () => ipcRenderer.invoke('core:checkShellUpdate'),
    installShellUpdate: () => ipcRenderer.invoke('core:installShellUpdate'),
    openPath: (which) => ipcRenderer.invoke('core:openPath', which),
    diagnose: () => ipcRenderer.invoke('core:diagnose'),
    cleanup: () => ipcRenderer.invoke('core:cleanup'),
    onProgress: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('core:progress', listener);
      return () => ipcRenderer.removeListener('core:progress', listener);
    },
    onLog: (callback) => {
      const listener = (_event, entry) => callback(entry);
      ipcRenderer.on('core:log', listener);
      return () => ipcRenderer.removeListener('core:log', listener);
    },
  },
});
