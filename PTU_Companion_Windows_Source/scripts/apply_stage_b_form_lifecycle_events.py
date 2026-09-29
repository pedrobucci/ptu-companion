#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
TARGETS = [
    ROOT / 'server.mjs',
    REPO / 'PTU_Companion_Android_Tauri' / 'www' / 'mobile-api.mjs',
]
EVENT_MODULES = [
    ROOT / 'rules' / 'pokemon-form-events.mjs',
    REPO / 'PTU_Companion_Android_Tauri' / 'www' / 'rules' / 'pokemon-form-events.mjs',
]

IMPORT_ANCHOR = "import {normalizePokemonFormState,resolvePokemonForms,resolvePokemonPresentation} from './rules/pokemon-forms.mjs';"
EVENT_IMPORT = "import {applyPokemonFormTransitionEvent} from './rules/pokemon-form-events.mjs';"
ROUTE_ANCHOR = "  if(req.method==='POST' && url.pathname==='/api/pokemon/forms/resolve'){"
ROUTE = r"""  if(req.method==='POST' && url.pathname==='/api/pokemon/forms/transition'){
    const payload=await bodyJson(req);
    const rulesetId=String(payload.rulesetId||getActiveRuleset());
    if(!definitions.getRuleset(rulesetId)) throw Object.assign(new Error('Unknown ruleset'),{status:400});
    const pokemon=payload.pokemon||{}; const details=pokemon.details||{};
    const speciesId=String(payload.speciesId||details.speciesDefinitionId||'');
    const baseSpecies=definitions.getResolved({rulesetId,kind:'species',id:speciesId});
    if(!baseSpecies)return json(res,404,{error:'Species definition not found in active ruleset'});
    const requested=payload.formState||details.formState||{baseFormId:payload.baseFormId,activeFormId:payload.activeFormId};
    const result=applyPokemonFormTransitionEvent({
      species:baseSpecies,
      formState:requested,
      context:pokemonFormContext({pokemon,payload}),
      event:payload.event||{},
      allowUnmet:!!payload.gmOverride
    });
    return json(res,result.valid?200:400,{rulesetId,baseSpecies:{id:baseSpecies.id,name:baseSpecies.name,forms:baseSpecies.forms||[]},...result});
  }
"""
OLD_CONTEXT = """    previousBaseFormId:context?.previousBaseFormId??state.baseFormId,
    previousActiveFormId:context?.previousActiveFormId??state.activeFormId,"""
NEW_CONTEXT = """    previousBaseFormId:context?.previousBaseFormId!==undefined?context.previousBaseFormId:state.baseFormId,
    previousActiveFormId:context&&Object.prototype.hasOwnProperty.call(context,'previousActiveFormId')?context.previousActiveFormId:state.activeFormId,"""


def patch_api(path: Path) -> bool:
    text = path.read_text(encoding='utf-8')
    original = text
    if EVENT_IMPORT not in text:
        if IMPORT_ANCHOR not in text:
            raise SystemExit(f'Pokemon Forms import anchor missing in {path}')
        text = text.replace(IMPORT_ANCHOR, IMPORT_ANCHOR + '\n' + EVENT_IMPORT, 1)
    if "/api/pokemon/forms/transition" not in text:
        if ROUTE_ANCHOR not in text:
            raise SystemExit(f'Pokemon Forms resolve route anchor missing in {path}')
        text = text.replace(ROUTE_ANCHOR, ROUTE + '\n' + ROUTE_ANCHOR, 1)
    if text != original:
        path.write_text(text, encoding='utf-8')
        return True
    return False


def patch_event_module(path: Path) -> bool:
    text = path.read_text(encoding='utf-8')
    original = text
    if OLD_CONTEXT in text:
        text = text.replace(OLD_CONTEXT, NEW_CONTEXT, 1)
    elif NEW_CONTEXT not in text:
        raise SystemExit(f'Form event previous-state anchor missing in {path}')
    if text != original:
        path.write_text(text, encoding='utf-8')
        return True
    return False


def main() -> None:
    changed = []
    for target in TARGETS:
        if patch_api(target):
            changed.append(str(target.relative_to(REPO)))
    for target in EVENT_MODULES:
        if patch_event_module(target):
            changed.append(str(target.relative_to(REPO)))
    print({'changed': changed, 'api_targets': len(TARGETS), 'event_modules': len(EVENT_MODULES)})


if __name__ == '__main__':
    main()
