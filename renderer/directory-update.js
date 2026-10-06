'use strict';
(function(root){
  const clone=value=>JSON.parse(JSON.stringify(value));
  const equal=(a,b)=>String(a||'').trim()===String(b||'').trim();
  function apply(data,updates){
    const result=clone(data);let changed=0;const conflicts=[];
    for(const update of updates){
      const parish=result.parishes.find(p=>p.id===update.id);
      if(!parish)continue;
      const original=update.before,next=update.after;
      if(next.name && equal(parish.name,original.name) && !equal(parish.name,next.name)){parish.name=next.name;changed++;}
      const canUpdateAddress=(equal(parish.address,original.address)||equal(parish.address,next.address)||!parish.address)&&(!parish.postalCode||equal(parish.postalCode,original.postalCode)||equal(parish.postalCode,next.postalCode))&&['streetNumber','colonyMunicipality'].every(k=>!parish[k]||equal(parish[k],original[k])||equal(parish[k],next[k]));
      if(canUpdateAddress){
        for(const key of ['address','streetNumber','colonyMunicipality','postalCode','state']){
          if(next[key]!==undefined&&!equal(parish[key],next[key])){parish[key]=next[key];changed++;}
        }
      }else conflicts.push(parish.id);
      if(next.phone&&(!parish.phone||equal(parish.phone,original.phone))&&!equal(parish.phone,next.phone)){parish.phone=next.phone;changed++;}
      const verification={...update.verification,...(!canUpdateAddress?{localAddressReviewRequired:true}:{})};
      if(JSON.stringify(parish.verification)!==JSON.stringify(verification)){parish.verification=verification;changed++;}
      for(const address of result.addresses.filter(a=>a.parishId===parish.id)){
        const baseline=update.addressesBefore.find(a=>a.id===address.id);
        if(baseline && next.name && !equal(original.name,next.name) && equal(address.recipientName,baseline.recipientName) && equal(baseline.recipientName,original.name)){address.recipientName=next.name;changed++;}
        const canUpdateCapture=baseline&&(equal(address.fullAddress,baseline.fullAddress)||equal(address.fullAddress,next.address))&&['streetNumber','colonyMunicipality','postalCode'].every(k=>!address[k]||equal(address[k],baseline[k]||original[k])||equal(address[k],next[k]));
        if(canUpdateCapture){
          for(const key of ['streetNumber','colonyMunicipality','postalCode'])if(next[key]!==undefined&&!equal(address[key],next[key])){address[key]=next[key];changed++;}
          if(!equal(address.fullAddress,next.address)){address.fullAddress=next.address;changed++;}
          if(next.phone&&(!address.phone||equal(address.phone,baseline.phone))&&!equal(address.phone,next.phone)){address.phone=next.phone;changed++;}
          if(JSON.stringify(address.verification)!==JSON.stringify(update.verification)){address.verification=clone(update.verification);changed++;}
        }
        if(address.parishSnapshot&&canUpdateAddress){
          const snapshot={...address.parishSnapshot,name:parish.name,address:parish.address,phone:parish.phone,postalCode:parish.postalCode};
          if(JSON.stringify(snapshot)!==JSON.stringify(address.parishSnapshot)){address.parishSnapshot=snapshot;changed++;}
        }
      }
    }
    return {data:result,changed,conflicts};
  }
  function migrate(storage,data,updates){
    const result=apply(data,updates);
    if(result.changed){
      const key='domicilios_respaldo_antes_revision_2026_10_06';
      if(!storage.getItem(key))storage.setItem(key,JSON.stringify(data));
    }
    return result;
  }
  const api={apply,migrate};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.DirectoryUpdate=api;
})(typeof window==='object'?window:globalThis);
