#!/usr/bin/env python3
import json, sqlite3, re, pathlib, sys

ROOT=pathlib.Path(__file__).resolve().parents[1]
DB=ROOT/'seed'/'definitions'/'ptu_seed_v1.0.sqlite3'

SKILL_NAMES={
 'acrobatics':'Acrobatics','athletics':'Athletics','combat':'Combat','intimidate':'Intimidate','stealth':'Stealth','survival':'Survival',
 'general education':'General Education','medicine education':'Medicine Education','occult education':'Occult Education','pokemon education':'Pokémon Education',
 'pokémon education':'Pokémon Education','technology education':'Technology Education','guile':'Guile','perception':'Perception','charm':'Charm','command':'Command','focus':'Focus','intuition':'Intuition'
}
RANKS={'pathetic':1,'untrained':2,'novice':3,'adept':4,'expert':5,'master':6,'virtuoso':8}

def slug(v):
    import unicodedata
    v=unicodedata.normalize('NFD',str(v or '')).encode('ascii','ignore').decode().lower().strip()
    return re.sub(r'(^-|-$)','',re.sub(r'[^a-z0-9]+','-',v))

def skill_leaf(rank, skill):
    s=SKILL_NAMES.get(skill.lower(),skill)
    return {'op':'leaf','kind':'skill_rank_min','raw':f'{rank.title()} {s}','skill':slug(s),'skill_name':s,'rank':rank.lower(),'rank_value':RANKS[rank.lower()]}

def feat_leaf(name): return {'op':'leaf','kind':'has_feature','raw':name,'name':name,'id':slug(name)}
def edge_leaf(name): return {'op':'leaf','kind':'has_edge','raw':name,'name':name,'id':slug(name)}
def manual_leaf(text): return {'op':'leaf','kind':'manual','raw':text}
def all_ast(*children,raw=None): return {'op':'all','raw':raw or ', '.join(c.get('raw','') for c in children),'children':list(children)}
def any_ast(*children,raw=None): return {'op':'any','raw':raw or ' or '.join(c.get('raw','') for c in children),'children':list(children)}
def sem(ast,status='full'):
    leaves=[]
    def walk(n):
        if not n:return
        if n.get('op') in ('all','any'):
            for c in n.get('children',[]):walk(c)
        else:leaves.append(n)
    walk(ast)
    manual=sum(1 for x in leaves if x.get('kind')=='manual')
    return {'status':status if not manual else 'partial','ast':ast,'rank_asts':[],'manual_leaf_count':manual,'leaf_count':len(leaves)}

def none_sem(): return sem({'op':'leaf','kind':'none','raw':'None'})

def record(source_id, page, name, *, id=None, kind='features', tags=None, parent=None, section=None, prereq=None, activation=None, target=None, trigger=None, effect=None, special=None, extra=None, cost=None, raw_text=None, needs_review=False, prereq_sem=None, compiled=None, training_feature=False, profession=None):
    rid=id or slug(name)
    source_title='Especial Classes' if source_id=='especial' else 'Classes extras'
    raw={
      'id':rid,'name':name,'source_id':source_id,'source_title':source_title,'source_kind':'homebrew','source_priority':180,'source_page':page,
      'record_kind': {'features':'feature','edges':'edge','poke_edges':'poke_edge'}[kind],
      'tags':tags or [],'parent_class':parent,'section':section or ('Homebrew Especial Classes' if source_id=='especial' else 'Homebrew Classes Extra'),
      'prerequisites_text':prereq,'activation_text':activation,
      'frequency':{'raw':activation or '', 'scope':None,'uses':None,'ap_cost':None,'ap_mode':None,'actions':[],'interrupt':False,'reaction':False,'priority':None},
      'cost_text':cost,'target_text':target,'trigger_text':trigger,'effect_text':effect,'special_text':special,'bonus_text':None,'condition_text':None,'extra_text':extra,
      'raw_text':raw_text or '\n'.join(x for x in [name, ''.join(f'[{t}]' for t in (tags or [])), prereq, activation, f'Target: {target}' if target else None, f'Trigger: {trigger}' if trigger else None, f'Effect: {effect}' if effect else None, f'Special: {special}' if special else None, f'Extra: {extra}' if extra else None] if x),
      'needs_review':bool(needs_review),
      'compiled_effects':compiled or [],
      'effect_semantics':{'unstructured_text':effect,'coverage':'partial' if compiled else ('manual' if effect else 'none'),'clause_count':1 if effect else 0,'structured_clause_count':len(compiled or [])},
      'semantic_automation':{'level':'hybrid' if compiled else ('manual_text' if effect else 'metadata_only'),'prerequisite_status':(prereq_sem or none_sem()).get('status','full'),'effect_coverage':'partial' if compiled else ('manual' if effect else 'none'),'semantic_version':'0.4-beta4'}
    }
    if prereq_sem is not None: raw['prerequisite_semantics']=prereq_sem
    elif prereq: raw['prerequisite_semantics']=sem(manual_leaf(prereq),'partial')
    else: raw['prerequisite_semantics']=none_sem()
    if training_feature: raw['training_feature']=True
    if profession: raw['profession']=profession
    return {'kind':kind,'raw':raw}

