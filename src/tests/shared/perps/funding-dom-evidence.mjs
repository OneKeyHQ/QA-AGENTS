// Compare rendered cells with raw records. Reading table props alone cannot
// detect stale rows left on screen after a toolbar filter changes.
import assert from 'node:assert/strict';
import {fundingRateText} from './funding-csv-evidence.mjs';
export function assertFundingRenderedRows(actual,records,page=1){
 const expected=records.slice((page-1)*20,page*20);
 assert.equal(actual.length,expected.length,'Rendered funding page row count');
 for(const [i,r] of expected.entries()){
  const cells=actual[i];assert.equal(cells.length,6,'Six rendered funding columns');
  const d=r.delta;
  // The visible funding market uses the base symbol. CSV deliberately adds
  // the DEX suffix; sharing its display expectation would reject valid UI.
  const market=d.coin.includes(':')?d.coin.slice(d.coin.indexOf(':')+1):d.coin;
  assert.equal(cells[1].trim(),market,`Rendered funding market ${i}`);
  assert.equal(cells[3].trim(),Number(d.szi)>0?'做多':Number(d.szi)<0?'做空':'--',`Rendered funding side ${i}`);
  assert.equal(cells[5].trim(),fundingRateText(d.fundingRate),`Rendered funding rate ${i}`);
 }
 return actual.length;
}
