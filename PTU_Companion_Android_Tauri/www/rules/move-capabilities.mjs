const key=value=>String(value||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

// Core 1.05 p.338: Special capabilities belong to learned moves and disappear
// when forgotten. Only the Special field is a passive grant; Effect is contextual.
export function resolveMoveCapabilities(capabilities=[],moves=[]){
  const caps=structuredClone(capabilities),applied=[],seen=new Set();
  for(const move of moves.filter(Boolean)){
    const id=key(move.id||move.name);if(seen.has(id))continue;seen.add(id);
    const text=String(move.raw?.special_text||'').trim();
    const match=text.match(/^Grants\s+(?:(\+\d+)\s+)?([A-Za-z][A-Za-z -]*?)(?:\s+(\+?\d+))?\.?$/i);
    if(!match)continue;
    const name=match[2].trim(),target=key(name),amount=match[1]||match[3],operation=amount?.startsWith('+')?'add':amount?'minimum':'grant',value=amount?Number(amount):null;
    let cap=caps.find(c=>key(c.capability_id||c.name)===target),field='value';
    if(['high-jump','long-jump'].includes(target)){
      cap=caps.find(c=>c.kind==='jump');field=target==='high-jump'?'high':'long';
      if(!cap){cap={name:'Jump',kind:'jump',high:0,long:0,component_capability_ids:['high-jump','long-jump']};caps.push(cap);}
    }
    if(!cap){cap={name,capability_id:target,kind:['sky','swim','burrow','overland','levitate','teleporter'].includes(target)?'movement':target==='power'?'power':'special'};caps.push(cap);}
    const before=Number(cap[field]||0);
    if(amount)cap[field]=operation==='add'?before+value:Math.max(before,value);
    applied.push({sourceKind:'move',sourceId:move.id,sourceName:move.name,sourceVersionId:move.versionId,sourcePage:move.sourcePage,targetId:target,targetName:name,operation,value,before,after:amount?cap[field]:null});
  }
  return {capabilities:caps,applied};
}
