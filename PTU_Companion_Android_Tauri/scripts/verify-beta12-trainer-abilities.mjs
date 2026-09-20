import fs from 'node:fs';
import assert from 'node:assert/strict';
const app=fs.readFileSync(new URL('../www/app.js',import.meta.url),'utf8');
assert(app.includes("trainerTabButton('abilities','Abilities')"),'Trainer Abilities tab button is missing');
assert(app.includes("tab==='abilities'"),'Trainer Abilities renderer is missing');
assert(app.includes("'edges','abilities','moves'"),'Trainer Abilities tab is not accepted by setTrainerTab');
assert(app.includes('RESOLVED TRAINER ABILITIES'),'Trainer Abilities section label is missing');
console.log('PTU Companion Android v2.2.0-beta.17 Trainer Abilities verification: OK');
