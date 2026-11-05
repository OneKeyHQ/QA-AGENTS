import test from 'node:test';
import assert from 'node:assert/strict';
test('failed catalog reads are shared once, then evicted so the next step can recover',async()=>{
 const {readCachedCatalog}=await import('../catalog-cache.mjs');
 const cache=new WeakMap(),page={};let calls=0;
 const failing=()=>{calls++;throw Error('transport offline');};
 await Promise.all([assert.rejects(readCachedCatalog(cache,page,failing),/transport offline/),assert.rejects(readCachedCatalog(cache,page,failing),/transport offline/)]);
 assert.equal(calls,1);
 const catalog=['BTC'];
 assert.equal(await readCachedCatalog(cache,page,()=>{calls++;return catalog;}),catalog);
 assert.equal(await readCachedCatalog(cache,page,()=>{throw Error('success must remain cached');}),catalog);
 assert.equal(calls,2);
});
