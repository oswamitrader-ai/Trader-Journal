const {app,nativeImage}=require('electron');
const {createWorker}=require('tesseract.js');
const path=require('node:path');
const {investmentRect,readInvestAmount}=require('../electron/exnovaStakeShield.cjs');
app.whenReady().then(async()=>{
  let worker;
  try{
    const image=nativeImage.createFromPath('C:/Users/swami/Downloads/Capturar.PNG'),size=image.getSize();
    const crop={x:Math.floor(size.width*.72),y:Math.floor(size.height*.055),width:0,height:Math.floor(size.height*.24)};crop.width=size.width-crop.x;
    worker=await createWorker('eng',1,{langPath:path.join(__dirname,'../electron/tessdata'),gzip:true,cacheMethod:'none',logger:()=>{}});
    await worker.setParameters({tessedit_pageseg_mode:'11'});
    const panel=image.crop(crop).resize({width:crop.width*3}),bitmap=panel.toBitmap();
    for(let i=0;i<bitmap.length;i+=4){const v=(.114*bitmap[i]+.587*bitmap[i+1]+.299*bitmap[i+2])>=65?0:255;bitmap[i]=bitmap[i+1]=bitmap[i+2]=v;bitmap[i+3]=255;}
    const {data}=await worker.recognize(nativeImage.createFromBitmap(bitmap,panel.getSize()).toPNG(),{},{blocks:true});
    const lines=(data.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>p.lines||[]));
    const region=investmentRect(lines,size,crop,3);
    const transformed=lines.map(l=>({...l,bbox:{x0:crop.x+l.bbox.x0/3,y0:crop.y+l.bbox.y0/3,x1:crop.x+l.bbox.x1/3,y1:crop.y+l.bbox.y1/3}}));
    const amount=region?readInvestAmount(transformed,size,region):null;
    console.log(JSON.stringify({region,amount,lines:lines.map(l=>({text:l.text,confidence:l.confidence,bbox:l.bbox}))}));
    if(!region||amount!==2)process.exitCode=1;
  }catch(e){console.error(e.message);process.exitCode=1;}
  finally{await worker?.terminate();app.exit(process.exitCode||0);}
});
