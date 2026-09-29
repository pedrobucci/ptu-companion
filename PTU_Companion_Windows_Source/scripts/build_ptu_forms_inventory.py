#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
POKEDEX_PACK = ROOT / 'seed' / 'content-packs' / 'ptu-gen8ish-pokedex.ptucp'
CORE_PACK = ROOT / 'seed' / 'content-packs' / 'ptu-core-1.05.ptucp'
OUT_JSON = REPO / 'docs' / 'data' / 'PTU_FORMS_INVENTORY.json'
OUT_MD = REPO / 'docs' / 'PTU_FORMS_INVENTORY.md'

# PTU 1.05 Core p.206: species explicitly named as having Mega-evolved entries.
CORE_MEGA_SPECIES = [
    'Venusaur','Charizard','Blastoise','Beedrill','Pidgeot','Alakazam','Slowbro','Gengar','Kangaskhan','Pinsir',
    'Gyarados','Aerodactyl','Mewtwo','Ampharos','Steelix','Scizor','Heracross','Houndoom','Tyranitar','Sceptile',
    'Blaziken','Swampert','Gardevoir','Sableye','Mawile','Aggron','Medicham','Manectric','Sharpedo','Camerupt',
    'Altaria','Banette','Absol','Glalie','Salamence','Metagross','Latias','Latios','Kyogre','Groudon','Rayquaza',
    'Lopunny','Gallade','Garchomp','Lucario','Abomasnow','Audino','Diancie'
]
PRIMAL_SPECIES = {'Kyogre','Groudon'}
MEGA_SPECIES = [name for name in CORE_MEGA_SPECIES if name not in PRIMAL_SPECIES]

REGIONAL_TOKENS = ('alola','galar','hisui','paldea')
ALT_TOKENS = ('forme','form','mode','schooling','solo','core','meteor','confined','unbound','crowned','hero-of-many-battles','dawn-wings','dusk-mane','therian','incarnate','fusion')
ART_KEYS = {'artwork','artwork_url','image','image_url','portrait','portrait_url','portrait_data_url'}
SHINY_KEYS = {'shiny','shiny_url','shiny_artwork','shiny_artwork_url','artwork_shiny_url','shiny_portrait_data_url','shiny_image_url'}
STAT_MAP = {
    'atk':'attack','attack':'attack','def':'defense','defense':'defense','sp atk':'special_attack','sp. atk':'special_attack',
    'special attack':'special_attack','sp def':'special_defense','sp. def':'special_defense','special defense':'special_defense',
    'speed':'speed','hp':'hp'
}

def norm(value: object) -> str:
    return re.sub(r'[^a-z0-9]+','-',str(value or '').lower()).strip('-')

def clean_text(value: object) -> str:
    return re.sub(r'\s+',' ',str(value or '')).strip()

def load_ndjson(pack: Path, suffix: str) -> tuple[str,list[dict]]:
    with zipfile.ZipFile(pack) as z:
        path = next((n for n in z.namelist() if n.endswith(suffix)), None)
        if not path:
            return '', []
        rows = [json.loads(line) for line in z.read(path).decode('utf-8').splitlines() if line.strip()]
        return path, rows

def parse_stats(text: str) -> dict[str,int]:
    out: dict[str,int] = {}
    for amount,label in re.findall(r'([+-]\d+)\s*(HP|Atk|Attack|Def|Defense|Sp\.?\s*Atk|Special Attack|Sp\.?\s*Def|Special Defense|Speed)', text, flags=re.I):
        key = STAT_MAP.get(clean_text(label).lower())
        if key:
            out[key] = int(amount)
    return out

