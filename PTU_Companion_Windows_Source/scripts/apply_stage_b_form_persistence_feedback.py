#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
TARGETS = [
    ROOT / 'static-preview' / 'app.js',
    REPO / 'PTU_Companion_Android_Tauri' / 'www' / 'app.js',
]
AUDIT_JSON = REPO / 'docs' / 'data' / 'PTU_FORMS_HP_MUTATION_AUDIT.json'
AUDIT_MD = REPO / 'docs' / 'PTU_FORMS_HP_MUTATION_AUDIT.md'

OLD_LABEL = "function pokemonFormStateLabel(formState={}){const base=formState.baseFormId||'base',active=formState.activeFormId||null;return active?`${base} + ${active}`:base;}"
NEW_LABEL = """function pokemonFormStateLabel(formState={},forms=[]){
  const display=id=>{const key=formEventSlug(id||'base')||'base';if(key==='base')return 'Canonical Base';const match=(forms||[]).find(form=>formEventSlug(form?.id)===key);return match?.name||String(id||'Canonical Base');};
  const base=display(formState.baseFormId||'base'),active=formState.activeFormId==null?null:display(formState.activeFormId);return active?`${base} + ${active}`:base;
}"""

OLD_FEEDBACK_HEAD = """  const afterState=pokemonFormStateSnapshot(p);const formChanged=beforeState.baseFormId!==afterState.baseFormId||beforeState.activeFormId!==afterState.activeFormId;
  const blockedTempHp=Math.max(0,Number(payload?.hpAdjustment?.blockedTempHp||0));const history=trainer()?.history;
  if(formChanged&&Array.isArray(history)){
    const ruleSummary=pokemonFormAppliedRuleSummary(payload);history.push({id:uid('h'),date:new Date().toISOString().slice(0,10),title:'Pokémon Form changed',detail:`${p.name}: ${pokemonFormStateLabel(beforeState)} → ${pokemonFormStateLabel(afterState)}${ruleSummary?` · ${ruleSummary}`:''}`});
    if(!silent)toast(`${p.name}: Form ${pokemonFormStateLabel(beforeState)} → ${pokemonFormStateLabel(afterState)}.`);
  }"""
NEW_FEEDBACK_HEAD = """  const afterState=pokemonFormStateSnapshot(p);const formChanged=beforeState.baseFormId!==afterState.baseFormId||beforeState.activeFormId!==afterState.activeFormId;
  const blockedTempHp=Math.max(0,Number(payload?.hpAdjustment?.blockedTempHp||0));const history=trainer()?.history;const formDefinitions=Array.isArray(payload?.baseSpecies?.forms)?payload.baseSpecies.forms:[];
  if(formChanged&&Array.isArray(history)){
    const ruleSummary=pokemonFormAppliedRuleSummary(payload);history.push({id:uid('h'),date:new Date().toISOString().slice(0,10),title:'Pokémon Form changed',detail:`${p.name}: ${pokemonFormStateLabel(beforeState,formDefinitions)} → ${pokemonFormStateLabel(afterState,formDefinitions)}${ruleSummary?` · ${ruleSummary}`:''}`});
    if(!silent)toast(`${p.name}: Form ${pokemonFormStateLabel(beforeState,formDefinitions)} → ${pokemonFormStateLabel(afterState,formDefinitions)}.`);
  }"""

PROGRESSION_DECL_OLD = "function applyPokemonProgression(){"
PROGRESSION_DECL_NEW = "async function applyPokemonProgression(){"
PROGRESSION_REVALIDATE_ANCHOR = "  d.buildEngineVersion='1.5.0'; d.hpBaseRelationsExempt=true; d.baseRelationsOverridden=!!pv.baseRelations?.overridden;\n  d.progressionHistory=Array.isArray(d.progressionHistory)?d.progressionHistory:[];"
PROGRESSION_REVALIDATE_NEW = "  d.buildEngineVersion='1.5.0'; d.hpBaseRelationsExempt=true; d.baseRelationsOverridden=!!pv.baseRelations?.overridden;\n  if(!pv.evolved)await revalidatePokemonFormAfterDirectHpMutation(p.id,{hpChanged:true,tempHpChanged:false,silent:true});\n  d.progressionHistory=Array.isArray(d.progressionHistory)?d.progressionHistory:[];"

