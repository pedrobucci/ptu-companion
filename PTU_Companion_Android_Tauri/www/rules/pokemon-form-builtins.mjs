import {normalizeSpeciesForms} from './pokemon-forms.mjs';
import {MEGA_FORM_CATALOG,MEGA_STONE_CATALOG} from './mega-form-runtime-data.mjs';

const BUILT_IN_SPECIES_FORMS=Object.freeze(MEGA_FORM_CATALOG);
const AEGISLASH_STANCE_FORM=Object.freeze({
  id:'sword-stance',name:'Sword Stance',mode:'transformation',sortOrder:10,
  statSwaps:[['attack','defense'],['special_attack','special_defense']],
  requirements:{all:[{kind:'manual',value:'aegislash:sword-stance'}]},
  overrides:{baseStats:{swap:[['attack','defense'],['special_attack','special_defense']]}},
  lifecycle:{model_version:1,source:'Pokemon Tabletop United 1.05 Core p.331',events:[
    {id:'stance-change-damaging-attack',event:'move-used',priority:10,when:{damaging:true},action:{type:'activate'},source_action:'Automatic when Aegislash uses a damaging attack.'},
    {id:'stance-change-defensive-move',event:'move-used',priority:20,when:{any:[{move:["King's Shield",'Protect']},{all:[{move_class:'Status'},{raises_defense_combat_stages:true}]},{tag:'Blessing'}]},action:{type:'deactivate',form_id:'sword-stance'},source_action:'Automatic return to Shield Stance.'},
    {id:'stance-change-full-action',event:'form-action',priority:30,when:{action_id:'stance-change-full-action'},action:{type:'toggle'},action_cost:'Full Action'}
  ]}
});
const BUILT_IN_FORM_ITEMS=Object.freeze(Object.fromEntries(MEGA_STONE_CATALOG.map(item=>[item.id,{
  id:item.id,name:item.name,kind:'items',category:'Mega Stone',effect:item.effect,
  price:null,sourceId:'ptu-core-1.05',sourcePage:item.sourcePage,versionId:`builtin:items:${item.id}@ptu-core-1.05`,contentPackId:null,
  raw:{id:item.id,name:item.name,category:'Mega Stone',effect_text:item.effect,pokemon_held_usable:true,shop_visible:false,mega_species_id:item.speciesId,mega_form_id:item.formId,app_helper:true}
}])));

export function mergeBuiltInSpeciesForms(speciesId,forms=[]){
  const source=Array.isArray(forms)?forms:[];
  const ids=new Set(source.map(form=>String(form?.id||'')));
  const key=String(speciesId||'').toLowerCase();
  const additions=[...(BUILT_IN_SPECIES_FORMS[key]||[]),...(key==='aegislash'?[AEGISLASH_STANCE_FORM]:[])].filter(form=>!ids.has(form.id));
  return normalizeSpeciesForms([...source,...additions]);
}

export function getBuiltInFormItem(itemId){
  const item=BUILT_IN_FORM_ITEMS[String(itemId||'').toLowerCase()];
  return item?JSON.parse(JSON.stringify(item)):null;
}

export function listBuiltInFormItems(){
  return Object.keys(BUILT_IN_FORM_ITEMS).map(getBuiltInFormItem);
}