def parse_transform_blocks(row: dict) -> list[dict]:
    text = str(row.get('raw_text') or '')
    if not text:
        return []
    markers = list(re.finditer(r'(?im)^\s*(Mega Evolution(?:\s+[XY])?|Primal Reversion)\s*$', text))
    blocks=[]
    for i,match in enumerate(markers):
        block = text[match.end(): markers[i+1].start() if i+1 < len(markers) else len(text)]
        type_m = re.search(r'(?is)Type:\s*(.*?)\s*Ability:', block)
        ability_m = re.search(r'(?is)Ability:\s*(.*?)\s*Stats:', block)
        stats_m = re.search(r'(?is)Stats:\s*(.*)', block)
        label = clean_text(match.group(1))
        kind = 'primal' if label.lower().startswith('primal') else 'mega'
        suffix = None
        if kind == 'mega':
            sm = re.search(r'\b([XY])$', label, flags=re.I)
            suffix = sm.group(1).upper() if sm else None
        type_text = clean_text(type_m.group(1) if type_m else '')
        ability_text = clean_text(ability_m.group(1) if ability_m else '')
        stats_text = clean_text(stats_m.group(1) if stats_m else '')
        blocks.append({
            'kind': kind,
            'label': label,
            'form_suffix': suffix,
            'type_change': None if type_text.lower() == 'unchanged' else type_text,
            'ability_added': ability_text or None,
            'stat_changes': parse_stats(stats_text),
            'raw_stats_text': stats_text,
        })
    return blocks

def recursive_hits(value: object, wanted: set[str], prefix='') -> list[dict]:
    hits=[]
    if isinstance(value,dict):
        for key,val in value.items():
            path=f'{prefix}.{key}' if prefix else key
            if key.lower() in wanted and val not in (None,'',[],{}):
                hits.append({'path':path,'value':val})
            hits.extend(recursive_hits(val,wanted,path))
    elif isinstance(value,list):
        for i,val in enumerate(value):
            hits.extend(recursive_hits(val,wanted,f'{prefix}[{i}]'))
    return hits

def row_summary(row: dict) -> dict:
    return {
        'id': row.get('logical_id') or row.get('id'),
        'name': row.get('display_name') or row.get('name'),
        'dex_number': row.get('dex_number'),
        'variant_kind': row.get('variant_kind'),
        'variant_of': row.get('variant_of'),
        'types': row.get('types'),
        'base_stats': row.get('base_stats'),
        'abilities': row.get('ability_slots'),
        'capabilities': row.get('capabilities'),
        'level_up_moves': row.get('level_up_moves'),
        'tm_moves': row.get('tm_moves'),
        'tutor_moves': row.get('tutor_moves'),
        'egg_moves': row.get('egg_moves'),
        'source_id': row.get('source_id'),
        'source_page': row.get('source_page'),
    }

def candidate_reason(row: dict) -> list[str]:
    ident=norm(row.get('logical_id') or row.get('id'))
    name=norm(row.get('display_name') or row.get('name'))
    reasons=[]
    if row.get('variant_kind'): reasons.append(f'variant_kind:{row.get("variant_kind")}')
    if row.get('variant_of'): reasons.append(f'variant_of:{row.get("variant_of")}')
    if any(tok in ident or tok in name for tok in REGIONAL_TOKENS): reasons.append('regional_name')
    if any(tok in ident for tok in ALT_TOKENS): reasons.append('alternate_form_name')
    caps=row.get('capabilities') or []
    cap_names={norm(c.get('name')) for c in caps if isinstance(c,dict)}
    if 'forme-change' in cap_names: reasons.append('capability:forme-change')
    if any(x in cap_names for x in ('therian-forme','origin-forme','sky-forme','zygarde-cells','viral-fusion','dragon-fusion')):
        reasons.append('capability:form-specific')
    return reasons

