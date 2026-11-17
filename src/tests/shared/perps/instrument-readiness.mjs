// The ticker updates optimistically before the background market switch and
// form reset finish. Only read committed state; never invoke actions/setters.
import {projectReactAll} from './react-projection.mjs';
import {readFileSync} from 'node:fs';
const elements=JSON.parse(readFileSync(new URL('../../../../shared/ui-semantic-map.json',import.meta.url))).elements;
export function instrumentProjection(f){
 const instruments=[],native=[],spot=[];
 for(;f;f=f.return){const name=f.type?.displayName||f.type?.type?.displayName||f.type?.name;if(!name?.includes('PerpTradingForm'))continue;
  for(let h=f.memoizedState,i=0;h&&i<600;h=h.next,i++){const seen=new Set();function visit(v,d){if(!v||typeof v!=='object'||d>4||seen.has(v))return;seen.add(v);
   if(typeof v.coin==='string'&&v.universe){if(v.mode==='perp'||v.mode==='spot')instruments.push({coin:v.coin,mode:v.mode});else if(Object.hasOwn(v,'margin'))native.push(v.coin);else if(v.coin.startsWith('@'))spot.push(v.coin);}
   for(const k of ['0','1','value','current','v'])if(Object.hasOwn(v,k))visit(v[k],d+1);
  }visit(h.memoizedState,0);}
 }return {instruments,native,spot};
}
export function instrumentBoundaryReady(state,pair,dex=null){
 const mode=pair.includes('/')?'spot':'perp';
 const base=mode==='perp'?pair.replace(/USDC$/u,''):null;
 const expected=mode==='perp'?(dex?`${dex}:${base}`:base):null;
 if(!state.instruments.length)return false;
 const coins=[...new Set(state.instruments.map(x=>x.coin))];if(coins.length!==1||state.instruments.some(x=>x.mode!==mode))return false;
 return mode==='perp'?coins[0]===expected&&state.native.length>0&&state.native.every(x=>x===expected):state.spot.length>0&&state.spot.every(x=>x===coins[0]);
}
export async function waitInstrumentBoundary(page,pair,form){
 const end=Date.now()+15000;let stableSince=0,last,previous;
 while(Date.now()<end){
  last=(await projectReactAll(form,instrumentProjection))[0];
  const badge=page.locator(elements['perps.perp-token-selector'].primary).filter({visible:true}).locator(elements['perps.ticker.dex_badge'].primary).filter({visible:true});
  const dexes=await badge.allTextContents();
  if(dexes.length>1)throw Error('Ambiguous active DEX badge');
  const dex=dexes[0]?.trim()||null;
  const inputs=await form.locator('input').evaluateAll(es=>es.map(e=>({value:e.value,disabled:e.disabled})));
  const current=JSON.stringify({state:last,inputs,dex});
  if(last&&instrumentBoundaryReady(last,pair,dex)){if(current!==previous||!stableSince)stableSince=Date.now();else if(Date.now()-stableSince>=350)return last;}else stableSince=0;
  previous=current;await page.waitForTimeout(100);
 }throw Error(`Market header changed but form boundary did not settle for ${pair}: ${JSON.stringify(last)}`);
}
