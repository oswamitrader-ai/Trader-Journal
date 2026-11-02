process.resourcesPath=__dirname;
const assert=require('node:assert/strict');
const tess=require('tesseract.js');
let actual=30;const writes=[];
const line=(text,x,y,w,h)=>({text,confidence:95,bbox:{x0:(x-983)*3,y0:(y-40)*3,x1:(x+w-983)*3,y1:(y+h-40)*3}});
tess.createWorker=async()=>({setParameters:async()=>{},terminate:async()=>{},recognize:async()=>({data:{lines:[line('Invest',1278,100,28,9),line('$ '+actual,1278,111,60,12)]}})});
const {createExnovaStakeShield}=require('../electron/exnovaStakeShield.cjs');
const frame={handle:'123',visible:true,foreground:true,bounds:{x:0,y:0,width:1366,height:728}};
class Window {constructor(){this.webContents={on(){},isLoading(){return false}}}isDestroyed(){return false}hide(){}destroy(){}setAlwaysOnTop(){}setIgnoreMouseEvents(){}setBounds(){}loadURL(){return Promise.resolve()}showInactive(){}}
const image={isEmpty:()=>false,getSize:()=>({width:1366,height:728}),crop(){return this},resize(){return this},toPNG:()=>Buffer.alloc(0)};
let status;
const shield=createExnovaStakeShield({desktopCapturer:{getSources:async()=>[{id:'window:123:0',thumbnail:image}]},screen:{screenToDipRect:(_,r)=>r},BrowserWindow:Window,app:{isPackaged:true},onStatus:s=>status=s,trackerFactory:()=>({start(){},stop(){},getState:()=>frame}),inputFactory:()=>({ready:async()=>{},stop(){},write:async(f,field,amount)=>{writes.push(amount);actual=amount}})});
async function confirmed(amount){const deadline=Date.now()+7000;while(Date.now()<deadline){if(status?.verified&&status.amount===amount)return;await new Promise(r=>setTimeout(r,100));}throw Error('Not confirmed: '+amount+' '+JSON.stringify(status));}
(async()=>{try{
shield.setLockState({enforceBrokerStakeLock:true,managementStyle:'SOROS_2',fixedStakeAmount:30,sorosLevel1Stake:56.1,sorosLevel2Stake:104.91,consecutiveWins:0});await shield.start();await confirmed(30);
for(const [wins,amount] of [[1,56.1],[2,104.91],[3,30],[4,56.1],[0,30]]){shield.setLockState({consecutiveWins:wins});await confirmed(amount);assert.equal(actual,amount);}
assert.deepEqual(writes,[56.1,104.91,30,56.1,30]);console.log('PASS integrated simulated field: advance, cycle restart, loss reset; every write independently read back.');
}finally{await shield.stop()}})().catch(e=>{console.error(e);process.exitCode=1});

