import test from 'node:test';import assert from 'node:assert/strict';
import {assertFundingRenderedRows} from '../funding-dom-evidence.mjs';
const r={delta:{coin:'xyz:ABC',szi:'-1',fundingRate:'-0.00000125'}};
const cells=['date','ABC','1 ABC','做空','-$0.01','-0.000125%'];
test('rendered funding cells detect stale market, side, rate and wrong page',()=>{
 assert.equal(assertFundingRenderedRows([cells],[r]),1);
 for(const [index,bad] of [[1,'OTHER'],[3,'做多'],[5,'0.000125%']]){const row=[...cells];row[index]=bad;assert.throws(()=>assertFundingRenderedRows([row],[r]));}
 assert.throws(()=>assertFundingRenderedRows([cells],[r],2));assert.throws(()=>assertFundingRenderedRows([],[r]));
 assert.equal(assertFundingRenderedRows([cells],Array(21).fill(r),2),1);
});
