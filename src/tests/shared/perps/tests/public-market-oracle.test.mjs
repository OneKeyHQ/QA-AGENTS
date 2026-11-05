import { test } from 'node:test';
import assert from 'node:assert/strict';
import { joinSpotContexts, eligibleSpotMarkets } from '../public-market-oracle.mjs';
test('spot oracle joins non-contiguous universe indexes by raw coin and preserves quotes',()=>{
  const rows=joinSpotContexts({tokens:[{index:101,name:'HYPE'},{index:0,name:'USDC'},{index:360,name:'USDH'}],universe:[{name:'@107',index:107,tokens:[101,0]},{name:'@232',index:232,tokens:[101,360]}]},[{coin:'@232',dayNtlVlm:'0'},{coin:'@107',dayNtlVlm:'1000'}]);
  assert.deepEqual(rows.map(r=>[r.coin,r.quote,r.context.dayNtlVlm]),[['@107','USDC','1000'],['@232','USDH','0']]);
  assert.deepEqual(eligibleSpotMarkets(rows).map(r=>r.coin),['@107']);
});
test('spot volume boundary is inclusive and missing context is not eligible when real volume exists',()=>{
  const rows=[999.999,1000,1000.001].map((v,i)=>({coin:`@${i}`,context:{dayNtlVlm:String(v)}}));rows.push({coin:'@unknown',context:null});
  assert.deepEqual(eligibleSpotMarkets(rows).map(r=>r.coin),['@1','@2']);
});
test('all unavailable spot volume leaves the full list visible',()=>{
  const rows=[{coin:'@1',context:null},{coin:'@2',context:{dayNtlVlm:'0'}}];assert.deepEqual(eligibleSpotMarkets(rows),rows);
});
test('ambiguous raw market contexts fail closed',()=>assert.throws(()=>joinSpotContexts({tokens:[],universe:[]},[{coin:'@1'},{coin:'@1'}]),/unique coin/));
