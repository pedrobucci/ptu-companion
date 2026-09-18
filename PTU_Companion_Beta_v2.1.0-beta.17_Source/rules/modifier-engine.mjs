/*
 * PTU Companion v1.3 — resolved creature / modifier layer v2 for Pokémon combat-facing values.
 *
 * Scope intentionally small and deterministic:
 * - Attack Conflict remains a Base Relations exemption handled by pokemon-engine.mjs.
 * - Mixed Power / Twisted Power modifies damaging Move rolls, not the stored Attack or Sp. Attack Stats.
 * - STAB modifies Damage Base before the Damage Chart lookup.
 *
 * The PTU Core's usual rounding rule is down, so half-stat bonuses use Math.floor.
 */

const slug=v=>String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

export function hasTwistedPowerEffect(details={}){
  const edges=Array.isArray(details.pokeEdges)?details.pokeEdges:[];
  if(edges.some(e=>slug(e?.id||e?.name)==='mixed-power')) return true;
  const native=Array.isArray(details.abilities)?details.abilities:[];
  if(native.some(a=>slug(typeof a==='string'?a:a?.name)==='twisted-power')) return true;
  const granted=Array.isArray(details.grantedAbilities)?details.grantedAbilities:[];
  return granted.some(a=>slug(typeof a==='string'?a:a?.name)==='twisted-power');
}

export function getPokemonModifierSummary(pokemon={}, context={}){
  const d=pokemon.details||{};
  const stats=d.finalStats||{};
  const twisted=hasTwistedPowerEffect(d);
  const attack=Math.max(0,Number(stats.attack)||0);
  const specialAttack=Math.max(0,Number(stats.special_attack??stats.spAttack)||0);
  const moveLimitBase=Math.max(0,Number(d.moveLimitBase??6)||0);
  const moveLimitModifier=Number(d.moveLimitModifier??0)||0;
  const moveLimitEffective=Math.max(0,Number(d.moveLimitEffective??(moveLimitBase+moveLimitModifier))||0);
  const held=context.heldItemEffect||null;
  const heldStatBonuses=held?.statBonuses||{};
  const effectiveStats={...stats};
  for(const [key,val] of Object.entries(heldStatBonuses)) effectiveStats[key]=(Number(effectiveStats[key])||0)+Number(val||0);
  if(held && Number(held.speedMultiplier||1)!==1 && effectiveStats.speed!=null) effectiveStats.speed=Math.floor((Number(effectiveStats.speed)||0)*Number(held.speedMultiplier||1));
  return {
    moveLimit:{base:moveLimitBase,modifier:moveLimitModifier,effective:moveLimitEffective},
    twistedPower: twisted ? {
      active:true,
      source:(d.pokeEdges||[]).some(e=>slug(e?.id||e?.name)==='mixed-power')?'Mixed Power':'Twisted Power',
      physicalDamageBonus:Math.floor(specialAttack/2),
      specialDamageBonus:Math.floor(attack/2),
      note:'Adds half Special Attack to Physical Move damage rolls and half Attack to Special Move damage rolls. It does not change the Move\'s Damage Class or the stored Stats.'
    } : {active:false,physicalDamageBonus:0,specialDamageBonus:0},
    effectiveStats,
    heldItem: held ? {id:held.id,name:held.name,automation:held.automation,effectText:held.effectText,statBonuses:held.statBonuses||{},speedMultiplier:held.speedMultiplier||1,speedEvasionBonus:held.speedEvasionBonus||0,conditionalDamageBonusSuperEffective:held.conditionalDamageBonusSuperEffective||0,preventsEvolution:!!held.preventsEvolution,removeGroundImmunity:!!held.removeGroundImmunity,hpStealRecoveryMultiplier:held.hpStealRecoveryMultiplier||1,defaultCombatStage:held.defaultCombatStage||null,warnings:held.warnings||[]} : null,
    activeEffects:[
      ...(twisted?[{kind:'damage_modifier',id:'twisted-power',source:(d.pokeEdges||[]).some(e=>slug(e?.id||e?.name)==='mixed-power')?'mixed-power':'twisted-power'}]:[]),
      ...(moveLimitModifier?[{kind:'move_limit_modifier',id:'move-limit',value:moveLimitModifier,source:'pokemon.details.moveLimitModifier'}]:[]),
      ...(held?[{kind:'held_item',id:held.id,source:'held-item',automation:held.automation}]:[])
    ]
  };
}

