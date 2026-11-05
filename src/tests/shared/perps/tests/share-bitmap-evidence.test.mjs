import test from 'node:test';
import assert from 'node:assert/strict';
import {expectedSharePnl,assertShareBitmapText} from '../share-bitmap-evidence.mjs';
const data={token:'BTC',side:'long',leverage:17,entryPrice:'80710.0',markPrice:'80149',pnl:'-2.3499',pnlPercent:'-11.805',priceType:'mark'};
const row=(text,y,height=.025)=>({text,x:.055,y,width:.2,height});
const fixture=()=>[row('BTC',.2),row('做多17X',.21),row('-11.81%',.33,.14),row('开仓价格',.51),row('80710.0',.565),row('标记价格',.625),row('80149',.675)];
test('分享像素期望独立处理美元截断、微小方向与百分比半入精度',()=>{
  assert.equal(expectedSharePnl(data,'pnl'),'-$2.34');assert.equal(expectedSharePnl(data,'roe'),'-11.81%');
  assert.equal(expectedSharePnl({...data,pnl:'0.0001'},'pnl'),'+< $0.01');
  assert.equal(expectedSharePnl({...data,pnl:'-0.0001'},'pnl'),'-< $0.01');
  assert.equal(expectedSharePnl({...data,pnl:'2.100'},'pnl'),'+$2.1');
  assert.equal(expectedSharePnl({...data,pnlPercent:'99.995'},'roe'),'+100.00%');
});
test('分享OCR断言拒绝错模式、负号丢失、错币/价格、缺标签和面板按钮混入',()=>{
  assertShareBitmapText(fixture(),data,'roe');
  for(const patch of [{index:2,text:'11.81%'},{index:2,text:'-$2.34'},{index:0,text:'ETH'},{index:4,text:'80711.0'},{index:5,text:'平仓价格'}]){
    const rows=fixture();rows[patch.index].text=patch.text;assert.throws(()=>assertShareBitmapText(rows,data,'roe'));
  }
  assert.throws(()=>assertShareBitmapText([...fixture(),row('保存图片',.9)],data,'roe'));
  const clipped=fixture();clipped[0].x=.99;assert.throws(()=>assertShareBitmapText(clipped,data,'roe'));
});
test('spot OCR uses buy/sell and average/current prices and rejects leaked perpetual badges or labels',()=>{
  const spot={...data,mode:'spot',token:'UBTC',tokenDisplayName:'BTC'};
  const rows=fixture();rows[1].text='买入';rows[3].text='平均成本价格';rows[5].text='当前价格';
  assertShareBitmapText(rows,spot,'roe');
  const pnl=rows.map(r=>({...r}));pnl[2].text='-$2.34';assertShareBitmapText(pnl,spot,'pnl');
  for(const patch of [{index:1,text:'做多17X'},{index:3,text:'开仓价格'},{index:5,text:'标记价格'},{index:0,text:'ETH'}]) {
    const wrong=rows.map(r=>({...r}));wrong[patch.index].text=patch.text;assert.throws(()=>assertShareBitmapText(wrong,spot,'roe'));
  }
  assert.throws(()=>assertShareBitmapText([...rows,row('17X',.85)],spot,'roe'));
});
