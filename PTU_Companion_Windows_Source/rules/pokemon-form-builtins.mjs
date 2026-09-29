import {normalizeSpeciesForms} from './pokemon-forms.mjs';

const BUILT_IN_SPECIES_FORMS=Object.freeze({
  sableye:[{
    id:'mega',name:'Mega Sableye',mode:'transformation',
    requirements:{all:[{kind:'held_item',value:'sableye-mega-stone'},{kind:'manual',value:{id:'mega-evolution-sableye-mega',label:'Trainer has the Mega Ring'}}]},
    overrides:{baseStats:{add:{attack:1,defense:5,special_attack:2,special_defense:5,speed:-3}}},
    sortOrder:100
  }]
});

const BUILT_IN_FORM_ITEMS=Object.freeze({
  'sableye-mega-stone':{
    id:'sableye-mega-stone',name:'Sableye Mega Stone',kind:'items',category:'Mega Stone',
    effect:'Species-specific Mega Stone required for Mega Evolution. No price or automatic effect is defined by the supplied Core item data.',
    price:null,sourceId:'ptu-core-1.05',sourcePage:206,versionId:'builtin:items:sableye-mega-stone@ptu-core-1.05',contentPackId:null,
    raw:{id:'sableye-mega-stone',name:'Sableye Mega Stone',category:'Mega Stone',effect_text:'Species-specific Mega Stone required for Mega Evolution. No price or automatic effect is defined by the supplied Core item data.',pokemon_held_usable:true,shop_visible:false}
  }
});

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
