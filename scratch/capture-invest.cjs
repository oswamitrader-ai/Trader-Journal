const {app,desktopCapturer}=require('electron');
const fs=require('fs');
app.whenReady().then(async()=>{try{const sources=await desktopCapturer.getSources({types:['window'],thumbnailSize:{width:1920,height:1200}});const s=sources.find(s=>/exnova/i.test(s.name));if(!s)throw Error('No Exnova window');fs.writeFileSync('scratch/invest-current.png',s.thumbnail.crop({x:Math.floor(s.thumbnail.getSize().width*.72),y:0,width:s.thumbnail.getSize().width-Math.floor(s.thumbnail.getSize().width*.72),height:220}).toPNG());console.log(s.thumbnail.getSize());}catch(e){console.error(e)}finally{app.exit()}});
