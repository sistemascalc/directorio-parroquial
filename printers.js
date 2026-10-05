'use strict';
const fs = require('node:fs');
const path = require('node:path');

function createPrinterService(settingsFile, getWindow) {
  let printing = false;
  function readName() {
    try {
      const value = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
      return typeof value.deviceName === 'string' ? value.deviceName : '';
    } catch (error) {
      if (error.code !== 'ENOENT') console.error('Configuración de impresora:', error.message);
      return '';
    }
  }
  async function list() {
    const printers = await getWindow().webContents.getPrintersAsync();
    const selected = readName();
    return {
      selected,
      printers: printers.map(p => ({ name: p.name, displayName: p.displayName || p.name, isDefault: p.isDefault }))
    };
  }
  async function save(deviceName) {
    const info = await list();
    if (typeof deviceName !== 'string' || !info.printers.some(p => p.name === deviceName)) {
      throw Error('Selecciona una impresora instalada en Windows.');
    }
    fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
    fs.writeFileSync(settingsFile + '.tmp', JSON.stringify({ deviceName }, null, 2));
    fs.renameSync(settingsFile + '.tmp', settingsFile);
    return { deviceName };
  }
  async function print() {
    if (printing) return { success: false, code: 'BUSY', message: 'Ya se está enviando un trabajo de impresión.' };
    printing = true;
    try {
      const { printers, selected } = await list();
      if (!selected || !printers.some(p => p.name === selected)) {
        return { success: false, code: 'PRINTER_UNAVAILABLE', message: 'Elige una impresora disponible para la app.' };
      }
      return await new Promise(resolve => {
        getWindow().webContents.print({
          silent: true,
          deviceName: selected,
          printBackground: false,
          color: false,
          copies: 1,
          collate: true,
          pagesPerSheet: 1,
          duplexMode: 'simplex',
          scaleFactor: 100,
          margins: { marginType: 'none' },
          pageSize: { width: 90000, height: 165000 },
          landscape: false
        }, (success, reason) => resolve({ success, message: success ? 'Sobres enviados a la impresora.' : `No se pudo imprimir: ${reason || 'revisa la impresora.'}` }));
      });
    } catch (error) {
      return { success: false, message: `No se pudo imprimir: ${error.message}` };
    } finally { printing = false; }
  }
  return { list, save, print };
}

function registerPrinterHandlers(ipcMain, settingsFile, getWindow) {
  const service = createPrinterService(settingsFile, getWindow);
  function trusted(event) {
    const win = getWindow();
    if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) {
      throw Error('Solicitud de impresión no autorizada.');
    }
  }
  for (const [channel, action] of [
    ['printers:list', () => service.list()],
    ['printers:save', name => service.save(name)],
    ['printers:print', () => service.print()]
  ]) {
    ipcMain.handle(channel, (event, value) => { trusted(event); return action(value); });
  }
}

module.exports = { createPrinterService, registerPrinterHandlers };
