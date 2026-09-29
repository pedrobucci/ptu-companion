import {normalizeSpeciesForms} from './pokemon-forms.mjs';

const BUILT_IN_SPECIES_FORMS=Object.freeze({
  sableye:[{
    id:'mega',name:'Mega Sableye',mode:'transformation',
    requirements:{all:[{kind:'manual',value:'mega-evolution-sableye-mega'}]},
    overrides:{baseStats:{add:{attack:1,defense:5,special_attack:2,special_defense:5,speed:-3}}},
    sortOrder:100
  }]
});

export function mergeBuiltInSpeciesForms(speciesId,forms=[]){
  const source=Array.isArray(forms)?forms:[];
  const ids=new Set(source.map(form=>String(form?.id||'')));
  const additions=(BUILT_IN_SPECIES_FORMS[String(speciesId||'').toLowerCase()]||[]).filter(form=>!ids.has(form.id));
  return normalizeSpeciesForms([...source,...additions]);
}
