#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import zipfile
from collections import Counter
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
REPO=ROOT.parent
POKEDEX_PACK=ROOT/'seed'/'content-packs'/'ptu-gen8ish-pokedex.ptucp'
CORE_PACK=ROOT/'seed'/'content-packs'/'ptu-core-1.05.ptucp'
OUT_JSON=REPO/'docs'/'data'/'PTU_FORMS_INVENTORY.json'
OUT_MD=REPO/'docs'/'PTU_FORMS_INVENTORY.md'

CORE_LIST=['Venusaur','Charizard','Blastoise','Beedrill','Pidgeot','Alakazam','Slowbro','Gengar','Kangaskhan','Pinsir','Gyarados','Aerodactyl','Mewtwo','Ampharos','Steelix','Scizor','Heracross','Houndoom','Tyranitar','Sceptile','Blaziken','Swampert','Gardevoir','Sableye','Mawile','Aggron','Medicham','Manectric','Sharpedo','Camerupt','Altaria','Banette','Absol','Glalie','Salamence','Metagross','Latias','Latios','Kyogre','Groudon','Rayquaza','Lopunny','Gallade','Garchomp','Lucario','Abomasnow','Audino','Diancie']
PRIMALS={'Kyogre','Groudon'}
MEGA_SPECIES=[x for x in CORE_LIST if x not in PRIMALS]
REGIONAL=('alola','galar','hisui','paldea')
ALT=('forme','form','mode','schooling','solo','core','meteor','confined','unbound','crowned','hero-of-many-battles','dawn-wings','dusk-mane','therian','incarnate','fusion')
ART_KEYS={'artwork','artwork_url','image','image_url','portrait','portrait_url','portrait_data_url'}
SHINY_KEYS={'shiny','shiny_url','shiny_artwork','shiny_artwork_url','artwork_shiny_url','shiny_portrait_data_url','shiny_image_url'}
STAT_ALIASES={'atk':'attack','attack':'attack','def':'defense','defense':'defense','sp atk':'special_attack','sp. atk':'special_attack','special attack':'special_attack','sp def':'special_defense','sp. def':'special_defense','special defense':'special_defense','speed':'speed','hp':'hp'}
STOP_PREFIXES=('basic information','base stats','evolution:','size information','breeding information','capability list','skill list','move list','level up move list','tm move list','tutor move list','egg move list','diet:','habitat:','<parsed text for page:')

def norm(v): return re.sub(r'[^a-z0-9]+','-',str(v or '').lower()).strip('-')
def clean(v): return re.sub(r'\s+',' ',str(v or '')).strip()

def load(pack,suffix):
    with zipfile.ZipFile(pack) as z:
        path=next((n for n in z.namelist() if n.endswith(suffix)),None)
        if not path:return '',[]
        return path,[json.loads(x) for x in z.read(path).decode('utf-8').splitlines() if x.strip()]

def hits(value,wanted,prefix=''):
    out=[]
    if isinstance(value,dict):
        for k,v in value.items():
            p=f'{prefix}.{k}' if prefix else k
            if k.lower() in wanted and v not in (None,'',[],{}):out.append({'path':p,'value':v})
            out.extend(hits(v,wanted,p))
    elif isinstance(value,list):
        for i,v in enumerate(value):out.extend(hits(v,wanted,f'{prefix}[{i}]'))
    return out

def summary(r,include_moves=True):
    out={'id':r.get('logical_id') or r.get('id'),'name':r.get('display_name') or r.get('name'),'dex_number':r.get('dex_number'),'variant_kind':r.get('variant_kind'),'variant_of':r.get('variant_of'),'types':r.get('types'),'base_stats':r.get('base_stats'),'abilities':r.get('ability_slots'),'capabilities':r.get('capabilities'),'source_id':r.get('source_id'),'source_page':r.get('source_page')}
    if include_moves:out.update({'level_up_moves':r.get('level_up_moves'),'tm_moves':r.get('tm_moves'),'tutor_moves':r.get('tutor_moves'),'egg_moves':r.get('egg_moves')})
    return out

