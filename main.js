'use strict';

const { app, BrowserWindow, Menu, dialog, screen, ipcMain, safeStorage } = require('electron');
const path = require('node:path');
const { startUpdates } = require('./updates');
const { registerPrinterHandlers } = require('./printers');
const { registerSyncHandlers } = require('./sync');

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
    registerPrinterHandlers(ipcMain, path.join(app.getPath('userData'), 'printer-settings.json'), () => mainWindow);
    registerSyncHandlers(ipcMain, app.getPath('userData'), safeStorage, () => mainWindow);
    ipcMain.handle('app:version', event => {
      if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) throw Error('Solicitud no autorizada.');
      return app.getVersion();
    });
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
    title: `Directorio de Domicilios — v${app.getVersion()}`,
    icon: path.join(__dirname, 'assets', 'templo.ico'),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      partition: 'persist:directorio-parroquial'
    }
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.on('page-title-updated', event => event.preventDefault());
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', event => event.preventDefault());
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html')).catch(reportError);
}

function reportError(error) {
  dialog.showErrorBox('No se pudo abrir el sistema', String(error.message || error));
  app.quit();
}
