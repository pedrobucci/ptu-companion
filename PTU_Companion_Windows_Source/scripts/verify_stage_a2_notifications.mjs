import {readFile} from 'node:fs/promises';

const app = await readFile(new URL('../static-preview/app.js', import.meta.url), 'utf8');

const fail = message => {
  console.error(`Stage A.2 Windows regression failed: ${message}`);
  process.exit(1);
};

if (app.includes('<button>🔔<b>1</b></button>')) fail('legacy Notifications bell is still rendered in the top bar.');
if (app.includes('>🔔<')) fail('a Notifications bell is still present in the player UI.');
if (!app.includes('onclick="openGlobalActions()"')) fail('Settings action disappeared while removing Notifications.');
if (!app.includes('trainer-switcher-button')) fail('Trainer switcher disappeared while removing Notifications.');

console.log('Stage A.2 Windows Notifications removal regression OK');
