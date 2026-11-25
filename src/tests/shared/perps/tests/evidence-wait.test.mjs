import test from 'node:test';
import assert from 'node:assert/strict';
import * as runtime from '../runtime.mjs';

test('readiness waits proceed immediately when the specific result is already present', async () => {
  assert.equal(typeof runtime.waitForEvidence,'function');
  let reads=0;
  assert.equal(await runtime.waitForEvidence(async()=>{reads++;return 'ETH';},v=>v==='ETH','ETH market'), 'ETH');
  assert.equal(reads,1);
});
test('readiness waits reject stale results until the expected identity and value commit', async () => {
  let reads=0;
  const result=await runtime.waitForEvidence(async()=>++reads===1?{coin:'BTC',value:10}:{coin:'ETH',value:20},
    async v=>v.coin==='ETH'&&v.value===20,'ETH quote',{interval:1});
  assert.equal(reads,2);assert.equal(result.coin,'ETH');
});
test('timeout retains the last actual value and cannot pass an empty result', async () => {
  await assert.rejects(runtime.waitForEvidence(async()=>[],v=>v.length===3,'Exactly 3 favorites',{timeout:2,interval:1}),
    e=>e.code==='PERPS_READINESS_TIMEOUT'&&e.message.includes('Exactly 3 favorites')&&JSON.stringify(e.actual)==='[]');
});
test('read failures retain their cause rather than silently becoming success', async () => {
  const error=Error('identity unavailable');
  await assert.rejects(runtime.waitForEvidence(async()=>{throw error;},()=>true,'Identity'),e=>e===error);
});
