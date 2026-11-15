const test=require('node:test'),assert=require('node:assert/strict');
const {parseReturnLines,parseVisibleResultTrade,createToastGate}=require('./exnovaCapture.cjs');
const line=(text,left,top)=>({text,left,top,confidence:90});
const parse=(amount)=>parseReturnLines([line('RETORNO',60,20),line(amount,60,54),line('R$5580',360,54)]);
const trade=(notice,stake)=>parseVisibleResultTrade({lines:[]},notice,new Date(2026,10,4),stake);
test('return amount belongs to the label, net result is distinct from stake',()=>{
  assert.equal(parse('+R$55,80').amount,55.8);
  assert.equal(trade(parse('+R$55,80'),30).pnl,25.8);
  assert.equal(trade(parse('+$3.76'),2).pnl,1.76);
  assert.equal(trade(parse('R$5580'),55.8),null);
  assert.equal(trade(parse('R$0,00'),55.8).pnl,-55.8);
  assert.equal(trade(parse('R$55,80'),55.8).result,'BREAKEVEN');
  assert.equal(parseReturnLines([line('RETORNO',60,20),line('R$5580',360,54)]).amount,null);
});
test('one event through changing OCR and missed frames; identical next trade can register',()=>{
  const gate=createToastGate(),notice=parse('+$3.76');let recorded=0;
  for(const frame of [notice,notice,null,null,parse('+$3.78'),notice,notice,{amount:null},notice,null,null,null,notice,notice]){
    if(gate.observe(frame)){recorded++;gate.markRecorded();}
  }
  assert.equal(recorded,2);
});
test('a corroborated one-frame result is captured only once',()=>{
  const gate=createToastGate();
  const notice={...parse('+$3.76'),confirmedInFrame:true};
  assert.equal(gate.observe(notice),true);gate.markRecorded();
  assert.equal(gate.observe(null),false);
  assert.equal(gate.observe(notice),false);
  assert.equal(createToastGate().observe({...notice,confirmedInFrame:false}),false);
});
test('keeps a brief panel in order while background frames accumulate during OCR',()=>{
  const {bufferCaptureFrame}=require('./exnovaCapture.cjs');const queue=[];
  for(let at=0;at<30;at++)bufferCaptureFrame(queue,{at,kind:at===8?'panel':'background'});
  assert(queue.some(f=>f.at===8));assert(queue.length<=8);
  assert.deepEqual(queue.map(f=>f.at),queue.map(f=>f.at).sort((a,b)=>a-b));
});
test('zero beside a grid line uses the coordinates of the RETORNO word',()=>{
  const {toastLines}=require('./exnovaCapture.cjs');
  const word=(text,x,y,confidence)=>({text,confidence,bbox:{x0:x,x1:x+35,y0:y,y1:y+18}});
  const lines=[{words:[word('©',290,294,39),word('RETORNO',366,294,81)]},
    {words:[word('eee',60,311,20),word('$0',366,339,94)]}];
  const notice=parseReturnLines(toastLines({lines},3));
  assert.equal(notice.amount,0);assert.equal(trade(notice,30).pnl,-30);
});
test('dark background cannot keep a disappeared toast marked as visible',()=>{
  const {sameReturnLabel}=require('./exnovaCapture.cjs');const old=Buffer.alloc(44*12*4),gone=Buffer.alloc(old.length);
  for(let i=0;i<12;i++){old[i*4]=old[i*4+1]=old[i*4+2]=255;}
  assert.equal(sameReturnLabel(old,old),true);
  assert.equal(sameReturnLabel(old,gone),false);
  const gate=createToastGate(),notice={amount:0,currency:'$',confirmedInFrame:true};
  let recorded=0;
  for(let operation=0;operation<5;operation++){
    assert.equal(gate.observe(notice),true);gate.markRecorded();recorded++;
    assert.equal(gate.observe(notice),false);
    for(let miss=0;miss<3;miss++)gate.observe(null);
  }
  assert.equal(recorded,5);
});