def main() -> None:
    species_path, species = load_ndjson(POKEDEX_PACK, 'species.ndjson')
    _, core_items = load_ndjson(CORE_PACK, 'items.ndjson')
    if not species:
        raise SystemExit('No species definitions found in Gen8ish pack.')

    by_name={norm(r.get('display_name') or r.get('name')):r for r in species}
    transforms=[]
    for row in species:
        for block in parse_transform_blocks(row):
            transforms.append({**block, 'species':row_summary(row)})

    mega=[x for x in transforms if x['kind']=='mega']
    primal=[x for x in transforms if x['kind']=='primal']
    mega_species={norm(x['species']['name']) for x in mega}
    expected_mega={norm(x) for x in MEGA_SPECIES}
    missing=sorted(expected_mega-mega_species)
    unexpected=sorted(mega_species-expected_mega)

    candidates=[]
    for row in species:
        reasons=candidate_reason(row)
        if reasons:
            candidates.append({**row_summary(row),'reasons':reasons,
                'artwork_hits':recursive_hits(row,ART_KEYS),
                'shiny_artwork_hits':recursive_hits(row,SHINY_KEYS)})

    variant_kinds=Counter(str(r.get('variant_kind')) for r in species if r.get('variant_kind'))
    variant_of_count=sum(1 for r in species if r.get('variant_of'))
    shiny_rows=[]
    normal_art_rows=[]
    for row in species:
        shiny=recursive_hits(row,SHINY_KEYS)
        art=recursive_hits(row,ART_KEYS)
        if shiny: shiny_rows.append({'id':row.get('logical_id') or row.get('id'),'name':row.get('display_name') or row.get('name'),'hits':shiny})
        if art: normal_art_rows.append({'id':row.get('logical_id') or row.get('id'),'name':row.get('display_name') or row.get('name'),'hits':art})

    mega_items=[]
    for item in core_items:
        text=' '.join(str(item.get(k) or '') for k in ('logical_id','id','name','display_name','description','effect','raw_text'))
        if re.search(r'\bmega\b|mega stone|mega ring|\w+ite\b',text,re.I):
            mega_items.append({
                'id':item.get('logical_id') or item.get('id'),
                'name':item.get('display_name') or item.get('name'),
                'source_page':item.get('source_page'),
                'description':item.get('description') or item.get('effect')
            })

    # Assertions anchor the inventory to the supplied PTU sources rather than guesses.
    if len(MEGA_SPECIES) != 46:
        raise SystemExit(f'Curated PTU Core Mega species list drifted: expected 46, got {len(MEGA_SPECIES)}')
    if len(mega) != 48:
        raise SystemExit(f'Expected 48 Mega form blocks in Gen8ish source, got {len(mega)}')
    if len(mega_species) != 46 or missing or unexpected:
        raise SystemExit(f'Mega source coverage mismatch: species={len(mega_species)} missing={missing} unexpected={unexpected}')
    if len(primal) != 2 or {norm(x['species']['name']) for x in primal} != {'kyogre','groudon'}:
        raise SystemExit(f'Expected Kyogre/Groudon Primal blocks, got {[x["species"]["name"] for x in primal]}')

    payload={
        'schema_version':1,
        'sources':{
            'ptu_core':{'reference':'Pokemon Tabletop United 1.05 Core','mega_rules_page':206,'mega_species':CORE_MEGA_SPECIES},
            'gen8ish_pack':{'file':str(POKEDEX_PACK.relative_to(REPO)),'species_path':species_path,'species_count':len(species)},
            'core_pack':{'file':str(CORE_PACK.relative_to(REPO)),'item_count':len(core_items)}
        },
        'summary':{
            'mega_forms':len(mega),'mega_species':len(mega_species),'primal_forms':len(primal),
            'alternate_form_candidates':len(candidates),'variant_of_records':variant_of_count,
            'variant_kinds':dict(sorted(variant_kinds.items())),
            'species_with_normal_artwork_metadata':len(normal_art_rows),
            'species_with_shiny_artwork_metadata':len(shiny_rows),
            'mega_related_core_items':len(mega_items)
        },
        'mega_forms':mega,
        'primal_forms':primal,
        'alternate_form_candidates':candidates,
        'artwork':{'normal_metadata':normal_art_rows,'shiny_metadata':shiny_rows},
        'mega_related_core_items':mega_items,
        'notes':[
            'Mega forms are temporary transformations, not permanent Species replacements.',
            'PTU Core requires a species/form-specific Mega Stone and a Trainer Mega Ring; exact item IDs are not inferred when the supplied item data does not provide them.',
            'Shiny is an individual presentation state. Missing dedicated Shiny artwork must not disable Shiny state.',
            'Alternate-form candidates are inventory data only; conversion to permanent vs transformation form requires family-by-family review.'
        ]
    }

    OUT_JSON.parent.mkdir(parents=True,exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

    lines=[
        '# PTU Parametrized Pokémon Forms Inventory', '',
        'Generated from the project’s supplied PTU data packs. This is an audit inventory, not yet the final pack conversion.', '',
        '## Source anchors', '',
        '- **PTU Core 1.05, p.206** defines Mega Evolution as a temporary physical transformation requiring a Pokémon-held species/form-specific Mega Stone and a Trainer-worn Mega Ring. It adds an Ability, may change Type, and changes Stats while preserving HP.',
        f'- **Gen 8ish PokéDex pack** contains {len(species)} parsed Species records and exactly **{len(mega)} Mega form blocks across {len(mega_species)} Species**, plus **{len(primal)} Primal Reversion blocks**.',
        '- Mega/Primal mechanics below are extracted from the parameterized Pokédex source blocks; no absent Stone IDs or artwork URLs are invented.', '',
        '## Mega Forms', '',
        '| Species | Form | Type | Added Ability | Stat changes | Source page |',
        '|---|---|---|---|---|---:|'
    ]
    def stat_text(changes):
        labels={'attack':'Atk','defense':'Def','special_attack':'Sp.Atk','special_defense':'Sp.Def','speed':'Speed','hp':'HP'}
        return ', '.join(f'{labels.get(k,k)} {v:+d}' for k,v in changes.items()) or '—'
    for row in sorted(mega,key=lambda x:(x['species']['source_page'] or 9999,x['species']['name'],x.get('form_suffix') or '')):
        form='Mega'+(f' {row["form_suffix"]}' if row.get('form_suffix') else '')
        lines.append(f'| {row["species"]["name"]} | {form} | {row["type_change"] or "Unchanged"} | {row["ability_added"] or "—"} | {stat_text(row["stat_changes"])} | {row["species"]["source_page"] or "—"} |')
    lines += ['', '## Primal Reversion', '', '| Species | Type | Added Ability | Stat changes | Source page |','|---|---|---|---|---:|']
    for row in sorted(primal,key=lambda x:x['species']['name']):
        lines.append(f'| {row["species"]["name"]} | {row["type_change"] or "Unchanged"} | {row["ability_added"] or "—"} | {stat_text(row["stat_changes"])} | {row["species"]["source_page"] or "—"} |')
    lines += ['', '## Alternate-form candidate census', '',
        f'- Records with `variant_of`: **{variant_of_count}**',
        f'- Candidate records identified from structured variant metadata, regional/form naming, or form-related capabilities: **{len(candidates)}**',
        f'- `variant_kind` distribution: `{json.dumps(dict(sorted(variant_kinds.items())),ensure_ascii=False)}`', '',
        'These candidates include regional forms, Forme/Mode pairs, Rotom appliances, fusion states, Crowned/Hero states, weather/battle modes, and other source-parametrized alternatives. They remain candidates until family-by-family classification decides whether each is a permanent/base Form or temporary transformation.', '',
        '## Shiny/artwork audit', '',
        f'- Species rows with normal artwork metadata in this source pack: **{len(normal_art_rows)}**',
        f'- Species rows with dedicated Shiny artwork metadata in this source pack: **{len(shiny_rows)}**',
        '- Absence of dedicated Shiny artwork does not prevent a Pokémon from being Shiny; Stage D falls back to the best normal artwork.', '',
        '## Mega item audit', '',
        f'- Core item records matching Mega-related text/name heuristics: **{len(mega_items)}**.',
        '- Exact Mega Stone IDs are intentionally not fabricated. The conversion phase should bind a held-item requirement only where a supplied item definition supports a stable ID; otherwise it should use an explicit source-backed/manual requirement.', '',
        '## Next conversion pass', '',
        '1. Convert all 48 Mega blocks into `mode: transformation` Forms on their base Species, preserving X/Y separately.',
        '2. Convert Kyogre/Groudon Primal Reversion into transformation Forms.',
        '3. Classify every alternate-form candidate family as permanent/base Form vs transformation using its PTU source mechanics.',
        '4. Reconcile regional forms already represented as separate Species records into the generic Form layer without breaking existing IDs/imports.',
        '5. Add Shiny artwork metadata only where an actual supplied asset/URL exists; otherwise keep the Stage D fallback.',
        '6. Generate deterministic `.ptucp` defaults for Windows and Android and add completeness regressions before changing the bundled packs.'
    ]
    OUT_MD.write_text('\n'.join(lines)+'\n',encoding='utf-8')
    print(json.dumps(payload['summary'],ensure_ascii=False,sort_keys=True))
    print(f'Wrote {OUT_JSON.relative_to(REPO)} and {OUT_MD.relative_to(REPO)}')

if __name__ == '__main__':
    main()
