const path = require('node:path');
const { createWorker } = require('tesseract.js');
const { createWindowTracker } = require('./exnovaWindowTracker.cjs');
const { createStakeInput } = require('./exnovaStakeInput.cjs');

function toTargetAmount(state) {
  if (!state?.enforceBrokerStakeLock) return null;
  const fixed = Number(state.fixedStakeAmount) || 50;
  const wins = Math.max(0, Number(state.consecutiveWins) || 0);
  const losses = Math.max(0, Number(state.consecutiveLosses) || 0);
  const style = String(state.managementStyle || 'MAO_FIXA').toUpperCase();
  const levels = { SOROS_1: 1, SOROS_2: 2, SOROS_3: 3 };
  const level = levels[style] ? wins % (levels[style]+1) : 0;
  if (level > 0) return Number(state[`sorosLevel${level}Stake`]) || [0, 93.5, 174.8, 326.9][level];
  if (['MARTINGALE', 'SOROSGALE'].includes(style) && losses > 0 && losses <= 2) return Number(state[`martingaleLevel${losses}Stake`]) || [0, 100, 200][losses];
  return fixed;
}
function investmentRect(lines, size, crop, scale, unit = 1) {
  // Regex principal: INVEST / INVESTMENT / INVESTIMENTO
  // Regex ampliada: variações OCR comuns em interfaces de baixo contraste
  // Ex: "In gost", "Ingost", "Ingest", "Invast", "Invest", "Invost", "In vest"
  const INVEST_RE = /\bINVEST(?:MENT|IMENTO)?\b|\bIn[\s]?(?:gost|vest|gest|vost|vast|gast|gust)\b/i;
  let label = lines.filter(l => Number(l.confidence) >= 25 && INVEST_RE.test(l.text || '')).sort((a,b)=>a.bbox.y0-b.bbox.y0)[0];

  // Fallback: localiza pelo padrão monetário "$ XX" ou "$ X.XX" na região direita
  // (o valor do campo Invest é detectado com alta confiança mesmo quando o label falha)
  if (!label) {
    const AMOUNT_RE = /^\$\s*\d[\d.,]*$/;
    const amountLine = lines.filter(l => Number(l.confidence) >= 50 && AMOUNT_RE.test((l.text || '').trim())).sort((a,b)=>a.bbox.y0-b.bbox.y0)[0];
    if (amountLine) {
      // Usa a linha do valor como âncora: o label "Invest" fica ~25px acima do valor
      label = { bbox: { x0: amountLine.bbox.x0, y0: Math.max(0, amountLine.bbox.y0 - 25*scale), x1: amountLine.bbox.x1, y1: amountLine.bbox.y0 } };
    }
  }

  if (!label) return null;
  const left = crop.x + label.bbox.x0 / scale, top = crop.y + label.bbox.y0 / scale;
  if (left < size.width*.65 || top > size.height*.35) return null;
  return {x:Math.max(0,left-8*unit)/size.width,y:Math.max(0,top-13*unit)/size.height,
    width:(size.width-Math.max(0,left-8*unit))/size.width,height:42*unit/size.height};
}
function physicalField(frame,region){const b=frame.bounds;return {x:Math.round(b.x+b.width*region.x),y:Math.round(b.y+b.height*region.y),width:Math.round(b.width*region.width),height:Math.round(b.height*region.height)};}
function readInvestAmount(lines,size,region){
  const candidates=lines.filter(l=>Number(l.confidence)>=50 && l.bbox.x0>=size.width*region.x && l.bbox.y0>=size.height*(region.y+region.height*.32) && l.bbox.y1<=size.height*(region.y+region.height)+2);
  for(const line of candidates){
    const text=String(line.text||'').replace(/R\s*\$|\$/gi,'').replace(/\s*[+-]\s*$/,'').trim();
    if(!/^(?:\d+|\d{1,3}(?:[.,]\d{3})+)(?:[.,]\d{1,2})?$/.test(text))continue;
    const decimal=/[.,]\d{1,2}$/.exec(text);
    const normalized=decimal?text.slice(0,decimal.index).replace(/[.,]/g,'')+'.'+decimal[0].slice(1):text.replace(/[.,]/g,'');
    const value=Number(normalized);if(Number.isFinite(value)&&value>0)return value;
  }
  return null;
}
function geometryFor(frame, region, screen) {
  const b = frame.bounds;
  return screen.screenToDipRect(null,{x:Math.round(b.x+b.width*region.x),y:Math.round(b.y+b.height*region.y),width:Math.round(b.width*region.width),height:Math.round(b.height*region.height)});
}
function makeShieldPage(amount,verified) {
  const value=Number(amount).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  return `<!doctype html><html><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#064e3b}body{display:flex;align-items:center;justify-content:center;border:2px solid #10b981;border-radius:5px;color:#d1fae5;font:bold 12px 'Segoe UI',sans-serif;user-select:none;cursor:not-allowed}</style><body>${verified?'🔒':'⏳'} R$ ${value}</body></html>`;
}
function createExnovaStakeShield({desktopCapturer,screen,BrowserWindow,app,onStatus,trackerFactory=createWindowTracker,inputFactory=createStakeInput}) {
  let stopped=true,processing=false,timer,overlay,workerPromise;
  let lockState={},calibration=null,lastAmount=null,lastPublished='',lastAttempt=0;
  let confirmedAmount=null,editing=false,lastWriteAt=0;
  let writeKey='',writeAttempts=0,validationError='',lastConfirmedKey='';
  const input=inputFactory();
  const tracker=trackerFactory(()=>position());
  function publish(state,message,extra={}) {
    const data={state,message,enabled:Boolean(lockState.enforceBrokerStakeLock),...extra},key=JSON.stringify(data);
    if(key!==lastPublished){lastPublished=key;onStatus?.(data);}
  }
  function hide(){if(overlay&&!overlay.isDestroyed())overlay.hide();}
  function frameKey(f){return `${f.handle}:${f.bounds.width}:${f.bounds.height}`;}
  function position(){
    const frame=tracker.getState(),amount=toTargetAmount(lockState);
    if(stopped||!(amount>0)||editing){hide();return;}
    if(!frame?.visible){hide();publish('waiting','Trava pronta; aguardando a Exnova aberta.');return;}
    if(!calibration||calibration.key!==frameKey(frame)){hide();return;}
    if(!overlay||overlay.isDestroyed()){
      overlay=new BrowserWindow({width:120,height:40,show:false,frame:false,transparent:true,resizable:false,movable:false,minimizable:false,maximizable:false,closable:false,focusable:false,skipTaskbar:true,hasShadow:false,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
      overlay.setAlwaysOnTop(true,'screen-saver');overlay.setIgnoreMouseEvents(false);
      overlay.webContents.on('did-finish-load',()=>position());
    }
    const bounds=geometryFor(frame,calibration.region,screen);overlay.setBounds(bounds,false);
    const verified=confirmedAmount!==null&&Math.abs(confirmedAmount-amount)<.005;
    const renderKey=amount+':'+verified;
    if(lastAmount!==renderKey){lastAmount=renderKey;overlay.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(makeShieldPage(amount,verified))}`).catch(()=>{});}
    if(!overlay.webContents.isLoading())overlay.showInactive();
    publish(validationError?'error':verified?'locked':'verifying',validationError|| (verified?`Invest confirmado: R$ ${amount.toFixed(2)}. Campo protegido.`:`Entrada definida: R$ ${amount.toFixed(2)}. Confirmando o valor no Invest…`),{amount,bounds,verified});
  }
  async function poll(){
    if(stopped)return;
    tracker.start();position();if(processing)return;
    const frame=tracker.getState();
    if(!(toTargetAmount(lockState)>0)){publish('disabled','Ative a trava de entrada no painel de gestão.');return;}
    if(!frame?.visible)return;
    if(Date.now()-lastAttempt<1500)return;
    lastAttempt=Date.now();processing=true;
    try{
      if(calibration?.key!==frameKey(frame)){calibration=null;confirmedAmount=null;publish('detecting','Localizando o campo Invest da Exnova…');}
      const sources=await desktopCapturer.getSources({types:['window'],thumbnailSize:{width:1920,height:1200},fetchWindowIcons:false});
      const target=sources.find(s=>String(s.id).split(':')[1]===frame.handle);
      if(!target?.thumbnail||target.thumbnail.isEmpty())throw new Error('Janela sem imagem disponível.');
      const size=target.thumbnail.getSize();
      const crop={x:Math.floor(size.width*.72),y:Math.floor(size.height*.055),width:0,height:Math.floor(size.height*.24)};crop.width=size.width-crop.x;
      const scale=3;
      if(!workerPromise){
        const langPath=app.isPackaged?path.join(process.resourcesPath,'tessdata'):path.join(__dirname,'tessdata');
        const workerPath=app.isPackaged?path.join(process.resourcesPath,'app.asar.unpacked/node_modules/tesseract.js/src/worker-script/node/index.js'):path.join(__dirname,'../node_modules/tesseract.js/src/worker-script/node/index.js');
        workerPromise=createWorker('eng',1,{langPath,workerPath,gzip:true,cacheMethod:'none',logger:()=>{}});
      }
      const worker=await workerPromise;await worker.setParameters({tessedit_pageseg_mode:'11'});
      let {data}=await worker.recognize(target.thumbnail.crop(crop).resize({width:crop.width*scale}).toPNG(),{},{blocks:true});
      let lines=data.lines||(data.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>p.lines||[]));
      // Low-contrast grey labels on the broker's dark panel need a second OCR pass.
      if(!lines.some(l=>Number(l.confidence)>=30 && /\bINVEST(?:MENT|IMENTO)?\b/i.test(l.text||''))){
        const panel=target.thumbnail.crop(crop).resize({width:crop.width*scale});
        const bitmap=panel.toBitmap();
        for(let i=0;i<bitmap.length;i+=4){
          const luminance=.114*bitmap[i]+.587*bitmap[i+1]+.299*bitmap[i+2];
          const value=luminance>=65?0:255;
          bitmap[i]=bitmap[i+1]=bitmap[i+2]=value;bitmap[i+3]=255;
        }
        const enhanced=require('electron').nativeImage.createFromBitmap(bitmap,panel.getSize());
        const retry=await worker.recognize(enhanced.toPNG(),{},{blocks:true});
        lines=retry.data.lines||(retry.data.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>p.lines||[]));
      }
      if(!app.isPackaged) console.log('[OCR Diagnóstico] Linhas detectadas (crop 72-100% x 5.5-29.5%):', JSON.stringify(lines.map(l=>({text:l.text?.trim(),conf:Math.round(l.confidence),bbox:{x0:Math.round(crop.x+l.bbox.x0/scale),y0:Math.round(crop.y+l.bbox.y0/scale),x1:Math.round(crop.x+l.bbox.x1/scale),y1:Math.round(crop.y+l.bbox.y1/scale)}})).filter(l=>l.text)));
      const density=size.width/screen.screenToDipRect(null,frame.bounds).width;
      const region=calibration?.region||investmentRect(lines,size,crop,scale,density);
      if(!region)throw new Error('Não localizei o texto Invest; mantenha o painel de entrada visível.');
      if(stopped||tracker.getState()?.handle!==frame.handle)return;
      calibration={key:frameKey(frame),region};position();
      const amount=toTargetAmount(lockState);
      const nextKey=frameKey(frame)+':'+amount;
      if(nextKey!==writeKey){writeKey=nextKey;writeAttempts=0;lastWriteAt=0;validationError='';}
      const fullLines=lines.map(l=>({...l,bbox:{x0:crop.x+l.bbox.x0/scale,y0:crop.y+l.bbox.y0/scale,x1:crop.x+l.bbox.x1/scale,y1:crop.y+l.bbox.y1/scale}}));
      const observed=readInvestAmount(fullLines,size,region);
      if(!app.isPackaged) console.log('[Exnova Invest readback]',JSON.stringify({expected:amount,observed,lines:fullLines.filter(l=>l.bbox.y0>=size.height*region.y&&l.bbox.y1<=size.height*(region.y+region.height)+2).map(l=>({text:l.text,confidence:l.confidence}))}));
      if(observed!==null&&Math.abs(observed-amount)<.005){lastConfirmedKey=nextKey;confirmedAmount=amount;writeAttempts=0;validationError='';position();return;}
      confirmedAmount=null;
      // An unreadable frame is not evidence that the broker changed the value.
      // Keep reporting unverified, but do not retype a previously confirmed target.
      if(observed===null&&lastConfirmedKey===nextKey){validationError='Leitura do Invest temporariamente indisponível; aguardando nova confirmação.';position();return;}
      if(observed!==null)lastConfirmedKey='';
      if(writeAttempts>=2){validationError='Não foi possível confirmar o valor do Invest. A entrada ainda não está validada.';position();return;}
      if(Date.now()-lastWriteAt<5000)return;
      await input.ready();
      if(stopped||toTargetAmount(lockState)!==amount)return;
      if(!tracker.getState()?.foreground||frameKey(tracker.getState())!==frameKey(frame))return;
      lastWriteAt=Date.now();writeAttempts++;editing=true;hide();
      try{await new Promise(resolve=>setTimeout(resolve,150));if(stopped||toTargetAmount(lockState)!==amount)return;await input.write(frame,physicalField(frame,region),amount);}
      finally{editing=false;position();}
      // Confirmation is deliberately deferred to a NEW frame, after broker formatting.
      publish('verifying',`Valor enviado ao Invest; aguardando confirmação de R$ ${amount.toFixed(2)}.`,{amount,verified:false});
    }catch(error){confirmedAmount=null;validationError=`Trava de entrada: ${String(error.message).slice(0,180)}`;publish('error',validationError,{verified:false});position();}
    finally{processing=false;}
  }
  return {
    getStatus:()=>lastPublished?JSON.parse(lastPublished):{state:'waiting',enabled:false,message:'Inicializando trava nativa.'},
    setLockState(state){lockState={...lockState,...state};position();if(!stopped)void poll();},
    async start(){if(!stopped)return;stopped=false;tracker.start();timer=setInterval(()=>void poll(),250);timer.unref?.();await poll();},
    async stop(){stopped=true;clearInterval(timer);tracker.stop();input.stop();hide();if(workerPromise){try{await(await workerPromise).terminate();}catch{}workerPromise=null;}overlay?.destroy();overlay=null;},
  };
}
module.exports={createExnovaStakeShield,toTargetAmount,investmentRect,geometryFor,readInvestAmount,physicalField};
