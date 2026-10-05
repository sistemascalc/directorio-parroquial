'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('parishCloud', {
  connect: input => ipcRenderer.invoke('cloud:connect', input),
  sync: data => ipcRenderer.invoke('cloud:sync', data),
  status: () => ipcRenderer.invoke('cloud:status'),
  disconnect: () => ipcRenderer.invoke('cloud:disconnect')
});
contextBridge.exposeInMainWorld('parishPrinter', {
  version: () => ipcRenderer.invoke('app:version'),
  list: () => ipcRenderer.invoke('printers:list'),
  save: name => ipcRenderer.invoke('printers:save', name),
  print: () => ipcRenderer.invoke('printers:print')
});
