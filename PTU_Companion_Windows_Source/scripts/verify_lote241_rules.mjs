import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {DefinitionRepository} from '../definitions/repository.mjs';
import {fileURLToPath} from 'node:url';

const win = new URL('../', import.meta.url);
const mobile = new URL('../../PTU_Companion_Android_Tauri/www/', import.meta.url);
const bundle = JSON.parse(readFileSync(new URL('mobile-data.json', mobile), 'utf8'));
globalThis.window = {__PTU_MOBILE_DATA__: bundle};
globalThis.localStorage = {getItem: () => null, setItem() {}};
const {definitions: android} = await import(new URL('mobile-api.mjs', mobile));
const windows = new DefinitionRepository(fileURLToPath(new URL('data/definitions/ptu_definitions.sqlite3', win)));

const core = 'ptu-core-only';
const consolidated = 'all-provided-material';
const cases = [
  ['moves', 'focus-punch', 'GM_DECISION_92', /25% of their maximum HP.*does not expend its frequency/],
  ['moves', 'mind-reader', 'GM_DECISION_93', /automatically hit the read target.*Mindlock/],
  ['moves', 'roar', 'GM_DECISION_94', /Shift away from the user.*toward their Trainer/],
  ['moves', 'spider-web', 'GM_DECISION_95', /target loses Stuck.*Trapped condition from this Spider Web/],
  ['abilities', 'mummy', 'GM_DECISION_96', /attacker’s Abilities.*until the attacker switches out/],
  ['items', 'luxury-ball', 'GM_DECISION_97', /−5.*narrative effect.*GM sets its starting Loyalty/],
];