records=[]
add=records.append
# -------------------------------------------------------------------------
# Especial Classes.pdf — Hacker + Police Officer
# -------------------------------------------------------------------------
add(record('especial',2,'Hacker',tags=['Class','+Speed','Gift'],parent='Hacker',prereq='Prerequisites: Adept Technology Education',activation='Extended Action',target='Self',effect='Whenever the hacker is rolling a Technology Education check and this test applies the Skill Stunt (Hacker), it may roll twice and take the best result on both tests. Receive the Skill Stunt (Hacker).',prereq_sem=sem(skill_leaf('adept','technology education'))))
add(record('especial',2,"Porygon's Gift",id='porygon-s-gift',tags=['+Speed'],parent='Hacker',prereq='Prerequisite: Hacker',activation='Extended Action',target='Your Pokémon',effect='The target loses 2 Tutor Points and receives the Ability Download.',extra='You have the Ability Download.',prereq_sem=sem(feat_leaf('Hacker')),compiled=[{'kind':'grant_entity','entity_kind':'ability','entity_id':'download','entity_name':'Download','confidence':'high','source_text':'Extra: You have the Ability Download.'}]))
add(record('especial',2,'Energetic',tags=['Ranked 2','+Speed'],parent='Hacker',prereq="Rank 1: Hacker, Porygon's Gift. Rank 2: Expert Technology Education, Energetic Rank 1.",effect='Rank 1: You receive the Moves Eerie Impulse and Lock-On. Rank 2: You receive the Moves Techno Blast and Flash Cannon.',needs_review=False,prereq_sem=sem(feat_leaf('Hacker'),'partial')))
add(record('especial',2,'Fast Texting',tags=['+Speed'],parent='Hacker',prereq='Prerequisite: Hacker',activation='1 AP',effect='You can make the hacking test faster. You finish the test in a full round instead of the Extended Action.',prereq_sem=sem(feat_leaf('Hacker'))))
add(record('especial',2,'Master Hacker',tags=['+Speed'],parent='Hacker',prereq='Prerequisite: Fast Texting, Master Technology Education',activation='Bind 2 AP; 1/Daily',effect='You can enter the Digital World without equipment. While the Action Points are bound, you can transfer your consciousness to the Digital World.',prereq_sem=sem(all_ast(feat_leaf('Fast Texting'),skill_leaf('master','technology education')))))
add(record('especial',2,'Stalker',tags=['+Speed'],parent='Hacker',prereq='Prerequisite: Hacker',effect="Whenever you do a Technology Education check with the Skill Stunt (Hacker), you do not need another test to hide your tracks; apply the same test. Your Pokémon have the same Technology Education dice rank as yours, maximum Master.",prereq_sem=sem(feat_leaf('Hacker'))))

add(record('especial',4,'Police Officer',id='police-officer',tags=['Class','+Attack','Weapon'],parent='Police Officer',prereq='Prerequisites: Novice Combat, Novice Intuition',effect='When using a weapon to make a physical attack, add your Combat rank to the damage. While with a shield, you can change your Shield DR for your Intuition.',prereq_sem=sem(all_ast(skill_leaf('novice','combat'),skill_leaf('novice','intuition')))))
add(record('especial',4,'Kevlar',tags=['+Attack','Weapon'],parent='Police Officer',prereq='Prerequisite: Police Officer',activation='Extended Action',effect='Your Pokémon loses 2 Tutor Points and gains the Ability Bulletproof.',extra='You have the Ability Bulletproof.',prereq_sem=sem(feat_leaf('Police Officer')),compiled=[{'kind':'grant_entity','entity_kind':'ability','entity_id':'bulletproof','entity_name':'Bulletproof','confidence':'high','source_text':'Extra: You have the Ability Bulletproof.'}]))
add(record('especial',4,'Riot Police',tags=['+Attack','Shield'],parent='Police Officer',prereq='Prerequisite: Police Officer, Adept Intuition',activation='1 AP',effect='You receive temporary Hit Points equal to twice your Intuition whenever you pay 1 AP.',prereq_sem=sem(all_ast(feat_leaf('Police Officer'),skill_leaf('adept','intuition')))))
add(record('especial',4,'Swat Style',tags=['+Attack','Weapon(Physical)'],parent='Police Officer',prereq='Prerequisite: Police Officer, Adept Combat',activation='Static',effect='When you use a heavy weapon to make a Struggle Attack, add +1 Damage Base.',prereq_sem=sem(all_ast(feat_leaf('Police Officer'),skill_leaf('adept','combat')))))
add(record('especial',4,'Canine',tags=['+Attack'],parent='Police Officer',prereq='Prerequisite: Police Officer, Master Intuition',activation='Extended Action',effect='Your Pokémon may learn Odor Sleuth. If you pay 1 Tutor Point, this Move no longer takes a Move Slot.',extra='You have Odor Sleuth.',prereq_sem=sem(all_ast(feat_leaf('Police Officer'),skill_leaf('master','intuition'))),compiled=[{'kind':'grant_entity','entity_kind':'move','entity_id':'odor-sleuth','entity_name':'Odor Sleuth','confidence':'high','source_text':'Extra: You have Odor Sleuth.'}]))
add(record('especial',4,'Light Shot Style',tags=['+Attack','Weapon(Physical)'],parent='Police Officer',prereq='Prerequisite: Police Officer, Adept Combat',activation='Static',effect='When you use a light weapon to make a Struggle Attack, the damaging attack receives 1d6+8 damage.',prereq_sem=sem(all_ast(feat_leaf('Police Officer'),skill_leaf('adept','combat')))))
add(record('especial',4,'Capitan',tags=['+Attack','Weapon(Physical)'],parent='Police Officer',prereq='Prerequisite: 4 Police Officer Features',activation='Static',effect='When you use physical weapons, you master your abilities with them to the edge. Adept Intuition Move: Take Aim. Master Intuition Move: Mat Block (Scene).',prereq_sem=sem({'op':'leaf','kind':'feature_count_min','raw':'4 Police Officer Features','group':'Police Officer','count':4})))

