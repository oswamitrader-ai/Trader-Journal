// Offline integration checks for actual MobileSyncService code. No network or account changes.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const esbuild = require('esbuild');
let failRisk = false, failSave = false, permanent = true, channels = 0, trades = [];
const client = {
  auth: {
    getUser: async () => ({data:{user:{id:'test-user',email:'test@example.com',app_metadata:{subscriptionStatus:'ACTIVE'}}}}),
    getSession: async () => ({data:{session:null}}),
    onAuthStateChange: () => ({data:{subscription:{unsubscribe(){}}}}),
  },
  removeChannel: async () => {},
  channel: () => { channels++; return {on(){return this},subscribe(){return this}}; },
  from(table) {
    const query = {select(){return this},eq(){return this},update(){this.writing=true;return this},insert(){this.writing=true;return this},maybeSingle(){return this},
      then(resolve,reject) {
        const data = this.writing ? [{id:'settings_test@example.com'}] : table==='system_users' ? {active:true,role:'CLIENT'} : table==='risk_settings' ? {dailyLossLimit:60,dailyProfitTarget:70,maxTradesPerDay:10} : table==='management_settings' ? {settings:{permanentMobileBrokerLockEnabled:permanent},updated_at:'2026-11-01T00:00:00Z'} : trades;
        return Promise.resolve({data,error:(failRisk&&table==='risk_settings') || (failSave&&this.writing) ? {message:'offline'} : null}).then(resolve,reject);
      }};
    return query;
  },
};
(async()=>{
  const result = await esbuild.build({entryPoints:[require('node:path').resolve(__dirname,'../src/services/mobileSyncService.ts')],bundle:true,platform:'node',format:'cjs',write:false,packages:'external',plugins:[{name:'mock-client',setup(build){build.onResolve({filter:/lib\/supabase$/},()=>({path:'mock-client',external:true}));}}]});
  const mod={exports:{}};
  vm.runInNewContext(result.outputFiles[0].text,{module:mod,exports:mod.exports,require:n=>n==='mock-client'?{supabase:client}:require(n),console:{log(){},warn(){}},setInterval:()=>1,clearInterval(){},setTimeout,Date});
  const service=mod.exports.mobileSyncService;
  service.setUserEmail('test@example.com');
  for(let i=0;i<20&&!service.getState().lastSyncedAt;i++)await new Promise(setImmediate);
  assert.equal(service.getState().permanentMobileBrokerLockEnabled,true);
  assert.equal(service.getState().isLockActive,true);
  await service.fetchDataAndSubscribe('test@example.com');
  assert.equal(channels,1,'refresh must not recreate Realtime channel');
  failRisk=true;
  await service.fetchDataAndSubscribe('test@example.com');
  assert.equal(service.getState().isLockActive,true,'network failure must not unlock');
  assert.equal(service.getState().syncError,'offline');
  failRisk=false;permanent=false;trades=[{accountType:'REAL',pnl:10},{accountType:'DEMO',pnl:-80}];
  await service.fetchDataAndSubscribe('test@example.com');
  assert.equal(service.getState().isStopHit,true,'total PnL rule must match desktop');
  trades=[];
  await service.fetchDataAndSubscribe('test@example.com');
  assert.equal(service.getState().isLockActive,false);
  failSave=true;
  await assert.rejects(service.setPermanentMobileBrokerLock(true));
  assert.equal(service.getState().permanentMobileBrokerLockEnabled,false,'failed save must not report cloud confirmation');
  service.stop();
  console.log('PASS: persistent Realtime subscription, permanent lock, safe connection failure, matching PnL rules, failed-save reporting.');
})().catch(error=>{console.error(error);process.exitCode=1});
