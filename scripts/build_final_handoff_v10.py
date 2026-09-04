from __future__ import annotations
import json, pathlib, shutil, hashlib, zipfile, sqlite3, re, unicodedata, copy, csv, os, collections, datetime
from typing import Any

SRC=pathlib.Path('/mnt/data/PTU_Companion_Seed_Data_v0.6')
ROOT=pathlib.Path('/mnt/data/PTU_Companion_Handoff_v1.0')
SEED=ROOT/'seed'
J=SEED/'json'; C=SEED/'csv'; S=SEED/'schemas'; PACKS=ROOT/'content_packs'; RULESETS=ROOT/'rulesets'; FIX=ROOT/'fixtures'; TV=ROOT/'test_vectors'; SCR=ROOT/'scripts'; EXT=ROOT/'external_data'
ZIP=pathlib.Path('/mnt/data/PTU_Companion_Handoff_v1.0.zip')
if ROOT.exists(): shutil.rmtree(ROOT)
for p in [J,C,S,PACKS,RULESETS,FIX,TV,SCR,EXT]: p.mkdir(parents=True,exist_ok=True)

# Copy source material prepared in previous stages; final bundle intentionally excludes old SQLite binaries/reports.
for p in (SRC/'json').glob('*.json'): shutil.copy2(p,J/p.name)
for p in (SRC/'csv').glob('*.csv'): shutil.copy2(p,C/p.name)
for p in (SRC/'schemas').glob('*.json'): shutil.copy2(p,S/p.name)
for p in (SRC/'rulesets').glob('*.json'): shutil.copy2(p,RULESETS/p.name)

def load(name): return json.loads((J/name).read_text(encoding='utf-8'))
def dump(path,obj):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+"\n",encoding='utf-8')
def slug(s):
    s=unicodedata.normalize('NFKD',str(s)).encode('ascii','ignore').decode().lower()
    s=re.sub(r"[^a-z0-9]+","-",s).strip('-')
    return s
def refkey(s):
    s=unicodedata.normalize('NFKD',str(s)).encode('ascii','ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+','',s)