# Professions occupy the campaign Training Feature slot.
PROF_SECTION='Campaign Professions · Training Features'
def prof(name,page,tags,effect,salary=None,hours=None,skills=None,id=None,prereq=None,prereq_sem=None,compiled=None,needs_review=False):
    meta={'salary_weekly':salary,'hours':hours,'connected_skills':skills or []}
    return record('especial',page,name,id=id,tags=['Training','Profession',*tags],section=PROF_SECTION,prereq=prereq,effect=effect,training_feature=True,profession=meta,prereq_sem=prereq_sem or none_sem(),compiled=compiled,needs_review=needs_review)
add(prof('Investigator',5,['+Speed'],'Adept: on Extended Actions, add Perception to Intuition and Intuition to Perception. Master: when an Extended Action to look for clues succeeds, collect one additional clue.',salary=3600,hours='8/5',skills=['Perception','Intuition']))
add(prof('Bounty Hunter',5,['+Speed'],'You may have a number of active contracts equal to your Intuition. Add +3 to Combat checks made to apprehend the target of your bounty.',salary='bounty',hours='campaign-defined',skills=['Combat','Intuition']))
add(prof('Pedreiro',5,['+HP'],'You gain the Move Strength. Whenever Athletics increases your Power Capability, increase Power by 1 additional point.',salary=36000,hours='8/6',skills=['Athletics'],compiled=[{'kind':'grant_entity','entity_kind':'move','entity_id':'strength','entity_name':'Strength','confidence':'high','source_text':'You gain the Move Strength.'}]))
add(prof('Handyman / Housewife',6,['+HP'],'Use General Education for actions to maintain a house. Actions to care for the house take half the normal time.',salary=36000,hours='6/7',skills=['General Education'],id='handyman-housewife'))
add(prof('Dirty Jobber',6,['+HP'],'Gain three profession merits: Fearless (+3 to checks against fear), Tolerance for Biology (+3 in stomach-turning situations), and Determined (+3 against checks that would prevent execution of your work).',salary=90000,hours='7/7',skills=['Focus']))
add(prof('Promotor',6,['+Attack'],'With Adept General Education, when you make a General Education check about the case you are prosecuting, gain a Stunt for that case (Intimidate test). Extra: may buy the Judge Feature.',salary=72000,hours='4/6',skills=['General Education','Intimidate']))
add(prof('Defensor',6,['+Defense'],'With Adept General Education, when you make a General Education check about the case you are defending, gain a Stunt for that case (Charm test). Extra: may buy the Judge Feature.',salary=72000,hours='4/6',skills=['General Education','Charm']))
add(prof('Juiz',6,['+Special Defense'],'With Master General Education, when you make a General Education check about the case you are judging, gain a Stunt for that case (Intuition test).',salary=180000,hours='4/6',skills=['General Education','Intuition'],id='juiz'))
add(prof('Plutocrata · Wealth',7,['+Speed'],'Make an Extended Action check with a chosen Education Skill to earn money. Accumulate a total result of 200 across checks to receive the weekly salary.',salary=360000,hours='campaign-defined',skills=['Guile','Education'],id='plutocrat-wealth'))
add(prof('Plutocrata · Influence',7,['+Speed'],'Make a Guile check to gain influence. For each 200 accumulated points, gain 1 temporary contact used for blackmail or alliance.',salary=360000,hours='campaign-defined',skills=['Guile','Education'],id='plutocrat-influence'))
add(prof('Princess',7,['+Speed'],'Whenever you need a favor, make a Charm check with your responsible family member and add your Intuition to this check.',salary=360000,hours='0',skills=['Charm','Intuition']))
# Smith is explicitly Ranked 2 and is treated as a Training Feature/Profession alternative.
smith_rank_sem={'status':'partial','ast':manual_leaf('Rank prerequisite depends on choosing the Athletics (physical) or Occult Education (magical) Smith path.'),'rank_asts':[], 'manual_leaf_count':1,'leaf_count':1}
add(prof('Smith',7,['Ranked 2','+Attack or Special Attack'],'Rank 1 and Rank 2: if you chose the Athletics version, gain Attack and may create only physical weapons. If you chose the Occult Education version, gain Special Attack and may create only magical weapons.',salary=None,hours=None,skills=['Focus','Athletics','Occult Education'],prereq='Rank 1: Adept Focus and Adept Athletics, or Adept Occult Education. Rank 2: Master Focus and Master Athletics, or Master Occult Education.',prereq_sem=smith_rank_sem,needs_review=True))

