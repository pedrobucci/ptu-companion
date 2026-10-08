import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

for(const path of ['../static-preview/app.js','../../PTU_Companion_Android_Tauri/www/app.js']){
  const source=await readFile(new URL(path,import.meta.url),'utf8');
  const extract=name=>{
    const start=source.search(new RegExp(`(?:async )?function ${name}\\(`));
    assert.ok(start>=0,`Missing ${name}`);
    const lineEnd=source.indexOf('\n',start);
    if(source.slice(start,lineEnd).trimEnd().endsWith('}'))return source.slice(start,lineEnd);
    return source.slice(start,source.indexOf('\n}',start)+2);
  };
  const writes=[],storage=new Map();
  const context={
    state:{trainer:{name:'Test',title:'Trainer',level:1,money:123,gmGrants:[{id:'grant',label:'Test grant'}]},ui:{screen:'dashboard',gmOverride:false},inventory:[],rosters:[],pokemon:[]},
    window:{PTU_ANDROID_BUILD:path.includes('Android')},nav:[],STORAGE_KEY:'test',persistenceMode:'sqlite',saveQueue:Promise.resolve(),location:{protocol:'http:'},
    localStorage:{setItem:(key,value)=>storage.set(key,value)},
    fetch:async(url,options)=>{writes.push(JSON.parse(options.body).state);return {ok:true,json:async()=>({savedAt:'test'})};},
    trainer:()=>context.state.trainer,activePokemon:()=>[],personPortrait:()=>'',heading:()=>'',section:(_title,body)=>body,
    progress:()=>'',persistenceLabel:()=>'',mobileBottomNav:()=>'',chip:()=>'',toast:()=>{},schedulePokemonBuildPreview:()=>{},
    styledConfirm:async()=>context.confirmed,
  };
  vm.createContext(context);
  vm.runInContext(['esc','itemIconHtml','dashboard','shell','persist','toggleGmOverride','removeGmGrant'].map(extract).join('\n'),context);
  context.commit=()=>context.persist();
  for(const icon of ['https://example.invalid/item.png','data:image/png;base64,AAAA','◆','<script>alert(1)</script>']){
    context.state.inventory=[{id:'custom',name:'Custom item',icon,qty:2}];
    const html=context.dashboard();
    if(icon.startsWith('https:')||icon.startsWith('data:')){
      assert.ok(html.includes(`<img class="item-art-icon" src="${icon}"`),'Home renders image data as an image');
      assert.ok(!html.includes(`<span>${icon}</span>`),'Home does not expose the image URL as text');
      assert.ok(html.includes('item-icon-fallback'),'Image failure has a fallback');
    }else{
      assert.ok(html.includes(context.esc(icon)),'Text icons are escaped');
      assert.ok(!html.includes('<script>'),'Icons cannot inject markup');
    }
    assert.equal(context.state.inventory[0].icon,icon,'Rendering preserves item data');
  }
  assert.match(context.shell(''),/GM OFF/,'GM disabled is explicit on every screen');
  await context.removeGmGrant('grant');
  assert.equal(context.state.trainer.gmGrants.length,1,'Disabled GM cannot remove a grant');
  context.toggleGmOverride();await context.saveQueue;
  assert.match(context.shell(''),/GM ON/,'Toggle updates the global indicator');
  assert.equal(JSON.parse(storage.get('test')).ui.gmOverride,true,'GM state survives browser save');
  assert.equal(writes.at(-1).ui.gmOverride,true,'SQLite save receives GM state');
  context.confirmed=false;await context.removeGmGrant('grant');
  assert.equal(context.state.trainer.gmGrants.length,1,'Cancel preserves the grant');
  context.confirmed=true;await context.removeGmGrant('grant');await context.saveQueue;
  assert.equal(writes.at(-1).trainer.gmGrants.length,0,'Confirmed removal persists');
  assert.equal(writes.at(-1).trainer.money,123,'No money changes');
  assert.equal(writes.at(-1).inventory[0].qty,2,'No inventory changes');
  context.toggleGmOverride();await context.saveQueue;
  assert.equal(writes.at(-1).ui.gmOverride,false,'Disabling GM persists too');
}
console.log('Issues #75/#88 + #77 gate/cancel/save: Windows and Android OK');
