const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
function createStakeInput(){
  let child=null,request=null,counter=0;
  let readyPromise,resolveReady,rejectReady;
  function fail(message){if(request){clearTimeout(request.timer);request.reject(new Error(message));request=null;}}
  function start(){
    if(child)return;
    readyPromise=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
    child=spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',fs.readFileSync(path.join(__dirname,'exnovaStakeInput.ps1'),'utf8')],{windowsHide:true,stdio:['pipe','pipe','pipe']});
    let buffer='';
    child.stdout.on('data',chunk=>{buffer+=chunk;let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);try{const response=JSON.parse(line);if(response.ready)resolveReady();if(request&&response.id===request.id){const current=request;clearTimeout(current.timer);request=null;if(response.ok)current.resolve(response);else current.reject(new Error(response.error));}}catch{}}});
    child.stderr.on('data',()=>{rejectReady(new Error('Não foi possível iniciar o preenchimento nativo.'));fail('Não foi possível iniciar o preenchimento nativo.');});
    child.on('error',()=>{rejectReady(new Error('Preenchimento nativo indisponível.'));fail('Preenchimento nativo indisponível.');child=null;});
    child.on('exit',()=>{rejectReady(new Error('Preenchimento nativo interrompido.'));fail('Preenchimento nativo interrompido.');child=null;});
  }
  return {
    ready(){start();let timer;return Promise.race([readyPromise,new Promise((_,reject)=>{timer=setTimeout(()=>{child?.kill();reject(new Error('Tempo excedido ao preparar preenchimento.'));},10000);})]).finally(()=>clearTimeout(timer));},
    write(frame,field,amount){
      if(request)return Promise.reject(new Error('Preenchimento em andamento.'));
      start();
      return new Promise((resolve,reject)=>{
        const id=++counter;
        request={id,resolve,reject,timer:setTimeout(()=>{fail('Tempo excedido ao preencher Invest.');child?.kill();child=null;},8000)};
        child.stdin.write(JSON.stringify({id,handle:frame.handle,bounds:frame.bounds,field,amount:String(Number(Number(amount).toFixed(2)))})+'\n');
      });
    },
    stop(){fail('Preenchimento encerrado.');child?.kill();child=null;}
  };
}
module.exports={createStakeInput};