# -------------------------------------------------------------------------
# Classes extras.pdf
# -------------------------------------------------------------------------
# Conjurer
add(record('classes_extra',2,'Conjurer',tags=['Class','+Attack or Special Attack'],parent='Conjurer',prereq='Prerequisites: Rune Master, Adept Occult Education, Novice Pokémon Education',activation='1 AP - Full Action',target='Unown, Prime Unown or Eudomown',effect='Roll Pokémon Education, DC 15, channeling Unown energy to create a temporary Pokémon. It has its signature and natural Moves; open Move Slots may be filled from its level Move list. If the temporary Pokémon faints, the channeling Unown also faints. The conjuration lasts for the Scene, until fainting, or until switched.',prereq_sem=sem(all_ast(manual_leaf('Rune Master'),skill_leaf('adept','occult education'),skill_leaf('novice','pokemon education')),'partial')))
add(record('classes_extra',2,'Grimoire',tags=['+Attack or Special Attack'],parent='Conjurer',prereq='Prerequisite: Conjurer',activation='Extended Action',effect='Create a Grimoire that memorizes a Pokémon. When a Pokémon is recorded, you may conjure it without the test. Only Occult Education Grimoires are allowed; each Grimoire can contain Pokémon equal to twice your level.',prereq_sem=sem(feat_leaf('Conjurer'))))
add(record('classes_extra',2,'Ace Conjurer',tags=['+Attack or Special Attack'],parent='Conjurer',prereq='Prerequisite: Conjurer',activation='Static',effect='You may use Occult Education to command Unown, Prime Unown, Eudomown and temporary conjured Pokémon. Special: you can have +1 Hidden Power.',prereq_sem=sem(feat_leaf('Conjurer'))))
add(record('classes_extra',2,'Hidden Weapon',tags=['+Attack or Special Attack'],parent='Conjurer',prereq='Prerequisite: Conjurer',activation='Bind 2 AP',effect='Conjure a weapon. It has the properties of an Arcane Weapon with the Adept Move Hidden Power and the Master Move Concealed Power.',prereq_sem=sem(feat_leaf('Conjurer'))))
add(record('classes_extra',2,'Hidden Armor',tags=['+Attack or Special Attack'],parent='Conjurer',prereq='Prerequisite: Conjurer',activation='Bind 2 AP',effect='Conjure clothes or armor.',prereq_sem=sem(feat_leaf('Conjurer'))))
add(record('classes_extra',2,'Legendary Conjure',tags=['+Attack or Special Attack'],parent='Conjurer',prereq='Prerequisite: Master Occult Education, Conjurer',activation='+1 AP',effect='Your Unown can conjure a Legendary Pokémon. Prime Unown can do it 1/Day; Eudomown can do it 1/Scene.',prereq_sem=sem(all_ast(skill_leaf('master','occult education'),feat_leaf('Conjurer')))))
add(record('classes_extra',2,'Type Mastery',tags=['+Attack or Special Attack'],parent='Conjurer',prereq='Prerequisite: Hidden Weapon, Hidden Armor',activation='Bind 2 AP',effect='Instead of the normal cost for Hidden Weapon and Hidden Armor, use this Feature cost. Your weapon and armor match the type and gain one Ability each according to the Type Mastery table.',prereq_sem=sem(all_ast(feat_leaf('Hidden Weapon'),feat_leaf('Hidden Armor')))))

# Enhancer and Enhancer Buffs
add(record('classes_extra',5,'Enhancer',tags=['Class','+Attack or Special Attack'],parent='Enhancer',prereq='Prerequisite: Novice Occult Education or Novice Focus',activation='Static',trigger='You or your Pokémon use a Move with access to Hidden Power.',effect='If the Move is Melee, 1 Target, it gains Pass. If the Move is Ranged 1, Xm, it gains Blast 2.',prereq_sem=sem(any_ast(skill_leaf('novice','occult education'),skill_leaf('novice','focus')))))
add(record('classes_extra',5,'Power Enhance',tags=['+Attack or Special Attack'],parent='Enhancer',prereq='Prerequisite: Hidden Power',activation='Static',effect='You learn the Move Concealed Power.',prereq_sem=sem(manual_leaf('Hidden Power'),'partial'),compiled=[{'kind':'grant_entity','entity_kind':'move','entity_id':'concealed-power','entity_name':'Concealed Power','confidence':'high','source_text':'You learn the Move Concealed Power.'}]))
add(record('classes_extra',5,'Hidden Coat',tags=['+Attack or Special Attack'],parent='Enhancer',prereq='Prerequisite: Master Occult Education or Master Focus',activation='At-Will - Free Action; Cost 1 AP',effect='You or your Pokémon with Hidden Power receive a coat that grants 20 temporary Hit Points. Hidden Coat may only be used once per Scene per target.',prereq_sem=sem(any_ast(skill_leaf('master','occult education'),skill_leaf('master','focus')))))
add(record('classes_extra',5,'Secret Garden',tags=['Ranked 4','+Attack or Special Attack'],parent='Enhancer',prereq='Rank 1: Enhancer; each later Rank requires the previous Secret Garden Rank.',activation='Static',effect='Each Rank grants two Enhancer Buffs. You have every non-Blessing Enhancer Buff that you learn, ignoring its Trigger.',prereq_sem=sem(feat_leaf('Enhancer'),'partial')))
BUFF_SECTION='Enhancer Buffs'
add(record('classes_extra',6,'Awakening',parent='Enhancer',section=BUFF_SECTION,activation='At-Will - Extended Action',trigger='A simple or fine weapon, or armor.',effect='The weapon or armor gains Hidden Power. While a Pokémon or Trainer is holding this armor or weapon, it has Hidden Power.'))
add(record('classes_extra',6,'Type Enhancer',parent='Enhancer',section=BUFF_SECTION,activation='EOT - Standard Action',trigger='A weapon or Pokémon with Hidden Power.',effect='The next damaging Move changes its Type to the Hidden Power Type. If the Move is already that Type, it receives +3d6 damage.'))
add(record('classes_extra',6,'Armor Boost',parent='Enhancer',section=BUFF_SECTION,activation='EOT - Standard Action',trigger='An armor or Pokémon with Hidden Power.',effect='For the rest of the Scene, the target has +6 Initiative.'))
add(record('classes_extra',6,'Resolve Boost',parent='Enhancer',section=BUFF_SECTION,prereq='Prerequisite: Armor Boost',activation='2/Scene',trigger='A Pokémon or Trainer with Hidden Power receives super-effective or massive damage.',effect='After damage resolves, if not fainted, recover 20 HP.',prereq_sem=sem(feat_leaf('Armor Boost'))))
add(record('classes_extra',6,'Critical Buff',parent='Enhancer',section=BUFF_SECTION,prereq='Prerequisite: Type Enhancer',activation='Static',trigger='A critical hit with Type Enhancer on the Move.',effect='The damage receives +3d8 damage.',prereq_sem=sem(feat_leaf('Type Enhancer'))))
add(record('classes_extra',6,"Heaven's Intervention",id='heavens-intervention',parent='Enhancer',section=BUFF_SECTION,activation='Scene - Blessing',effect='Bless the battlefield against a Type of your Hidden Power. Any ally may resist that Type one step further. 2 uses.'))
add(record('classes_extra',6,"Hell's Calling",id='hells-calling',parent='Enhancer',section=BUFF_SECTION,activation='Scene - Blessing',effect='Bless the battlefield with a Type of your Hidden Power. Any ally that faints may use one Hidden Power before fainting; treat this Blessing like Aftermath. 3 uses.'))
add(record('classes_extra',6,"Earth's Bond",id='earths-bond',parent='Enhancer',section=BUFF_SECTION,activation='Scene - Blessing',effect='Bless the battlefield with a Type of your Hidden Power. An ally that lands a critical hit may add an extra status effect according to the Earth’s Bond table. Targets immune to critical hits are immune to this effect. 2 uses.'))

