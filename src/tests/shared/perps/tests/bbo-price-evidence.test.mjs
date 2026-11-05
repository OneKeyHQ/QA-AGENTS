import test from 'node:test';
import assert from 'node:assert/strict';
import {expectedBboPrice,assertBboPriceState} from '../bbo-price-evidence.mjs';
const base={bid:'100',ask:'101',szDecimals:4};
test('BBO四模式双方向使用买卖一，5表示有效价格步长而非第五档',()=>{
  for(const [side,type,offsetTicks,price]of [
    ['long','counterparty',0,'101'],['short','counterparty',0,'100'],
    ['long','queue',0,'100'],['short','queue',0,'101'],
    ['long','counterparty',5,'101.05'],['short','counterparty',5,'99.95'],
    ['long','queue',5,'99.95'],['short','queue',5,'101.05'],
  ])assert.equal(expectedBboPrice({...base,side,type,offsetTicks}),price);
});
test('BBO跨数量级重新求有效网格，现货小价不能使用永续精度',()=>{
  assert.equal(expectedBboPrice({bid:'9.9999',ask:'9.9999',szDecimals:0,side:'long',type:'counterparty',offsetTicks:5}),'10.004');
  assert.equal(expectedBboPrice({bid:'10',ask:'10',szDecimals:0,side:'short',type:'counterparty',offsetTicks:5}),'9.9995');
  assert.equal(expectedBboPrice({bid:'0.00001',ask:'0.00001001',szDecimals:0,spot:true,side:'long',type:'counterparty',offsetTicks:5}),'0.00001006');
  assert.throws(()=>expectedBboPrice({bid:'0.00001',ask:'0.00001001',szDecimals:0,side:'long',type:'counterparty',offsetTicks:5}));
});
test('BBO真实价格证据拒绝错误方向、模式、资产、旧盘口或猜选多个快照',()=>{
  const good={coin:'BTC',mode:{type:'counterparty',offsetTicks:5},type:'limit',advanced:false,priceError:null,books:[{coin:'BTC',bid:'80000',ask:'80001',time:100000}],now:100001,szDecimals:5,side:'long',spot:false,price:'80006'};
  const fixture={coin:'BTC',label:'对手价 5',type:'counterparty',offsetTicks:5};
  assertBboPriceState(good,fixture);
  for(const patch of [{coin:'ETH'},{side:'short'},{price:'80001'},{mode:{type:'queue',offsetTicks:5}},{advanced:true},{now:200000},{books:[]},{books:[...good.books,...good.books]},{priceError:'bbo_unavailable'}])assert.throws(()=>assertBboPriceState({...good,...patch},fixture));
});
