import {fileURLToPath} from 'node:url';
import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));const app=fs.readFileSync(path.join(root,'www/app.js'),'utf8');const css=fs.readFileSync(path.join(root,'www/styles.css'),'utf8');const runtime=fs.readFileSync(path.join(root,'www/mobile-runtime.js'),'utf8');
const ok=(v,m)=>{if(!v)throw new Error(m)};
ok(app.includes('definitionArtworkHtml(d)'), 'Rules Library artwork helper missing');
ok(app.includes('<span>Adjusted Base</span><span>Existing alloc.</span>'), 'Adjusted Base column missing');
ok(app.includes('openPokemonProgressAbilityInfo'), 'Ability details action missing');ok(app.includes('openPokemonProgressMoveInfo'), 'Move details action missing');ok(app.includes('🐾 Open in Creatures'), 'Open in Creatures action missing');
ok(app.includes("['trainer','🪪','Trainer'],['rosters'"), 'Trainer is not in Android quick nav');ok(app.includes("route('creature')\">🐾 Creatures"), 'Creatures is not preserved in More menu');ok(css.includes('.ability-choice{display:grid'), 'Ability alignment CSS missing');ok(runtime.includes("version:'2.2.0-android-beta.20'"),'Runtime version mismatch');
console.log('PTU Companion Android v2.2.0-beta.20 visual/navigation verification: OK');
