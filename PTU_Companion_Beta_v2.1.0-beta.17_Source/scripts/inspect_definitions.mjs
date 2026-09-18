import { DefinitionRepository } from '../definitions/repository.mjs';
const repo=new DefinitionRepository(new URL('../seed/definitions/ptu_seed_v1.0.sqlite3',import.meta.url).pathname);
try{
  const ruleset=process.argv[2]||'all-provided-material';
  console.log(`Ruleset: ${ruleset}`);
  console.table(repo.getCounts(ruleset));
  console.log('\nRulesets:');
  console.table(repo.getRulesets().map(r=>({id:r.id,name:r.name})));
  console.log('\nExample — Shadow Claw:');
  console.log(repo.getResolved({rulesetId:ruleset,kind:'moves',id:'shadow-claw'}));
}finally{repo.close();}
