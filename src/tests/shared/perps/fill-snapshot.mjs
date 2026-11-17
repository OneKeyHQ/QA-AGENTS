// Read-only history identity; no trading endpoint or signer is used.
import assert from 'node:assert/strict';
export function normalizeFills(rows){
 assert.ok(Array.isArray(rows),'Raw fills response must be an array');
 const ids=new Set();
 const normalized=rows.map(r=>{
  assert.ok(r&&typeof r.coin==='string'&&Number.isFinite(r.time)&&['B','A'].includes(r.side),'Complete raw fill identity required');
  assert.ok(r.tid!==undefined,'Raw fill trade ID required');
  // Dust conversions legitimately reuse tid=0. Keep their full identities;
  // neither collapse them nor reject distinct events as duplicate trades.
  const id=JSON.stringify([r.tid,r.coin,r.time,r.oid,r.hash,r.side]);assert.ok(!ids.has(id),'Unique full fill identities');ids.add(id);
  return {id,coin:r.coin,time:r.time,side:r.side,px:r.px,sz:r.sz,oid:r.oid,hash:r.hash,fee:r.fee,closedPnl:r.closedPnl};
 });
 return normalized.sort((a,b)=>a.id.localeCompare(b.id));
}
export async function readFillSnapshot(account){
 assert.match(account,/^0x[\da-f]{40}$/iu);
 const response=await fetch('https://api.hyperliquid.xyz/info',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'userFills',user:account,aggregateByTime:false}),signal:AbortSignal.timeout(20000)});
 assert.equal(response.status,200,'Read-only existing user fills');return normalizeFills(await response.json());
}
