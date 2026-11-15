const {spawn}=require('node:child_process');
const {createInterface}=require('node:readline');
const {readFileSync}=require('node:fs');
const path=require('node:path');
function createWindowFrameReader(nativeImage){
  let child,pending,backoff=0;
  function finish(image){if(!pending)return;const {resolve,timer}=pending;pending=null;clearTimeout(timer);resolve(image);}
  function stop(){const active=child;child=null;active?.kill();finish(null);}
  async function read(){
    if(process.platform!=='win32'||Date.now()<backoff||pending)return null;
    if(!child){
      const script=readFileSync(path.join(__dirname,'exnovaWindowFrame.ps1'),'utf8').replace(/^\uFEFF/,'');
      const active=spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,stdio:['pipe','pipe','ignore']});child=active;
      createInterface({input:active.stdout}).on('line',line=>{
        if(active!==child||!pending)return;
        const image=line?nativeImage.createFromBuffer(Buffer.from(line,'base64')):null;
        if(!image||image.isEmpty()){backoff=Date.now()+2000;finish(null);}else finish(image);
      });
      const failed=()=>{if(active===child){backoff=Date.now()+5000;stop();}};
      active.once('error',failed);active.once('exit',failed);active.stdin.on('error',failed);
    }
    return new Promise(resolve=>{pending={resolve,timer:setTimeout(()=>{backoff=Date.now()+5000;stop();},4500)};child.stdin.write('\n');});
  }
  return {read,stop};
}
module.exports={createWindowFrameReader};
