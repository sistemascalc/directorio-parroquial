'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('parishPrinter', {
  version: () => ipcRenderer.invoke('app:version'),
  list: () => ipcRenderer.invoke('printers:list'),
  save: name => ipcRenderer.invoke('printers:save', name),
  print: () => ipcRenderer.invoke('printers:print')
});
