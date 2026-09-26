#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
REPO=ROOT.parent
JSON_PATH=REPO/'docs'/'data'/'PTU_FORMS_INVENTORY.json'
MD_PATH=REPO/'docs'/'PTU_FORMS_INVENTORY.md'

# Three Mega blocks sit at page/extraction boundaries in the packed raw_text and lose
# their Stats line. Values below are transcribed from the supplied Gen 8ish PokéDex
# pages 73, 94, and 850 respectively and are guarded by exact species/ability pairs.
PAGE_BOUNDARY_FALLBACKS={
    'swampert':{'ability_added':'Swift Swim','stat_changes':{'attack':4,'defense':2,'special_attack':1,'special_defense':2,'speed':1}},
    'beedrill':{'ability_added':'Adaptability','stat_changes':{'attack':6,'special_attack':-3,'speed':7}},
    'metagross':{'ability_added':'Tough Claws','stat_changes':{'attack':1,'defense':2,'special_attack':1,'special_defense':2,'speed':4}},
}

def norm(v):return re.sub(r'[^a-z0-9]+','-',str(v or '').lower()).strip('-')
def clean_field(value):
    text=re.sub(r'\s+',' ',str(value or '')).strip()
    for marker in (' Diet:',' Habitat:',' Basic Information',' Unofficial PTU',' <PARSED TEXT FOR PAGE:'):
        if marker in text:text=text.split(marker,1)[0].strip()
    return text or None

def repair(rows):
    for row in rows:
        row['type_change']=clean_field(row.get('type_change'))
        row['ability_added']=clean_field(row.get('ability_added'))
        key=norm(row.get('species',{}).get('name'))
        if key in PAGE_BOUNDARY_FALLBACKS and row.get('kind')=='mega':
            patch=PAGE_BOUNDARY_FALLBACKS[key]
            row['ability_added']=patch['ability_added']
            row['stat_changes']=patch['stat_changes']
            row['raw_stats_text']='source-backed page-boundary fallback'
    return rows

def main():
    data=json.loads(JSON_PATH.read_text(encoding='utf-8'))
    data['schema_version']=2
    data['mega_forms']=repair(data.get('mega_forms',[]))
    data['primal_forms']=repair(data.get('primal_forms',[]))
    mega=data['mega_forms']; primal=data['primal_forms']
    mega_species={norm(x['species']['name']) for x in mega}
    if len(mega)!=48 or len(mega_species)!=46:raise SystemExit(f'Mega coverage mismatch: {len(mega)} forms/{len(mega_species)} species')
    if len(primal)!=2 or {norm(x['species']['name']) for x in primal}!={'kyogre','groudon'}:raise SystemExit('Primal coverage mismatch')
    incomplete=[x for x in mega+primal if not x.get('ability_added') or not x.get('stat_changes')]
    if incomplete:raise SystemExit('Incomplete transformations remain: '+json.dumps([x['species']['name'] for x in incomplete]))
    dirty=[x for x in mega+primal if re.search(r'\b(?:Diet|Habitat|Basic Information|Unofficial PTU)\b',str(x.get('ability_added'))+' '+str(x.get('type_change')),re.I)]
    if dirty:raise SystemExit('Adjacent source fields leaked into transform data')
    data.setdefault('notes',[]).append('Swampert, Beedrill, and Metagross Mega stat blocks are restored from their supplied PDF pages because packed raw_text loses those lines at page boundaries.')
    JSON_PATH.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

    labels={'attack':'Atk','defense':'Def','special_attack':'Sp.Atk','special_defense':'Sp.Def','speed':'Speed','hp':'HP'}
    stats=lambda d:', '.join(f'{labels.get(k,k)} {v:+d}' for k,v in d.items())
    s=data['summary']
    lines=['# PTU Parametrized Pokémon Forms Inventory','','Generated from the project’s supplied PTU data packs. This is an audit inventory; bundled/default packs are not modified by this report.','','## Source anchors','','- **PTU Core 1.05, p.206** defines Mega Evolution as a temporary physical transformation requiring a Pokémon-held species/form-specific Mega Stone and a Trainer-worn Mega Ring. It adds an Ability, may change Type, and changes Stats while preserving HP.',f'- **Gen 8ish PokéDex pack** contains {data["sources"]["gen8ish_pack"]["species_count"]} parsed Species records and exactly **48 Mega forms across 46 Species**, plus **2 Primal Reversions**.','- Charizard X/Y and Mewtwo X/Y remain distinct Mega Forms. No missing Stone IDs or artwork URLs are invented.','','## Mega Forms','','| Species | Form | Type | Added Ability | Stat changes | Source page |','|---|---|---|---|---|---:|']
    for x in sorted(mega,key=lambda v:(v['species'].get('source_page') or 9999,v['species']['name'],v.get('form_suffix') or '')):
        form='Mega'+(f' {x["form_suffix"]}' if x.get('form_suffix') else '')
        lines.append(f'| {x["species"]["name"]} | {form} | {x.get("type_change") or "Unchanged"} | {x["ability_added"]} | {stats(x["stat_changes"])} | {x["species"].get("source_page") or "—"} |')
    lines+=['','## Primal Reversion','','| Species | Type | Added Ability | Stat changes | Source page |','|---|---|---|---|---:|']
    for x in sorted(primal,key=lambda v:v['species']['name']):lines.append(f'| {x["species"]["name"]} | {x.get("type_change") or "Unchanged"} | {x["ability_added"]} | {stats(x["stat_changes"])} | {x["species"].get("source_page") or "—"} |')
    lines+=['','## Alternate-form candidate census','',f'- Records with `variant_of`: **{s["variant_of_records"]}**',f'- Candidate records identified from structured variant metadata, regional/form naming, or form-related Capabilities: **{s["alternate_form_candidates"]}**',f'- `variant_kind` distribution: `{json.dumps(s["variant_kinds"],ensure_ascii=False)}`','','These candidates include regional forms, Forme/Mode pairs, Rotom appliances, fusion states, Crowned/Hero states, weather/battle modes, and other source-parametrized alternatives. They remain candidates until family-by-family classification decides whether each is a permanent/base Form or temporary transformation.','','## Shiny/artwork audit','',f'- Species rows with normal artwork metadata in this source pack: **{s["species_with_normal_artwork_metadata"]}**',f'- Species rows with dedicated Shiny artwork metadata in this source pack: **{s["species_with_shiny_artwork_metadata"]}**','- Absence of dedicated Shiny artwork does not prevent Shiny state; Stage D falls back to the best normal artwork.','','## Mega item audit','',f'- Core item records matching Mega-related heuristics: **{s["mega_related_core_items"]}**.','- Exact Mega Stone IDs are intentionally not fabricated. Requirements will bind only to stable source-backed item definitions; otherwise the generic Forms requirement system must expose a source-backed/manual condition.','','## Conversion gate','','Before changing bundled/default `.ptucp` files: classify all alternate candidates family-by-family, audit local artwork mappings, generate deterministic Forms, and add completeness regressions for all 48 Mega Forms + 2 Primals.']
    MD_PATH.write_text('\n'.join(lines)+'\n',encoding='utf-8')
    print(json.dumps({'mega_forms':len(mega),'mega_species':len(mega_species),'primal_forms':len(primal),'alternate_candidates':s['alternate_form_candidates'],'shiny_metadata_rows':s['species_with_shiny_artwork_metadata']},sort_keys=True))

if __name__=='__main__':main()
