const assert=require('node:assert/strict'),esbuild=require('esbuild'),vm=require('vm');
(async()=>{const r=await esbuild.build({entryPoints:['src/utils/stakeProgression.ts'],bundle:true,platform:'node',format:'cjs',write:false});const m={exports:{}};vm.runInNewContext(r.outputFiles[0].text,{module:m,exports:m.exports});const calc=m.exports.getStakeProgression;const {toTargetAmount}=require('../electron/exnovaStakeShield.cjs');
const date='2026-11-15';
for(const levels of [1,2,3])for(const result of ['GAIN','LOSS']){
 const settings={managementStyle:'SOROS_'+levels,enforceBrokerStakeLock:true,fixedStakeAmount:30,sorosLevel1Stake:55.8,sorosLevel2Stake:103.79,sorosLevel3Stake:193.05};let trades=[];
 for(let step=0;step<=levels;step++){
   const state=calc(trades,settings,date);const expected=step?settings['sorosLevel'+step+'Stake']:30;
   assert.equal(toTargetAmount({...settings,...state}),expected);
   trades.push({id:String(step),date,time:'10:00:0'+step,result:step===levels?result:'GAIN',contractsOrQuantity:expected});
 }
 assert.equal(toTargetAmount({...settings,...calc(trades,settings,date)}),30,'reset '+levels+'/'+result);
 assert.equal(toTargetAmount({...settings,...calc([trades.at(-1)],settings,date)}),30,'reset despite prior missed capture');
}
console.log('PASS all Soros levels reset after final win/loss, including missing earlier trades');})().catch(e=>{console.error(e);process.exitCode=1});