# Writer
add(record('classes_extra',8,'Writer',tags=['Class','+Attack or Special Attack'],parent='Writer',prereq='Prerequisite: Unown level 20 or Sigilyph level 20, Adept Occult Education',activation='Static',effect='Choose the Unown evolution line or the Sigilyph evolution line. Gain Species Savant for the chosen evolution line even without its prerequisite. If you have Rewrite, its Frequency becomes Scene - Extended Action.',prereq_sem=sem(all_ast(manual_leaf('Unown level 20 or Sigilyph level 20'),skill_leaf('adept','occult education')),'partial')))
add(record('classes_extra',8,'Magic Tattoo',tags=['+Attack or Special Attack'],parent='Writer',prereq='Prerequisite: Writer',activation='Extended Action',effect='Ink tattoos that reveal your potential. You may have any number, but benefit from only 4 at a time. Each active tattoo gives 1 AP, maximum +4 AP.',prereq_sem=sem(feat_leaf('Writer'))))
add(record('classes_extra',8,'Words Have Power',tags=['+Attack or Special Attack'],parent='Writer',prereq='Prerequisite: Magic Tattoo',activation='Extended Action',trigger='Your Unown, Sigilyph, an object, or yourself.',effect='Your runes have power. You can give a Capability to the Pokémon evolution line selected by Writer; tattoos and runed objects also gain Capabilities. Prime Unown keep their Capability; maximum 6. Signature Capabilities cannot be granted.',prereq_sem=sem(feat_leaf('Magic Tattoo'))))
add(record('classes_extra',8,'Poem Writer',tags=['Ranked 3','+Attack or Special Attack'],parent='Writer',prereq='Rank 1: Writer. Rank 2: Writer, Expert Occult Education. Rank 3: Writer, Master Occult Education.',activation='Static; Bind 1 AP per Rank',effect='Each Rank grants one Rank in Species Highbrow. For each bound AP, gain +1d6 damage in Struggle Attack or Hidden Power.',prereq_sem=sem(feat_leaf('Writer'),'partial')))
add(record('classes_extra',8,'The Verb',tags=['+Attack or Special Attack'],parent='Writer',prereq='Prerequisite: Writer',activation='1/Scene; Cost 1 AP',trigger='Your Pokémon from the Unown or Sigilyph evolution line makes a damaging Move.',effect='The user receives a damage boost from the Writer table and resists the next non-Struggle Move one additional step. Prime adds +1d6 for each extra Unown, maximum 6d6. You may use this 4/Scene, but every rune loses its power until the end of the Scene.',prereq_sem=sem(feat_leaf('Writer'))))

# Ronin
add(record('classes_extra',11,'Ronin',tags=['Class','+Speed'],parent='Ronin',prereq='Prerequisite: Novice Combat, Novice Acrobatics',activation='Static',trigger='You have a light melee weapon in one hand and nothing in the other.',effect='Whenever you would use a melee Struggle Attack, you may use Scratch instead. You learn Scratch and it is a Weapon Move. If you have all seven Features of this class, learn Cut and may use it instead of Scratch.',prereq_sem=sem(all_ast(skill_leaf('novice','combat'),skill_leaf('novice','acrobatics'))),compiled=[{'kind':'grant_entity','entity_kind':'move','entity_id':'scratch','entity_name':'Scratch','confidence':'high','source_text':'You learn Scratch.'}]))
add(record('classes_extra',11,'First Form',tags=['+Speed'],parent='Ronin',prereq='Prerequisite: Ronin',activation='Static',effect='You learn the Moves Aqua Cutter and Slash.',prereq_sem=sem(feat_leaf('Ronin')),compiled=[{'kind':'grant_entity','entity_kind':'move','entity_id':'aqua-cutter','entity_name':'Aqua Cutter','confidence':'high'},{'kind':'grant_entity','entity_kind':'move','entity_id':'slash','entity_name':'Slash','confidence':'high'}]))
add(record('classes_extra',11,'You Are Already Dead',tags=['+Speed'],parent='Ronin',prereq='Prerequisite: Ronin',activation='1 AP - Swift Action',trigger='You use a Move with the Pass tag.',effect='Delay the damage for one round and guarantee the hit. Damage arrives after the end of your next round and changes to Move damage + (unused Overland ×2) + your Speed Stat - enemy Speed Stat.',prereq_sem=sem(feat_leaf('Ronin'))))
add(record('classes_extra',11,'Shadow Form',tags=['+Speed'],parent='Ronin',prereq='Prerequisite: Ronin',activation='Static',effect='You learn the Moves Shadow Claw and Night Slash.',prereq_sem=sem(feat_leaf('Ronin')),compiled=[{'kind':'grant_entity','entity_kind':'move','entity_id':'shadow-claw','entity_name':'Shadow Claw','confidence':'high'},{'kind':'grant_entity','entity_kind':'move','entity_id':'night-slash','entity_name':'Night Slash','confidence':'high'}]))
add(record('classes_extra',11,'Human Form',tags=['+Speed'],parent='Ronin',prereq='Prerequisite: Ronin',activation='Static',effect='You learn Leaf Blade and gain the Ability Super Luck.',prereq_sem=sem(feat_leaf('Ronin')),compiled=[{'kind':'grant_entity','entity_kind':'move','entity_id':'leaf-blade','entity_name':'Leaf Blade','confidence':'high'},{'kind':'grant_entity','entity_kind':'ability','entity_id':'super-luck','entity_name':'Super Luck','confidence':'high'}]))
add(record('classes_extra',11,'One Sword Style',tags=['+Speed'],parent='Ronin',prereq='Prerequisite: 3 Ronin Features',activation='Static',trigger='You are using a light melee weapon in one hand and nothing in the other.',effect='Moves from this class count as Weapon Moves and receive the listed buffs: Scratch critical range +2; Cut ignores 10 DR instead of 5; Night Slash causes Vortex on critical; Leaf Blade paralyzes on critical; Shadow Claw lowers Defense by 1 stage on critical; Aqua Cutter may become Ice Type; Slash grants +1 Attack and Speed stage on natural 20.',prereq_sem=sem({'op':'leaf','kind':'feature_count_min','raw':'3 Ronin Features','group':'Ronin','count':3})))
add(record('classes_extra',11,"I'm The Storm That Is Approaching",id='im-the-storm-that-is-approaching',tags=['+Speed'],parent='Ronin',prereq='Prerequisite: First Form',activation='Daily* - Full Action; Cost 2 AP',effect='Use Slash with the listed changes: lose Pass, feet must be on the ground, double Overland and move only forward, attack each enemy passed, may change direction on obstacles to a direction not previously used, damage becomes Electric, and after passing the same enemy four times DB becomes 14. Gain another Daily use when Acrobatics or Combat reaches Virtuoso, max 3/Daily.',prereq_sem=sem(feat_leaf('First Form'))))