try {
  for (const [repo, rules, app] of [
    [windows, new URL('rules/', win), new URL('static-preview/app.js', win)],
    [android, new URL('rules/', mobile), new URL('app.js', mobile)],
  ]) {
    for (const [kind, id, decision, effect] of cases) {
      const rulesetId = id === 'mummy' ? 'ptu-official-with-playtests' : core;
      const definition = repo.getResolved({rulesetId, kind, id});
      assert.equal(definition.catalogDecision, decision);
      assert.match(definition.effect, effect);
      assert.equal(definition.raw.effect_text, definition.effect);
      const listing = repo.listResolved({rulesetId, kind, q: definition.name, limit: 100});
      assert.equal(listing.find(row => row.id === id)?.effect, definition.effect);
      if (id === 'luxury-ball') assert.equal(definition.raw.capture_modifier, -5);
    }
    const coreMummy = repo.getResolved({rulesetId: core, kind: 'abilities', id: 'mummy'});
    assert.equal(coreMummy.catalogDecision, undefined);
    assert.match(coreMummy.frequency, /Daily/);
    const playtestMummy = repo.getResolved({rulesetId: consolidated, kind: 'abilities', id: 'mummy'});
    assert.equal(playtestMummy.catalogDecision, 'GM_DECISION_96');
    assert.match(playtestMummy.frequency, /At-Will.*Free Action/);

    for (const id of ['fling', 'frustration', 'magnitude', 'return', 'round', 'spit-up', 'triple-kick']) {
      assert.equal(repo.getResolved({rulesetId: core, kind: 'moves', id}).ac, id === 'triple-kick' ? 3 : 2);
    }
    assert.equal(repo.getResolved({rulesetId: core, kind: 'moves', id: 'mat-block'}).category, 'Status');
    for (const [id, field, original, expected] of [
      ['aeroblast', 'frequency', 'Daily', 'Scene'],
      ['astonish', 'damageBase', 3, 6],
      ['judgment', 'frequency', 'Daily', 'Scene'],
      ['luster-purge', 'frequency', 'Scene x2', 'EOT'],
      ['mist-ball', 'frequency', 'Scene x2', 'EOT'],
      ['mystical-fire', 'damageBase', 7, 8],
      ['rage', 'damageBase', 2, 6],
      ['seed-flare', 'range', '6, Ranged Blast 3', '6, Ranged Blast 3, Smite, Spirit Surge'],
      ['shock-wave', 'frequency', 'At-Will', 'EOT'],
      ['spacial-rend', 'frequency', 'Daily x2', 'Scene x2'],
      ['spark', 'damageBase', 6, 7],
      ['stored-power', 'frequency', 'EOT', 'Scene x2'],
      ['leech-life', 'frequency', 'Scene x2', 'EOT'],
      ['power-trip', 'frequency', 'EOT', 'Scene x2'],
      ['thunder-wave', 'ac', 4, 2],
    ]) {
      const selected = repo.getResolved({rulesetId: consolidated, kind: 'moves', id});
      assert.equal(selected[field], expected);
      assert.equal(repo.getResolved({rulesetId: consolidated, kind: 'moves', id, versionId: selected.versionId})[field], original);
      assert.equal(repo.getVersions({kind: 'moves', id}).find(row => row.versionId === selected.versionId)[field], original);
    }
    const steam = repo.getResolved({rulesetId: consolidated, kind: 'moves', id: 'steam-eruption'});
    assert.equal(steam.ac, 3);
    assert.equal(steam.damageBase, 11);
    const {normalizeLote241Definition} = await import(new URL('lote241-decisions.mjs', rules));
    const custom = {kind: 'moves', id: 'spider-web', contentPackId: 'custom', sourceId: 'core', effect: 'GM variant'};
    assert.equal(normalizeLote241Definition(custom, {editationEnabled: true}), custom);
    const pinned = {kind: 'moves', id: 'power-trip', contentPackId: 'ptu-sumo-references', sourceId: 'sumo', pinned: true, frequency: 'EOT'};
    assert.equal(normalizeLote241Definition(pinned, {editationEnabled: true}), pinned);

    const {eligibleNaturalMoves, tutorPointsAtLevel, levelAbilitySlots, validateBaseRelations} = await import(new URL('pokemon-engine.mjs', rules));
    const moves = [{move: 'Blank', level: ''}, {move: 'Known', level: '1'}, {move: 'Later', level: 20}, {move: 'On evolution', level: 'Evo'}];
    assert.deepEqual(eligibleNaturalMoves(moves, 1).map(row => row.name), ['Known', 'On evolution']);
    assert.deepEqual([1,4,5,40,100].map(tutorPointsAtLevel), [1,1,2,9,21]);
    assert.deepEqual([19,20,39,40].map(level => levelAbilitySlots(level).length), [1,2,2,3]);
    assert.equal(validateBaseRelations({hp: 50, attack: 5, defense: 4}, {hp: 1, attack: 5, defense: 4}).length, 0);
    const {resolveMoveDamage} = await import(new URL('modifier-engine.mjs', rules));
    const pokemon = {loyalty: 6, details: {finalStats: {attack: 15, special_attack: 10}, combatStages: {attack: 2, defense: -2, spAttack: 3, accuracy: 6, evasion: 6}}};
    const damageFor = (id, rulesetId = consolidated) => resolveMoveDamage({
      moveDefinition: repo.getResolved({rulesetId, kind: 'moves', id}),
      pokemon, speciesTypes: ['Normal', 'Psychic'], getDamageBase: db => repo.getDamageBase(db),
    });
    assert.equal(damageFor('return', core).finalDamageBase, 11);
    assert.equal(damageFor('frustration', core).finalDamageBase, 5);
    assert.equal(damageFor('power-trip').baseDamageBase, 12);
    assert.equal(damageFor('stored-power').baseDamageBase, 12);
    assert.equal(damageFor('magnitude', core), null, 'Variable DB requires its actual input');

    const source = readFileSync(app, 'utf8');
    const criticalCode = source.match(/function pokemonCombatDoubleDamageDiceExpression\([\s\S]*?\n}/)[0];
    const critical = vm.runInNewContext(`${criticalCode};pokemonCombatDoubleDamageDiceExpression`);
    assert.equal(critical('2d6+8'), '4d6+16');
    const stat = damageFor('return', core).primaryStat.value;
    assert.equal(stat, 21);
    assert.match(source, /total=Number\(manualDamage\|\|0\)\+stat\+powerBonus\+itemDamage\+bonus\+boundBonus/);

    const ledger = {conditions: {trapped: true}};
    const setStuckCode = source.slice(source.indexOf('function pokemonCombatSetStuck('), source.indexOf('\nfunction pokemonCombatElectrodashPanel('));
    let types = [];
    const ctx = vm.createContext({pokemonCombatParticipant: () => ledger, pokemon: () => ({name: 'QA', types}), pokemonCombatSlug: type => type.toLowerCase(), pokemonCombatLog() {}, commit() {}, render() {}, toast() {}});
    vm.runInContext(setStuckCode, ctx);
    ctx.pokemonCombatSetStuck('qa', true, 'spider-web');
    assert.equal(ledger.conditions.stuck, true);
    assert.equal(ledger.conditions.spiderWeb, true);
    ctx.pokemonCombatSetStuck('qa', false);
    assert.equal(ledger.conditions.stuck, false);
    assert.equal(ledger.conditions.spiderWeb, undefined);
    assert.equal(ledger.conditions.trapped, true, 'An unrelated trap persists');
    types = ['Ghost'];
    ctx.pokemonCombatSetStuck('qa', true, 'spider-web');
    assert.equal(ledger.conditions.stuck, false, 'Ghost remains immune');
  }
} finally {
  windows.close();
}
console.log('Lote 241 Windows/Android: catalog precedence, six GM decisions, natural learning, DB, critical dice and Spider Web link passed.');
