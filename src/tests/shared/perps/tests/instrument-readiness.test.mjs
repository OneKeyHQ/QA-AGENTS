import test from 'node:test';import assert from 'node:assert/strict';import {instrumentBoundaryReady} from '../instrument-readiness.mjs';
const native={instruments:[{coin:'BTC',mode:'perp'}],native:['BTC'],spot:['@107']};
test('optimistic ticker cannot prove background asset/form readiness',()=>{assert.equal(instrumentBoundaryReady({...native,native:['ETH']},'BTCUSDC'),false);assert.equal(instrumentBoundaryReady({...native,native:[]},'BTCUSDC'),false);assert.equal(instrumentBoundaryReady(native,'BTCUSDC'),true);});
test('both active spot atom and form instrument must agree; retained native atom irrelevant',()=>{const spot={instruments:[{coin:'@107',mode:'spot'}],native:['BTC'],spot:['@107']};assert.equal(instrumentBoundaryReady(spot,'HYPE/USDC'),true);assert.equal(instrumentBoundaryReady({...spot,spot:['@1']},'HYPE/USDC'),false);assert.equal(instrumentBoundaryReady(spot,'BTCUSDC'),false);});
test('mixed committed form instruments fail closed',()=>assert.equal(instrumentBoundaryReady({...native,instruments:[...native.instruments,{coin:'ETH',mode:'perp'}]},'BTCUSDC'),false));
test('HIP-3 ticker requires its DEX identity; another DEX or missing badge cannot settle',()=>{
 const hip={instruments:[{coin:'xyz:SOXL',mode:'perp'}],native:['xyz:SOXL'],spot:['@1187']};
 assert.equal(instrumentBoundaryReady(hip,'SOXLUSDC','xyz'),true);
 assert.equal(instrumentBoundaryReady(hip,'SOXLUSDC','abc'),false);
 assert.equal(instrumentBoundaryReady(hip,'SOXLUSDC'),false);
 assert.equal(instrumentBoundaryReady({...hip,native:['abc:SOXL']},'SOXLUSDC','xyz'),false);
});