# Without Evolution Ace
WEA='Without Evolution Ace'
add(record('classes_extra',14,WEA,id='without-evolution-ace',tags=['Class'],parent=WEA,prereq='Prerequisite: Novice Pokémon Education, Novice Command',activation='Training Action',trigger='Your non-Legendary Pokémon without an evolution line and with at least 2 Tutor Points remaining.',effect='Target loses 2 Tutor Points and becomes a unique specimen. Choose Giant, Tiny, or Best of the Kind (BOTK): Giant before Level 20: +3 base HP, +1 Size, +1 Weight Class; Tiny before Level 20: +3 base Speed, -1 Size, -1 Weight Class; BOTK after Level 20: +3 base Attack, Special Attack, Defense, or Special Defense and +2d6 to a Skill. Minimum Small and Weight Class 1; maximum Huge and Weight Class 8.',prereq_sem=sem(all_ast(skill_leaf('novice','pokemon education'),skill_leaf('novice','command')))))
add(record('classes_extra',14,'Offense Changes',parent=WEA,prereq=f'Prerequisite: {WEA}',activation='Training Action',trigger='Your non-Legendary Pokémon without an evolution line and with at least 1 Tutor Point remaining.',effect='Target loses 1 Tutor Point and receives the Offense Change bonus from the class table.',prereq_sem=sem(feat_leaf(WEA))))
add(record('classes_extra',14,'Defense Changes',parent=WEA,prereq=f'Prerequisite: {WEA}',activation='Training Action',trigger='Your non-Legendary Pokémon without an evolution line and with at least 1 Tutor Point remaining.',effect='Target loses 1 Tutor Point and receives the Defense Change bonus from the class table. This persists while you are training the Pokémon, except for BOTK.',prereq_sem=sem(feat_leaf(WEA))))
add(record('classes_extra',14,'Start Changes',parent=WEA,prereq=f'Prerequisite: {WEA}',activation='Training Action',trigger='Your non-Legendary Pokémon without an evolution line and with at least 1 Tutor Point remaining.',effect='Target loses 1 Tutor Point and receives the Start Change bonus from the class table. This is active the first time the Pokémon battles in the Scene and can be passed with Baton Pass, except for BOTK.',prereq_sem=sem(feat_leaf(WEA))))
add(record('classes_extra',14,'Body Changes',parent=WEA,prereq='Prerequisite: Master Pokémon Education',effect='Your Pokémon with 3+ Tutor Points invested in this class receives the Body Change bonus from the class table.',prereq_sem=sem(skill_leaf('master','pokemon education'))))
add(record('classes_extra',15,'Trainer Knows Best',tags=['Order'],parent=WEA,prereq='Prerequisite: Master Command',activation='Bind 2 AP',target='Your non-Legendary Pokémon without an evolution line.',effect='For DB10+ Moves before STAB: Ranged/Line becomes Ranged 6, Blast 4, Exhaust; Melee/Burst/Cone becomes Close Blast 4, Exhaust; add +3d10 damage.',prereq_sem=sem(skill_leaf('master','command'))))
add(record('classes_extra',15,'Body Control',parent=WEA,prereq='Prerequisite: Trainer Knows Best, Body Changes',activation='2/Daily - Standard; Cost 2 AP',effect='Once you have mastered your Pokémon, it resembles an evolution. Giant: recover all lost HP and, if at least 1 Injury, receive 1 Tick of temporary HP. Tiny: next damaging Move receives half Speed as damage bonus. BOTK: Attack, Defense, Special Attack, and Special Defense gain 2 stages.',prereq_sem=sem(all_ast(feat_leaf('Trainer Knows Best'),feat_leaf('Body Changes')))))

