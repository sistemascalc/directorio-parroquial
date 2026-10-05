'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { validSource } = require('../updates');
const root = path.join(__dirname, '..');
const url = new URL(process.argv[2]);
const parts = url.pathname.replace(/\/$/, '').split('/').filter(Boolean);
const source = { provider: 'github', owner: parts[0], repo: (parts[1] || '').replace(/\.git$/, '') };
if (url.protocol !== 'https:' || url.hostname !== 'github.com' || parts.length !== 2 || !validSource(source)) {
  throw new Error('Indica https://github.com/usuario/repositorio');
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8').replace(/^\uFEFF/, ''));
pkg.build.publish = [{ ...source, releaseType: 'release' }];
fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
fs.writeFileSync(path.join(root, 'update-source.json'), JSON.stringify(source, null, 2) + '\n');
fs.writeFileSync(path.join(root, 'Activar-actualizaciones.ps1'), [
  "$ErrorActionPreference = 'Stop'",
  "$dataFolder = Join-Path $env:APPDATA 'DirectorioParroquial'",
  "New-Item -ItemType Directory -Path $dataFolder -Force | Out-Null",
  "Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'update-source.json') -Destination (Join-Path $dataFolder 'update-source.json') -Force",
  "Write-Host 'GitHub conectado. Cierra y vuelve a abrir Directorio Parroquial.'",
  ''
].join('\r\n'));
console.log(`Actualizaciones configuradas: ${source.owner}/${source.repo}`);
