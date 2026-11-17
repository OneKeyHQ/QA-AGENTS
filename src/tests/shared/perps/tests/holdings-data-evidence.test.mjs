import test from 'node:test';
import assert from 'node:assert/strict';
import { holdingOracle, assertHoldingNumbers, assertHoldingOrder, projectHoldingsEvidence, assertHoldingPnlColor, assertSpotShareSource } from '../holdings-data-evidence.mjs';
const raw=(coin,total,hold='0',entryNtl='0')=>({coin,total,hold,entryNtl});
test('raw holdings oracle: exact decimals, frozen clamp, cost and signed percentage',()=>{
  const e=holdingOracle(raw('UBTC','0.03','0.04','2400'),'90000');
  assert.equal(e.total,'0.03');assert.equal(e.available,'0');assert.equal(e.value,'2700.00');
  assert.equal(e.pnl,'300');assert.equal(e.percent,'12.5');
  assert.equal(holdingOracle(raw('UETH','3','0','120'),'20').percent,'-50');
  assert.equal(holdingOracle(raw('UBTC','0.00000001','0','0'),'100000').value,'0.00');
  assert.equal(holdingOracle(raw('UBTC','0.000000000000000000000000000000001'),'100').total,'0.000000000000000000000000000000001');
});
test('stable holdings do not consume volatile marks or manufacture PnL; zero-cost and missing-price PnL absent',()=>{
  for(const c of ['USDC','USDT','USDB','USDH']) {
    const e=holdingOracle(raw(c,'2','0.2','99'),'200');
    assert.equal(e.value,'2.00');assert.equal(e.pnl,null);
  }
  assert.equal(holdingOracle(raw('UBTC','1','0','0'),'100').pnl,null);
  assert.equal(holdingOracle(raw('UBTC','1','0','5'),null).pnl,null);
});
test('numeric UI comparisons reject wrong value, signed loss, percentage, available balance and duplicate text',()=>{
  const e=holdingOracle(raw('UBTC','2','0.5','100'),'100');
  const cells={total:'2 BTC',available:'1.5 BTC',usdcValue:'$200.00',pnl:'+$100.00 (+100.0%)'};
  assertHoldingNumbers(cells,e,'BTC');
  for(const patch of [{available:'2 BTC'},{usdcValue:'$199.00'},{pnl:'-$100.00 (-100.0%)'},{pnl:'+$100.00 (+99.0%)'},{total:'2 BTC 2 BTC'}])
    assert.throws(()=>assertHoldingNumbers({...cells,...patch},e,'BTC'));
  const loss=holdingOracle(raw('UETH','3','0','120'),'20');
  assertHoldingNumbers({total:'3 ETH',available:'3 ETH',usdcValue:'$60',pnl:'-$60 (-50.0%)'},loss,'ETH');
});
test('sort oracle enforces USDC priority, value then quantity; rejects duplicate identities and reversed ties',()=>{
  const rows=[{rawCoin:'A',total:'2'},{rawCoin:'B',total:'1'},{rawCoin:'USDC',total:'0.1'}];
  const values={A:'10.00',B:'10.00',USDC:'0.10'};
  assertHoldingOrder([rows[2],rows[0],rows[1]],values);
  assert.throws(()=>assertHoldingOrder(rows,values));
  assert.throws(()=>assertHoldingOrder([rows[2],rows[1],rows[0]],values));
  assert.throws(()=>assertHoldingOrder([rows[2],rows[0],rows[0]],values));
});
test('malformed quantities and marks fail closed',()=>{
  for(const x of ['NaN','Infinity','-1','1e3',undefined])assert.throws(()=>holdingOracle(raw('UBTC',x),'1'));
  assert.throws(()=>holdingOracle(raw('UBTC','1'),'bad'));
});
test('actual computed PnL color rejects reversed signs, neutral, hidden and unparseable styles',()=>{
  assertHoldingPnlColor('rgb(68, 214, 44)','1');assertHoldingPnlColor('rgba(255, 32, 24, 1)','-1');
  for(const c of ['rgb(255, 0, 0)','rgb(99, 99, 99)','rgba(68, 214, 44, 0)','green',null])assert.throws(()=>assertHoldingPnlColor(c,'1'));
});
test('spot share source independently binds cost, raw token, mark and percentage, rejects perpetual contamination',()=>{
  const r=raw('UBTC','2','0','100'),d={mode:'spot',token:'UBTC',pnl:'100',pnlPercent:100,entryPrice:'50',markPrice:'100'};
  assertSpotShareSource(d,r,'100');
  for(const patch of [{mode:'perp'},{token:'BTC'},{pnl:'101'},{pnlPercent:50},{entryPrice:'51'},{markPrice:'99'}])assert.throws(()=>assertSpotShareSource({...d,...patch},r,'100'));
});
test('committed table projection reads raw owner hooks, excludes sibling account, never invokes callbacks',()=>{
  let called=false;
  const balances={balances:[raw('UBTC','2','0','100')],isLoaded:true};
  const prices={'UBTC/USDC':{markPx:'100'}};
  const universes=[{baseName:'UBTC',quoteName:'USDC',name:'UBTC/USDC'}];
  const hook=v=>({memoizedState:[v,()=>{called=true;}],next:null});
  const owner={memoizedState:hook(balances)};owner.memoizedState.next=hook(prices);owner.memoizedState.next.next=hook(universes);
  const table={return:owner,memoizedProps:{listViewDebugRenderTrackerProps:{name:'SpotBalanceList'},data:[],columns:[]}};owner.child=table;
  const other={memoizedState:hook({balances:[raw('WRONG','9')],isLoaded:true})};owner.sibling=other;
  const e=projectHoldingsEvidence(table);
  assert.deepEqual(e.raw,balances);assert.deepEqual(e.prices,prices);assert.deepEqual(e.universes,universes);assert.equal(called,false);
  const wrong=hook({balances:[raw('WRONG','9')],isLoaded:true});owner.memoizedState.next.next.next=wrong;
  assert.throws(()=>projectHoldingsEvidence(table),/ambiguous/u);
});
test('holding projection reads six actual keyed DOM cells and ignores derived PnL as an oracle',()=>{
  const old=globalThis.getComputedStyle;globalThis.getComputedStyle=()=>({color:'rgb(68, 214, 44)'});
  try {
    const hook=v=>({memoizedState:[v,null],next:null});
    const owner={memoizedState:hook({balances:[raw('UBTC','2','0.5','100')],isLoaded:true})};
    owner.memoizedState.next=hook({'UBTC/USDC':{markPx:'100'}});
    owner.memoizedState.next.next=hook([{baseName:'UBTC',quoteName:'USDC',name:'UBTC/USDC'}]);
    const table={return:owner,memoizedProps:{listViewDebugRenderTrackerProps:{name:'SpotBalanceList'},data:[],columns:[]}};owner.child=table;
    const columns=['coin','total','available','usdcValue','pnl','contract'],item={rawCoin:'UBTC',coin:'BTC',total:'2',pnl:'WRONG_DERIVED'};
    table.memoizedProps.data=[item];const rowFiber={return:table,memoizedProps:{item,columnConfigs:columns.map(key=>({key}))}};table.child=rowFiber;
    let last;for(const [i,key] of columns.entries()) {
      const text=['BTC','2 BTC','1.5 BTC','$200','+$100 (+100.0%)','--'][i];
      const el={innerText:text,textContent:text,children:[],getBoundingClientRect:()=>({x:10+i*100,y:20,width:90,height:25}),querySelectorAll:()=>[]};
      const cell={key,return:rowFiber,stateNode:el};if(last)last.sibling=cell;else rowFiber.child=cell;last=cell;
    }
    const e=projectHoldingsEvidence(table);assert.equal(e.rows.length,1);assert.equal(e.rows[0].cells.pnl.text,'+$100 (+100.0%)');
    assertHoldingNumbers(Object.fromEntries(Object.entries(e.rows[0].cells).map(([k,v])=>[k,v.text])),holdingOracle(e.raw.balances[0],e.prices['UBTC/USDC'].markPx),'BTC');
    const second={memoizedProps:{listViewDebugRenderTrackerProps:{name:'SpotBalanceList'},data:[],columns:[]}};table.sibling=second;
    assert.throws(()=>projectHoldingsEvidence(table),/One committed/u);
  }finally{if(old===undefined)delete globalThis.getComputedStyle;else globalThis.getComputedStyle=old;}
});
