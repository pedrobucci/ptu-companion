from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
API=ROOT/'PTU_Companion_Android_Tauri/www/mobile-api.mjs'
APP=ROOT/'PTU_Companion_Android_Tauri/www/app.js'


def replace_once(path,old,new,label):
    text=path.read_text(encoding='utf-8')
    if new in text:
        print('Already normalized',label)
        return
    count=text.count(old)
    if count!=1:
        raise RuntimeError(f'Expected one {label} anchor in {path}, found {count}')
    path.write_text(text.replace(old,new,1),encoding='utf-8')
    print('Normalized',label)

replace_once(
    API,
    "import {normalizeSpeciesForms,normalizePokemonFormState,resolvePokemonForms} from './rules/pokemon-forms.mjs';",
    "import {normalizePokemonFormState,resolvePokemonForms} from './rules/pokemon-forms.mjs';\nimport {normalizeSpeciesForms} from './rules/pokemon-forms.mjs';",
    'Android Forms imports',
)

replace_once(
    APP,
    """function pokemonPortraitUrl(p){
  const speciesId=String(p?.details?.speciesDefinitionId||'').trim();
  if(window.PTU_ANDROID_BUILD&&speciesId)return androidSpeciesArtwork(speciesId);
  return speciesId?`/api/pokemon/portrait/${encodeURIComponent(speciesId)}`:(p?.img||'creatures/default.svg');
}""",
    """function pokemonPortraitUrl(p){
  const speciesId=String(p?.details?.speciesDefinitionId||'').trim();
  if(window.PTU_ANDROID_BUILD&&speciesId)return androidSpeciesArtwork(speciesId);
  return speciesId?`/api/pokemon/portrait/${encodeURIComponent(speciesId)}`:(p?.img||'creatures/default.svg');
}""",
    'Android portrait source shape',
)