def parse_stats(text):
    text=clean(text).replace('Sp .','Sp.').replace('Sp. ','Sp. ')
    out={}
    rx=r'([+-]\s*\d+)\s*(HP|Atk|Attack|Def|Defense|Sp\.?\s*Atk|Special\s+Attack|Sp\.?\s*Def|Special\s+Defense|Speed)'
    for amount,label in re.findall(rx,text,re.I):
        key=STAT_ALIASES.get(clean(label).lower())
        if key:out[key]=int(amount.replace(' ',''))
    return out

def field_from_lines(lines,start,prefix,next_prefixes):
    value=[]
    first=lines[start]
    value.append(first.split(':',1)[1].strip() if ':' in first else '')
    for line in lines[start+1:start+6]:
        low=clean(line).lower()
        if any(low.startswith(p) for p in next_prefixes) or any(low.startswith(p) for p in STOP_PREFIXES):break
        if not low:continue
        value.append(clean(line))
    return clean(' '.join(value))

def parse_transform_blocks(row):
    lines=str(row.get('raw_text') or '').replace('\r','').split('\n')
    blocks=[]
    for i,line in enumerate(lines):
        m=re.fullmatch(r'\s*(Mega Evolution(?:\s+[XY])?|Primal Reversion)\s*',line,re.I)
        if not m:continue
        label=clean(m.group(1)); kind='primal' if label.lower().startswith('primal') else 'mega'; suffix=None
        if kind=='mega':
            sm=re.search(r'\b([XY])$',label,re.I); suffix=sm.group(1).upper() if sm else None
        window=lines[i+1:i+20]
        type_text=''; ability_text=''; stats_text=''
        for j,w in enumerate(window):
            low=clean(w).lower()
            if low.startswith('type:') and not type_text:type_text=field_from_lines(window,j,'type:',('ability:','stats:'))
            elif low.startswith('ability:') and not ability_text:ability_text=field_from_lines(window,j,'ability:',('stats:','type:'))
            elif low.startswith('stats:') and not stats_text:
                chunks=[w.split(':',1)[1].strip()]
                for cont in window[j+1:j+6]:
                    c=clean(cont); cl=c.lower()
                    if any(cl.startswith(p) for p in STOP_PREFIXES) or cl.startswith(('type:','ability:','mega evolution','primal reversion')):break
                    if not c:continue
                    if re.search(r'[+-]\s*\d+|^(?:atk|def|sp\.?\s*(?:atk|def)|speed|hp)\b',c,re.I):chunks.append(c)
                    else:break
                stats_text=clean(' '.join(chunks))
        # Defensive cleanup for page-extraction bleed.
        for token in (' Diet:',' Habitat:',' Basic Information',' <PARSED TEXT FOR PAGE:'):
            if token in type_text:type_text=type_text.split(token,1)[0].strip()
            if token in ability_text:ability_text=ability_text.split(token,1)[0].strip()
        blocks.append({'kind':kind,'label':label,'form_suffix':suffix,'type_change':None if type_text.lower()=='unchanged' else (type_text or None),'ability_added':ability_text or None,'stat_changes':parse_stats(stats_text),'raw_stats_text':stats_text})
    return blocks

def reasons(r):
    ident=norm(r.get('logical_id') or r.get('id')); name=norm(r.get('display_name') or r.get('name')); out=[]
    if r.get('variant_kind'):out.append(f'variant_kind:{r.get("variant_kind")}')
    if r.get('variant_of'):out.append(f'variant_of:{r.get("variant_of")}')
    if any(t in ident or t in name for t in REGIONAL):out.append('regional_name')
    if any(t in ident for t in ALT):out.append('alternate_form_name')
    caps=r.get('capabilities') or []; names={norm(c.get('name')) for c in caps if isinstance(c,dict)}
    if 'forme-change' in names:out.append('capability:forme-change')
    if names & {'therian-forme','origin-forme','sky-forme','zygarde-cells','viral-fusion','dragon-fusion'}:out.append('capability:form-specific')
    return out

