// Read-only verification. Credentials stay in memory and are never printed.
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const root=require('node:path').resolve(__dirname,'..');
const git=(...args)=>execFileSync('git',['-c',`safe.directory=${root.replace(/\\/g,'/')}`,...args],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']});
const ref='mreykdrbyfrwqovsleqi';
const base=`https://${ref}.supabase.co`;
let oldKey;
const commits=git('log','--format=%H','-S','SUPABASE_SERVICE_ROLE_KEY','--','src/lib/supabase.ts').trim().split(/\s+/);
for(const commit of commits){
  for(const revision of [commit,commit+'^']){
    let code;try{code=git('show',revision+':src/lib/supabase.ts');}catch{continue;}
    for(const token of code.match(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g)||[]){
      try{const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url'));if(claims.role==='service_role'&&claims.ref===ref)oldKey=token;}catch{}
    }
    if(oldKey)break;
  }
  if(oldKey)break;
}
if(!oldKey)throw new Error('Historical exposed key could not be located');
const source=fs.readFileSync(root+'/src/lib/supabase.ts','utf8');
const publicKey=source.match(/sb_publishable_[\w-]+/)[0];
let legacyStillAccepted=false;
let functionalCheckFailed=false;
async function check(name,path,headers,method='GET',body){
  const response=await fetch(base+path,{headers:{...headers,...(body?{'Content-Type':'application/json'}:{})},method,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
  const raw=await response.text();
  let code, returnedUserList;try{const parsed=JSON.parse(raw);code=parsed.code||parsed.error_code||parsed.error;if(path.startsWith('/auth/v1/admin/users'))returnedUserList=Array.isArray(parsed.users);}catch{}
  console.log(JSON.stringify({name,status:response.status,errorCode:typeof code==='string'?code:undefined,returnedUserList}));
  if(name.startsWith('legacy ') && response.ok) legacyStillAccepted=true;
  if(name==='modern public key / Auth settings' && !response.ok) functionalCheckFailed=true;
  if(name.startsWith('modern public key /') && !name.endsWith('/ Auth settings') && ![401,403].includes(response.status)) functionalCheckFailed=true;
}
(async()=>{
  for(const [label,headers] of [
    ['legacy API key',{apikey:oldKey,Authorization:`Bearer ${oldKey}`}],
    ['legacy bearer with modern API key',{apikey:publicKey,Authorization:`Bearer ${oldKey}`}],
    ['legacy bearer without API key',{Authorization:`Bearer ${oldKey}`}],
  ]){
    await check(label+' / Auth admin','/auth/v1/admin/users?page=1&per_page=1',headers);
    await check(label+' / Data API','/rest/v1/trades?select=id&limit=0',headers);
    await check(label+' / Storage','/storage/v1/bucket',headers);
    await check(label+' / Edge Function','/functions/v1/manage-users',headers,'POST',{action:'list'});
  }
  await check('modern public key / Auth settings','/auth/v1/settings',{apikey:publicKey});
  await check('modern public key / anonymous Data API','/rest/v1/trades?select=id&limit=0',{apikey:publicKey});
  await check('modern public key / unauthenticated admin function','/functions/v1/manage-users',{apikey:publicKey},'POST',{action:'list'});
  console.log(JSON.stringify({fullyRevoked:!legacyStillAccepted,publicEndpointChecksPassed:!functionalCheckFailed}));
  if(legacyStillAccepted || functionalCheckFailed)process.exitCode=2;
})().catch(e=>{console.error(e.name+': verification failed');process.exitCode=1;});
