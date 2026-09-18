import {readFileSync,mkdtempSync,rmSync,existsSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {inspectContentPack,importContentPack} from '../definitions/pack-importer.mjs';
import {DefinitionRepository} from '../definitions/repository.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const assert=(v,m)=>{if(!v)throw new Error(m)};
const archivePath=join(root,'seed','content-packs','campaign-homebrew-chickute.ptucp');
const archive=readFileSync(archivePath);
const inspected=inspectContentPack(archive);
assert(inspected.manifest.format==='ptu-content-pack'&&inspected.manifest.format_version===1,'Existing PTU pack format is not accepted');
assert(inspected.counts.species===3,'Chickute test pack species count mismatch');

const direct=mkdtempSync(join(tmpdir(),'ptu-pack-import-direct-'));
const directDb=join(direct,'defs.sqlite3');
await import('node:fs/promises').then(fs=>fs.copyFile(join(root,'seed','definitions','ptu_seed_v1.0.sqlite3'),directDb));
const result=await importContentPack({buffer:archive,dbPath:directDb,backupDir:join(direct,'backups'),enableRulesetId:'all-provided-material',archiveFilename:'campaign-homebrew-chickute.ptucp'});
assert(result.definitionCounts.species===3,'Direct pack import did not write species definitions');
assert(existsSync(join(direct,'backups',result.backupFilename)),'Definitions backup was not created before import');
const directRepo=new DefinitionRepository(directDb);
assert(directRepo.getResolved({rulesetId:'all-provided-material',kind:'species',id:'chickute'})?.name==='Chickute','Imported Species does not resolve');
assert(directRepo.getRuleset('all-provided-material').packs.some(p=>p.pack_id==='campaign-homebrew-chickute'&&p.enabled),'Imported pack was not enabled in target Ruleset');
directRepo.close();
rmSync(direct,{recursive:true,force:true});

// Exercise the desktop HTTP importer and persistent definition database.
const testData=mkdtempSync(join(tmpdir(),'ptu-pack-import-api-'));
const seedDb=join(root,'seed','definitions','ptu_seed_v1.0.sqlite3');
const seedHash=createHash('sha256').update(readFileSync(seedDb)).digest('hex');
const port=5400+Math.floor(Math.random()*250);
const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PTU_PORT:String(port),PTU_DATA_DIR:testData},stdio:['ignore','pipe','pipe']});
let stderr='';child.stderr.on('data',d=>stderr+=d);
async function wait(){for(let i=0;i<100;i++){try{const r=await fetch(`http://127.0.0.1:${port}/api/health`);if(r.ok)return r.json()}catch{} await new Promise(r=>setTimeout(r,80));}throw new Error(`Server failed: ${stderr}`)}
try{
 const health=await wait();
 assert(health.version==='2.1.0-beta.17','beta.6 server version mismatch');
 assert(health.definitions?.persistent===true,'Definitions are not using persistent desktop storage');
 const persistentDb=join(testData,'definitions','ptu_definitions.sqlite3');
 assert(existsSync(persistentDb)&&statSync(persistentDb).size>1_000_000,'Persistent definitions database was not created');
 const response=await fetch(`http://127.0.0.1:${port}/api/content-packs/import`,{method:'POST',headers:{'Content-Type':'application/octet-stream','X-PTU-Filename':encodeURIComponent('campaign-homebrew-chickute.ptucp')},body:archive});
 const payload=await response.json(); assert(response.ok,payload.error||'HTTP content pack import failed');
 assert(payload.result?.definitionCounts?.species===3,'HTTP importer count mismatch');
 const packs=await (await fetch(`http://127.0.0.1:${port}/api/content-packs`)).json();
 assert(packs.imports?.length>=1,'Pack import history not exposed');
 assert(packs.packs.some(p=>p.id==='campaign-homebrew-chickute'&&p.enabled),'Imported pack not active in current Ruleset');
 const seedHashAfter=createHash('sha256').update(readFileSync(seedDb)).digest('hex');
 assert(seedHashAfter===seedHash,'Bundled seed database was mutated by desktop import');
} finally {child.kill('SIGTERM');rmSync(testData,{recursive:true,force:true});}

const app=readFileSync(join(root,'static-preview','app.js'),'utf8');
for(const token of ['Import .ptucp','importContentPackFile','contentPackManager','/api/content-packs/import']) assert(app.includes(token),`Desktop Content Pack UI missing: ${token}`);
const guide=join(root,'docs','PTU_CONTENT_PACK_CONVERSION_GUIDE.md');
assert(existsSync(guide),'Future-model PTU content pack conversion guide missing');
console.log('PTU Companion beta.6 Content Pack import verification: OK');
console.log('Transactional .ptucp import + backup + persistent definitions + active Ruleset enable: passed');