function mergeDiceExpression(rolledDamage, flatBonus){
  const text=String(rolledDamage||'').replace(/\s+/g,'');
  const m=text.match(/^(\d+d\d+)([+-]\d+)?$/i);
  if(!m) return flatBonus?`${rolledDamage||'Damage'} ${flatBonus>=0?'+':'-'} ${Math.abs(flatBonus)}`:String(rolledDamage||'');
  const base=Number(m[2]||0);
  const total=base+Number(flatBonus||0);
  return `${m[1]}${total>0?`+${total}`:total<0?total:''}`;
}

export function resolveMoveDamage({pokemon={},moveDefinition=null,speciesTypes=[],getDamageBase=null,heldItemEffect=null}={}){
  const move=moveDefinition||{};
  const moveClass=String(move.class||move.damageClass||move.raw?.class||'').trim().toLowerCase();
  const damaging=moveClass==='physical'||moveClass==='special';
  const baseDb=Number(move.damageBase);
  if(!damaging || !Number.isFinite(baseDb) || typeof getDamageBase!=='function') return null;
  const moveType=String(move.type||'').trim().toLowerCase();
  const types=(Array.isArray(speciesTypes)?speciesTypes:[]).map(t=>String(t||'').trim().toLowerCase());
  const stab=moveType && types.includes(moveType) ? 2 : 0;
  const finalDb=Math.max(1,Math.min(28,baseDb+stab));
  const chart=getDamageBase(finalDb);
  if(!chart) return null;
  const d=pokemon.details||{};
  const stats=d.finalStats||{};
  const modifiers=getPokemonModifierSummary(pokemon,{heldItemEffect});
  const effective=modifiers.effectiveStats||stats;
  const attack=Math.max(0,Number(effective.attack)||0);
  const specialAttack=Math.max(0,Number(effective.special_attack??effective.spAttack)||0);
  const primary=moveClass==='physical'?attack:specialAttack;
  const mixedBonus=modifiers.twistedPower.active
    ? (moveClass==='physical'?modifiers.twistedPower.physicalDamageBonus:modifiers.twistedPower.specialDamageBonus)
    : 0;
  const flatBonus=primary+mixedBonus;
  return {
    moveClass,
    baseDamageBase:baseDb,
    stabDamageBaseBonus:stab,
    finalDamageBase:finalDb,
    damageChart:chart,
    primaryStat:{name:moveClass==='physical'?'Attack':'Special Attack',value:primary},
    mixedPowerBonus:mixedBonus,
    heldItemConditionalSuperEffectiveBonus:Number(heldItemEffect?.conditionalDamageBonusSuperEffective||0),
    finalRoll:mergeDiceExpression(chart.rolled_damage,flatBonus),
    breakdown:[
      {label:`DB ${baseDb}`,value:baseDb},
      ...(stab?[{label:'STAB',value:'+2 DB'}]:[]),
      {label:moveClass==='physical'?'Attack':'Special Attack',value:primary},
      ...(mixedBonus?[{label:'Mixed Power',value:mixedBonus}]:[]),
      ...(heldItemEffect?.statBonuses && Number(heldItemEffect.statBonuses[moveClass==='physical'?'attack':'special_attack']||0)?[{label:`${heldItemEffect.name} Stat Bonus`,value:Number(heldItemEffect.statBonuses[moveClass==='physical'?'attack':'special_attack'])}]:[])
    ]
  };
}
