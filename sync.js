'use strict';
const fs = require('node:fs');
const path = require('node:path');

const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function validateSnapshot(data) {
  if (!data || !Array.isArray(data.parishes) || !Array.isArray(data.addresses) || JSON.stringify(data).length > 5000000) throw Error('Directorio inválido.');
  for (const group of [data.parishes, data.addresses]) {
    const ids = new Set();
    for (const row of group) {
      if (!row || typeof row.id !== 'string' || ids.has(row.id)) throw Error('Registros sin identificador único.');
      ids.add(row.id);
    }
  }
  return JSON.parse(JSON.stringify(data));
}
const { mergeSnapshots } = require('./renderer/sync-merge');
function createSyncService(directory, safeStorage, request=fetch) {
  const filename=path.join(directory,'cloud-session.json');
  let state=null, busy=false;
  const write = () => {
    const encrypted=safeStorage.encryptString(JSON.stringify(state)).toString('base64');
    fs.mkdirSync(directory,{recursive:true});
    fs.writeFileSync(filename+'.tmp',encrypted); fs.renameSync(filename+'.tmp',filename);
  };
  function read() {
    if (state) return;
    try { state=JSON.parse(safeStorage.decryptString(Buffer.from(fs.readFileSync(filename,'utf8'),'base64'))); }
    catch (e) { if (e.code!=='ENOENT') throw Error('No se pudo recuperar la sesión. Vuelve a conectar la sincronización.'); }
  }
  function backup(data,label) {
    fs.mkdirSync(path.join(directory,'sync-backups'),{recursive:true});
    fs.writeFileSync(path.join(directory,'sync-backups',`${Date.now()}-${label}.json`),JSON.stringify(data,null,2));
  }
  async function api(route,options={},authenticated=true) {
    const response=await request(state.url+route,{
      ...options, signal:AbortSignal.timeout(20000),
      headers:{apikey:state.key,...(authenticated?{Authorization:'Bearer '+state.access_token}:{}),'Content-Type':'application/json',...options.headers}
    });
    if (!response.ok) {
      if (response.status===401 || response.status===403) throw Error('Sesión o permisos inválidos. Revisa el usuario y las políticas de Supabase.');
      if (response.status===404) throw Error('Falta configurar la tabla directorio_shared en Supabase.');
      throw Error(`No se pudo sincronizar (HTTP ${response.status}). Los cambios locales se conservan.`);
    }
    const body=await response.text(); return body ? JSON.parse(body) : null;
  }
  async function refresh() {
    if (state.expires_at > Date.now()+60000) return;
    const token=await api('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:state.refresh_token})},false);
    Object.assign(state,{access_token:token.access_token,refresh_token:token.refresh_token,expires_at:Date.now()+token.expires_in*1000}); write();
  }
  async function remote() {
    const rows=await api('/rest/v1/directorio_shared?owner=eq.'+encodeURIComponent(state.owner)+'&select=revision,data');
    if (!rows?.length) return null;
    return { revision:rows[0].revision,data:validateSnapshot(rows[0].data) };
  }
  async function connect(input) {
    if (busy) throw Error('Espera a que termine la sincronización.');
    busy=true; const previous=state;
    try {
      const url=new URL(input.url);
      if (url.protocol!=='https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) || url.username || url.password || url.port || (url.pathname!=='/' && url.pathname!=='')) throw Error('Usa la URL HTTPS del proyecto Supabase.');
      const key=String(input.key||'').trim();
      let isPublic=key.startsWith('sb_publishable_');
      if (!isPublic) { try { isPublic=JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role==='anon'; } catch {} }
      if (!isPublic) throw Error('Usa la clave pública publishable o anon, nunca una clave secreta.');
      if (!safeStorage.isEncryptionAvailable()) throw Error('Windows no puede proteger la sesión de sincronización.');
      const local=validateSnapshot(input.data);
      state={url:url.origin,key};
      const token=await api('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:input.email,password:input.password})},false);
      Object.assign(state,{owner:token.user.id,email:token.user.email,access_token:token.access_token,refresh_token:token.refresh_token,expires_at:Date.now()+token.expires_in*1000});
      let shared=await remote();
      backup(local,'antes-de-conectar');
      if (!shared) {
        try { await api('/rest/v1/directorio_shared',{method:'POST',body:JSON.stringify({owner:state.owner,revision:1,data:local})}); }
        catch(error) { shared=await remote(); if(!shared)throw error; }
        if (!shared) shared={revision:1,data:local};
      }
      state.base=shared.data; state.revision=shared.revision; write();
      return {enabled:true,email:state.email,data:validateSnapshot(shared.data)};
    } catch(e) { state=previous; throw e; } finally { busy=false; }
  }
  async function sync(input) {
    if (busy) return {busy:true};
    busy=true;
    try {
      read(); if (!state) return {enabled:false};
      const local=validateSnapshot(input);
      await refresh();
      for(let attempt=0;attempt<3;attempt++) {
        const shared=await remote();
        if(!shared)throw Error('El directorio compartido no existe. Vuelve a conectar.');
        const merged=mergeSnapshots(state.base,local,shared.data);
        if(merged.conflicts.length) {
          const signature=JSON.stringify({local,remote:shared.data});
          if(state.conflictSignature!==signature) { backup({local,remote:shared.data},'conflicto'); state.conflictSignature=signature;write(); }
          return {enabled:true,conflicts:merged.conflicts};
        }
        if (!equal(merged.data,shared.data)) {
          const rows=await api('/rest/v1/directorio_shared?owner=eq.'+encodeURIComponent(state.owner)+'&revision=eq.'+shared.revision,{
            method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({revision:shared.revision+1,data:merged.data})
          });
          if(!rows?.length)continue;
          shared.revision++;
        }
        const oldBase=state.base,oldRevision=state.revision;
        state.base=merged.data;state.revision=shared.revision;delete state.conflictSignature;
        try { write(); } catch(error) {state.base=oldBase;state.revision=oldRevision;throw error;}
        return {enabled:true,email:state.email,data:validateSnapshot(merged.data)};
      }
      throw Error('Otro equipo está guardando cambios. Se volverá a intentar.');
    } finally {busy=false;}
  }
  function status() { read(); return {enabled:!!state,email:state?.email||''}; }
  function disconnect() { if(busy)throw Error('Espera a que termine la sincronización.'); state=null;fs.rmSync(filename,{force:true});return {enabled:false}; }
  return {connect,sync,status,disconnect};
}
function registerSyncHandlers(ipcMain,directory,safeStorage,getWindow) {
  const service=createSyncService(directory,safeStorage);
  for(const action of ['connect','sync','status','disconnect']) {
    ipcMain.handle('cloud:'+action,(event,input)=>{
      const win=getWindow();
      if(!win || event.sender!==win.webContents || event.senderFrame!==win.webContents.mainFrame)throw Error('Solicitud no autorizada.');
      return service[action](input);
    });
  }
}
module.exports={mergeSnapshots,validateSnapshot,createSyncService,registerSyncHandlers};
