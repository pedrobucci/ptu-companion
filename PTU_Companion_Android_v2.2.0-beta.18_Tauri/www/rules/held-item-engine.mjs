const slug=v=>String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const STAT_KEYS=['hp','attack','defense','special_attack','special_defense','speed'];
const statKey=v=>{const x=slug(v).replaceAll('-','_');return ({sp_attack:'special_attack',sp_atk:'special_attack',sp_defense:'special_defense',sp_def:'special_defense'})[x]||x;};

/**
 * Resolve the subset of PTU Held Item effects that can be represented deterministically
 * in the current prototype. Unsupported/conditional effects remain visible as manual text.
 */
export function resolveHeldItemEffect({itemDefinition=null,config={},pokemon={},hasOutgoingEvolution=false}={}){
  if(!itemDefinition) return null;
  const raw=itemDefinition.raw||{};
  const id=slug(itemDefinition.id||raw.id||itemDefinition.name);
  const base={
    id,name:itemDefinition.name||raw.name||id,
    definitionId:itemDefinition.id||raw.id||id,
    versionId:itemDefinition.versionId||raw.definition_version_id||null,
    sourceId:itemDefinition.sourceId||raw.source_id||null,
    effectText:itemDefinition.effect||raw.effect_text||'',
    automation:'manual',valid:true,errors:[],warnings:[],requiresConfig:[],
    statBonuses:{},grantedAbilities:[],speedMultiplier:1,speedEvasionBonus:0,
    conditionalDamageBonusSuperEffective:0,preventsEvolution:false,removeGroundImmunity:false,
    hpStealRecoveryMultiplier:1,defaultCombatStage:null,statusOnEquip:null
  };
  switch(id){
    case 'bright-powder':
      base.automation='automatic'; base.speedEvasionBonus=2; break;
    case 'full-incense':
      base.automation='automatic'; base.grantedAbilities=['Stall']; break;
    case 'expert-belt':
      base.automation='conditional'; base.conditionalDamageBonusSuperEffective=5; break;
    case 'everstone':
      base.automation='automatic'; base.preventsEvolution=true; break;
    case 'big-root':
      base.automation='conditional'; base.hpStealRecoveryMultiplier=2; break;
    case 'iron-ball':
      base.automation='automatic'; base.speedMultiplier=0.5; base.removeGroundImmunity=true; break;
    case 'eviolite': {
      base.automation='automatic'; base.preventsEvolution=true; base.requiresConfig=['two_stats'];
      if(!hasOutgoingEvolution){base.valid=false;base.errors.push('Eviolite only affects a Pokémon that is not fully evolved in its family.');}
      const stats=Array.isArray(config.stats)?[...new Set(config.stats.map(statKey).filter(s=>STAT_KEYS.includes(s)))]:[];
      if(stats.length!==2){base.valid=false;base.errors.push('Choose exactly two different Stats for Eviolite.');}
      else for(const stat of stats) base.statBonuses[stat]=5;
      break;
    }
    case 'choice-item': {
      base.automation='partial'; base.requiresConfig=['stat'];
      const stat=statKey(config.stat||'');
      if(!STAT_KEYS.filter(s=>s!=='hp').includes(stat)){base.valid=false;base.errors.push('Choose Attack, Defense, Special Attack, Special Defense, or Speed for the Choice Item.');}
      else base.defaultCombatStage={stat,value:2};
      base.warnings.push('Suppressed status and its combat-duration persistence remain a manual combat-state check in v1.4.');
      break;
    }
    case 'flame-orb':
      base.automation='partial'; base.statusOnEquip='Burned'; base.warnings.push('Status-condition lifecycle is not fully automated yet.'); break;
    default:
      base.automation='manual'; break;
  }
  return base;
}

export function applyHeldItemToTypeProfile(profile=[],effect=null){
  if(!effect?.removeGroundImmunity) return profile;
  return (profile||[]).map(row=>{
    const attack=String(row.attackType||row.attack_type||'').toLowerCase();
    if(attack!=='ground' || Number(row.multiplier)!==0) return row;
    // Iron Ball removes immunity to Ground; without a target-side component resolver here,
    // neutral is the safe resolved fallback. A future type component engine can preserve
    // a secondary resistance/weakness while removing only the immunity component.
    return {...row,relation:'neutral',multiplier:1,netSteps:0,heldItemOverride:'Iron Ball removes Ground immunity'};
  });
}

export function applyHeldItemToEffectiveStats(stats={},effect=null){
  const out={...stats}; if(!effect) return out;
  for(const [key,val] of Object.entries(effect.statBonuses||{})) out[key]=(Number(out[key])||0)+Number(val||0);
  if(Number(effect.speedMultiplier)!==1 && out.speed!=null) out.speed=Math.floor((Number(out.speed)||0)*Number(effect.speedMultiplier||1));
  return out;
}
