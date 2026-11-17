import assert from 'node:assert/strict';

// Independent fixed-point grid oracle. Enumerate neighbouring valid price
// grids; never import the application's BBO/next-price implementation.
const digits = 12, scale = 10n ** BigInt(digits);
function decimal(value) {
  assert.match(String(value), /^\d+(?:\.\d{1,12})?$/u, 'Plain non-negative exact decimal required');
  const [a,b=''] = String(value).split('.');
  return BigInt(a) * scale + BigInt(b.padEnd(digits,'0'));
}
function text(value) {
  const a=value/scale,b=(value%scale).toString().padStart(digits,'0').replace(/0+$/u,'');
  return a.toString()+(b?'.'+b:'');
}
function exponent(value) { return value.toString().length-digits-1; }
function tick(power, decimals) {
  const tickPower=Math.max(-decimals,Math.min(power-4,0));
  return 10n ** BigInt(digits+tickPower);
}
function nextGrid(price, up, decimals) {
  const power=exponent(price), candidates=[];
  for(const e of [power-1,power,power+1]) {
    const step=tick(e,decimals),q=price/step;
    const next=up?(q+1n)*step:(q-(price%step===0n?1n:0n))*step;
    if(next>0n&&next%tick(exponent(next),decimals)===0n&&(up?next>price:next<price))candidates.push(next);
  }
  assert.ok(candidates.length,'Adjacent positive valid BBO grid exists');
  return candidates.reduce((a,b)=>up?(a<b?a:b):(a>b?a:b));
}
export function expectedBboPrice({bid,ask,side,type,offsetTicks,szDecimals,spot=false}) {
  assert.ok(['long','short'].includes(side));
  assert.ok(['counterparty','queue'].includes(type));
  assert.ok([0,5].includes(offsetTicks));
  assert.ok(Number.isInteger(szDecimals)&&szDecimals>=0&&szDecimals<=8);
  const useAsk=(side==='long')===(type==='counterparty');
  const bidValue=decimal(bid),askValue=decimal(ask);
  assert.ok(bidValue>0n&&askValue>=bidValue,'Valid two-sided raw BBO required');
  let price=useAsk?askValue:bidValue;
  const decimals=Math.max((spot?8:6)-szDecimals,0);
  assert.equal(price%tick(exponent(price),decimals),0n,'Raw BBO on valid price grid');
  for(let n=0;n<offsetTicks;n++)price=nextGrid(price,useAsk,decimals);
  return text(price);
}
export function assertBboPriceState(state, {coin,label,type,offsetTicks}) {
  assert.equal(state.coin,coin,'BBO must belong to the selected raw market');
  assert.equal(state.mode?.type,type,`${label} mode type`);
  assert.equal(state.mode?.offsetTicks,offsetTicks,`${label} offset`);
  assert.equal(state.type,'limit');
  assert.equal(state.advanced,false);
  assert.equal(state.priceError,null);
  assert.equal(state.books.length,1,'One committed raw BBO per button required');
  const book=state.books[0];
  assert.equal(book.coin,coin,'BBO coin must match the button');
  assert.ok(Number.isFinite(book.time)&&Math.abs(state.now-book.time)<30000,'Fresh raw BBO required');
  const expected=expectedBboPrice({bid:book.bid,ask:book.ask,side:state.side,type,offsetTicks,szDecimals:state.szDecimals,spot:state.spot});
  assert.equal(state.price,expected,`${label}/${state.side}: actual committed price vs independent raw BBO grid`);
  return {side:state.side,price:state.price,bid:book.bid,ask:book.ask,time:book.time};
}
