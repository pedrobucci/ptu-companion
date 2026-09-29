import {normalizeSpeciesForms} from './pokemon-forms.mjs';
import {MEGA_FORM_CATALOG,MEGA_STONE_CATALOG} from './mega-form-runtime-data.mjs';

const BUILT_IN_SPECIES_FORMS=Object.freeze(MEGA_FORM_CATALOG);
const BUILT_IN_FORM_ITEMS=Object.freeze(Object.fromEntries(MEGA_STONE_CATALOG.map(item=>[item.id,{
  id:item.id,name:item.name,kind:'items',category:'Mega Stone',effect:item.effect,
  price:null,sourceId:'ptu-core-1.05',sourcePage:item.sourcePage,versionId:`builtin:items:${item.id}@ptu-core-1.05`,contentPackId:null,
  raw:{id:item.id,name:item.name,category:'Mega Stone',effect_text:item.effect,pokemon_held_usable:true,shop_visible:false,mega_species_id:item.speciesId,mega_form_id:item.formId,app_helper:true}
}])));

export function mergeBuiltInSpeciesForms(speciesId,forms=[]){
  const source=Array.isArray(forms)?forms:[];
  const ids=new Set(source.map(form=>String(form?.id||'')));
  const additions=(BUILT_IN_SPECIES_FORMS[String(speciesId||'').toLowerCase()]||[]).filter(form=>!ids.has(form.id));
  return normalizeSpeciesForms([...source,...additions]);
}

export function getBuiltInFormItem(itemId){
  const item=BUILT_IN_FORM_ITEMS[String(itemId||'').toLowerCase()];
  return item?JSON.parse(JSON.stringify(item)):null;
}

export function listBuiltInFormItems(){
  return Object.keys(BUILT_IN_FORM_ITEMS).map(getBuiltInFormItem);
}
