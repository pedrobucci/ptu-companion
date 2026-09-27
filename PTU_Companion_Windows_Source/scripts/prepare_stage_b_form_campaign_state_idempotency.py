#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

TARGET = Path(__file__).resolve().parent / 'apply_stage_b_form_campaign_state.py'

OLD = '''    old_scene = "function endScene(){ state.ui.scene+=1; state.ui.round=1; state.pokemon.forEach(p=>Object.keys(p.combatStages).forEach(k=>p.combatStages[k]=0)); commit(`Scene ${state.ui.scene}. Combat stages reset.`); }"
    new_scene = "async function endScene(){ state.ui.scene+=1; state.ui.round=1; for(const p of state.pokemon){Object.keys(p.combatStages).forEach(k=>p.combatStages[k]=0);if(p?.details?.speciesDefinitionId)await applyPokemonFormGameEventUi(p.id,{kind:'scene-end'},{silent:true,commitAfter:false});} commit(`Scene ${state.ui.scene}. Combat stages reset; Form scene-end hooks applied.`); }"
    if new_scene not in text:
        if old_scene not in text: raise SystemExit(f'endScene anchor drifted: {path}')
        text = text.replace(old_scene, new_scene, 1)
'''

NEW = '''    old_scene = "function endScene(){ state.ui.scene+=1; state.ui.round=1; state.pokemon.forEach(p=>Object.keys(p.combatStages).forEach(k=>p.combatStages[k]=0)); commit(`Scene ${state.ui.scene}. Combat stages reset.`); }"
    new_scene = "async function endScene(){ state.ui.scene+=1; state.ui.round=1; for(const p of state.pokemon){Object.keys(p.combatStages).forEach(k=>p.combatStages[k]=0);if(p?.details?.speciesDefinitionId)await applyPokemonFormGameEventUi(p.id,{kind:'scene-end'},{silent:true,commitAfter:false});} commit(`Scene ${state.ui.scene}. Combat stages reset; Form scene-end hooks applied.`); }"
    combat_scene = "async function endScene(){ state.ui.scene+=1; state.ui.round=1; for(const p of state.pokemon){Object.keys(p.combatStages).forEach(k=>p.combatStages[k]=0);if(p?.details?.speciesDefinitionId)await applyPokemonFormGameEventUi(p.id,{kind:'scene-end'},{silent:true,commitAfter:false});} pokemonCombatOnSceneAdvance(); commit(`Scene ${state.ui.scene}. Combat stages reset; Form scene-end hooks applied.`); }"
    if new_scene not in text and combat_scene not in text:
        if old_scene not in text: raise SystemExit(f'endScene anchor drifted: {path}')
        text = text.replace(old_scene, new_scene, 1)
'''


def main() -> None:
    text = TARGET.read_text(encoding='utf-8')
    if NEW in text:
        print('campaign-state patch already accepts Combat-enhanced endScene')
        return
    if OLD not in text:
        raise SystemExit('campaign-state endScene idempotency anchor drifted')
    TARGET.write_text(text.replace(OLD, NEW, 1), encoding='utf-8')
    print('campaign-state patch updated to accept Combat-enhanced endScene')


if __name__ == '__main__':
    main()
