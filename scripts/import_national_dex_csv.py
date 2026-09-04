#!/usr/bin/env python3
import csv,json,pathlib,sys,re,unicodedata
if len(sys.argv)!=3:
 print('usage: import_national_dex_csv.py pokemon_species.csv pokemon_species.json');raise SystemExit(2)
def key(s):return re.sub(r'[^a-z0-9]+','',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower())
rows=list(csv.DictReader(open(sys.argv[1],encoding='utf-8'))); mp={key(r['identifier']):int(r['id']) for r in rows}
p=pathlib.Path(sys.argv[2]);data=json.loads(p.read_text(encoding='utf-8'));changed=0
for sp in data:
 if sp.get('variant_of'): base=key(sp.get('variant_of','')); n=mp.get(base)
 else:n=mp.get(key(sp.get('display_name','')))
 if n and not sp.get('national_dex_number'):
  sp['national_dex_number']=n;sp['dex_number']=n;changed+=1
p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print('updated',changed)
