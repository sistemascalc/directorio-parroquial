'use strict';
(function() {
  const api=window.parishCloud,store=window.directoryStore;
  const button=document.getElementById('cloudSettings'),status=document.getElementById('cloudStatus');
  if(!api){button.hidden=true;return;}
  let enabled=false,busy=false,timer;
  const dialog=document.createElement('dialog');
  dialog.style.cssText='border:0;border-radius:16px;padding:24px;width:min(520px,90vw);color:#14382c';
  dialog.innerHTML=`<h3>Sincronización por internet</h3>
    <p>Conecta ambas computadoras al mismo proyecto y al mismo usuario de la oficina.</p>
    <p>La primera conexión sube el directorio. Si ya existe uno compartido, se descarga y se guarda un respaldo del directorio local antes de reemplazarlo.</p>
    <form id="cloudForm">
      <label>URL del proyecto Supabase<input id="cloudUrl" type="url" placeholder="https://tu-proyecto.supabase.co" required style="width:100%;margin:6px 0 12px"></label>
      <label>Clave pública publishable o anon<input id="cloudKey" required autocomplete="off" style="width:100%;margin:6px 0 12px"></label>
      <label>Correo del usuario de la oficina<input id="cloudEmail" type="email" required autocomplete="username" style="width:100%;margin:6px 0 12px"></label>
      <label>Contraseña del usuario<input id="cloudPassword" type="password" required autocomplete="current-password" style="width:100%;margin:6px 0 12px"></label>
      <p id="cloudError" role="alert" style="color:#a51d1d"></p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button id="cloudConnect" class="btn btn-primary">Conectar y usar directorio compartido</button><button id="cloudDisconnect" class="btn btn-secondary" type="button">Desconectar este equipo</button><button id="cloudCancel" class="btn btn-secondary" type="button">Cerrar</button></div>
    </form>`;
  document.body.append(dialog);
  const field=id=>dialog.querySelector('#'+id),error=field('cloudError');
  button.addEventListener('click',()=>{if(!dialog.open)dialog.showModal();});
  field('cloudCancel').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{field('cloudPassword').value='';});
  field('cloudDisconnect').addEventListener('click',async()=>{
    if(busy)return;
    try{await api.disconnect();enabled=false;status.textContent='Sincronización desactivada';error.textContent='';dialog.close();}
    catch(e){error.textContent=e.message;}
  });
  field('cloudForm').addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;busy=true;field('cloudConnect').disabled=true;error.textContent='';
    try {
      const response=await api.connect({url:field('cloudUrl').value.trim(),key:field('cloudKey').value.trim(),email:field('cloudEmail').value.trim(),password:field('cloudPassword').value,data:store.snapshot()});
      store.apply(response.data);enabled=true;status.textContent='Directorio compartido conectado';dialog.close();
    } catch(e){error.textContent=e.message;}
    finally{busy=false;field('cloudConnect').disabled=false;field('cloudPassword').value='';}
  });
  async function sync() {
    if(!enabled||busy||window.isEnvelopePrinting?.()||dialog.open)return;
    busy=true;const before=store.snapshot();
    try {
      const response=await api.sync(before);
      if(response.busy)return;
      if(response.conflicts?.length){status.textContent='Conflicto: '+response.conflicts.slice(0,3).join(', ')+'. Cambios conservados; reconecta para descargar el directorio compartido.';return;}
      if(!response.enabled){enabled=false;status.textContent='Sincronización desactivada';return;}
      const current=store.snapshot();
      const merged=DirectoryMerge.mergeSnapshots(before,current,response.data);
      if(merged.conflicts.length){
        await api.disconnect(); enabled=false;
        status.textContent='Sincronización pausada por cambios simultáneos. Los cambios locales se conservan. Reconecta para descargar el directorio compartido con respaldo.';
        return;
      }
      if(JSON.stringify(current)!==JSON.stringify(merged.data))store.apply(merged.data);
      status.textContent='Sincronizado · '+new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
      if(JSON.stringify(before)!==JSON.stringify(current))schedule();
    } catch(e){status.textContent='Sin conexión o error: cambios guardados en este equipo. '+e.message;}
    finally{busy=false;}
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(sync,600);}
  window.addEventListener('directory-changed',schedule);
  window.addEventListener('online',schedule);
  setInterval(sync,10000);
  api.status().then(info=>{enabled=info.enabled;status.textContent=enabled?'Conectando directorio compartido…':'Sincronización sin configurar';if(enabled)sync();}).catch(e=>{status.textContent=e.message;});
})();