def sha(p):
    h=hashlib.sha256();
    with open(p,'rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
    return h.hexdigest()
def freq(raw):
    t=(raw or '').strip(); lo=t.lower(); out={'raw':t,'scope':'other','uses':None,'ap_cost':None,'ap_mode':None,'actions':[],'interrupt':False,'reaction':False,'priority':None}
    if 'static' in lo: out['scope']='static'
    elif 'at-will' in lo or 'at will' in lo: out['scope']='at_will'
    elif 'eot' in lo: out['scope']='eot'
    elif 'scene' in lo:
        out['scope']='scene'; m=re.search(r'scene\s*x\s*(\d+)',lo); out['uses']=int(m.group(1)) if m else 1
    elif 'daily' in lo:
        out['scope']='daily'; m=re.search(r'daily\s*x\s*(\d+)',lo); out['uses']=int(m.group(1)) if m else 1
    for a in ['free','swift','standard','shift','full','extended']:
        if a in lo:out['actions'].append(a)
    out['interrupt']='interrupt' in lo; out['reaction']='reaction' in lo
    return out

moves=load('moves.json'); movevers=load('moves_versions.json')
abilities=load('abilities.json'); abilityvers=load('abilities_versions.json')
capabilities=load('capabilities.json'); capvers=load('capabilities_versions.json')
species=load('pokemon_species.json')

# Ensure all canonical capabilities added in Stage 5 have a source version for Content Pack transport.
cvkeys={(x['id'],x.get('source_id')) for x in capvers}
for x in capabilities:
    if (x['id'],x.get('source_id')) not in cvkeys:
        y=copy.deepcopy(x); y.pop('versions',None); y.pop('canonical_selection',None); capvers.append(y); cvkeys.add((y['id'],y.get('source_id')))

# ---------- Source-supported definitions missing from extraction ----------
def move_rec(id,name,source_page,type_,frequency,ac,db,dice,setd,klass,range_,effect,**extra):
    r={'id':id,'name':name,'source_id':'knight','source_title':'Knight','source_kind':'homebrew_species_support','source_priority':180,'source_page':source_page,
       'raw_text':None,'needs_review':False,'type':type_,'frequency_text':frequency,'frequency':freq(frequency),'ac_text':'None' if ac is None else str(ac),'ac':ac,
       'damage_base':db,'damage_dice':dice,'damage_set':setd,'class':klass,'range_text':range_,'effect_text':effect,'effect_parts':[{'kind':'effect','text':effect}] if effect else [],
       'contest_type':None,'contest_effect':None,'special_text':None,'trigger_text':None,'target_text':None,'bonus_text':None,'limitation_text':None,'weapon_suggestions_text':None,'condition_text':None}
    r.update(extra); return r
new_moves=[
 move_rec('expanding-force','Expanding Force',6,'Psychic','EOT',2,8,'2d8+10','19','Special','Ranged 6, 1 Target','If Psychic Terrain is in effect and the user is grounded upon its execution, this Move receives +20 damage in addition to the +10 Psychic Terrain damage.'),
 move_rec('armor-cannon','Armor Cannon',6,'Fire','Scene',2,12,'3d12+10','30','Special','Ranged 6, 1 Target',"Armor Cannon deals damage and lowers the user's Defense and Special Defense stats by one stage each.",compiled_effects=[{'kind':'state_change','target_path':'self.combat_stages.current.defense','operation':'add','value':-1},{'kind':'state_change','target_path':'self.combat_stages.current.special-defense','operation':'add','value':-1}],semantic_automation='hybrid'),
 move_rec('bitter-blade','Bitter Blade',6,'Fire','Scene x2',2,9,'2d10+10','21','Physical','Ranged 6, 1 Target',"Bitter Blade inflicts damage, and it restores the user's HP by half of the damage dealt."),
 move_rec('kowtow-cleave','Kowtow Cleave',6,'Dark','EOT',None,8,'2d8+10','19','Physical','Melee, 1 Target','Kowtow Cleave cannot miss.'),
 move_rec('lash-out','Lash Out',6,'Dark','Scene',2,7,'2d6+10','17','Physical','Melee, 1 Target',"If any of the user's stats were lowered during the turn this Move is used, it has Damage Base 15."),
]

def ability_rec(id,name,page,freqtxt,effect,bonus=None,compiled=None,automation='manual_text',source='knight',title='Knight'):
    return {'id':id,'name':name,'source_id':source,'source_title':title,'source_kind':'homebrew_species_support','source_priority':180,'source_page':page,'raw_text':None,'needs_review':False,
            'frequency_action_text':freqtxt,'frequency':freq(freqtxt),'trigger_text':None,'target_text':None,'effect_text':effect,'bonus_text':bonus,'special_text':None,'condition_text':None,
            'compiled_effects':compiled or [],'effect_semantics':{'coverage':'partial' if compiled else 'manual','effects':compiled or []},'semantic_automation':automation}
new_abs=[
 ability_rec('white-knight','White Knight',6,'Static',"Connection - Ally Switch. Your Intercept maneuver is a Swift Action and doesn't need the Athletics test.",'You have 5 Damage Reduction.',[{'kind':'grant_connection','entity_kind':'move','entity_id':'ally-switch'},{'kind':'modifier','target_path':'combat.damage_reduction','operation':'add','value':5,'mode':'passive'}],'hybrid'),
 ability_rec('death-knight','Death Knight',6,'Static','Connection - Shadow Claw. Your Pass keyword moves you 6 squares in a straight line.','You have 5 Damage Reduction.',[{'kind':'grant_connection','entity_kind':'move','entity_id':'shadow-claw'},{'kind':'modifier','target_path':'combat.damage_reduction','operation':'add','value':5,'mode':'passive'}],'hybrid'),
 ability_rec('supreme-overlord','Supreme Overlord',6,'Scene - Swift Action','The user gains 1 Attack Combat Stage for any ally that has fainted in the battle.',None,[], 'manual_text'),
 ability_rec('overlocker','Overlocker',2,'At-Will - Extended Action','The user makes refined accessories from common clothes, choosing Reinforced or Malleable permanently for that refinement. Reinforced grants Bulletproof and Bodyguard. Malleable grants Flutter and Blur.',None,[], 'manual_text',source='needlene',title='Needlene'),
]
for r in new_moves:
    if not any(x['id']==r['id'] and x.get('source_id')=='knight' for x in movevers): movevers.append(copy.deepcopy(r))
    if not any(x['id']==r['id'] for x in moves): moves.append(copy.deepcopy(r))
for r in new_abs:
    if not any(x['id']==r['id'] and x.get('source_id')==r['source_id'] for x in abilityvers):
        vv=copy.deepcopy(r); vv.pop('compiled_effects',None); vv.pop('effect_semantics',None); vv.pop('semantic_automation',None); abilityvers.append(vv)
    if not any(x['id']==r['id'] for x in abilities): abilities.append(copy.deepcopy(r))

moves.sort(key=lambda x:(x.get('name') or '').casefold()); movevers.sort(key=lambda x:((x.get('name') or '').casefold(),x.get('source_priority',0),x.get('source_id','')))
abilities.sort(key=lambda x:(x.get('name') or '').casefold()); abilityvers.sort(key=lambda x:((x.get('name') or '').casefold(),x.get('source_priority',0),x.get('source_id','')))
capvers.sort(key=lambda x:((x.get('name') or '').casefold(),x.get('source_id','')))

# ---------- Targeted repairs to supplied homebrew species ----------
ability_by_key={refkey(x['name']):x for x in abilities}; move_by_key={refkey(x['name']):x for x in moves}; cap_by_key={refkey(x['name']):x for x in capabilities}
repair_log=[]; quarantine=[]
def slot(slot,name):
    a=ability_by_key.get(refkey(name)); cat='basic' if slot.lower().startswith('basic') else 'advanced' if slot.lower().startswith('advanced') else 'high'
    m=re.search(r'(\d+)',slot); idx=int(m.group(1)) if m else 1
    return {'slot':slot,'name':name,'ability_id':a['id'] if a else slug(name),'slot_category':cat,'slot_index':idx,'reference_status':'resolved_source_repair' if a else 'unresolved_source_repair'}
def mv_obj(level,name):
    m=move_by_key.get(refkey(name)); return {'level':str(level),'move':m['name'] if m else name,'type_hint':None,'move_id':m['id'] if m else slug(name),'reference_status':'resolved_source_repair' if m else 'unresolved_source_repair'}
def list_move(name,note=None):
    m=move_by_key.get(refkey(name)); return {'move':m['name'] if m else name,'move_id':m['id'] if m else slug(name),'note':note,'reference_status':'resolved_source_repair' if m else 'unresolved_source_repair'}
def tm(code,name):
    m=move_by_key.get(refkey(name)); return {'code':str(code).zfill(2) if str(code).isdigit() else str(code),'move':m['name'] if m else name,'move_id':m['id'] if m else slug(name),'reference_status':'resolved_source_repair' if m else 'unresolved_source_repair'}
def getsp(sid): return next((x for x in species if x.get('id')==sid),None)
def logrepair(sp,field,before,after,reason,confidence='high'):
    rec={'species_id':sp['id'],'source_id':sp.get('source_id'),'field':field,'reason':reason,'confidence':confidence,'before':before,'after':after}
    repair_log.append(rec); sp.setdefault('data_repairs',[]).append({k:v for k,v in rec.items() if k not in ['before','after']})

knight_abilities={
 'charcadet':[('Basic Ability 1','Flash Fire'),('Advanced Ability 1','Blaze'),('Advanced Ability 2','Guts'),('Advanced Ability 3','Pride'),('High Ability','Flame Body')],
 'armarouge':[('Basic Ability 1','Flash Fire'),('Advanced Ability 1','Weak Armor'),('Advanced Ability 2','Competitive'),('Advanced Ability 3','Pride'),('High Ability','White Knight')],
 'ceruledge':[('Basic Ability 1','Flash Fire'),('Advanced Ability 1','Weak Armor'),('Advanced Ability 2','Guts'),('Advanced Ability 3','Defiant'),('High Ability','Death Knight')],
 'kingambit':[('Basic Ability 1','Supreme Overlord'),('Advanced Ability 1','Defiant'),('Advanced Ability 2','Hyper Cutter'),('Advanced Ability 3','Regal Challenge'),('High Ability','Pressure')],
}
for sid,arr in knight_abilities.items():
    sp=getsp(sid)
    if sp:
        before=copy.deepcopy(sp.get('ability_slots')); after=[slot(s,n) for s,n in arr]; sp['ability_slots']=after; logrepair(sp,'ability_slots',before,after,'Reconstructed directly from Knight species block; earlier two-column/layout parse assigned slot labels as values.')

# Exact Knight level-up lists, replacing contaminated lists where needed.
king=[('Evo','Kowtow Cleave'),(14,'Torment'),(17,'Feint Attack'),(22,'Scary Face'),(25,'Metal Claw'),(30,'Slash'),(33,'Assurance'),(38,'Metal Sound'),(41,'Embargo'),(46,'Iron Defense'),(49,'Night Slash'),(57,'Iron Head'),(63,'Swords Dance'),(71,'Guillotine')]
sp=getsp('kingambit')
if sp:
    b=copy.deepcopy(sp.get('level_up_moves')); a=[mv_obj(l,n) for l,n in king]; sp['level_up_moves']=a; logrepair(sp,'level_up_moves',b,a,'Reconstructed directly from Knight level-up list; evolution lines had leaked into the parsed move list.')
# Charcadet egg list exact from source.
sp=getsp('charcadet')
if sp:
    b=copy.deepcopy(sp.get('egg_moves')); a=[list_move(n) for n in ['Mystical Fire','Wide Guard','Night Slash','Shadow Sneak','Quick Guard','Solar Blade']]; sp['egg_moves']=a; logrepair(sp,'egg_moves',b,a,'Reconstructed from the explicit Knight Egg Move List; previous extraction swallowed the next Basic Information block.')
# TM typo 'Sword Dance' -> catalog Swords Dance for Knight line.
for sid in ['charcadet','armarouge','ceruledge']:
    sp=getsp(sid)
    if sp:
        for r in sp.get('tm_moves',[]):
            if refkey(r.get('move'))==refkey('Sword Dance'):
                before=copy.deepcopy(r); m=move_by_key.get(refkey('Swords Dance')); r.update({'move':m['name'],'move_id':m['id'],'reference_status':'resolved_source_spelling_normalization'}); repair_log.append({'species_id':sid,'source_id':'knight','field':'tm_moves','reason':'Knight uses singular Sword Dance while PTU catalog definition is Swords Dance.','confidence':'high','before':before,'after':copy.deepcopy(r)})
# Kingambit 'Swords' tutor shorthand -> Swords Dance, logged medium confidence and raw source retained.
sp=getsp('kingambit')
if sp:
    for r in sp.get('tutor_moves',[]):
        if refkey(r.get('move'))=='swords':
            before=copy.deepcopy(r); m=move_by_key.get(refkey('Swords Dance')); r.update({'move':m['name'],'move_id':m['id'],'reference_status':'resolved_source_context_normalization'}); repair_log.append({'species_id':'kingambit','source_id':'knight','field':'tutor_moves','reason':'Tutor entry “Swords” normalized to Swords Dance because the same source lists Swords Dance as the learned/TM move and no “Swords” move definition exists.','confidence':'medium','before':before,'after':copy.deepcopy(r)})

# Needlene exact ability slots and obvious spelling corrections.
sp=getsp('needlene')
if sp:
    arr=[('Basic Ability 1','Overlocker'),('Advanced Ability 1','Technician'),('Advanced Ability 2','Sheer Force'),('Advanced Ability 3','Exploit'),('High Ability','Needles')]
    b=copy.deepcopy(sp.get('ability_slots')); a=[slot(s,n) for s,n in arr]; sp['ability_slots']=a; logrepair(sp,'ability_slots',b,a,'Reconstructed from explicit Needlene species block; asterisk denotes local newly-defined Ability, not part of the name.')
    # specific obvious source misspellings/punctuation
    aliases={'frustraition':'Frustration','drainkiss':'Draining Kiss','sahdowclaw':'Shadow Claw'}
    for container in ['tm_moves','egg_moves']:
        for r in sp.get(container,[]):
            k=refkey(r.get('move'))
            if k in aliases:
                before=copy.deepcopy(r); m=move_by_key[refkey(aliases[k])]; r.update({'move':m['name'],'move_id':m['id'],'reference_status':'resolved_source_spelling_normalization'}); repair_log.append({'species_id':'needlene','source_id':'needlene','field':container,'reason':'Obvious spelling/name normalization against supplied PTU move catalog.','confidence':'high','before':before,'after':copy.deepcopy(r)})

# Paldean Pidgey line: restore explicit Ability slots and obvious move spellings from supplied PDF.
pidgey_abs={
 'pidgey--pidgey':[('Basic Ability 1','Keen Eye'),('Basic Ability 2','Tangled Feet'),('Advanced Ability 1','Big Pecks'),('Advanced Ability 2','Blow Away'),('High Ability','Run Away')],
 'pidgeotto--pidgeotto':[('Basic Ability 1','Keen Eye'),('Basic Ability 2','Tangled Feet'),('Advanced Ability 1','Big Pecks'),('Advanced Ability 2','Blow Away'),('High Ability','Competitive')],
 'pidgeot--pidgeot':[('Basic Ability 1','Keen Eye'),('Basic Ability 2','Tangled Feet'),('Advanced Ability 1','Big Pecks'),('Advanced Ability 2','Blow Away'),('High Ability','Run Away')],
}
for sid,arr in pidgey_abs.items():
    sp=getsp(sid)
    if not sp: continue
    b=copy.deepcopy(sp.get('ability_slots')); a=[slot(s,n) for s,n in arr]; sp['ability_slots']=a; logrepair(sp,'ability_slots',b,a,'Restored complete Ability slots from supplied Paldean Pidgey source.')
    for r in sp.get('level_up_moves',[]):
        if refkey(r.get('move'))==refkey('Thunder Wave- Electric'):
            before=copy.deepcopy(r); m=move_by_key[refkey('Thunder Wave')]; r.update({'move':m['name'],'move_id':m['id'],'type_hint':'Electric','reference_status':'resolved_layout_cleanup'}); repair_log.append({'species_id':sid,'source_id':'pidgey','field':'level_up_moves','reason':'Type suffix had been captured as part of the move name.','confidence':'high','before':before,'after':copy.deepcopy(r)})
    for r in sp.get('tutor_moves',[]):
        if refkey(r.get('move'))==refkey('Electoball'):
            before=copy.deepcopy(r); m=move_by_key.get(refkey('Electro Ball'))
            if m: r.update({'move':m['name'],'move_id':m['id'],'reference_status':'resolved_source_spelling_normalization'}); repair_log.append({'species_id':sid,'source_id':'pidgey','field':'tutor_moves','reason':'Electoball normalized to Electro Ball.','confidence':'high','before':before,'after':copy.deepcopy(r)})

# Homebrew obvious typo corrections previously suggested but never applied.
for sid in ['heafinha','chickute','terroster']:
    sp=getsp(sid)
    if not sp: continue
    for cont in ['level_up_moves','tm_moves','egg_moves','tutor_moves']:
        for r in sp.get(cont,[]):
            nm=r.get('move',''); k=refkey(nm)
            aliases={'flamethower':'Flamethrower','landswarth':"Land's Wrath",'beatupdark':'Beat Up'}
            if k in aliases and refkey(aliases[k]) in move_by_key:
                before=copy.deepcopy(r); m=move_by_key[refkey(aliases[k])]; r.update({'move':m['name'],'move_id':m['id'],'reference_status':'resolved_source_spelling_normalization'}); repair_log.append({'species_id':sid,'source_id':sp.get('source_id'),'field':cont,'reason':'Obvious spelling/type-suffix normalization against supplied move catalog.','confidence':'high','before':before,'after':copy.deepcopy(r)})

# ---------- Conservative generic reference cleanup ----------
TYPES=['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy']
move_keys=sorted(move_by_key,key=len,reverse=True)
def extract_candidate(s):
    raw=str(s or '').strip(); t=raw
    # Strip obvious next-page / next-section contamination while retaining prefix.
    for marker in [' Basic Information',' Breeding Information',' HP: Attack:',' Base Stats:',' Unofficial PTU',' Zygarde Cube Move List',' New Move',' New Ability']:
        i=t.find(marker)
        if i>=0: t=t[:i]
    t=re.sub(r'^\s*:\s*(\d{1,3})\s*','',t)
    t=re.sub(r'^\s*(\d{1,3})\s+(?=[A-Za-z])','',t)
    t=t.strip(' .,:;§')
    t=re.sub(r'\s*-\s*('+'|'.join(TYPES)+r')\s*$','',t,flags=re.I)
    t=t.replace('*','').strip()
    return t
alias_moves={
 'sworddance':'Swords Dance','hijumpkick':'High Jump Kick','landswarth':"Land's Wrath",'flamethower':'Flamethrower','frustraition':'Frustration','drainkiss':'Draining Kiss','sahdowclaw':'Shadow Claw','electoball':'Electro Ball','xscissor':'X-Scissor','nightshade':'Night Shade'
}
def split_known_moves(text):
    t=extract_candidate(text).replace('(N)',' ').replace('(n)',' ')
    # common separators first
    pieces=[p.strip() for p in re.split(r'\s*[.;]\s*',t) if p.strip()]
    out=[]
    def resolve_piece(p):
        # remove embedded TM numbers before a move
        p=re.sub(r'\b\d{1,3}\b',' ',p); p=' '.join(p.split()); k=refkey(p)
        if k in alias_moves: k=refkey(alias_moves[k])
        if k in move_by_key:return [move_by_key[k]]
        # recursive normalized-key segmentation, max 3 pieces
        kk=refkey(p)
        memo={}
        def rec(rest,depth=0):
            if not rest:return []
            if depth>=3:return None
            if rest in move_by_key:return [move_by_key[rest]]
            if rest in memo:return memo[rest]
            for mk in move_keys:
                if len(mk)>=4 and rest.startswith(mk) and rest!=mk:
                    rr=rec(rest[len(mk):],depth+1)
                    if rr is not None:
                        memo[rest]=[move_by_key[mk]]+rr; return memo[rest]
            memo[rest]=None; return None
        return rec(kk)
    for p in pieces:
        rs=resolve_piece(p)
        if rs is None:return None
        out.extend(rs)
    return out or None

# Clean structured lists and split a small number of concatenated move references only when every segment maps exactly.
for sp in species:
    for cont in ['level_up_moves','tm_moves','egg_moves','tutor_moves']:
        old=sp.get(cont,[])
        if not isinstance(old,list): continue
        new=[]
        for r in old:
            nm=r.get('move') if isinstance(r,dict) else None
            if not nm: new.append(r); continue
            cand=extract_candidate(nm); ck=refkey(cand)
            if ck in alias_moves: cand=alias_moves[ck]; ck=refkey(cand)
            if ck in move_by_key:
                m=move_by_key[ck]; rr=copy.deepcopy(r); changed=(rr.get('move')!=m['name'] or rr.get('move_id')!=m['id'] or not str(rr.get('reference_status','')).startswith('resolved'))
                rr['move']=m['name'];rr['move_id']=m['id'];rr['reference_status']='resolved_final_normalization'
                if changed: repair_log.append({'species_id':sp['id'],'source_id':sp.get('source_id'),'field':cont,'reason':'Conservative final reference cleanup (section contamination, type suffix, punctuation, or exact alias).','confidence':'high','before':r,'after':copy.deepcopy(rr)})
                new.append(rr); continue
            # drop obvious pure layout/stat junk to quarantine, never silently discard evidence
            if re.fullmatch(r'[+\-]?\d+(?:\s*(?:sp\.?\s*)?(?:atk|def|speed|attack|defense))?',cand.strip(),re.I) or not cand or cand.lower()=='none' or cand.lower().startswith('basic information'):
                quarantine.append({'species_id':sp['id'],'source_id':sp.get('source_id'),'container':cont,'record':r,'reason':'final_layout_junk'}); continue
            parts=split_known_moves(nm)
            if parts and len(parts)>1:
                for i,m in enumerate(parts):
                    rr=copy.deepcopy(r);rr['move']=m['name'];rr['move_id']=m['id'];rr['reference_status']='resolved_final_split';
                    if i>0 and cont=='tm_moves': rr['code']=None
                    new.append(rr)
                repair_log.append({'species_id':sp['id'],'source_id':sp.get('source_id'),'field':cont,'reason':'Concatenated reference split only because every segment exactly matched a known supplied Move.','confidence':'high','before':r,'after':new[-len(parts):]});continue
            new.append(r)
        sp[cont]=new

# Ability aliases and parameterized/choice slot metadata.
ability_alias={'weakarmour':'Weak Armor','syncronize':'Synchronize','overlocker':'Overlocker'}
for sp in species:
    old=sp.get('ability_slots',[])
    if not isinstance(old,list):continue
    new=[]
    for r in old:
        nm=str(r.get('name') or '').strip().strip('*').strip(); k=refkey(nm)
        if re.fullmatch(r'(basic|advanced|adv|high)ability\d*',k):
            quarantine.append({'species_id':sp['id'],'source_id':sp.get('source_id'),'container':'ability_slots','record':r,'reason':'slot_label_captured_as_value'});continue
        if k in ability_alias: nm=ability_alias[k];k=refkey(nm)
        m=re.fullmatch(r'Type Aura\s*\(([^)]+)\)',nm,re.I)
        if m and 'typeaura' in ability_by_key:
            rr=copy.deepcopy(r);rr.update({'name':'Type Aura','ability_id':ability_by_key['typeaura']['id'],'reference_status':'resolved_parameterized','parameters':{'type':m.group(1).title()}});new.append(rr);continue
        # Exact choice patterns: X or Y / X (Red) / Y (Blue). Keep conditions as raw text.
        names=[]
        if ' or ' in nm.lower(): names=[x.strip() for x in re.split(r'\s+or\s+',nm,flags=re.I)]
        elif ' / ' in nm: names=[re.sub(r'\s*\([^)]*\)\s*$','',x).strip() for x in nm.split('/')]
        opts=[]
        if names:
            for n in names:
                a=ability_by_key.get(refkey(n));
                if a:opts.append({'ability_id':a['id'],'name':a['name']})
            if len(opts)==len(names):
                rr=copy.deepcopy(r);rr['reference_status']='resolved_choice';rr['choice_options']=opts;rr['choice_condition_text']=nm;new.append(rr);continue
        a=ability_by_key.get(k)
        if a:
            rr=copy.deepcopy(r);rr.update({'name':a['name'],'ability_id':a['id'],'reference_status':'resolved_final_normalization'});new.append(rr)
        else:new.append(r)
    sp['ability_slots']=new

# Movement capability conditions / contaminated prefix cleanup.
for sp in species:
    old=sp.get('capabilities',[])
    if not isinstance(old,list): continue
    new=[]
    for r in old:
        nm=str(r.get('name') or '')
        cand=extract_candidate(nm)
        # “Tracker Underdog” exact two-cap sequence
        kk=refkey(cand)
        if kk and kk not in cap_by_key:
            matches=[];rest=kk
            for ck in sorted(cap_by_key,key=len,reverse=True):
                if rest.startswith(ck):
                    matches=[cap_by_key[ck]]; rest=rest[len(ck):]; break
            if matches and rest in cap_by_key:
                matches.append(cap_by_key[rest])
                for cc in matches:new.append({'name':cc['name'],'kind':'special','capability_id':cc['id'],'reference_status':'resolved_final_split'})
                continue
        if refkey(cand) in cap_by_key:
            cc=cap_by_key[refkey(cand)];rr=copy.deepcopy(r);rr['name']=cc['name'];rr['capability_id']=cc['id'];rr['reference_status']='resolved_final_normalization';new.append(rr);continue
        new.append(r)
    sp['capabilities']=new

# ---------- Evolution correction: Wurmple split paths are explicit in source ----------
evo_edges=load('ptu_evolution_edges.json') if (J/'ptu_evolution_edges.json').exists() else []
evo_fams=load('ptu_evolution_families.json') if (J/'ptu_evolution_families.json').exists() else []
# Replace any gen8 Wurmple family edges with explicit branch-safe set.
evo_edges=[e for e in evo_edges if not (e.get('source_id')=='gen8' and (refkey(e.get('from_species_name','')) in {'wurmple','silcoon','cascoon'} or refkey(e.get('to_species_name','')) in {'silcoon','beautifly','cascoon','dustox'}))]
wurmple_edges=[
 {'family_id':'gen8:wurmple','from_species_name':'Wurmple','to_species_name':'Silcoon','from_ref_key':'wurmple','to_ref_key':'silcoon','to_min_level':5,'condition_text':'Minimum 5','mapping_confidence':'source_explicit_branch','source_id':'gen8'},
 {'family_id':'gen8:wurmple','from_species_name':'Silcoon','to_species_name':'Beautifly','from_ref_key':'silcoon','to_ref_key':'beautifly','to_min_level':10,'condition_text':'Minimum 10','mapping_confidence':'source_explicit_branch','source_id':'gen8'},
 {'family_id':'gen8:wurmple','from_species_name':'Wurmple','to_species_name':'Cascoon','from_ref_key':'wurmple','to_ref_key':'cascoon','to_min_level':5,'condition_text':'Minimum 5','mapping_confidence':'source_explicit_branch','source_id':'gen8'},
 {'family_id':'gen8:wurmple','from_species_name':'Cascoon','to_species_name':'Dustox','from_ref_key':'cascoon','to_ref_key':'dustox','to_min_level':10,'condition_text':'Minimum 10','mapping_confidence':'source_explicit_branch','source_id':'gen8'},
]
evo_edges.extend(wurmple_edges)
for i,e in enumerate(evo_edges): e.setdefault('edge_id',f"{e.get('source_id','src')}:{refkey(e.get('from_species_name',''))}>{refkey(e.get('to_species_name',''))}:{i}")
# Update family record if present.
for f in evo_fams:
    if f.get('id')=='gen8:wurmple' or f.get('family_id')=='gen8:wurmple': f['edges_status']='resolved';f['manual_review']=False

# ---------- Revalidate species references ----------
moveids={x['id'] for x in moves}; abids={x['id'] for x in abilities}; capids={x['id'] for x in capabilities}
unresolved=[]; validations=[]
for sp in species:
    um=[];ua=[];uc=[]
    for cont in ['level_up_moves','tm_moves','egg_moves','tutor_moves']:
        for r in sp.get(cont,[]) or []:
            mid=r.get('move_id')
            if mid not in moveids:
                um.append({'container':cont,'reference':r.get('move'),'reference_key':refkey(r.get('move'))}); unresolved.append({'kind':'move','species_id':sp['id'],'container':cont,'reference':r.get('move'),'reference_key':refkey(r.get('move')),'suggestions':[]})
    for r in sp.get('ability_slots',[]) or []:
        if r.get('reference_status')=='resolved_choice': continue
        aid=r.get('ability_id')
        if aid not in abids:
            ua.append({'container':'ability_slots','reference':r.get('name'),'reference_key':refkey(r.get('name'))}); unresolved.append({'kind':'ability','species_id':sp['id'],'container':'ability_slots','reference':r.get('name'),'reference_key':refkey(r.get('name')),'suggestions':[]})
    for r in sp.get('capabilities',[]) or []:
        ids=[]
        if r.get('capability_id'):ids=[r['capability_id']]
        elif r.get('component_capability_ids'):ids=r['component_capability_ids']
        for cid in ids:
            if cid not in capids:
                uc.append({'container':'capabilities','reference':r.get('name'),'reference_key':refkey(r.get('name'))});unresolved.append({'kind':'capability','species_id':sp['id'],'container':'capabilities','reference':r.get('name'),'reference_key':refkey(r.get('name')),'suggestions':[]});break
        if not ids and r.get('reference_status','').startswith('unresolved'):
            uc.append({'container':'capabilities','reference':r.get('name'),'reference_key':refkey(r.get('name'))});unresolved.append({'kind':'capability','species_id':sp['id'],'container':'capabilities','reference':r.get('name'),'reference_key':refkey(r.get('name')),'suggestions':[]})
    missing=[]
    for fld in ['types','base_stats','ability_slots','capabilities','skills']:
        if not sp.get(fld): missing.append(fld)
    nr=bool(um or ua or uc or missing or sp.get('needs_review'))
    validations.append({'species_id':sp['id'],'unresolved_abilities':len(ua),'unresolved_moves':len(um),'unresolved_capabilities':len(uc),'missing_fields':missing,'needs_review':nr,'details':{'moves':um,'abilities':ua,'capabilities':uc}})

# Group gaps
groups={}
for r in unresolved:
    key=(r['kind'],r['reference'])
    g=groups.setdefault(key,{'kind':r['kind'],'reference_name':r['reference'],'count':0,'species_examples':[],'containers':set(),'status':'manual_review_required'})
    g['count']+=1; g['containers'].add(r['container'])
    if r['species_id'] not in g['species_examples'] and len(g['species_examples'])<20:g['species_examples'].append(r['species_id'])
gaps=[]
for g in groups.values():g['containers']=sorted(g['containers']);gaps.append(g)
gaps.sort(key=lambda x:(x['kind'],-x['count'],x['reference_name'] or ''))

# Preserve source issue queue but remove now-resolved entity references from semantic queue only if exact IDs are now known.
sem_unres=load('semantic_unresolved_references.json')
sem_final=[]
for r in sem_unres:
    eid=refkey(r.get('entity_name',''))
    kind=r.get('entity_kind')
    resolved=(kind=='move' and eid in move_by_key) or (kind=='ability' and eid in ability_by_key) or (kind=='capability' and eid in cap_by_key)
    # Avoid pretending grammar false positives such as “an” are resolved.
    if resolved and len(eid)>2: r=copy.deepcopy(r);r['status']='resolved_in_final_catalog';r['resolved_id']=(move_by_key.get(eid) or ability_by_key.get(eid) or cap_by_key.get(eid))['id']
    else: sem_final.append(r)

# Write final canonical datasets.
dump(J/'moves.json',moves); dump(J/'moves_versions.json',movevers); dump(J/'abilities.json',abilities); dump(J/'abilities_versions.json',abilityvers); dump(J/'capabilities_versions.json',capvers); dump(J/'pokemon_species.json',species)
dump(J/'ptu_evolution_edges.json',evo_edges); dump(J/'ptu_evolution_families.json',evo_fams); dump(J/'species_evolution_review.json',[])
dump(J/'reference_unresolved.json',unresolved);dump(J/'species_reference_validation.json',validations);dump(J/'species_reference_gaps.json',gaps);dump(J/'semantic_unresolved_references_final.json',sem_final);dump(J/'final_data_repairs.json',repair_log);dump(J/'final_extraction_quarantine.json',quarantine)

# Final status for Pokedex flavor entries: schema support only, text not bundled from non-supplied copyrighted corpora.
pokedex_status=load('pokedex_entry_status.json')
for x in pokedex_status:
    x['status']='not_bundled'; x['reason']='Pokédex flavor text is not present in the supplied PTU PDFs; the app schema/import path is provided, but copyrighted external text is not redistributed in this handoff.'
dump(J/'pokedex_entry_status.json',pokedex_status)

# ---------- Final Content Pack rebuild ----------
registry=load('content_pack_registry.json')
pack_specs={x['id']:x for x in registry}
source_to_pack={sid:p['id'] for p in registry for sid in p.get('source_ids',[])}
category_files={'moves':'moves_versions.json','abilities':'abilities_versions.json','capabilities':'capabilities_versions.json','features':'features.json','edges':'edges.json','poke_edges':'poke_edges.json','items':'items.json','species':'pokemon_species.json'}
category_records={k:load(v) for k,v in category_files.items()}
pack_content={pid:{k:[] for k in category_files} for pid in pack_specs}
version_index=collections.defaultdict(list); unmapped=[]
for kind,recs in category_records.items():
    for r0 in recs:
        r=copy.deepcopy(r0);sid=r.get('source_id');pid=source_to_pack.get(sid)
        if not pid:unmapped.append({'kind':kind,'id':r.get('id'),'source_id':sid});continue
        lid=r['id'];vid=f'{kind}:{lid}@{sid}';r['logical_id']=lid;r['definition_version_id']=vid;r['content_pack_id']=pid;r['source_priority']=pack_specs[pid].get('priority',r.get('source_priority',0))
        pack_content[pid][kind].append(r);version_index[(kind,lid)].append({'definition_version_id':vid,'content_pack_id':pid,'source_id':sid,'priority':pack_specs[pid].get('priority',0),'source_page':r.get('source_page'),'name':r.get('name') or r.get('display_name'),'needs_review':bool(r.get('needs_review'))})

core_dataset_names=['damage_chart','type_matchups','type_effectiveness_scale','type_traits','trainer_progression','trainer_milestones','pokemon_experience','pokemon_progression_rules']
core_datasets={n:load(n+'.json') for n in core_dataset_names}
canonical_edges=load('canonical_evolution_edges_current.json')
new_registry=[]
for pid,oldm in pack_specs.items():
    temp=ROOT/'_pack_build'/pid; temp.mkdir(parents=True,exist_ok=True);(temp/'content'/'datasets').mkdir(parents=True,exist_ok=True)
    files={};counts={}
    for kind in category_files:
        recs=sorted(pack_content[pid][kind],key=lambda r:(r.get('logical_id',''),r.get('definition_version_id','')))
        if not recs:continue
        b=''.join(json.dumps(r,ensure_ascii=True,separators=(',',':'))+'\n' for r in recs).encode();rel=f'content/{kind}.ndjson';(temp/rel).write_bytes(b);files[rel]={'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b),'records':len(recs),'media_type':'application/x-ndjson'};counts[kind]=len(recs)
    sids=set(oldm.get('source_ids',[])); datasets={}
    if pid=='ptu-core-1.05':datasets.update(core_datasets)
    pe=[x for x in evo_edges if x.get('source_id') in sids];pf=[x for x in evo_fams if x.get('source_id') in sids]
    if pe:datasets['ptu_evolution_edges']=pe
    if pf:datasets['ptu_evolution_families']=pf
    if pid=='pokemon-current-catalog-2026-09':datasets['canonical_evolution_edges_current']=[x for x in canonical_edges if x.get('source_id') in sids]
    for n,obj in datasets.items():
        b=(json.dumps(obj,ensure_ascii=False,indent=2)+'\n').encode();rel=f'content/datasets/{n}.json';(temp/rel).write_bytes(b);files[rel]={'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b),'records':len(obj) if isinstance(obj,list) else 1,'media_type':'application/json'};counts['dataset:'+n]=len(obj) if isinstance(obj,list) else 1
    manifest={k:v for k,v in oldm.items() if k not in ['archive','files','content_counts','generated_at','dataset_version']}
    manifest.update({'format':'ptu-content-pack','format_version':1,'version':'1.0.0','content_counts':counts,'files':files,'generated_at':'2026-09-03','dataset_version':'1.0','notes':'Final handoff pack. Source records remain versioned; lower-priority definitions are never destructively overwritten.'})
    (temp/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    out=PACKS/(pid+'.ptucp')
    with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for p in sorted(temp.rglob('*')):
            if p.is_file():z.write(p,p.relative_to(temp).as_posix())
    manifest['archive']={'filename':out.name,'sha256':sha(out),'bytes':out.stat().st_size};new_registry.append(manifest)
shutil.rmtree(ROOT/'_pack_build')
dump(J/'content_pack_registry.json',new_registry);dump(J/'content_pack_unmapped_records.json',unmapped)

idx=[];conf=[]
for (kind,lid),vers in sorted(version_index.items()):
    sv=sorted(vers,key=lambda x:(x['priority'],x['content_pack_id']));row={'definition_kind':kind,'logical_id':lid,'name':next((x.get('name') for x in reversed(sv) if x.get('name')),None),'versions':sv,'version_count':len(sv),'highest_priority_version':sv[-1]['definition_version_id']};idx.append(row)
    if len(sv)>1:conf.append(row)
dump(J/'definition_version_index.json',idx);dump(J/'definition_conflicts.json',conf)

# Update ruleset versions and snapshots.
rulesets=[]
for p in sorted(RULESETS.glob('*.json')):
    rs=json.loads(p.read_text());rs['version']='1.0.0';dump(p,rs);rulesets.append(rs)
def resolve(rs):
    enabled={p['id']:p for p in rs.get('packs',[]) if p.get('enabled',True)};order={p['id']:i for i,p in enumerate(rs.get('packs',[])) if p.get('enabled',True)};out=[]
    for row in idx:
        cand=[]
        for v in row['versions']:
            if v['content_pack_id'] in enabled:
                x=copy.deepcopy(v);x['_p']=enabled[v['content_pack_id']].get('priority',v['priority']);x['_o']=order[v['content_pack_id']];cand.append(x)
        if not cand:continue
        key=f"{row['definition_kind']}:{row['logical_id']}";pin=rs.get('version_pins',{}).get(key);win=next((x for x in cand if x['definition_version_id']==pin),None) if pin else None
        if not win:win=max(cand,key=lambda x:(x['_p'],x['_o']))
        out.append({'definition_kind':row['definition_kind'],'logical_id':row['logical_id'],'winner_version_id':win['definition_version_id'],'winner_pack_id':win['content_pack_id'],'candidate_count':len(cand)})
    return out
dump(J/'campaign_rulesets.json',rulesets);dump(J/'ruleset_resolution_snapshots.json',{r['id']:resolve(r) for r in rulesets})

# ---------- SQLite final seed ----------
db=SEED/'ptu_seed_v1.0.sqlite3';shutil.copy2(SRC/'ptu_seed_v0.6.sqlite3',db);con=sqlite3.connect(db);con.execute('PRAGMA foreign_keys=OFF')
# Canonical definition tables
for t in ['moves','abilities','capabilities']:
    con.execute(f'DELETE FROM {t}')
for r in moves:
    con.execute('INSERT INTO moves(id,name,type,frequency_text,ac,damage_base,damage_dice,damage_set,class,range_text,effect_text,source_id,source_page,needs_review,raw_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',(r['id'],r.get('name'),r.get('type'),r.get('frequency_text'),r.get('ac'),r.get('damage_base'),r.get('damage_dice'),r.get('damage_set'),r.get('class'),r.get('range_text'),r.get('effect_text'),r.get('source_id'),r.get('source_page'),int(bool(r.get('needs_review'))),json.dumps(r,ensure_ascii=False)))
for r in abilities:
    con.execute('INSERT INTO abilities(id,name,frequency_action_text,trigger_text,target_text,effect_text,source_id,source_page,needs_review,raw_json) VALUES(?,?,?,?,?,?,?,?,?,?)',(r['id'],r.get('name'),r.get('frequency_action_text'),r.get('trigger_text'),r.get('target_text'),r.get('effect_text'),r.get('source_id'),r.get('source_page'),int(bool(r.get('needs_review'))),json.dumps(r,ensure_ascii=False)))
for r in capabilities:
    con.execute('INSERT INTO capabilities(id,name,source_id,source_page,capability_kind,effect_text,needs_review,raw_json) VALUES(?,?,?,?,?,?,?,?)',(r['id'],r.get('name'),r.get('source_id'),r.get('source_page'),r.get('capability_kind'),r.get('effect_text'),int(bool(r.get('needs_review'))),json.dumps(r,ensure_ascii=False)))
# Species rows – keep existing schema and defense profile if present in record.
con.execute('DELETE FROM species')
for sp in species:
    con.execute('INSERT INTO species(id,display_name,national_dex_number,display_dex_id,variant_index,variant_of,variant_kind,generation,enabled,enabled_for_character_creation,mechanical_completeness,types_json,base_stats_json,defense_profile_json,source_id,source_page,needs_review,raw_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',(
        sp['id'],sp.get('display_name') or sp.get('name') or sp['id'],sp.get('national_dex_number',sp.get('dex_number')),sp.get('display_dex_id'),sp.get('variant_index'),sp.get('variant_of'),sp.get('variant_kind'),sp.get('generation'),int(bool(sp.get('enabled',True))),int(bool(sp.get('enabled_for_character_creation',sp.get('enabled',True)))),sp.get('mechanical_completeness','complete'),json.dumps(sp.get('types',[]),ensure_ascii=False),json.dumps(sp.get('base_stats',{}),ensure_ascii=False),json.dumps(sp.get('defense_profile',[]),ensure_ascii=False),sp.get('source_id'),sp.get('source_page'),int(bool(sp.get('needs_review'))),json.dumps(sp,ensure_ascii=False)))
# Validation/unresolved/evolution
con.execute('DELETE FROM reference_unresolved')
for r in unresolved:con.execute('INSERT INTO reference_unresolved(kind,species_id,container,reference,reference_key,suggestions_json) VALUES(?,?,?,?,?,?)',(r['kind'],r['species_id'],r['container'],r.get('reference'),r.get('reference_key'),json.dumps(r.get('suggestions',[]))))
con.execute('DELETE FROM species_reference_validation')
for r in validations:con.execute('INSERT INTO species_reference_validation(species_id,unresolved_abilities,unresolved_moves,unresolved_capabilities,missing_fields_json,needs_review,raw_json) VALUES(?,?,?,?,?,?,?)',(r['species_id'],r['unresolved_abilities'],r['unresolved_moves'],r['unresolved_capabilities'],json.dumps(r['missing_fields']),int(r['needs_review']),json.dumps(r,ensure_ascii=False)))
con.execute('DELETE FROM ptu_evolution_edges')
for e in evo_edges:con.execute('INSERT INTO ptu_evolution_edges(family_id,from_species_name,to_species_name,to_min_level,condition_text,mapping_confidence,source_id,raw_json) VALUES(?,?,?,?,?,?,?,?)',(e.get('family_id'),e.get('from_species_name'),e.get('to_species_name'),e.get('to_min_level'),e.get('condition_text'),e.get('mapping_confidence'),e.get('source_id'),json.dumps(e,ensure_ascii=False)))
# Content/source/version/rulesets
for t in ['content_packs','content_pack_dependencies','definition_versions','campaign_rulesets','campaign_ruleset_packs','campaign_ruleset_version_pins']:
    con.execute(f'DELETE FROM {t}')
for m in new_registry:
    con.execute('INSERT INTO content_packs(id,name,version,priority,kind,browse_only,archive_filename,archive_sha256,manifest_json) VALUES(?,?,?,?,?,?,?,?,?)',(m['id'],m['name'],m['version'],m['priority'],m.get('kind'),int(bool(m.get('browse_only'))),m['archive']['filename'],m['archive']['sha256'],json.dumps(m,ensure_ascii=False)))
    for d in m.get('dependencies',[]):con.execute('INSERT INTO content_pack_dependencies(pack_id,dependency_pack_id,required) VALUES(?,?,?)',(m['id'],d['id'],int(bool(d['required']))))
for kind,recs in pack_content.items():pass
for (kind,lid),vers in version_index.items():
    # locate actual source record once per version
    for v in vers:
        src=next(r for r in pack_content[v['content_pack_id']][kind] if r['definition_version_id']==v['definition_version_id'])
        con.execute('INSERT INTO definition_versions(version_id,definition_kind,logical_id,content_pack_id,source_id,priority,source_page,needs_review,raw_json) VALUES(?,?,?,?,?,?,?,?,?)',(v['definition_version_id'],kind,lid,v['content_pack_id'],v['source_id'],v['priority'],v.get('source_page'),int(bool(v.get('needs_review'))),json.dumps(src,ensure_ascii=False)))
for rs in rulesets:
    con.execute('INSERT INTO campaign_rulesets(id,name,version,description,raw_json) VALUES(?,?,?,?,?)',(rs['id'],rs['name'],rs['version'],rs.get('description'),json.dumps(rs,ensure_ascii=False)))
    for i,p in enumerate(rs.get('packs',[])): con.execute('INSERT INTO campaign_ruleset_packs(ruleset_id,pack_id,enabled,priority,position) VALUES(?,?,?,?,?)',(rs['id'],p['id'],int(bool(p.get('enabled',True))),p.get('priority'),i))
    for k,v in rs.get('version_pins',{}).items():con.execute('INSERT INTO campaign_ruleset_version_pins(ruleset_id,definition_key,version_id) VALUES(?,?,?)',(rs['id'],k,v))
# Metadata
con.execute("INSERT OR REPLACE INTO metadata(key,value) VALUES('dataset_version','1.0')")
con.execute("INSERT OR REPLACE INTO metadata(key,value) VALUES('handoff_stage','7/7 final')")
con.commit(); integrity=con.execute('PRAGMA integrity_check').fetchone()[0]
# FTS rebuild where supported
for fts in ['moves_fts','abilities_fts','capabilities_fts','species_fts']:
    try: con.execute(f"INSERT INTO {fts}({fts}) VALUES('rebuild')")
    except Exception: pass
con.commit();con.close()

# ---------- Fixtures ----------
trainer_fixture={
 'format':'ptu-trainer-fixture','version':1,'id':'fixture-trainer-investigator','name':'Test Investigator','level':5,'exp':0,'money':5000,
 'background':{'name':'Former Investigator','raised_skills':['perception','intuition'],'lowered_skills':['charm']},
 'skills':{'stealth':{'base_rank':'novice'},'perception':{'base_rank':'adept'},'command':{'base_rank':'novice'}},
 'gm_grants':[{'id':'grant-stealth','kind':'fixed','target':'trainer.skill.stealth.check_bonus','operation':'add','value':2,'permanent':True},{'id':'grant-edge','kind':'resource','resource':'edge','amount':1,'allocation':{'definition_id':'skill-edge','parameters':{'skill':'command','rank':'novice'}}}],
 'rosters':[{'id':'roster-personal','name':'Personal','active':True,'max_members':6,'rules':{'combat':True,'personal_use':True,'mount':True}},{'id':'roster-company','name':'Company','active':True,'max_members':6,'rules':{'combat':True,'personal_use':False,'mount':True,'trade':False}}],
 'pokemon':[{'id':'pkm-sableye','species_definition_id':'sableye','nickname':'Fixture Sableye','level':20,'exp':None,'capture_ball_item_id':'poke-ball','injuries':0,'held_item_id':None,'storage_state':'carried','roster_memberships':['roster-personal','roster-company'],'battle_state':{'current_hp':42,'temporary_hp':0,'combat_stages':{'attack':0,'defense':0,'special_attack':0,'special_defense':0,'speed':0},'statuses':[]}}],
 'inventory':{'backpack':[{'item_id':'potion','quantity':3}], 'storage':[{'item_id':'antidote','quantity':2}], 'equipped':{}},
 'timeline':[{'kind':'level_up','level':5,'note':'Fixture milestone'},{'kind':'gm_grant','grant_id':'grant-edge'}]
}
dump(FIX/'trainer_profile_full.json',trainer_fixture)
shop_fixture={'id':'shop-fixture','name':'Fixture Poké Mart','buy_multiplier':1.0,'sell_multiplier':0.5,'items':[{'item_id':'potion','available':True,'buy_override':None,'sell_override':None},{'item_id':'poke-ball','available':True,'buy_override':250,'sell_override':None}]}
dump(FIX/'shop_preset.json',shop_fixture)
override_fixture={'id':'override-fixture','logical_definition':'ability:abominable','base_version':'ability:abominable@feb2016','override':{'effect_text':'Fixture only - do not use as PTU rule.','provenance':'gm_override'},'purpose':'Tests non-destructive campaign override persistence.'}
dump(FIX/'gm_override_example.json',override_fixture)

# ---------- Deterministic test vectors ----------
damage=load('damage_chart.json'); dbmap={int(x['damage_base']):x for x in damage}
def dmgexpr(db,stat):
    d=dbmap[db]['rolled_damage']
    m=re.fullmatch(r'(.+?)([+-]\d+)?',d); # convenience only
    # always append stat arithmetically to constant if present
    mm=re.fullmatch(r'(\d+d\d+)(?:\+(\d+))?',d)
    if mm:return f"{mm.group(1)}+{int(mm.group(2) or 0)+stat}"
    return f'{d}+{stat}'
rule_vectors=[
 {'id':'stab-db4-dark-atk15','input':{'move_db':4,'move_type':'Dark','actor_types':['Dark'],'damage_class':'Physical','attack_stat':15},'expected':{'stab_applies':True,'final_db':6,'damage_expression':'2d6+23'},'source_basis':'Core STAB +2 DB; Core DB6 rolled damage 2d6+8.'},
 {'id':'no-stab-db4-atk15','input':{'move_db':4,'move_type':'Fire','actor_types':['Dark'],'damage_class':'Physical','attack_stat':15},'expected':{'stab_applies':False,'final_db':4,'damage_expression':'1d8+21'}},
 {'id':'single-weakness-step','input':{'weak_count':1,'resistant_count':0,'immune':False},'expected':{'multiplier':1.5}},
 {'id':'double-resistance-step','input':{'weak_count':0,'resistant_count':2,'immune':False},'expected':{'multiplier':0.25}},
]
dump(TV/'rules_engine.json',rule_vectors)
progression_vectors=[
 {'id':'pokemon-level-5','input':{'level':5},'expected':{'stat_points_awarded':1,'tutor_point_awarded':True,'ability_unlock':False,'check_moves_and_evolution':True}},
 {'id':'pokemon-level-20','input':{'level':20},'expected':{'stat_points_awarded':1,'tutor_point_awarded':True,'ability_unlock':True,'check_moves_and_evolution':True}},
 {'id':'trainer-level-5-milestone','input':{'level':5},'expected':{'baseline_stat_point':1,'baseline_feature':1,'milestone_choice_required':True}},
]
dump(TV/'progression_engine.json',progression_vectors)
storage_vectors=[
 {'id':'storage-reject-injured','input':{'injuries':1,'held_item_id':'leftovers'},'expected':{'allowed':False,'reason':'pokemon_has_injuries'}},
 {'id':'storage-accept-healthy','input':{'injuries':0,'held_item_id':'leftovers','battle_state':{'current_hp':10,'statuses':['poisoned'],'combat_stages':{'attack':2}}},'expected':{'allowed':True,'held_item_destination':'trainer_backpack','battle_state_reset':True}},
 {'id':'overlapping-active-rosters','input':{'pokemon_id':'pkm-1','rosters':[{'id':'personal','active':True},{'id':'company','active':True}]},'expected':{'valid':True,'membership_count':2}},
]
dump(TV/'storage_roster.json',storage_vectors)
modifier_vectors=[
 {'id':'fixed-gm-stealth','base':{'trainer.skill.stealth.check_bonus':0},'modifiers':[{'source':'gm_grant','operation':'add','target':'trainer.skill.stealth.check_bonus','value':2,'duration':'permanent'}],'expected':{'trainer.skill.stealth.check_bonus':2,'survives_respec':True}},
 {'id':'resource-grant-reallocation','grant':{'resource':'edge','amount':1,'allocation':'skill-edge:charm'},'respec':{'new_allocation':'skill-edge:command'},'expected':{'resource_amount':1,'allocation':'skill-edge:command','grant_preserved':True}},
]
dump(TV/'modifier_engine.json',modifier_vectors)
content_vectors=[]
snaps=load('ruleset_resolution_snapshots.json')
for rsid in ['ptu-core-only','ptu-official-with-playtests','all-provided-material']:
    found=next((x for x in snaps.get(rsid,[]) if x['definition_kind']=='abilities' and x['logical_id']=='abominable'),None)
    if not found: found=next((x for x in snaps.get(rsid,[]) if x['definition_kind']=='ability' and x['logical_id']=='abominable'),None)
    content_vectors.append({'id':'abominable-'+rsid,'ruleset':rsid,'definition':'ability:abominable','expected_winner_version_id':found['winner_version_id'] if found else None})
dump(TV/'content_resolver.json',content_vectors)
shop_vectors=[{'id':'default-sale-half','input':{'base_price':200,'quantity':3,'sell_multiplier':0.5},'expected':{'money_added':300}},{'id':'buy-override','input':{'catalog_price':200,'transaction_price':250,'quantity':2,'money_before':1000},'expected':{'money_after':500,'inventory_delta':2}}]
dump(TV/'inventory_shop.json',shop_vectors)

# ---------- External data import support ----------
external_readme='''# External factual/display data not bundled\n\nThe supplied PTU PDFs do not contain a complete National Dex mapping for every older species and do not contain the console-game Pokédex flavor-text corpus. The final handoff therefore does **not** fabricate these fields.\n\nThe runtime/model already supports them. During development, a maintainer may import a factual National Dex CSV from a permissively usable source (for example PokeAPI's `pokemon_species.csv`) using `scripts/import_national_dex_csv.py`. This is a build-time enrichment step only; the released app remains offline.\n\nPokédex flavor entries use the schema in `schemas/pokedex-flavor-entry-v1.schema.json`. Only text the project is entitled to redistribute should be packaged.\n'''
(EXT/'README.md').write_text(external_readme,encoding='utf-8')
importer='''#!/usr/bin/env python3\nimport csv,json,pathlib,sys,re,unicodedata\nif len(sys.argv)!=3:\n print('usage: import_national_dex_csv.py pokemon_species.csv pokemon_species.json');raise SystemExit(2)\ndef key(s):return re.sub(r'[^a-z0-9]+','',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower())\nrows=list(csv.DictReader(open(sys.argv[1],encoding='utf-8'))); mp={key(r['identifier']):int(r['id']) for r in rows}\np=pathlib.Path(sys.argv[2]);data=json.loads(p.read_text(encoding='utf-8'));changed=0\nfor sp in data:\n if sp.get('variant_of'): base=key(sp.get('variant_of','')); n=mp.get(base)\n else:n=mp.get(key(sp.get('display_name','')))\n if n and not sp.get('national_dex_number'):\n  sp['national_dex_number']=n;sp['dex_number']=n;changed+=1\np.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\\n',encoding='utf-8');print('updated',changed)\n'''
(SCR/'import_national_dex_csv.py').write_text(importer,encoding='utf-8')
flavor_schema={'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'https://ptu-companion.local/schemas/pokedex-flavor-entry-v1.schema.json','type':'object','required':['species_key','game','language','text','source_id'],'properties':{'species_key':{'type':'string'},'game':{'type':'string'},'language':{'type':'string'},'text':{'type':'string'},'source_id':{'type':'string'}}}
dump(S/'pokedex-flavor-entry-v1.schema.json',flavor_schema)

# ---------- Final reports & docs ----------
# Critical counts
unres_by_kind=collections.Counter(r['kind'] for r in unresolved)
needs_review_counts={'moves':sum(bool(x.get('needs_review')) for x in moves),'abilities':sum(bool(x.get('needs_review')) for x in abilities),'capabilities':sum(bool(x.get('needs_review')) for x in capabilities),'features':sum(bool(x.get('needs_review')) for x in load('features.json'))}
complete=sum(x.get('mechanical_completeness')=='complete' for x in species); enabled=sum(bool(x.get('enabled_for_character_creation',x.get('enabled'))) for x in species)
report=f'''# PTU Companion — Final Data QA Report v1.0\n\n## Status\nStage **7/7 complete**. This handoff is an implementation seed, not a claim that every narrative/conditional PTU rule is machine-executable. Source text and provenance remain authoritative for manual/hybrid rules.\n\n## Final counts\n\n| Dataset | Count |\n|---|---:|\n| Moves (canonical winners) | {len(moves)} |\n| Move source versions | {len(movevers)} |\n| Abilities (canonical winners) | {len(abilities)} |\n| Ability source versions | {len(abilityvers)} |\n| Capabilities | {len(capabilities)} |\n| Capability source versions | {len(capvers)} |\n| Features records | {len(load('features.json'))} |\n| Edges | {len(load('edges.json'))} |\n| Poké Edges | {len(load('poke_edges.json'))} |\n| Items | {len(load('items.json'))} |\n| Species/form/reference records | {len(species)} |\n| Mechanically complete species records | {complete} |\n| Enabled for character creation | {enabled} |\n| PTU evolution edges | {len(evo_edges)} |\n| Content packs | {len(new_registry)} |\n| Definition versions | {sum(len(x['versions']) for x in idx)} |\n| Logical definitions with >1 version | {len(conf)} |\n| Final targeted/data repairs logged | {len(repair_log)} |\n| Final layout records quarantined | {len(quarantine)} |\n| Remaining unresolved move refs | {unres_by_kind['move']} |\n| Remaining unresolved ability refs | {unres_by_kind['ability']} |\n| Remaining unresolved capability refs | {unres_by_kind['capability']} |\n\nSQLite `PRAGMA integrity_check`: **{integrity}**.\n\n## High-value final corrections\n- Restored Charcadet/Armarouge/Ceruledge/Kingambit Ability slots directly from `Knight.pdf`.\n- Added source-defined Knight Moves: Expanding Force, Armor Cannon, Bitter Blade, Kowtow Cleave, Lash Out.\n- Added source-defined Knight Abilities: White Knight, Death Knight, Supreme Overlord.\n- Ensured Pack Lord is transported as a versioned Capability in the Knight content pack.\n- Added Needlene's source-defined Overlocker Ability and restored its Ability slots.\n- Corrected obvious Needlene move-name typos while retaining repair provenance.\n- Restored complete Ability slots for the supplied Paldean Pidgey line and normalized Thunder Wave/Electro Ball spelling/layout.\n- Resolved the Wurmple split evolution graph as four explicit source-supported edges.\n- Applied conservative page-layout cleanup only when the remaining prefix/segments exactly resolve to known supplied definitions; discarded-looking text is quarantined, not destroyed.\n\n## Intentional gaps\n- National Dex numbers for many pre-891 PTU-source records remain nullable because the supplied Gen8ish PDF is not ordered by National Dex. A build-time CSV importer is supplied instead of guessing.\n- Console-game Pokédex flavor text is not present in the supplied PDFs and is not redistributed. The schema/import path is ready.\n- References to later moves such as Tera Blast/Poltergeist remain unresolved where no mechanical definition exists in the supplied rules material.\n- Some species Capabilities are referenced by name but have no definition in the supplied sources; those remain review items.\n- Conditional/narrative rules remain `manual_text` or `hybrid`; this is deliberate.\n\nSee `KNOWN_GAPS_v1.0.md` and `seed/json/species_reference_gaps.json` for the machine-readable queue.\n'''
(ROOT/'DATA_QUALITY_REPORT_v1.0.md').write_text(report,encoding='utf-8')
known=f'''# PTU Companion — Known Gaps v1.0\n\nThese are **explicitly preserved gaps**, not silent assumptions.\n\n1. **Pokédex flavor entries** — schema supported; corpus not bundled because it is absent from supplied PDFs.\n2. **National Dex mapping for older source records** — many are null; run the included build-time importer against a factual species CSV rather than deriving numbers from PDF page order.\n3. **Later Move references without supplied PTU definitions** — e.g. Tera Blast and some later-generation moves may appear on homebrew species and remain disabled/unresolved until authored in the Windows editor or an additional content pack.\n4. **Capability definition gaps** — recurring names such as Breathless and certain forme/fusion capabilities are referenced by species but not safely defined in supplied material.\n5. **Semantic automation** — narrative/context-dependent rules remain manual/hybrid. The UI must always display original Effect text.\n6. **Source-specific oddities are preserved** — e.g. `Knight.pdf` mechanically lists Ceruledge and Kingambit as Fire Type; the app must not silently replace campaign-source mechanics with videogame canon.\n\nRemaining reference counts at handoff: moves {unres_by_kind['move']}, abilities {unres_by_kind['ability']}, capabilities {unres_by_kind['capability']}.\n'''
(ROOT/'KNOWN_GAPS_v1.0.md').write_text(known,encoding='utf-8')

# Implementation plan is intentionally agent-oriented.
impl='''# PTU Companion — Agent Implementation Plan v1.0\n\n## Read order\n1. `README_FIRST.md`\n2. `TECHNICAL_SPECIFICATION_v1.0.md`\n3. `seed/DATA_FORMAT_v1.0.md`\n4. `test_vectors/`\n5. `fixtures/`\n6. Implement, using `.ptucp` imports rather than hardcoding rule text.\n\n## Milestones\n1. Tauri 2 workspace + Windows/Android smoke builds.\n2. Runtime SQLite migrations and staged `.ptucp` importer with hash/schema/path-traversal validation.\n3. Ruleset/version resolver.\n4. Trainer + Pokémon instance repositories and profile lazy-loading.\n5. Modifier/explainability engine.\n6. Progression/validation engine and creation/level-up wizards.\n7. Resolved Move service (STAB/DB/damage expression/weapon variant; no dice rolling).\n8. Active combat state + round/scene/day reset service.\n9. Rosters/storage invariants.\n10. Inventory/equipment/shop transactions.\n11. GM grants/respec/history.\n12. Search/Pokédex/rules UI.\n13. Import/export trainer packs and embedded referenced homebrew.\n14. Windows content editor.\n15. Android performance pass and ARM64 release APK.\n\n## Hard requirements\n- No PTU rules in React components.\n- No fixed six-Move array for Pokémon; limit is resolved by rules. Trainer Move list is unlimited.\n- No destructive content overwrite.\n- `Injuries > 0` blocks Pokémon Storage.\n- A Pokémon may belong to multiple active Rosters.\n- The app never rolls dice.\n- Derived values expose provenance/explanation.\n- All import mutation is staged/transactional.\n\n## Definition quality behavior\n`needs_review`, `mechanical_completeness`, `reference_status`, and semantic `automation_level` are runtime-visible quality signals. Do not treat missing/ambiguous fields as zero or false.\n'''
(ROOT/'IMPLEMENTATION_PLAN.md').write_text(impl,encoding='utf-8')

# Seed data format final summary
fmt='''# PTU Companion Seed/Data Format v1.0\n\n- Runtime canonical persistence: SQLite.\n- Content authoring/interchange: JSON/NDJSON.\n- Human review convenience: CSV.\n- Content pack extension: `.ptucp` = ZIP container with `manifest.json` + `content/*.ndjson` + optional `content/datasets/*.json`.\n- Trainer export extension planned by Technical Specification: `.ptutrainer`.\n- Full backup extension: `.ptubackup`.\n\n## Content resolution\n1. Explicit version pin, if valid.\n2. Enabled packs only.\n3. Highest effective pack priority.\n4. Ruleset order tie-break.\n5. GM override applies to resolved character/campaign state without mutating source version.\n\n## Rule quality\n- `machine_ready`: structured effect/prerequisite can be applied automatically.\n- `hybrid`: apply only compiled clauses and display/require the remaining textual adjudication.\n- `manual_text`: display source rule; never infer behavior at runtime.\n\n## Species quality\n- `complete` + enabled: legal for creation under pack/ruleset validation.\n- `partial|incomplete`: browse/edit only by default.\n- unresolved references remain explicit and searchable.\n\n## Images\nUser images are external files referenced by UUID/path; import should downscale and convert to WebP. Do not store normal images as SQLite BLOBs.\n'''
(SEED/'DATA_FORMAT_v1.0.md').write_text(fmt,encoding='utf-8')

# Update technical spec v0.1 -> v1.0 + final handoff addendum.
spec=pathlib.Path('/mnt/data/PTU_Companion_Technical_Specification.md').read_text(encoding='utf-8')
spec=spec.replace('Version: 0.1 (implementation baseline)','Version: 1.0 (final implementation handoff)')
add='''\n\n## 33. Final handoff data contract (v1.0)\n\nThe implementation MUST bootstrap rule content from the `.ptucp` files in this handoff. `seed/ptu_seed_v1.0.sqlite3` is a build/reference snapshot and must not be used as the writable Trainer database. On first run/app upgrade, import definitions into versioned runtime tables or ship a read-only definitions database beside the writable profile database.\n\nRequired content fields include logical ID, definition version ID, content pack ID, source provenance, quality flags, raw/source text where available, and compiled semantics where safe.\n\nThe final bundle contains deterministic test vectors. Those vectors are acceptance contracts for the rules layer, especially STAB/DB resolution, progression, GM grants, storage invariants, overlapping Rosters, content-version resolution, and shop arithmetic.\n\n## 34. Runtime database separation\n\nRecommended physical split:\n\n```text\ndefinitions.sqlite   read-mostly imported content/version/search indexes\nprofiles.sqlite      Trainer/Pokémon/NPC/shop/history state\nmedia/               portraits and custom Pokémon/NPC images\n```\n\nA single SQLite file is acceptable for v1 only if archived profiles are not eagerly hydrated and definition updates are transactionally isolated from user state. Never overwrite user state by replacing the seed DB.\n\n## 35. `.ptucp` import transaction\n\n1. Open archive with ZIP-slip/path traversal checks.\n2. Parse `manifest.json`; reject unsupported `format_version`.\n3. Verify every manifest SHA-256 before parsing payload.\n4. Validate JSON/NDJSON records.\n5. Check required pack dependencies.\n6. Stage all rows in a transaction/temp tables.\n7. Upsert by `definition_version_id`; never overwrite a different source version.\n8. Rebuild/refresh FTS indexes.\n9. Re-resolve affected Campaign Rulesets.\n10. Commit atomically; rollback on any error.\n\nScripts inside packs are never executed.\n\n## 36. Resolved Move acceptance contract\n\nFor a damaging Move, deterministic display resolution is:\n\n```text\nbase DB\n→ multi-strike DB rule when applicable\n→ DB modifiers such as STAB\n→ damage-chart expression\n→ add Attack or Special Attack and static bonuses\n→ display expression\n```\n\nDo not subtract target Defense or apply effectiveness until presenting a target-specific preview; the normal sheet Move card should represent the attacker's pre-roll expression. No dice are rolled by the application.\n\nRequired fixture: DB4 Dark Physical Move, Dark user, Attack 15 => STAB DB6 => `2d6+23`.\n\n## 37. Quality/fallback behavior\n\n- Unknown values are nullable, never coerced to zero.\n- `needs_review=true` must not be hidden.\n- `manual_text` effects are not auto-applied.\n- `hybrid` effects apply only explicitly structured atoms.\n- Incomplete species remain browseable but not selectable for character creation unless a GM-authored complete definition/override is active.\n- Source mechanics are not silently “corrected” to videogame canon.\n\n## 38. External Pokédex display enrichment\n\nThe supplied PTU documents do not contain the complete console-game Pokédex flavor corpus. The model supports flavor entries, but the final seed deliberately omits that corpus. A separately licensed/user-supplied content pack may add records with `species_key`, `game`, `language`, `text`, and `source_id`.\n\nLikewise, older National Dex numbers should be imported from a factual species mapping rather than guessed from Gen8ish PDF order. A build-time importer is included in the handoff.\n\n## 39. Final acceptance gates\n\nBefore a release candidate is considered usable:\n- all JSON and manifests parse;\n- all `.ptucp` hashes verify;\n- SQLite integrity check passes;\n- test vectors pass;\n- Trainer profile can be created, closed, reopened without loading archived profiles;\n- one Pokémon can belong to two active Rosters;\n- injured Pokémon Storage transfer is rejected;\n- healthy transfer returns Held Item to Backpack and clears dynamic battle state;\n- GM Resource Grant survives respec;\n- Windows editor can create a new definition version/content pack;\n- Android can import that pack and use it offline.\n\n## 40. Handoff files\n\nUse `README_FIRST.md` as the authoritative file map. `DATA_QUALITY_REPORT_v1.0.md` and `KNOWN_GAPS_v1.0.md` describe what remains deliberately manual/incomplete.\n'''
(ROOT/'TECHNICAL_SPECIFICATION_v1.0.md').write_text(spec+add,encoding='utf-8')

readme=f'''# PTU Companion — Final Agent Handoff v1.0\n\n**Data preparation: 7/7 stages complete.**\n\nStart with:\n1. `TECHNICAL_SPECIFICATION_v1.0.md`\n2. `IMPLEMENTATION_PLAN.md`\n3. `seed/DATA_FORMAT_v1.0.md`\n4. `test_vectors/`\n5. `DATA_QUALITY_REPORT_v1.0.md`\n\n## What is already prepared\n- versioned Moves, Abilities, Capabilities, Features, Edges, Poké Edges, Items and Species;\n- 18 importable `.ptucp` content packs;\n- four example Campaign Rulesets;\n- PTU Damage Base/type/progression datasets;\n- semantic prerequisite/effect structures where safely parsed;\n- Species type-defense profiles and evolution graphs;\n- final SQLite reference/search seed;\n- fixtures and deterministic test vectors;\n- source provenance, repair log, unresolved-reference queues and quarantine.\n\n## What the coding agent should NOT spend time doing first\nDo not retype the Core, invent missing rules, or flatten all content into one winner-only table. Implement the importer/resolver/domain services first. Targeted data gaps are already enumerated.\n\n## Key final counts\n- {len(moves)} canonical Moves / {len(movevers)} source versions\n- {len(abilities)} canonical Abilities / {len(abilityvers)} source versions\n- {len(capabilities)} Capabilities\n- {len(load('features.json'))} Feature records\n- {len(load('items.json'))} Items\n- {len(species)} Species/form/reference records ({complete} mechanically complete)\n- {len(new_registry)} Content Packs\n- SQLite integrity: {integrity}\n\nThis package contains no Trainer save from a real player; fixtures are synthetic.\n'''
(ROOT/'README_FIRST.md').write_text(readme,encoding='utf-8')

# Copy build script itself into handoff.
shutil.copy2('/mnt/data/build_final_handoff_v10.py',SCR/'build_final_handoff_v10.py')

# Verifier script.
verifier='''#!/usr/bin/env python3\nimport json,pathlib,hashlib,zipfile,sqlite3,sys\nR=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else pathlib.Path(__file__).resolve().parents[1])\nerrs=[]\n# JSON\nfor p in R.rglob('*.json'):\n try:json.loads(p.read_text(encoding='utf-8'))\n except Exception as e:errs.append(f'JSON {p}: {e}')\n# Packs\nfor p in (R/'content_packs').glob('*.ptucp'):\n try:\n  with zipfile.ZipFile(p) as z:\n   m=json.loads(z.read('manifest.json'));\n   for rel,meta in m.get('files',{}).items():\n    b=z.read(rel);h=hashlib.sha256(b).hexdigest();\n    if h!=meta['sha256']:errs.append(f'pack hash {p.name}:{rel}')\n except Exception as e:errs.append(f'pack {p}: {e}')\n# DB\ntry:\n con=sqlite3.connect(R/'seed'/'ptu_seed_v1.0.sqlite3');res=con.execute('pragma integrity_check').fetchone()[0];con.close();\n if res!='ok':errs.append('sqlite '+res)\nexcept Exception as e:errs.append('sqlite '+str(e))\n# final manifest\nmp=R/'manifest.json'\nif mp.exists():\n m=json.loads(mp.read_text());\n for rel,meta in m.get('files',{}).items():\n  p=R/rel\n  if not p.exists():errs.append('missing '+rel);continue\n  h=hashlib.sha256(p.read_bytes()).hexdigest();\n  if h!=meta['sha256']:errs.append('manifest hash '+rel)\nprint('OK' if not errs else '\\n'.join(errs));raise SystemExit(1 if errs else 0)\n'''
(SCR/'verify_handoff.py').write_text(verifier,encoding='utf-8')

# QA JSON and manifest before verifier.
qa={'stage':'7/7','status':'complete','sqlite_integrity':integrity,'counts':{'moves':len(moves),'move_versions':len(movevers),'abilities':len(abilities),'ability_versions':len(abilityvers),'capabilities':len(capabilities),'capability_versions':len(capvers),'features':len(load('features.json')),'edges':len(load('edges.json')),'poke_edges':len(load('poke_edges.json')),'items':len(load('items.json')),'species':len(species),'complete_species':complete,'enabled_species':enabled,'content_packs':len(new_registry),'definition_versions':sum(len(x['versions']) for x in idx),'definition_conflicts':len(conf),'repairs':len(repair_log),'quarantine':len(quarantine),'unresolved':dict(unres_by_kind)},'checks':{'unmapped_pack_records':len(unmapped),'evolution_review_entries':0}}
dump(J/'final_qa_summary.json',qa)

# Final manifest of every file except manifest itself.
files={}
for p in sorted(ROOT.rglob('*')):
    if p.is_file() and p.name!='manifest.json':
        rel=p.relative_to(ROOT).as_posix();files[rel]={'sha256':sha(p),'bytes':p.stat().st_size}
manifest={'format':'ptu-companion-agent-handoff','version':'1.0.0','generated_at':'2026-09-03','stage':'7/7','files':files,'sqlite_integrity':integrity}
dump(ROOT/'manifest.json',manifest)

# Run built-in pack+manifest verification (inline) before zipping.
errors=[]
for p in PACKS.glob('*.ptucp'):
    try:
        with zipfile.ZipFile(p) as z:
            m=json.loads(z.read('manifest.json'))
            for rel,meta in m.get('files',{}).items():
                b=z.read(rel)
                if hashlib.sha256(b).hexdigest()!=meta['sha256']: errors.append(f'{p.name}:{rel}:hash')
    except Exception as e:errors.append(f'{p.name}:{e}')
if integrity!='ok':errors.append('sqlite_integrity')
if unmapped:errors.append(f'unmapped={len(unmapped)}')
if errors:raise RuntimeError('Final QA failed: '+repr(errors[:20]))

# Zip final handoff.
if ZIP.exists():ZIP.unlink()
with zipfile.ZipFile(ZIP,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for p in sorted(ROOT.rglob('*')):
        if p.is_file():z.write(p,p.relative_to(ROOT).as_posix())
print(json.dumps({'root':str(ROOT),'zip':str(ZIP),'qa':qa},ensure_ascii=False,indent=2))
