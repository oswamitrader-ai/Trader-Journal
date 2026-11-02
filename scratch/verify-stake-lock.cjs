const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const esbuild=require('esbuild'),JSZip=require('jszip');
const {toTargetAmount,investmentRect,readInvestAmount,geometryFor}=require('../electron/exnovaStakeShield.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
  const compiled=await esbuild.build({entryPoints:[path.join(root,'src/utils/extensionGenerator.ts')],bundle:true,platform:'node',format:'cjs',write:false,packages:'external'});
  const mod={exports:{}};
  vm.runInNewContext(compiled.outputFiles[0].text,{module:mod,exports:mod.exports,require,Blob,console,fetch:async url=>{
    const filename=path.join(root,'public',String(url).replace(/^\//,''));
    return fs.existsSync(filename)?new Response(fs.readFileSync(filename)):new Response('',{status:404});
  }});
  const savedPath=path.join(process.env.APPDATA || '', 'tradelock-desktop/exnova-stake-state.json');
  const config=fs.existsSync(savedPath)?JSON.parse(fs.readFileSync(savedPath,'utf8')):{enforceBrokerStakeLock:false};
  const blob=await mod.exports.generateExtensionZip(config);
  const zip=await JSZip.loadAsync(await blob.arrayBuffer());
  for(const name of ['background.js','content.js','injected.js','blocked.js','popup.js'])new vm.Script(await zip.file(name).async('string'),{filename:name});
  const injected=await zip.file('injected.js').async('string');
  const begin=injected.indexOf('  function getTargetStakeAmount()'),end=injected.indexOf('  let writingStakeInput',begin);
  const source=injected.slice(begin,end);
  for(const style of ['MAO_FIXA','SOROS_1','SOROS_2','SOROS_3','MARTINGALE'])for(let wins=0;wins<9;wins++)for(let losses=0;losses<4;losses++){
    const state={enforceBrokerStakeLock:true,fixedStakeAmount:30,sorosLevel1Stake:56.1,sorosLevel2Stake:104.91,sorosLevel3Stake:196.18,martingaleLevel1Stake:60,martingaleLevel2Stake:120,managementStyle:style};
    const web=vm.runInNewContext(source+';getTargetStakeAmount()',{stakeLockState:state,consecutiveWins:wins,consecutiveLosses:losses});
    assert.equal(web,toTargetAmount({...state,consecutiveWins:wins,consecutiveLosses:losses}),`${style}/${wins}/${losses}`);
  }
  assert.equal(toTargetAmount({enforceBrokerStakeLock:true,managementStyle:'SOROS_1',fixedStakeAmount:30,sorosLevel1Stake:56.1,consecutiveWins:3}),56.1);
  const soros={enforceBrokerStakeLock:true,managementStyle:'SOROS_2',fixedStakeAmount:30,sorosLevel1Stake:56.1,sorosLevel2Stake:104.91};
  assert.deepEqual([0,1,2,3,4,0].map(consecutiveWins=>toTargetAmount({...soros,consecutiveWins})),[30,56.1,104.91,30,56.1,30]);
  const size={width:1366,height:728};
  const region=investmentRect([{text:'Invest',confidence:90,bbox:{x0:864,y0:192,x1:954,y1:219}}],size,{x:988,y:38},3);
  assert(region.y*728<=89,'top edge must cover the formerly exposed area');
  const line=text=>({text,confidence:95,bbox:{x0:1276,y0:111,x1:1340,y1:123}});
  for(const [text,value] of [['R$ 30',30],['$ 30.00',30],['R$ 1.230,00',1230],['$1,230.00',1230]])assert.equal(readInvestAmount([line(text)],size,region),value);
  assert.equal(readInvestAmount([line('Invest'),line('30:00')],size,region),null);
  let rect;
  geometryFor({bounds:{x:-1366,y:100,width:1366,height:728}},region,{screenToDipRect:(_,r)=>{rect=r;return r}});
  assert(rect.x<0 && rect.y>100,'window movement and negative display origin');
  // Check generated event guards against recursive programmatic writes.
  assert(injected.includes('!writingStakeInput && e.isTrusted'));
  assert(injected.includes('getTargetStakeAmount();\n            if (currentTarget > 0)'));
  assert(!injected.includes('rect.width + 50'));
  assert(injected.includes('width:100%;height:100%'));
  fs.mkdirSync(path.join(root,'out'),{recursive:true});
  const icon=path.join(root,'out/extension-icon.png');
  if(fs.existsSync(icon))zip.file('icon.png',fs.readFileSync(icon));
  fs.writeFileSync(path.join(root,'out/TradeLock-Extension-invest.zip'),await zip.generateAsync({type:'nodebuffer'}));
  console.log('PASS: 180 web/desktop progression comparisons, Soros cycles, input OCR, top edge coverage, generated JavaScript syntax and event guards.');
})().catch(e=>{console.error(e);process.exitCode=1});
