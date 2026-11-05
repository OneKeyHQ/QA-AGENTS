// Independent arithmetic over the raw balance atom and raw market contexts.
// Does not import product valuation, sorting or presentation utilities.
import assert from 'node:assert/strict';
const stable=new Set(['USDC','USDT','USDB','USDH']);
function decimal(v, signed=false) {
  assert.equal(typeof v,'string','Raw decimal string required');
  assert.match(v,signed ? /^-?\d+(?:\.\d+)?$/u : /^\d+(?:\.\d+)?$/u,'Finite plain raw decimal required');
  const [w,f='']=v.split('.');
  return {n:BigInt(w+f),d:10n**BigInt(f.length)};
}
const add=(a,b)=>({n:a.n*b.d+b.n*a.d,d:a.d*b.d});
const sub=(a,b)=>add(a,{...b,n:-b.n});
const mul=(a,b)=>({n:a.n*b.n,d:a.d*b.d});
const cmp=(a,b)=>a.n*b.d-b.n*a.d;
function fixed(a,places) {
  const sign=a.n<0n?'-':'', n=a.n<0n?-a.n:a.n,scale=10n**BigInt(places);
  const rounded=(n*scale*2n+a.d)/(2n*a.d);
  return `${rounded===0n?'':sign}${rounded/scale}${places?'.'+String(rounded%scale).padStart(places,'0'):''}`;
}
const plain=a=>fixed(a,30).replace(/\.?0+$/u,'')||'0';
function exact(a) {
  const places=String(a.d).length-1;
  assert.equal(a.d,10n**BigInt(places),'Exact finite decimal scale');
  const text=fixed(a,places);
  return places?text.replace(/\.?0+$/u,'')||'0':text;
}
function money(text) {
  assert.match(text,/^\$\d[\d,]*(?:\.\d+)?$/u,'Readable unambiguous dollar amount required');
  return decimal(text.replace(/[$,]/gu,''));
}
export function assertHoldingValue(text,e) {
  assert.equal(cmp(money(text),decimal(e.value)),0n,'Visible USDC valuation from raw mark');
}
export function assertHoldingPnlColor(color,pnl) {
  const value=decimal(pnl,true).n;if(value===0n)return;
  const match=String(color).match(/^rgba?\(\s*(\d+(?:\.\d+)?)[, ]+\s*(\d+(?:\.\d+)?)[, ]+\s*(\d+(?:\.\d+)?)(?:\s*[,/]\s*(\d+(?:\.\d+)?))?\s*\)$/u);
  assert.ok(match,'Actual computed RGB PnL color required');
  const [r,g,b]=match.slice(1,4).map(Number);
  assert.ok([r,g,b].every(v=>v>=0&&v<=255));
  assert.ok(match[4]===undefined||Number(match[4])>0,'PnL text must not be transparent');
  assert.ok(value>0n?g>r&&g>b:r>g&&r>b,'Positive PnL green, negative red');
}
export function holdingOracle(raw,mark) {
  assert.ok(typeof raw.coin==='string'&&raw.coin);
  const total=decimal(raw.total),hold=decimal(raw.hold),cost=decimal(raw.entryNtl??'0'),one=decimal('1');
  const available=sub(total,hold),price=stable.has(raw.coin)?one:mark==null?null:decimal(mark);
  const value=price?mul(total,price):cost;
  const pnl=!stable.has(raw.coin)&&price&&cost.n>0n?sub(value,cost):null;
  const percent=pnl?{n:pnl.n*cost.d*100n,d:pnl.d*cost.n}:null;
  return {total:exact(total),available:available.n<0n?'0':exact(available),value:fixed(value,2),
    valueRatio:{n:String(value.n),d:String(value.d)},pnl:pnl?exact(pnl):null,
    percent:percent?plain(percent):null,percent1:percent?fixed(percent,1):null,
    entryRatio:total.n>0n?{n:String(cost.n*total.d),d:String(cost.d*total.n)}:null,
    markRatio:price?{n:String(price.n),d:String(price.d)}:null};
}
export function assertSpotShareSource(data,raw,mark) {
  assert.equal(data.mode,'spot');assert.equal(data.token,raw.coin,'Spot card raw token identity');
  const e=holdingOracle(raw,mark);assert.notEqual(e.pnl,null,'Cost-based spot sample required');
  assert.equal(cmp(decimal(data.pnl,true),decimal(e.pnl,true)),0n,'Card dollar PnL independently derives from raw spot quantity/cost/mark');
  assert.ok(Math.abs(Number(data.pnlPercent)-Number(e.percent))<=1e-12*Math.max(1,Math.abs(Number(e.percent))),'Card percentage uses spot cost, not perpetual ROE');
  for(const [key,ratio] of [['entryPrice',e.entryRatio],['markPrice',e.markRatio]]) {
    const text=String(data[key]).replace(/,/gu,''),actual=decimal(text),expected={n:BigInt(ratio.n),d:BigInt(ratio.d)};
    assert.ok(actual.n>0n,'Visible share prices must be positive');
    const difference=cmp(actual,expected),abs=difference<0n?-difference:difference;
    assert.ok(abs*2n<=expected.d,`Card ${key} matches independent raw price within half its displayed decimal unit`);
  }
  return e;
}
export function assertHoldingNumbers(cells,e,coin) {
  for(const key of ['total','available']) {
    assert.ok(cells[key].endsWith(` ${coin}`),'Visible asset suffix');
    const amount=cells[key].slice(0,-coin.length-1);
    assert.equal(cmp(decimal(amount),decimal(e[key])),0n,`Visible ${key} from raw balance/frozen quantity`);
  }
  assertHoldingValue(cells.usdcValue,e);
  if(e.pnl===null||decimal(e.pnl,true).n===0n)assert.equal(cells.pnl,'--','No fabricated zero/costless/stable PnL');
  else {
    const m=cells.pnl.match(/^([+-])(\$[\d,.]+) \(([+-])([\d.]+)%\)$/u);
    assert.ok(m,'Both visible signed dollar and percentage required');
    const positive=decimal(e.pnl,true).n>0n,sign=positive?'+':'-';
    assert.equal(m[1],sign);assert.equal(m[3],sign);
    assert.equal(cmp(money(m[2]),decimal(fixed(decimal(e.pnl,true),2).replace(/^-/u,''))),0n);
    assert.equal(cmp(decimal(m[4]),decimal(e.percent1.replace(/^-/u,''))),0n,'Independent cost-based percentage');
  }
}
export function assertHoldingOrder(rows,values) {
  assert.equal(new Set(rows.map(r=>r.rawCoin)).size,rows.length,'Unique holding identities');
  const value=r=>typeof values[r.rawCoin]==='string'?decimal(values[r.rawCoin]):
    {n:BigInt(values[r.rawCoin].n),d:BigInt(values[r.rawCoin].d)};
  for(let i=1;i<rows.length;i++) {
    const a=rows[i-1],b=rows[i];
    assert.notEqual(b.rawCoin,'USDC','USDC must be first');
    if(a.rawCoin==='USDC')continue;
    const delta=cmp(value(a),value(b));
    assert.ok(delta>0n||delta===0n&&cmp(decimal(a.total),decimal(b.total))>=0n,'Value descending, exact raw quantity tie break');
  }
}

