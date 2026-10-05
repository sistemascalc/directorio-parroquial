(function(root) {
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  function mergeSnapshots(base,local,remote) {
    const conflicts=[],data={};
    for(const group of ['parishes','addresses']) {
      const b=new Map(base[group].map(r=>[r.id,r])), l=new Map(local[group].map(r=>[r.id,r])), r=new Map(remote[group].map(r=>[r.id,r]));
      data[group]=[];
      for(const id of new Set([...r.keys(),...l.keys(),...b.keys()])) {
        const before=b.get(id),ours=l.get(id),theirs=r.get(id);let value;
        if(equal(ours,before))value=theirs;
        else if(equal(theirs,before)||equal(ours,theirs))value=ours;
        else {conflicts.push(ours?.name||ours?.recipientName||theirs?.name||theirs?.recipientName||id);continue;}
        if(value)data[group].push(value);
      }
    }
    return {data,conflicts};
  }
  if(typeof module==='object')module.exports={mergeSnapshots};
  else root.DirectoryMerge={mergeSnapshots};
})(typeof window==='object'?window:this);
