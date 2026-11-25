import test from 'node:test';
import assert from 'node:assert/strict';
import * as evidence from '../execution-evidence.mjs';

const metadata=async()=>({'X-Onekey-Request-Version':'6.7.0','X-Onekey-Request-Build-Number':'20261102001','User-Agent':'OneKeyWallet/6.7.0'});
test('Desktop evidence binds the actual case result to the installed version/build and execution window', async()=>{
  const [tc]=evidence.decoratePerpsCases([{id:'PERPS-001',fn:async()=>({status:'passed',steps:[]})}],{readMetadata:metadata});
  const result=await tc.fn({});
  assert.equal(result.context.version,'6.7.0');assert.equal(result.context.build,'20261102001');
  assert.equal(result.context.platform,'desktop');assert.equal(result.context.testId,'PERPS-001');
  assert.ok(result.context.startedAt && result.context.endedAt);
});
test('missing or mismatched package evidence blocks before any UI action', async()=>{
  let actions=0;
  const [tc]=evidence.decoratePerpsCases([{id:'PERPS-001',fn:async()=>{actions++;}}],{readMetadata:async()=>{throw Error('Package mismatch');}});
  const result=await tc.fn({});
  assert.equal(actions,0);assert.equal(result.status,'skipped');assert.equal(result.blocked,true);
  assert.equal(result.steps[0].failureCategory,'environment');
});
test('assertion, readiness, sample and restore failures stay distinct and redact credentials', async()=>{
  for(const [error,category,status] of [
    [new assert.AssertionError({message:'Expected ETH',actual:'BTC',expected:'ETH'}),'assertion','failed'],
    [Object.assign(Error('Quote pending'),{code:'PERPS_READINESS_TIMEOUT',actual:[],expected:'quotes'}),'readiness','failed'],
    [Object.assign(Error('Sample absent'),{code:'PERPS_SAMPLE_UNAVAILABLE'}),'sample','skipped'],
    [Object.assign(Error('Restore failed'),{fatalRestore:true}),'restore','failed'],
  ]) {
    const [tc]=evidence.decoratePerpsCases([{id:'PERPS-001',fn:async()=>{throw error;}}],{readMetadata:metadata});
    const r=await tc.fn({});assert.equal(r.status,status);assert.equal(r.steps[0].failureCategory,category);
  }
  const [tc]=evidence.decoratePerpsCases([{id:'PERPS-001',fn:async()=>({status:'failed',steps:[{status:'failed',detail:'password=secret',actual:{privateKey:'secret'}}]})}],{readMetadata:metadata});
  assert.ok(!JSON.stringify(await tc.fn({})).includes('secret'));
});

test('invalid results and contradictory passed/failed/skipped steps cannot become a clean pass', async()=>{
  for(const [returned,status] of [
    [undefined,'failed'],
    [{status:'passed',steps:[]},'skipped'],
    [{status:'passed',steps:[{name:'sample',status:'skipped',detail:'Missing sample'}]},'skipped'],
    [{status:'passed',steps:[{name:'value',status:'failed',detail:'Mismatch'}]},'failed'],
  ]) {
    const [tc]=evidence.decoratePerpsCases([{id:'PERPS-001',fn:async()=>returned}],{readMetadata:metadata});
    const r=await tc.fn({});assert.equal(r.status,status);assert.ok(r.context.endedAt);
  }
});
