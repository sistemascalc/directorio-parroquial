'use strict';
(function(root){
  function parts(record={}, fallback={}) {
    const raw=String(record.fullAddress || record.address || fallback.address || '').trim();
    const cp=String(record.postalCode || fallback.postalCode || (raw.match(/\b\d{5}\b/) || [''])[0]).trim();
    let clean=raw;
    if(cp) clean=clean.replace(new RegExp('(?:C\\.?\\s*P\\.?\\s*:?\\s*)?\\b'+cp.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','gi'),'');
    const lines=clean.split(/\n|,/).map(x=>x.trim()).filter(Boolean);
    return {streetNumber:record.streetNumber || lines.shift() || '', colonyMunicipality:record.colonyMunicipality || lines.join(', '), postalCode:cp};
  }
  function format(record,fallback) {const p=parts(record,fallback);return [p.streetNumber,p.colonyMunicipality,p.postalCode ? 'C.P. '+p.postalCode : ''].filter(Boolean).join('\n');}
  const api={parts,format};
  if(typeof module==='object' && module.exports) module.exports=api;
  else root.AddressFormat=api;
})(typeof window==='object'?window:globalThis);
