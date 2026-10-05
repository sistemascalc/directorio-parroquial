'use strict';

const { app, BrowserWindow, Menu, dialog, screen } = require('electron');
const path = require('node:path');
const { startUpdates } = require('./updates');

// La misma carpeta de datos se usa en desarrollo y en la aplicación instalada.
app.setPath('userData', process.env.DIRECTORIO_PARROQUIAL_DATA_DIR
  ? path.resolve(process.env.DIRECTORIO_PARROQUIAL_DATA_DIR)
  : path.join(app.getPath('appData'), 'DirectorioParroquial'));

let mainWindow;
const hasLock = app.requestSingleInstanceLock();

if (!hasLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    startUpdates(app);
  }).catch(reportError);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({
    width: Math.min(1280, width),
    height: Math.min(900, height),
    title: 'Directorio Parroquial',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      partition: 'persist:directorio-parroquial'
    }
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  // Se carga el HTML original sin inyecciones, transformaciones ni reemplazos.
  // window.print() conserva el diálogo de impresión nativo de Chromium/Electron.
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html')).catch(reportError);
}

function reportError(error) {
  dialog.showErrorBox('No se pudo abrir el sistema', String(error.message || error));
  app.quit();
}