AUDIT_ROWS = [
    {
        'surface': 'defaultState sample Pokémon',
        'assignment': 'object literals with hp/maxHp',
        'classification': 'construction_only',
        'lifecycle': 'not_applicable',
        'reason': 'Initial sample objects are created before any individual Form lifecycle state exists.'
    },
    {
        'surface': 'rules-backed Pokémon creation builder',
        'assignment': 'new Pokémon object hp/maxHp',
        'classification': 'construction_only',
        'lifecycle': 'not_applicable',
        'reason': 'A new individual is constructed from resolved PTU stats before it enters campaign state.'
    },
    {
        'surface': 'loadCreatureReferenceData',
        'assignment': 'resolved maxHp reconciliation + hp clamp',
        'classification': 'lifecycle_sensitive',
        'lifecycle': 'covered',
        'reason': 'A resolved Max HP change can alter HP-ratio Form conditions; linked Pokémon are revalidated.'
    },
    {
        'surface': 'applyPokemonProgression — no evolution',
        'assignment': 'level-up maxHp update + hp clamp',
        'classification': 'lifecycle_sensitive',
        'lifecycle': 'covered_in_this_pass',
        'reason': 'Normal level progression can change Max HP without changing Species, so HP-ratio Forms must be revalidated after progression details are updated.'
    },
    {
        'surface': 'applyPokemonProgression — evolution',
        'assignment': 'new Species maxHp + hp clamp',
        'classification': 'intentional_form_reset',
        'lifecycle': 'covered_by_reset',
        'reason': 'Evolution changes Species and intentionally resets formState to canonical base instead of carrying an old Species Form across evolution.'
    },
    {
        'surface': 'applyPokemonRestat',
        'assignment': 'redistributed maxHp + hp clamp',
        'classification': 'lifecycle_sensitive',
        'lifecycle': 'covered',
        'reason': 'Stat redistribution can change Max HP and therefore HP-ratio Form conditions.'
    },
    {
        'surface': 'acquirePokeEdge',
        'assignment': 'resolved maxHp from edge effects + hp clamp',
        'classification': 'lifecycle_sensitive',
        'lifecycle': 'covered',
        'reason': 'A Poké Edge can alter resolved Max HP; linked Form state is revalidated when it does.'
    },
    {
        'surface': 'refundPokeEdge',
        'assignment': 'resolved maxHp after edge refund + hp clamp',
        'classification': 'lifecycle_sensitive',
        'lifecycle': 'covered',
        'reason': 'Removing a Poké Edge can alter resolved Max HP; linked Form state is revalidated when it does.'
    },
    {
        'surface': 'changeHp — linked Species',
        'assignment': 'HP/THP adjustment',
        'classification': 'lifecycle_event',
        'lifecycle': 'covered',
        'reason': 'The normal HP control dispatches hp-adjust through the campaign Form event endpoint.'
    },
    {
        'surface': 'changeHp — unlinked/demo fallback',
        'assignment': 'direct HP/THP adjustment',
        'classification': 'unlinked_fallback',
        'lifecycle': 'not_applicable',
        'reason': 'Demo/unlinked Pokémon have no Species Form catalog to revalidate.'
    },
    {
        'surface': 'storePokemon',
        'assignment': 'restore hp to maxHp and clear THP',
        'classification': 'application_reset',
        'lifecycle': 'covered',
        'reason': 'Existing Storage semantics already reset HP/THP; Form THP provenance is cleared and Form state is revalidated.'
    },
    {
        'surface': 'withdrawPokemon',
        'assignment': 'restore hp to maxHp and clear THP',
        'classification': 'application_reset',
        'lifecycle': 'covered',
        'reason': 'Existing withdrawal semantics reset HP/THP; linked Form state is revalidated after cleanup.'
    },
    {
        'surface': 'useItem — linked Species',
        'assignment': 'Potion/Super Potion/Oran Berry healing',
        'classification': 'lifecycle_event',
        'lifecycle': 'covered',
        'reason': 'Automated healing dispatches hp-adjust so HP-sensitive Forms re-evaluate.'
    },
    {
        'surface': 'useItem — unlinked/demo fallback',
        'assignment': 'direct healing clamp',
        'classification': 'unlinked_fallback',
        'lifecycle': 'not_applicable',
        'reason': 'Demo/unlinked Pokémon have no Species Form catalog to revalidate.'
    },
]


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f'Anchor drifted: {label}')
    return text.replace(old, new, 1)


def patch_client(path: Path) -> bool:
    text = path.read_text(encoding='utf-8')
    original = text
    text = replace_once(text, OLD_LABEL, NEW_LABEL, f'Form display label in {path}')
    text = replace_once(text, OLD_FEEDBACK_HEAD, NEW_FEEDBACK_HEAD, f'Form lifecycle feedback in {path}')
    text = replace_once(text, PROGRESSION_DECL_OLD, PROGRESSION_DECL_NEW, f'Pokémon progression async boundary in {path}')
    text = replace_once(text, PROGRESSION_REVALIDATE_ANCHOR, PROGRESSION_REVALIDATE_NEW, f'Pokémon progression Form revalidation in {path}')
    if text != original:
        path.write_text(text, encoding='utf-8')
        return True
    return False


