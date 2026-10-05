'use strict';

const fs = require('node:fs');
const path = require('node:path');

function validSource(value) {
  return value && value.provider === 'github' &&
    /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(value.owner || '') &&
    /^[A-Za-z0-9_.-]+$/.test(value.repo || '') &&
    value.repo !== '.' && value.repo !== '..';
}

// The user-data file allows activating an already installed first version.
// No account password or GitHub token is ever stored in the application.
function loadSource(app) {
  const userFile = path.join(app.getPath('userData'), 'update-source.json');
  const sourceFile = fs.existsSync(userFile) ? userFile : path.join(__dirname, 'update-source.json');
  const source = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  return validSource(source) ? { provider: 'github', owner: source.owner, repo: source.repo } : null;
}

function startUpdates(app, dependencies = {}) {
  if (!app.isPackaged || process.platform !== 'win32') return;
  const logFile = path.join(app.getPath('userData'), 'updates.log');
  function log(message) {
    try {
      fs.mkdirSync(path.dirname(logFile), { recursive: true });
      if (fs.existsSync(logFile) && fs.statSync(logFile).size > 1024 * 1024) {
        fs.renameSync(logFile, logFile + '.previous');
      }
      fs.appendFileSync(logFile, `${new Date().toISOString()} ${message}\n`);
    } catch { /* A logging failure must not prevent opening the directory. */ }
  }
  let updater;
  try {
    const source = loadSource(app);
    if (!source) {
      log('Actualizaciones pendientes de conectar a un repositorio de GitHub.');
      return;
    }
    const { NsisUpdater } = dependencies.updaterModule || require('electron-updater');
    updater = new NsisUpdater(source);
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    updater.allowPrerelease = false;
    updater.allowDowngrade = false;
    updater.logger = {
      info: (...args) => log(args.join(' ')),
      warn: (...args) => log(args.join(' ')),
      error: (...args) => log(args.join(' ')),
      debug: () => {}
    };
    updater.on('error', error => log(`Actualización no disponible: ${error.message}`));
    updater.on('update-downloaded', info => log(`Versión ${info.version} lista. Se instalará al cerrar la app.`));
  } catch (error) {
    log(`Configuración de actualizaciones: ${error.message}`);
    return;
  }
  let checking = false;
  const check = async () => {
    if (checking) return;
    checking = true;
    try { await updater.checkForUpdates(); }
    catch (error) { log(`No se pudo buscar actualización: ${error.message}`); }
    finally { checking = false; }
  };
  const initial = setTimeout(check, 15000);
  const periodic = setInterval(check, 4 * 60 * 60 * 1000);
  initial.unref();
  periodic.unref();
  app.once('before-quit', () => { clearTimeout(initial); clearInterval(periodic); });
}

module.exports = { startUpdates, validSource, loadSource };
