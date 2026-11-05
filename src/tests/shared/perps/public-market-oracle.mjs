// Public read-only Hyperliquid oracle. Join contexts by coin, never by array
// offset: the universe can retain non-contiguous indexes after delistings.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RESULTS_DIR } from '../../helpers/index.mjs';
export function joinSpotContexts(meta, contexts) {
  assert.ok(Array.isArray(meta?.universe)&&Array.isArray(meta?.tokens)&&Array.isArray(contexts));
  const byCoin=new Map(contexts.map(c=>[c.coin,c]));
  assert.equal(byCoin.size,contexts.length,'Raw spot contexts must have unique coin identities');
  const tokens=new Map(meta.tokens.map(t=>[t.index,t]));
  assert.equal(tokens.size,meta.tokens.length,'Raw token indexes must be unique');
  return meta.universe.map(u=>{
    const base=tokens.get(u.tokens[0]),quote=tokens.get(u.tokens[1]);
    assert.ok(base&&quote,'Raw market tokens must exist');
    return {coin:u.name,base:base.name,quote:quote.name,context:byCoin.get(u.name)??null};
  });
}
export async function spotMarketOracle() {
  const response=await fetch('https://api.hyperliquid.xyz/info',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'spotMetaAndAssetCtxs'}),signal:AbortSignal.timeout(20000)});
  assert.equal(response.status,200,'Public spot metadata and contexts');
  const data=await response.json();assert.equal(data.length,2);
  const rows=joinSpotContexts(...data);
  const dir=resolve(RESULTS_DIR,'perps-desktop-completion');mkdirSync(dir,{recursive:true});
  writeFileSync(resolve(dir,'spot-market-oracle.json'),JSON.stringify({at:new Date().toISOString(),url:'https://api.hyperliquid.xyz/info',type:'spotMetaAndAssetCtxs',rows},null,2));
  return rows;
}
export function eligibleSpotMarkets(markets) {
  const hasVolume=markets.some(r=>Number(r.context?.dayNtlVlm)>0);
  return markets.filter(r=>!hasVolume||Number(r.context?.dayNtlVlm)>=1000);
}
export async function perpMarketOracle(allowedDexs) {
  const response=await fetch('https://api.hyperliquid.xyz/info',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'allPerpMetas'}),signal:AbortSignal.timeout(20000)});
  assert.equal(response.status,200,'Public perpetual market metadata');
  const metas=await response.json();assert.ok(Array.isArray(metas));
  const rows=metas.flatMap(m=>m?.universe??[]).filter(r=>!r.isDelisted&&(!r.name.includes(':')||allowedDexs.includes(r.name.split(':')[0])));
  assert.ok(rows.some(r=>r.name==='BTC'));
  const dir=resolve(RESULTS_DIR,'perps-desktop-completion');mkdirSync(dir,{recursive:true});
  writeFileSync(resolve(dir,'perp-market-oracle.json'),JSON.stringify({at:new Date().toISOString(),type:'allPerpMetas',allowedDexs,rows},null,2));
  return rows;
}
export function fundingSettlementTokens(metas, spotMeta) {
  assert.ok(Array.isArray(metas)&&Array.isArray(spotMeta?.tokens));
  const tokens=new Map(spotMeta.tokens.map(t=>[t.index,t.name])), result={};
  assert.equal(tokens.size,spotMeta.tokens.length,'Unique raw collateral token indexes');
  for(const meta of metas) {
    const token=tokens.get(meta.collateralToken);
    assert.ok(token,`Raw collateral token ${meta.collateralToken} must exist`);
    for(const market of meta.universe??[]) {
      assert.ok(!Object.hasOwn(result,market.name),'Unique raw funding market identity');
      result[market.name]=token;
    }
  }
  return result;
}
export async function fundingSettlementOracle() {
  const bodies=await Promise.all(['allPerpMetas','spotMeta'].map(async type=>{
    const response=await fetch('https://api.hyperliquid.xyz/info',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type}),signal:AbortSignal.timeout(20000)});
    assert.equal(response.status,200,`Independent ${type} settlement metadata`);
    return response.json();
  }));
  const tokens=fundingSettlementTokens(...bodies);
  const dir=resolve(RESULTS_DIR,'perps-desktop-completion');mkdirSync(dir,{recursive:true});
  writeFileSync(resolve(dir,'funding-settlement-oracle.json'),JSON.stringify({at:new Date().toISOString(),tokens},null,2));
  return tokens;
}