def validate_audit_anchors(path: Path) -> None:
    text = path.read_text(encoding='utf-8')
    required = [
        'async function applyPokemonProgression()',
        "if(!pv.evolved)await revalidatePokemonFormAfterDirectHpMutation(p.id,{hpChanged:true,tempHpChanged:false,silent:true});",
        "if(pv.evolved){d.formState={schemaVersion:1,baseFormId:'base',activeFormId:null};d.manualFormApprovals=[];}",
        'await revalidatePokemonFormAfterDirectHpMutation(p.id,{hpChanged:true,tempHpChanged:false,silent:true})',
        'async function storePokemon(id)',
        'async function withdrawPokemon(id)',
        'async function useItem(itemId,pid)',
        "applyPokemonFormGameEventUi(pid,{kind:'hp-adjust',delta:healing}",
        'createdFromDefinition:true',
    ]
    missing = [needle for needle in required if needle not in text]
    if missing:
        raise SystemExit(f'HP mutation audit anchors missing in {path}: {missing}')


def write_audit() -> None:
    payload = {
        'schema_version': 1,
        'scope': 'Pokemon HP/max-HP mutation surfaces in the Windows/Android campaign UI clients',
        'platforms': ['windows', 'android'],
        'summary': {
            'surfaces': len(AUDIT_ROWS),
            'lifecycle_sensitive_or_event': sum(row['classification'] in {'lifecycle_sensitive', 'lifecycle_event'} for row in AUDIT_ROWS),
            'construction_only': sum(row['classification'] == 'construction_only' for row in AUDIT_ROWS),
            'intentional_form_reset': sum(row['classification'] == 'intentional_form_reset' for row in AUDIT_ROWS),
            'application_reset': sum(row['classification'] == 'application_reset' for row in AUDIT_ROWS),
            'unlinked_fallback': sum(row['classification'] == 'unlinked_fallback' for row in AUDIT_ROWS),
            'uncovered_linked_surfaces': sum(row['lifecycle'] not in {'covered', 'covered_in_this_pass', 'covered_by_reset', 'not_applicable'} for row in AUDIT_ROWS),
        },
        'surfaces': AUDIT_ROWS,
        'notes': [
            'The audit covers mutation/initialization surfaces in the campaign UI clients, not internal resolver calculations that operate on copies.',
            'Persisted Form IDs remain unchanged; readable names are a display concern only.',
            'No deferred/source-insufficient family is unlocked by this audit.'
        ]
    }
    AUDIT_JSON.parent.mkdir(parents=True, exist_ok=True)
    AUDIT_JSON.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    lines = [
        '# PTU Forms — Pokémon HP / Max HP Mutation Audit',
        '',
        'Deterministic audit of campaign-client Pokémon HP and Max HP initialization/mutation surfaces relevant to the Stage B Form lifecycle.',
        '',
        f"- Surfaces classified: **{payload['summary']['surfaces']}**",
        f"- Lifecycle-sensitive/event surfaces: **{payload['summary']['lifecycle_sensitive_or_event']}**",
        f"- Construction-only: **{payload['summary']['construction_only']}**",
        f"- Intentional Form reset: **{payload['summary']['intentional_form_reset']}**",
        f"- Existing application reset paths: **{payload['summary']['application_reset']}**",
        f"- Unlinked/demo fallbacks: **{payload['summary']['unlinked_fallback']}**",
        f"- Uncovered linked surfaces: **{payload['summary']['uncovered_linked_surfaces']}**",
        '',
        '| Surface | Assignment | Classification | Lifecycle | Reason |',
        '| --- | --- | --- | --- | --- |',
    ]
    for row in AUDIT_ROWS:
        lines.append(f"| {row['surface']} | {row['assignment']} | `{row['classification']}` | `{row['lifecycle']}` | {row['reason']} |")
    lines += [
        '',
        '## Guardrails',
        '',
        '- The normal no-evolution level-up path is now explicitly lifecycle-revalidated after its resolved build fields are updated.',
        '- Evolution remains an intentional Species boundary and resets the individual Form state to canonical base.',
        '- Construction-only and unlinked/demo paths do not claim Form lifecycle semantics.',
        '- Persisted Form IDs are not renamed or migrated; display names are resolved from catalog Forms only when available.',
        '- The ten deferred/source-insufficient families remain blocked.',
        ''
    ]
    AUDIT_MD.write_text('\n'.join(lines), encoding='utf-8')


def main() -> None:
    changed = [str(path.relative_to(REPO)) for path in TARGETS if patch_client(path)]
    for path in TARGETS:
        validate_audit_anchors(path)
    write_audit()
    print({
        'changed': changed,
        'targets': len(TARGETS),
        'hp_mutation_audit_surfaces': len(AUDIT_ROWS),
        'uncovered_linked_surfaces': 0,
        'persistence_feedback_model_version': 1,
    })


if __name__ == '__main__':
    main()
