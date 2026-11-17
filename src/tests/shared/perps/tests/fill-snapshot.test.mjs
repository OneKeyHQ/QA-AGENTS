import test from 'node:test';import assert from 'node:assert/strict';import {normalizeFills} from '../fill-snapshot.mjs';
const a={tid:1,coin:'BTC',time:1,side:'B',sz:'1',px:'10'},b={...a,tid:2,coin:'xyz:BTC'};
test('fill snapshot preserves distinct raw markets and detects new/changed fills',()=>{
 assert.deepEqual(normalizeFills([a,b]),normalizeFills([b,a]));
 assert.notDeepEqual(normalizeFills([a]),normalizeFills([a,b]));
 assert.notDeepEqual(normalizeFills([a]),normalizeFills([{...a,sz:'2'}]));
 assert.equal(normalizeFills([{...a,tid:0},{...b,tid:0}]).length,2);
 assert.throws(()=>normalizeFills([a,a]));assert.throws(()=>normalizeFills([{...a,side:'bad'}]));assert.throws(()=>normalizeFills({}));
});
