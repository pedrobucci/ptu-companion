#!/usr/bin/env python3
import json,pathlib,hashlib,zipfile,sqlite3,sys
R=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else pathlib.Path(__file__).resolve().parents[1])
errs=[]
# JSON
for p in R.rglob('*.json'):
 try:json.loads(p.read_text(encoding='utf-8'))
 except Exception as e:errs.append(f'JSON {p}: {e}')
# Packs
for p in (R/'content_packs').glob('*.ptucp'):
 try:
  with zipfile.ZipFile(p) as z:
   m=json.loads(z.read('manifest.json'));
   for rel,meta in m.get('files',{}).items():
    b=z.read(rel);h=hashlib.sha256(b).hexdigest();
    if h!=meta['sha256']:errs.append(f'pack hash {p.name}:{rel}')
 except Exception as e:errs.append(f'pack {p}: {e}')
# DB
try:
 con=sqlite3.connect(R/'seed'/'ptu_seed_v1.0.sqlite3');res=con.execute('pragma integrity_check').fetchone()[0];con.close();
 if res!='ok':errs.append('sqlite '+res)
except Exception as e:errs.append('sqlite '+str(e))
# final manifest
mp=R/'manifest.json'
if mp.exists():
 m=json.loads(mp.read_text());
 for rel,meta in m.get('files',{}).items():
  p=R/rel
  if not p.exists():errs.append('missing '+rel);continue
  h=hashlib.sha256(p.read_bytes()).hexdigest();
  if h!=meta['sha256']:errs.append('manifest hash '+rel)
print('OK' if not errs else '\n'.join(errs));raise SystemExit(1 if errs else 0)