# Alternative Poké Edges / Edge / General Feature
add(record('classes_extra',16,'Human Form',kind='poke_edges',section='Alternative Poké Edges',prereq='Prerequisite: Amorphous or Aura Type or Legendary',cost='1 or 3 Tutor Points',effect='The Pokémon gains a persistent signature human form. Amorphous: +3d6+2 Guile, +2d6 Charm, +2d6 Intimidate (3 Tutor Points). Aura Type: +3d6+2 Charm, +2d6 Intuition, +2d6 to any Skill (3 Tutor Points). Legendary: +3d6+3 to any Skill, +2d6+2 to any Skill, +2d6+1 to any Skill (1 Tutor Point). Pokémon with Shapeshifter may shift to human under the same conditions as that Capability.',prereq_sem=sem(manual_leaf('Amorphous or Aura Type or Legendary'),'partial'),needs_review=True))
add(record('classes_extra',16,'Human Speech',kind='poke_edges',section='Alternative Poké Edges',prereq='Prerequisite: Have a Teacher or be a Legendary',cost='1 or 3 Tutor Points',effect='The Pokémon can talk like a human. Legendary cost: 1 Tutor Point; non-Legendary cost: 3 Tutor Points. Gain +2d6 in Charm or Intimidate checks using the voice.',prereq_sem=sem(manual_leaf('Have a Teacher or be a Legendary'),'partial'),needs_review=True))
add(record('classes_extra',16,'Pokemon Understanding',id='pokemon-understanding',kind='edges',section='Alternative Edges',prereq='Prerequisite: Adept Occult Education or Adept General Education or Adept Pokémon Education',effect='You understand Pokémon speech.',prereq_sem=sem(any_ast(skill_leaf('adept','occult education'),skill_leaf('adept','general education'),skill_leaf('adept','pokemon education')))))
add(record('classes_extra',16,'Species Highbrow',id='species-highbrow',tags=['Ranked 3'],section='Alternative General Features',prereq='Prerequisite: Species Savant; each merit targets the evolutionary family chosen in Species Savant and costs Tutor Points from that Pokémon.',activation='Static',effect='Rank 1: the Pokémon receives Adaptability and +1 base Special Attack, Attack, and Speed. Rank 2: the Pokémon receives Tolerance and +1 base Special Defense, Defense, and HP. Rank 3: the Pokémon receives a secondary Type (or may use one of its existing Types) and gains the listed base-stat adjustment for that Type. Each merit may be used only once per Pokémon.',prereq_sem=sem(feat_leaf('Species Savant'),'partial'),needs_review=True))

# Add Type table data to Species Highbrow and Conjurer Type Mastery so the app keeps the source data structured for future automation.
type_bonus={
 'Bug':{'attack':3,'defense':3,'speed':2,'spAttack':-2},'Dark':{'attack':3,'speed':3,'spAttack':2,'defense':-1,'spDefense':-1},
 'Dragon':{'attack':4,'spAttack':3,'speed':-1},'Electric':{'speed':4,'spAttack':2,'attack':2,'hp':-1},'Fairy':{'spAttack':3,'spDefense':3},
 'Fighting':{'attack':5,'defense':1,'speed':1,'spAttack':-1},'Fire':{'attack':3,'spAttack':3,'speed':3,'defense':-1,'hp':-1},
 'Flying':{'speed':3,'attack':2,'spAttack':2,'defense':-1,'spDefense':-1},'Ground':{'attack':4,'defense':3,'speed':-1},
 'Grass':{'attack':2,'defense':2,'spAttack':2,'spDefense':2,'hp':-1},'Ghost':{'defense':3,'spAttack':3,'attack':1,'spDefense':1,'hp':-1},
 'Ice':{'hp':2,'attack':2,'defense':2,'spAttack':2,'spDefense':2,'speed':2},'Normal':{'hp':3,'speed':2,'spAttack':-2},
 'Poison':{'attack':3,'spAttack':3,'spDefense':3,'defense':-1,'speed':-2},'Psychic':{'spAttack':4,'attack':1,'spDefense':1},
 'Water':{'attack':3,'defense':3,'spAttack':2,'speed':-2},'Rock':{'defense':5,'attack':2,'speed':-1},'Steel':{'defense':4,'spDefense':4,'attack':-1,'spAttack':-1}
}
for rec in records:
    if rec['kind']=='features' and rec['raw']['id']=='species-highbrow': rec['raw']['species_highbrow_type_bonuses']=type_bonus
    if rec['kind']=='features' and rec['raw']['id']=='type-mastery': rec['raw']['type_mastery_table']={
      'Normal':['Scrappy','Normalize'],'Fighting/Fire/Electric':['Exploit','Blur'],'Ice/Bug/Flying':['Tinted Lens','Fur Coat'],
      'Rock/Ground/Dark':['Hustle','Sturdy'],'Fairy/Psychic/Grass':['Compound Eyes','Sacred Bell'],'Poison/Water/Ghost':['Poison Touch','Liquid Ooze'],'Steel/Dragon':['Unaware','Battle Armor']}

con=sqlite3.connect(DB)
con.row_factory=sqlite3.Row
cur=con.cursor()

