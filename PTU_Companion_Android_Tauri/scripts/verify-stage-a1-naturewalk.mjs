import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeCapability, normalizeNaturewalkTerrains, formatCapabilityLabel} from '../www/rules/capability-normalization.mjs';

const legacy=normalizeCapability({name:'Naturewalk',capability_id:'naturewalk',terrain:'Forest'});
assert.deepEqual(legacy.terrain,['Forest']);
assert.equal(formatCapabilityLabel(legacy),'Naturewalk [Forest]');

const multi=normalizeCapability({name:'Naturewalk',capability_id:'naturewalk',terrain:['Forest','Urban']});
assert.deepEqual(normalizeNaturewalkTerrains(multi),['Forest','Urban']);
assert.equal(formatCapabilityLabel(multi),'Naturewalk [Forest, Urban]');

const plural=normalizeCapability({name:'Naturewalk',terrains:'Cave; Mountain'});
assert.deepEqual(plural.terrains,['Cave','Mountain']);
assert.equal(formatCapabilityLabel(plural),'Naturewalk [Cave, Mountain]');

const textLegacy=normalizeCapability('Naturewalk (Ocean / Urban)');
assert.deepEqual(textLegacy.terrain,['Ocean','Urban']);
assert.equal(formatCapabilityLabel(textLegacy),'Naturewalk [Ocean, Urban]');

const api=await readFile(new URL('../www/mobile-api.mjs',import.meta.url),'utf8');
assert.match(api,/normalizeCapabilities/);
assert.match(api,/capabilities:normalizeCapabilities\(raw\.capabilities\)/);
const app=await readFile(new URL('../www/app.js',import.meta.url),'utf8');
assert.match(app,/function normalizeNaturewalkTerrains\(/);
assert.match(app,/Naturewalk \[\$\{terrains\.join\(', '\)\}\]/);
console.log('Stage A.1 Android Naturewalk regression OK');