def main():
    species_path,species=load(POKEDEX_PACK,'species.ndjson'); _,items=load(CORE_PACK,'items.ndjson')
    transforms=[]
    for r in species:
        transforms.extend({**b,'species':summary(r)} for b in parse_transform_blocks(r))
    mega=[x for x in transforms if x['kind']=='mega']; primal=[x for x in transforms if x['kind']=='primal']
    mega_names={norm(x['species']['name']) for x in mega}; expected={norm(x) for x in MEGA_SPECIES}
    if len(MEGA_SPECIES)!=46 or len(mega)!=48 or len(mega_names)!=46 or mega_names!=expected:raise SystemExit(f'Mega coverage failed forms={len(mega)} species={len(mega_names)} missing={sorted(expected-mega_names)} extra={sorted(mega_names-expected)}')
    if len(primal)!=2 or {norm(x['species']['name']) for x in primal}!={'kyogre','groudon'}:raise SystemExit('Primal coverage failed')
    incomplete=[x for x in mega+primal if not x['ability_added'] or not x['stat_changes']]
    if incomplete:raise SystemExit('Incomplete transform parsing: '+json.dumps([{'species':x['species']['name'],'label':x['label'],'ability':x['ability_added'],'stats':x['stat_changes'],'raw':x['raw_stats_text']} for x in incomplete],ensure_ascii=False))
    dirty=[x for x in mega+primal if re.search(r'\b(?:Diet|Habitat|Basic Information)\b',str(x['ability_added'])+' '+str(x['type_change']),re.I)]
    if dirty:raise SystemExit('Transform parsing leaked adjacent fields: '+json.dumps(dirty,ensure_ascii=False))

    candidates=[]; normal=[]; shiny=[]
    for r in species:
        rs=reasons(r); ah=hits(r,ART_KEYS); sh=hits(r,SHINY_KEYS)
        if rs:candidates.append({**summary(r),'reasons':rs,'artwork_hits':ah,'shiny_artwork_hits':sh})
        if ah:normal.append({'id':r.get('logical_id') or r.get('id'),'name':r.get('display_name') or r.get('name'),'hits':ah})
        if sh:shiny.append({'id':r.get('logical_id') or r.get('id'),'name':r.get('display_name') or r.get('name'),'hits':sh})
    vk=Counter(str(r.get('variant_kind')) for r in species if r.get('variant_kind')); vo=sum(bool(r.get('variant_of')) for r in species)
    mega_items=[]
    for it in items:
        text=' '.join(str(it.get(k) or '') for k in ('logical_id','id','name','display_name','description','effect','raw_text'))
        if re.search(r'\bmega\b|mega stone|mega ring|\w+ite\b',text,re.I):mega_items.append({'id':it.get('logical_id') or it.get('id'),'name':it.get('display_name') or it.get('name'),'source_page':it.get('source_page'),'description':it.get('description') or it.get('effect')})
    payload={'schema_version':2,'sources':{'ptu_core':{'reference':'Pokemon Tabletop United 1.05 Core','mega_rules_page':206,'listed_species':CORE_LIST},'gen8ish_pack':{'file':str(POKEDEX_PACK.relative_to(REPO)),'species_path':species_path,'species_count':len(species)},'core_pack':{'file':str(CORE_PACK.relative_to(REPO)),'item_count':len(items)}},'summary':{'mega_forms':len(mega),'mega_species':len(mega_names),'primal_forms':len(primal),'alternate_form_candidates':len(candidates),'variant_of_records':vo,'variant_kinds':dict(sorted(vk.items())),'species_with_normal_artwork_metadata':len(normal),'species_with_shiny_artwork_metadata':len(shiny),'mega_related_core_items':len(mega_items)},'mega_forms':mega,'primal_forms':primal,'alternate_form_candidates':candidates,'artwork':{'normal_metadata':normal,'shiny_metadata':shiny},'mega_related_core_items':mega_items,'notes':['Mega forms are temporary transformations, not permanent Species replacements.','PTU Core requires a species/form-specific Mega Stone and a Trainer Mega Ring; exact item IDs are not inferred when supplied item data does not provide them.','Shiny is an individual presentation state; missing dedicated Shiny artwork does not disable Shiny state.','Alternate-form candidates remain unconverted until family-by-family classification.']}
    OUT_JSON.parent.mkdir(parents=True,exist_ok=True); OUT_JSON.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

    labels={'attack':'Atk','defense':'Def','special_attack':'Sp.Atk','special_defense':'Sp.Def','speed':'Speed','hp':'HP'}
    st=lambda d:', '.join(f'{labels.get(k,k)} {v:+d}' for k,v in d.items())
    md=['# PTU Parametrized Pokémon Forms Inventory','','Generated from supplied PTU data. Audit inventory only; default packs are not modified by this report.','','## Source anchors','','- **PTU Core 1.05, p.206** defines Mega Evolution as a temporary physical transformation requiring a species/form-specific Mega Stone held by the Pokémon and a Mega Ring worn by its Trainer. It adds an Ability, may change Type, and changes Stats while preserving HP.',f'- **Gen 8ish PokéDex pack** contains {len(species)} Species records, **48 Mega forms across 46 Species**, and **2 Primal Reversions**.','- X/Y Mega variants are distinct records. No missing item IDs or artwork URLs are invented.','','## Mega Forms','','| Species | Form | Type | Added Ability | Stat changes | Page |','|---|---|---|---|---|---:|']
    for x in sorted(mega,key=lambda x:(x['species']['source_page'] or 9999,x['species']['name'],x.get('form_suffix') or '')):
        form='Mega'+(f' {x["form_suffix"]}' if x.get('form_suffix') else '')
        md.append(f'| {x["species"]["name"]} | {form} | {x["type_change"] or "Unchanged"} | {x["ability_added"]} | {st(x["stat_changes"])} | {x["species"]["source_page"] or "—"} |')
    md+=['','## Primal Reversion','','| Species | Type | Added Ability | Stat changes | Page |','|---|---|---|---|---:|']
    for x in sorted(primal,key=lambda x:x['species']['name']):md.append(f'| {x["species"]["name"]} | {x["type_change"] or "Unchanged"} | {x["ability_added"]} | {st(x["stat_changes"])} | {x["species"]["source_page"] or "—"} |')
    md+=['','## Alternate-form candidate census','',f'- `variant_of` records: **{vo}**',f'- Candidates from structured metadata, regional/form naming, or form-related Capabilities: **{len(candidates)}**',f'- `variant_kind`: `{json.dumps(dict(sorted(vk.items())),ensure_ascii=False)}`','','Candidates include regional forms, Forme/Mode pairs, Rotom appliances, fusion states, Crowned/Hero states, weather/battle modes, and other parameterized alternatives. Each still needs family-level classification as permanent/base Form or temporary transformation.','','## Shiny/artwork audit','',f'- Species rows with normal artwork metadata in this pack: **{len(normal)}**',f'- Species rows with dedicated Shiny artwork metadata in this pack: **{len(shiny)}**','- Shiny remains valid without dedicated art because Stage D falls back to normal artwork.','','## Mega item audit','',f'- Core item records matching Mega-related heuristics: **{len(mega_items)}**.','- Exact Mega Stone IDs will only be bound when a stable source-backed item definition exists.','','## Conversion gate','','Before changing bundled/default `.ptucp` files: classify all 81 alternate candidates, audit external/local artwork mappings, generate deterministic Forms, and add completeness/regression checks for all 48 Mega Forms + 2 Primals.']
    OUT_MD.write_text('\n'.join(md)+'\n',encoding='utf-8')
    print(json.dumps(payload['summary'],ensure_ascii=False,sort_keys=True)); print(f'Wrote {OUT_MD.relative_to(REPO)} and {OUT_JSON.relative_to(REPO)}')

if __name__=='__main__':main()