def upsert(rec):
    raw=rec['raw']; kind=rec['kind']; source=raw['source_id']; rid=raw['id']; js=json.dumps(raw,ensure_ascii=False,separators=(',',':'))
    needs=int(bool(raw.get('needs_review')))
    if kind=='features':
        row=cur.execute('select row_id from features where id=? and source_id=? order by row_id limit 1',(rid,source)).fetchone()
        vals=(rid,raw['name'],raw.get('parent_class'),raw.get('section'),raw.get('prerequisites_text'),raw.get('activation_text'),raw.get('effect_text'),source,raw.get('source_page'),needs,js)
        if row:
            rowid=row['row_id'];cur.execute('update features set id=?,name=?,parent_class=?,section=?,prerequisites_text=?,activation_text=?,effect_text=?,source_id=?,source_page=?,needs_review=?,raw_json=? where row_id=?',(*vals,rowid))
        else:
            cur.execute('insert into features(id,name,parent_class,section,prerequisites_text,activation_text,effect_text,source_id,source_page,needs_review,raw_json) values(?,?,?,?,?,?,?,?,?,?,?)',vals);rowid=cur.lastrowid
        try:
            cur.execute('delete from features_fts where row_id=?',(rowid,));cur.execute('insert into features_fts(row_id,id,name,parent_class,effect_text) values(?,?,?,?,?)',(rowid,rid,raw['name'],raw.get('parent_class'),raw.get('effect_text')))
        except sqlite3.OperationalError: pass
    elif kind=='edges':
        vals=(rid,raw['name'],raw.get('prerequisites_text'),raw.get('effect_text'),source,raw.get('source_page'),needs,js)
        if cur.execute('select 1 from edges where id=?',(rid,)).fetchone():cur.execute('update edges set name=?,prerequisites_text=?,effect_text=?,source_id=?,source_page=?,needs_review=?,raw_json=? where id=?',(raw['name'],raw.get('prerequisites_text'),raw.get('effect_text'),source,raw.get('source_page'),needs,js,rid))
        else:cur.execute('insert into edges(id,name,prerequisites_text,effect_text,source_id,source_page,needs_review,raw_json) values(?,?,?,?,?,?,?,?)',vals)
    else:
        vals=(rid,raw['name'],raw.get('prerequisites_text'),raw.get('cost_text'),raw.get('effect_text'),source,raw.get('source_page'),needs,js)
        if cur.execute('select 1 from poke_edges where id=?',(rid,)).fetchone():cur.execute('update poke_edges set name=?,prerequisites_text=?,cost_text=?,effect_text=?,source_id=?,source_page=?,needs_review=?,raw_json=? where id=?',(raw['name'],raw.get('prerequisites_text'),raw.get('cost_text'),raw.get('effect_text'),source,raw.get('source_page'),needs,js,rid))
        else:cur.execute('insert into poke_edges(id,name,prerequisites_text,cost_text,effect_text,source_id,source_page,needs_review,raw_json) values(?,?,?,?,?,?,?,?,?)',vals)
    pack='campaign-homebrew-especial-classes' if source=='especial' else 'campaign-homebrew-classes-extra'
    vid=f'{kind}:{rid}@{source}'
    raw['logical_id']=rid;raw['definition_version_id']=vid;raw['content_pack_id']=pack
    js=json.dumps(raw,ensure_ascii=False,separators=(',',':'))
    # Keep base table and version payload identical after adding version metadata.
    if kind=='features':cur.execute('update features set raw_json=? where id=? and source_id=?',(js,rid,source))
    elif kind=='edges':cur.execute('update edges set raw_json=? where id=?',(js,rid))
    else:cur.execute('update poke_edges set raw_json=? where id=?',(js,rid))
    cur.execute('insert into definition_versions(version_id,definition_kind,logical_id,content_pack_id,source_id,priority,source_page,needs_review,raw_json) values(?,?,?,?,?,?,?,?,?) ON CONFLICT(version_id) DO UPDATE SET definition_kind=excluded.definition_kind,logical_id=excluded.logical_id,content_pack_id=excluded.content_pack_id,source_id=excluded.source_id,priority=excluded.priority,source_page=excluded.source_page,needs_review=excluded.needs_review,raw_json=excluded.raw_json',(vid,kind,rid,pack,source,180,raw.get('source_page'),needs,js))

for r in records: upsert(r)

# Rebuild small FTS tables for feature/edge additions where applicable.
try:
    cur.execute("INSERT INTO features_fts(features_fts) VALUES('rebuild')")
except Exception: pass

# Keep manifests informative.
for pack,source in [('campaign-homebrew-especial-classes','especial'),('campaign-homebrew-classes-extra','classes_extra')]:
    row=cur.execute('select manifest_json from content_packs where id=?',(pack,)).fetchone()
    if row:
        manifest=json.loads(row['manifest_json'])
        manifest['version']='1.1.0-beta4'
        existing_notes=manifest.get('notes')
        if isinstance(existing_notes,list):
            notes=existing_notes
        elif existing_notes:
            notes=[str(existing_notes)]
        else:
            notes=[]
        manifest['notes']=notes + ['Beta 2.1.0-beta.4: completed campaign Trainer classes/features/edges from the supplied PDF and classified Especial Classes professions as Training Features.']
        manifest['content_counts']={
          'features':cur.execute("select count(*) c from definition_versions where content_pack_id=? and definition_kind='features'",(pack,)).fetchone()['c'],
          'edges':cur.execute("select count(*) c from definition_versions where content_pack_id=? and definition_kind='edges'",(pack,)).fetchone()['c'],
          'poke_edges':cur.execute("select count(*) c from definition_versions where content_pack_id=? and definition_kind='poke_edges'",(pack,)).fetchone()['c']
        }
        cur.execute('update content_packs set version=?, manifest_json=? where id=?',('1.1.0-beta4',json.dumps(manifest,ensure_ascii=False),pack))

cur.execute("INSERT INTO metadata(key,value) VALUES('beta_homebrew_revision','2.1.0-beta.4') ON CONFLICT(key) DO UPDATE SET value=excluded.value")
con.commit()
print(f'Imported/updated {len(records)} campaign homebrew definitions into {DB}')
for src in ('especial','classes_extra'):
    print(src,'features',cur.execute('select count(*) c from features where source_id=?',(src,)).fetchone()['c'],'edges',cur.execute('select count(*) c from edges where source_id=?',(src,)).fetchone()['c'],'poke_edges',cur.execute('select count(*) c from poke_edges where source_id=?',(src,)).fetchone()['c'])
con.close()
