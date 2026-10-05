import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const clients=[
  ['Windows','../static-preview/app.js','../static-preview/styles.css'],
  ['Android','../../PTU_Companion_Android_Tauri/www/app.js','../../PTU_Companion_Android_Tauri/www/styles.css']
];
for(const [platform,appPath,cssPath] of clients){
  const app=await readFile(new URL(appPath,import.meta.url),'utf8');
  const css=await readFile(new URL(cssPath,import.meta.url),'utf8');
  assert.match(app,/showSpeciesOnRosterCards:false/,
    `${platform}: existing saves keep the current default display`);
  assert.ok(app.includes('data.ui.showSpeciesOnRosterCards=!!data.ui.showSpeciesOnRosterCards'),
    `${platform}: legacy saves normalize the preference`);
  assert.ok(app.includes('state.ui.showSpeciesOnRosterCards&&p.species'),
    `${platform}: roster species display is preference-gated`);
  assert.ok(app.includes('onchange="setRosterSpeciesOnCards(this.checked)"'),
    `${platform}: settings control updates the preference`);
  assert.ok(app.includes('openGlobalActions,setRosterSpeciesOnCards'),
    `${platform}: settings handler is available to the UI`);
  assert.ok(css.includes('.creature-card-species{')&&css.includes('overflow-wrap:anywhere'),
    `${platform}: long species names wrap within creature cards`);

  const handler=app.match(/function setRosterSpeciesOnCards\(enabled\)\{[^\n]+/);
  assert.ok(handler,`${platform}: preference handler exists`);
  const context={state:{ui:{showSpeciesOnRosterCards:false}},saved:0,rendered:0};
  context.persist=()=>{context.saved++;};
  context.render=()=>{context.rendered++;};
  vm.runInNewContext(`${handler[0]}; setRosterSpeciesOnCards('yes');`,context);
  assert.equal(context.state.ui.showSpeciesOnRosterCards,true,`${platform}: can enable`);
  vm.runInNewContext(`${handler[0]}; setRosterSpeciesOnCards(false);`,context);
  assert.equal(context.state.ui.showSpeciesOnRosterCards,false,`${platform}: can disable`);
  assert.equal(context.saved,2,`${platform}: both changes persist`);
  assert.equal(context.rendered,2,`${platform}: both changes rerender cards`);
}
console.log('Issue #23 roster species preference: Windows + Android OK');
