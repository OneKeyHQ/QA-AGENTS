import test from 'node:test';
import assert from 'node:assert/strict';
import {projectSizingSide} from '../sizing-projection.mjs';
const bn = x => ({toFixed: () => String(x)});
function fixture(feed) {
  const ref = {activeTradeInstrument:{coin:'BTC'},perpsAccount:{accountAddress:'A'},isSpot:false,side:'long',
    formData:{type:'market',orderMode:'twap',sizeInputMode:'slider',sizePercent:20},resolvedSizeInputUnit:'usd',
    computedSizeForSide:bn('.2'),effectivePriceBN:bn(100),twapReferencePriceBN:bn(100),twapTriggerReferencePriceBN:bn(100),orderValue:bn(20),leverage:10,szDecimals:4};
  return {type:function SideButtonInternal(){},memoizedState:{memoizedState:{current:ref},next:{memoizedState:{v:feed},next:null}}};
}
const raw = {coin:'BTC',accountAddress:'A',markPx:'100',maxTradeSzs:['1','2'],leverage:{value:10}};
test('current Desktop raw max feed is scoped by accountAddress', () => {
  const s = projectSizingSide(fixture(raw),{innerText:'≈ $20.00'});
  assert.deepEqual(s.feeds,[{coin:'BTC',account:'A',mark:'100',maxima:['1','2'],leverage:10}]);
});
test('conflicting account aliases fail rather than selecting a convenient identity', () => {
  assert.throws(()=>projectSizingSide(fixture({...raw,user:'B'}),{innerText:''}),/Conflicting/);
});
