import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../persistence/database.mjs';
import { CampaignRepository } from '../persistence/repository.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const path=join(root,'data','ptu_companion.sqlite3');
if(!existsSync(path)){
  console.error('Database does not exist yet. Run RUN_FUNCTIONAL_PREVIEW.bat first.');
  process.exit(1);
}
const db=openDatabase(path); const repo=new CampaignRepository(db);
const state=repo.loadState();
console.log(JSON.stringify({
  database:path,
  activeProfile:state?.activeProfileId,
  trainer:state?.trainer?.name,
  level:state?.trainer?.level,
  pokemon:state?.pokemon?.length,
  rosters:state?.rosters?.length,
  inventory:state?.inventory?.length,
  npcs:state?.npcs?.length,
  revisions:repo.listRevisions(undefined,30).length
},null,2));
db.close();
