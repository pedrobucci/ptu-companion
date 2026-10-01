#!/usr/bin/env python3
"""Build the reviewed, offline Books supplement; --extract reads the supplied PDFs.

Normal builds use the versioned JSON/artwork and need neither PDFs nor PDF libraries.
Extraction needs pdfplumber/Pillow and Poppler's pdftotext on PATH.
"""
import argparse
import hashlib
import json
import re
import sqlite3
import subprocess
import unicodedata
import zipfile
from io import BytesIO
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
DATA = ROOT / 'seed/content-packs/campaign-books-species'
PACK_ID = 'campaign-books-species'
VERSION = '1.0.0'
FILES = ['Alola Lilligant', 'Aron Desert', 'Babee', 'Budice', 'Eudemown',
         'Fire Giant Honedge', 'Grifflet', 'Icynib', 'Izaguiraze', 'Lopunny',
         'Miroboros', 'Noirela', 'Scarlet and Violet', 'Waifu Pool']


def slug(value):
    value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', value).strip('-')


def key(value):
    return slug(value).replace('-', '')


def payload(value):
    return (json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n').encode('utf-8')


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def section(text, start, end):
    match = re.search(start + r'\s*:?(.*?)(?=' + end + r'|\Z)', text, re.I | re.S)
    return re.sub(r'\s+', ' ', match[1]).strip(' :') if match else ''


def extract_artwork(page):
    from PIL import Image, UnidentifiedImageError
    images = [im for im in page.images if im['x0'] < 310]
    if not images:
        raise ValueError(f'No artwork on PDF page {page.page_number}')
    im = max(images, key=lambda im: im['width'] * im['height'])
    # Read the embedded image instead of rendering its bounds: overlaid PDF
    # headings/stats can cross those bounds and must not enter the portrait.
    if im['bits'] != 8 or 'DeviceRGB' not in str(im['colorspace']):
        raise ValueError(f'Artwork needs explicit color conversion on page {page.page_number}')
    raw = im['stream'].get_data()
    try:
        portrait = Image.open(BytesIO(raw)).convert('RGB')
    except UnidentifiedImageError:
        portrait = Image.frombytes('RGB', im['srcsize'], raw)
    mask = im['stream'].attrs.get('SMask')
    if mask:
        mask = mask.resolve() if hasattr(mask, 'resolve') else mask
        portrait.putalpha(Image.frombytes('L', (mask.attrs['Width'], mask.attrs['Height']), mask.get_data()))
    portrait.thumbnail((512, 512))
    return portrait


def extract(books):
    import pdfplumber
    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / 'assets/species').mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(f'file:{ROOT / "seed/definitions/ptu_seed_v1.0.sqlite3"}?mode=ro', uri=True)
    references = {}
    existing = []
    for kind, logical, raw in db.execute('SELECT definition_kind,logical_id,raw_json FROM definition_versions WHERE content_pack_id != ?', (PACK_ID,)):
        row = json.loads(raw)
        name = row.get('display_name') or row.get('name') or logical
        references.setdefault(kind, {})[key(name)] = (logical, name)
        if kind == 'species':
            existing.append(row)
    db.close()
    aliases = {'dazzlingglean': 'dazzlinggleam', 'suckierpunch': 'suckerpunch',
               'sworddance': 'swordsdance', 'naturewalker': 'naturewalk',
               'swin': 'swim', 'blench': 'belch', 'icewind': 'icywind', 'falseswape': 'falseswipe',
               'owntime': 'owntempo', 'refrigerator': 'refrigerate', 'nimblestrike': 'nimblestrikes'}

    def reference(kind, name):
        name = name.strip().rstrip('.* ')
        normalized = key(name)
        if kind == 'capabilities':
            normalized = {'deadlysilent': 'deadsilent', 'teleport': 'teleporter', 'transporter': 'teleporter',
                          'fontaine': 'fountain', 'mountable': 'mountablex'}.get(normalized, normalized)
        logical, canonical = references.get(kind, {}).get(aliases.get(normalized, normalized), (slug(name), name))
        status = 'resolved_final_normalization' if aliases.get(normalized, normalized) in references.get(kind, {}) else 'unresolved_source_reference'
        return logical, canonical, status

    def move(name, **extra):
        note = 'N' if re.search(r'\(N\)', name, re.I) else None
        name = re.sub(r'\s*\(N\)', '', name, flags=re.I).strip()
        mid, canonical, status = reference('moves', name)
        return {**extra, 'move': canonical, 'move_id': mid, 'reference_status': status, **({'note': note} if note else {})}

    inventory = []
    source_texts = {}
    records = []
    for pdf in sorted(books.glob('*')):
        if pdf.suffix.lower() != '.pdf':
            continue
        text = subprocess.check_output(['pdftotext', '-layout', str(pdf), '-'], encoding='utf-8')
        source_texts[pdf.stem] = text
        inventory.append({'filename': pdf.name, 'sha256': digest(pdf.read_bytes()),
                          'species_pages': [i for i, p in enumerate(text.split('\f'), 1) if 'Base Stats:' in p]})
    for filename in FILES:
        pdf_path = books / (filename + '.pdf')
        full_pages = source_texts[filename].split('\f')
        with pdfplumber.open(pdf_path) as pdf:
            for index, page in enumerate(pdf.pages):
                full = page.extract_text(x_tolerance=2) or ''
                if 'Base Stats:' not in full:
                    continue
                left = page.crop((0, 0, 310, page.height)).extract_text(x_tolerance=2) or ''
                right = page.crop((310, 0, page.width, page.height)).extract_text(x_tolerance=2) or ''
                # Babee's tutor list continues onto the otherwise empty second page.
                if filename == 'Babee' and index == 0:
                    right += '\n' + (pdf.pages[1].extract_text() or '')
                name = left.splitlines()[0].strip()
                if filename == 'Eudemown':
                    name = 'Unown (Eudemown)' if index == 0 else 'Eudemown'
                elif filename == 'Aron Desert':
                    name += ' (Desert)'
                elif filename == 'Waifu Pool':
                    name += f' (Waifu Pool {index // 3 + 1})'
                elif filename == 'Budice' and index == 2:
                    name = 'Aromint'
                logical = slug(name)
                stats = {}
                for label, field in [('Hp', 'hp'), ('Attack', 'attack'), ('Defense', 'defense'),
                                     ('Special Attack', 'special_attack'), ('Special Defense', 'special_defense'), ('Speed', 'speed')]:
                    m = re.search(r'^' + label + r':\s*(\d+)', left, re.I | re.M)
                    stats[field] = int(m[1]) if m else None
                types = [s.strip().title() for s in re.search(r'^Type:\s*(.+)$', left, re.M)[1].split('/')]
                counters = {'basic': 0, 'advanced': 0, 'high': 0}
                slots = []
                for category, _, ability in re.findall(r'^(Basic|Adv(?:anced)?|High) Ability\s*(\d*):\s*(.+)$', left, re.I | re.M):
                    category = {'basic': 'basic', 'adv': 'advanced', 'advanced': 'advanced', 'high': 'high'}[category.lower()]
                    counters[category] += 1
                    aid, canonical, status = reference('abilities', ability)
                    slots.append({'slot': f'{category.title()} Ability {counters[category]}', 'slot_category': category,
                                  'slot_index': counters[category], 'name': canonical, 'ability_id': aid, 'reference_status': status})
                caps_text = section(right, r'Capability List', r'Skill List')
                skills_text = section(right, r'Skill List', r'(?:Level Up )?Move List')
                skills = []
                skill_names = {'athl': 'Athletics', 'athletic': 'Athletics', 'athletics': 'Athletics',
                               'acro': 'Acrobatics', 'acrobatic': 'Acrobatics', 'acrobatics': 'Acrobatics',
                               'combat': 'Combat', 'stealth': 'Stealth', 'percep': 'Perception',
                               'perception': 'Perception', 'focus': 'Focus'}
                for skill, dice, modifier in re.findall(r'([A-Za-z]+)\s*(\d+)d6\s*([+-]\d+)?', skills_text):
                    skills.append({'skill': skill_names.get(skill.lower(), skill), 'dice': int(dice), 'modifier': int(modifier or 0)})
                if len(skills) != 6:
                    raise ValueError(f'{filename} p.{index+1}: skills {skills}')
                capabilities = []
                for part in re.split(r',\s*(?![^()]*\))', caps_text):
                    part = part.strip().rstrip('.')
                    if not part:
                        continue
                    m = re.match(r'Jump\s*:?\s*(\d+)\s*/\s*(\d+)', part, re.I)
                    if m:
                        capabilities.append({'name': 'Jump', 'kind': 'jump', 'high': int(m[1]), 'long': int(m[2]),
                                             'component_capability_ids': ['high-jump', 'long-jump'], 'reference_status': 'resolved_composite'})
                        continue
                    m = re.match(r'(.+?)\s*\((.+)\)', part)
                    if m:
                        cid, canonical, status = reference('capabilities', m[1])
                        capabilities.append({'name': canonical, 'kind': 'special', 'capability_id': cid,
                                             'terrains': [s.strip() for s in m[2].split(',')], 'reference_status': status})
                        continue
                    m = re.match(r'(.+?)\s*:?\s+(\d+)$', part)
                    cname, value = (m[1].rstrip(':'), int(m[2])) if m else (part, None)
                    cid, canonical, status = reference('capabilities', cname)
                    capabilities.append({'name': canonical, 'capability_id': cid, 'reference_status': status,
                                         'kind': 'movement' if cid in ['overland', 'swim', 'sky', 'levitate', 'burrow', 'teleport'] else 'power' if cid == 'power' else 'special',
                                         **({'value': value} if value is not None else {})})
                moves_end = r'(?:TM(?: Move)?(?: List)?|Egg Move List|Tutor Move List|Mega form)'
                level_text = section(right, r'(?:Level Up )?Move List', moves_end)
                level_moves = []
                # Single-line source formatting permits lossless level boundaries.
                for match in re.finditer(r'(?:Lv\.?\s*)?(\d+|Evo(?:lution)?)[.:\s-]*(.*?)(?=\s+(?:Lv\.?\s*)?(?:\d+|Evo)[.:\s-]|\Z)', level_text, re.I):
                    level, mname = match.groups()
                    mname = re.sub(r'\s*-\s*(Normal|Fire|Water|Grass|Electric|Ice|Fighting|Poison|Ground|Flyingl?|Psychic|Bug|Rock|Ghost|Dragon|Dark|Steel|Fairy)$', '', mname, flags=re.I)
                    level_moves.append(move(mname, level='Evolution' if level.lower().startswith('evo') else level))
                tm_text = section(right, r'\bTM(?: Move)?(?: List)?', r'Egg Move List|Tutor Move List|Mega form')
                tm_moves = []
                for m in re.finditer(r'(?<!\d)(\d{1,3})\s+(.+?)(?=(?:,\s*|\s+)\d{1,3}\s|\Z)', tm_text):
                    parts = m[2].rstrip(',').split(',')
                    tm_moves.append(move(parts[0], code=m[1].zfill(2)))
                    tm_moves.extend(move(s, code='') for s in parts[1:] if s.strip())
                tutor_text = section(right, r'Tutor Move List', r'Mega form')
                egg_text = section(right, r'Egg Move List', r'TM(?: Move)?(?: List)?|Tutor Move List')
                tutor_text = tutor_text.replace('Fire Spin Hex', 'Fire Spin, Hex')
                tutors = [move(s) for s in tutor_text.split(',') if s.strip()]
                eggs = [move(s) for s in egg_text.split(',') if s.strip()]
                fields = {}
                for label, field in [('Height', 'height_text'), ('Weight', 'weight_text'), ('Gender(?: Ratio)?', 'gender_ratio_text'),
                                     ('Egg [Gg]roup', 'egg_group_text'), ('Diet', 'diet_text'), ('Habitat', 'habitat_text'), ('Average Hatch Rate', 'hatch_rate_text')]:
                    m = re.search(r'^' + label + r':\s*(.*)$', left, re.I | re.M)
                    if m:
                        fields[field] = m[1].strip()
                if 'Egg Group:' in fields.get('gender_ratio_text', ''):
                    fields['gender_ratio_text'] = fields['gender_ratio_text'].split('Egg Group:', 1)[0].strip()
                    egg = re.search(r'Egg Group:\s*\n([^\n]+)', left)
                    if egg:
                        fields['egg_group_text'] = egg[1].strip()
                evolution_text = section(left, r'Evolution', r'Size Information')
                stages = []
                for m in re.finditer(r'(\d+)\s*-\s*(.+?)(?=\s+\d+\s*-|\Z)', evolution_text):
                    stage_name = m[2]
                    level = re.search(r'(?:Minimum|Level)\s*(\d+)|\s(\d+)(?:\s*;|\Z)', stage_name, re.I)
                    condition = None
                    if level:
                        tail = stage_name[level.end():].strip(' ;')
                        condition = tail or None
                        stage_name = stage_name[:level.start()].strip()
                    stages.append({'stage': int(m[1]), 'species_name': stage_name, 'min_level': int(level[1] or level[2]) if level else None, 'condition_text': condition})
                source_id = 'books-' + slug(filename)
                if filename == 'Scarlet and Violet':
                    old = next(r for r in existing if r['id'] == logical)
                    dex = old.get('dex_number') or old.get('national_dex_number')
                else:
                    dex = None
                raw = {'id': logical, 'logical_id': logical, 'display_name': name, 'name': name, 'enabled': True,
                       'source_id': source_id, 'source_title': filename, 'source_kind': 'homebrew_species', 'source_priority': 180,
                       'source_page': index + 1, 'source_file': pdf_path.name, 'source_sha256': digest(pdf_path.read_bytes()),
                       'types': types, 'base_stats': stats, 'ability_slots': slots, 'skills': skills, 'skills_text': skills_text,
                       'capabilities': capabilities, 'capabilities_text': caps_text,
                       'level_up_moves': level_moves, 'tm_moves': tm_moves, 'tm_moves_text': tm_text,
                       'tutor_moves': tutors, 'tutor_moves_text': tutor_text, 'egg_moves': eggs, 'egg_moves_text': egg_text,
                       'evolution': stages, 'evolution_text': evolution_text, **fields,
                       'dex_number': dex, 'mechanical_completeness': 'complete' if all(v is not None for v in stats.values()) else 'partial',
                       'missing_mechanical_fields': [f'base_stats.{k}' for k, v in stats.items() if v is None],
                       'enabled_for_character_creation': all(v is not None for v in stats.values()), 'search_aliases': [name, filename],
                       'raw_text': full_pages[index].strip(), 'data_notes': ['Transcribed from the supplied PDF; spelling-only reference normalization preserves the source text.'],
                       'portrait_asset_path': f'assets/species/{logical}.webp'}
                portrait = extract_artwork(page)
                portrait.save(DATA / raw['portrait_asset_path'], 'WEBP', quality=92, method=6)
                records.append(raw)
    (DATA / 'species.json').write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (DATA / 'source-inventory.json').write_text(json.dumps(inventory, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Extracted {len(records)} species pages; review species.json before building.')


def build():
    species = json.loads((DATA / 'species.json').read_text(encoding='utf-8'))
    supplemental = json.loads((DATA / 'supplemental.json').read_text(encoding='utf-8'))
    entries = {}
    for kind, rows in {'species': species, **supplemental}.items():
        entries[f'content/{kind}.ndjson'] = b''.join(payload(r) for r in rows)
    for row in species:
        entries[row['portrait_asset_path']] = (DATA / row['portrait_asset_path']).read_bytes()
    for kind in ['families', 'edges']:
        entries[f'content/datasets/ptu_evolution_{kind}.json'] = (DATA / f'evolution-{kind}.json').read_bytes()
    manifest = {'format': 'ptu-content-pack', 'format_version': 1, 'id': PACK_ID,
                'name': 'Campaign Books — Pokémon supplement', 'version': VERSION, 'priority': 180, 'kind': 'homebrew_species',
                'source_ids': sorted({r['source_id'] for r in species}),
                'description': 'Missing campaign species and PTU sheets recovered from the owner-supplied Books PDFs.',
                'files': {name: {'bytes': len(raw), 'sha256': digest(raw), **({'records': len(raw.decode().splitlines())} if name.endswith('.ndjson') else {})} for name, raw in entries.items()}}
    for folder in [ROOT / 'bundled-packs', REPO / 'PTU_Companion_Android_Tauri/bundled-packs']:
        folder.mkdir(parents=True, exist_ok=True)
        target = folder / f'{PACK_ID}-{VERSION}.ptucp'
        with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for name, raw in {'manifest.json': payload(manifest), **entries}.items():
                info = zipfile.ZipInfo(name, date_time=(2026, 10, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                archive.writestr(info, raw)
        print(target, digest(target.read_bytes()))
    # Reuse the established Android overlay serializer, with this pack's identity/data.
    import build_fakemon_1_leva_mobile_bundle as mobile
    mobile.PACK_ID = PACK_ID
    mobile.VERSION = VERSION
    mobile.PACK = ROOT / 'bundled-packs' / f'{PACK_ID}-{VERSION}.ptucp'
    mobile.OUT = REPO / 'PTU_Companion_Android_Tauri/www/books-species-data.js'
    mobile.main(expected_counts={kind: len(rows) for kind, rows in {'species': species, **supplemental}.items()},
                global_name='__PTU_BOOKS_SPECIES_BUNDLED_PACK__')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--extract', action='store_true')
    parser.add_argument('--books', type=Path)
    args = parser.parse_args()
    if args.extract:
        if args.books is None:
            parser.error('--extract requires --books')
        extract(args.books)
    else:
        build()
