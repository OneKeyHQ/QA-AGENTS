// Perps shared assertions and real browser actions. Never downgrade missing evidence to PASS.
import { unlockWalletIfNeeded } from '../../helpers/navigation.mjs';
export { mustStopAfterResult, markRestoreFailure } from '../../helpers/execution-policy.mjs';
export function assertPortfolioStats(data) {
  if (!data || data.hasNaN) throw Error('Portfolio statistics missing or NaN/Infinity');
  for (const key of ['winRate','profitFactor','avgProfit','avgLoss','volume','totalTrades']) {
    const value = data[key];
    if (typeof value !== 'string' || !value.trim()) throw Error(`Portfolio ${key} missing: ${value}`);
    if (value === '--' && key !== 'totalTrades') continue;
    const numeric = number(value.replace(/^</,'').replaceAll(',', ''));
    if (!Number.isFinite(numeric)) throw Error(`Portfolio ${key} invalid: ${value}`);
    if (key === 'winRate' && (!/%$/.test(value) || numeric < 0 || numeric > 100)) throw Error(`Portfolio ${key} out of range: ${value}`);
    if (['profitFactor','volume','totalTrades'].includes(key) && numeric < 0) throw Error(`Portfolio ${key} negative: ${value}`);
    if (key === 'totalTrades' && !Number.isInteger(numeric)) throw Error(`Portfolio ${key} must be integer: ${value}`);
  }
  return JSON.stringify(data);
}
export function assertPortfolioTooltip(tooltip, expectedLabel) {
  if (!tooltip) throw Error('Portfolio chart Tooltip missing');
  if (!tooltip.time || !Number.isFinite(number(tooltip.value?.replace(/^</,'').replaceAll(',', '')))) throw Error('Portfolio Tooltip date/value missing or invalid');
  if (tooltip.label !== expectedLabel) throw Error(`Portfolio Tooltip label ${tooltip.label}, expected ${expectedLabel}`);
  if (!tooltip.rect || !tooltip.bounds || ['x','y','width','height'].some(key=>!Number.isFinite(tooltip.rect[key])||!Number.isFinite(tooltip.bounds[key])) || tooltip.rect.width<=0 || tooltip.rect.height<=0 || tooltip.rect.x < tooltip.bounds.x - 1 || tooltip.rect.x + tooltip.rect.width > tooltip.bounds.x + tooltip.bounds.width + 1 || tooltip.rect.y < tooltip.bounds.y - 1 || tooltip.rect.y + tooltip.rect.height > tooltip.bounds.y + tooltip.bounds.height + 1) throw Error('Portfolio Tooltip overflows chart bounds');
  return tooltip;
}
export function assertResultPopulation(kind, count) {
  const valid = kind === 'multiple' ? count > 1 : kind === 'single' ? count === 1 : kind === 'empty' ? count === 0 : false;
  if (!valid) throw Error(`Search sample ${kind} has ${count} results`);
}
export function number(value) {
  if (value === null || value === undefined || /NaN|Infinity/.test(String(value))) return NaN;
  const suffix=String(value).match(/([KMBT])$/i)?.[1]?.toUpperCase();
  const multiplier={K:1e3,M:1e6,B:1e9,T:1e12}[suffix]??1;
  const cleaned = String(value).replace(/[KMBT]$/i,'').replace(/[$,%x\s+]/g,'').replace(/−/g,'-');
  if (!/^-?\d+(?:\.\d+)?$/.test(cleaned)) return NaN;
  return Number(cleaned)*multiplier;
}
export function assertHealthFields(data) {
  if (!data) throw Error('Account health data missing');
  for (const key of ['accountAsset','available','leverage','usedMargin','mmr']) {
    const v=data[key];
    // With no position, leverage/MMR deliberately show --. The labels must still exist.
    if ((key==='leverage'||key==='mmr') && v==='--') continue;
    if (!Number.isFinite(number(v))) throw Error(`Account health ${key} missing or invalid: ${v}`);
  }
  return JSON.stringify(data);
}
export function assertHealthColor(health, data) {
  if (!health) throw Error('Account health label missing');
  const colors={'健康':'green','低风险':'green','中等风险':'yellow','中风险':'yellow','高风险':'red',Healthy:'green','Moderate risk':'yellow','High risk':'red'};
  const expected=colors[health.label];
  if (!expected) throw Error(`Unknown or missing account health label: ${health.label}`);
  const actual=health.isGreen?'green':health.isYellow?'yellow':health.isRed?'red':'other';
  if (expected!==actual) throw Error(`Account health color mismatch: ${health.label}, expected ${expected}, actual ${actual}`);
  if (data) {
    const mmr=number(data.mmr), lev=number(data.leverage), margin=number(data.usedMargin), asset=number(data.accountAsset);
    if ([lev,margin,asset].every(Number.isFinite) && asset>0) {
      const levScore=lev<=5?0:lev<=15?1:2;
      const marginScore=margin/asset*100<=60?0:margin/asset*100<=85?1:2;
      const mmrScore=Number.isFinite(mmr)?(mmr<=30?0:mmr<=60?1:2):Math.max(levScore,marginScore);
      const score=mmrScore*3+levScore*2+marginScore;
      const risk=score>=6?'red':score>=3?'yellow':'green';
      if (expected!==risk) throw Error(`Account health risk score ${score}: expected ${risk}, label ${health.label}`);
    }
  }
  return `label=${health.label}, color=${actual}`;
}
export function assertPnlColor(pnl) {
  if (!pnl) throw Error('Total PnL element missing');
  const value=number(pnl.value);
  if (!Number.isFinite(value)) throw Error(`Total PnL invalid: ${pnl.value}`);
  if (value>0&&!pnl.isGreen || value<0&&!pnl.isRed) throw Error(`Total PnL color mismatch: ${pnl.value}`);
  return `value=${pnl.value}, rgb=${pnl.r},${pnl.g},${pnl.b}`;
}
export async function reloadPerps(page, {navigate, ready, unlock=unlockWalletIfNeeded}) {
  const options={waitUntil:'domcontentloaded',timeout:45000};
  // Electron's router changes file:///index.html to a non-file route. Reload the
  // actually loaded shell recorded by Chromium, never a fabricated route URL.
  if(page.url?.().startsWith('file:')) {
    const shell=await page.evaluate(()=>performance.getEntriesByType('navigation')[0]?.name);
    if(!shell || !/^file:.*\/index\.html(?:[?#]|$)/.test(shell)) throw Error('Cannot identify loaded Electron app shell for refresh');
    await page.goto(shell,options);
  } else await page.reload(options);
  await unlock(page);
  await navigate(page);
  await ready(page);
}