// Self-contained for projectReactAll serialization. Observe committed owners only;
// no component names, callbacks, selectors inferred from product's computed values.
export function projectHoldingsEvidence(start) {
  let root=start;while(root.return)root=root.return;
  const tables=[],seen=new Set(),stack=[root];
  for(let count=0;stack.length&&count<100000;count++) {
    const f=stack.pop(),v=f.memoizedProps;
    if(v?.listViewDebugRenderTrackerProps?.name==='SpotBalanceList'&&Array.isArray(v.data)&&Array.isArray(v.columns)&&!seen.has(v)) {seen.add(v);tables.push(f);}
    if(f.sibling)stack.push(f.sibling);if(f.child)stack.push(f.child);
  }
  if(stack.length||tables.length!==1)throw Error('One committed holdings table required');
  const table=tables[0];let sources;
  for(let owner=table;owner;owner=owner.return) {
    const raw=new Set(),prices=new Set(),universes=new Set();
    let h=owner.memoizedState,steps=0;
    for(;h&&steps<1000;h=h.next,steps++) {
      const hookValue=h.memoizedState;
      if(Array.isArray(hookValue)&&hookValue[2]?.name==='spotAssetCtxsMapAtom') {
        if(!hookValue[0]||typeof hookValue[0]!=='object'||Array.isArray(hookValue[0]))throw Error('Unreadable named spot context atom');
        prices.add(hookValue[0]);
      }
      const visited=new Set();
      function visit(v,depth) {
        if(!v||typeof v!=='object'||depth>5||visited.has(v))return;visited.add(v);
        if(Array.isArray(v.balances)&&typeof v.isLoaded==='boolean')raw.add(v);
        if(!Array.isArray(v)&&Object.values(v).some(x=>x&&typeof x==='object'&&typeof x.markPx==='string'))prices.add(v);
        if(Array.isArray(v)&&v.length&&v.every(x=>x&&typeof x.baseName==='string'&&typeof x.quoteName==='string'&&typeof x.name==='string'))universes.add(v);
        for(const key of ['0','1','value','current','v'])if(Object.hasOwn(v,key))visit(v[key],depth+1);
      }
      visit(h.memoizedState,0);
    }
    if(h)throw Error('Holding hook scan limit');
    if(raw.size>1||prices.size>1||universes.size>1)throw Error('ambiguous raw holding sources in one owner');
    if(raw.size&&prices.size&&universes.size) {sources={raw:[...raw][0],prices:[...prices][0],universes:[...universes][0]};break;}
  }
  if(!sources)throw Error('Raw balances/mark contexts/universes not readable from committed holding owner');
  const rows=[],rowItems=new Set(),todo=table.child?[table.child]:[];
  function firstHost(f) {
    const q=[f];for(let n=0;q.length&&n<300;n++) {
      const node=q.shift();if(node.stateNode?.getBoundingClientRect)return node.stateNode;
      for(let c=node.child;c;c=c.sibling)q.push(c);
    }
    return null;
  }
  for(let n=0;todo.length&&n<50000;n++) {
    const f=todo.pop(),v=f.memoizedProps;
    if(v?.item?.rawCoin&&Array.isArray(v.columnConfigs)&&!rowItems.has(v.item)) {
      rowItems.add(v.item);
      const keys=new Set(v.columnConfigs.map(c=>c.key)),cells={},cellStack=f.child?[f.child]:[];
      for(let j=0;cellStack.length&&j<2000;j++) {
        const c=cellStack.pop();
        if(keys.has(c.key)&&!cells[c.key]) {
          const el=firstHost(c),rect=el?.getBoundingClientRect();
          if(rect&&rect.width>0&&rect.height>0) {
            const text=el.innerText.trim(),leaf=[el,...el.querySelectorAll('*')].find(x=>x.children.length===0&&x.textContent?.trim()===text);
            cells[c.key]={text,x:rect.x,y:rect.y,width:rect.width,color:leaf?getComputedStyle(leaf).color:null};
          }
        }
        if(c.sibling)cellStack.push(c.sibling);if(c.child)cellStack.push(c.child);
      }
      if(cellStack.length)throw Error('Holding cell scan limit');
      if(Object.keys(cells).length)rows.push({item:{rawCoin:v.item.rawCoin,coin:v.item.coin,total:v.item.total},cells});
    }
    if(f.sibling)todo.push(f.sibling);if(f.child)todo.push(f.child);
  }
  if(todo.length)throw Error('Holding row scan limit');
  return {...sources,rows,data:table.memoizedProps.data.map(r=>({rawCoin:r.rawCoin,total:r.total,contract:r.contract,isAssetClickable:r.isAssetClickable}))};
}
