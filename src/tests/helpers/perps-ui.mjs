// Perps UI actions shared by Page Objects and all three desktop browser platforms.
import {readFileSync} from 'node:fs';
import {unlockWalletIfNeeded} from './navigation.mjs';
import {waitInstrumentBoundary} from '../shared/perps/instrument-readiness.mjs';
import {dismissReleaseNotice} from '../shared/perps/release-notice.mjs';
import {coherentFavoriteView} from '../shared/perps/favorite-view.mjs';
import {closeLocalOverlay} from './local-overlay-close.mjs';
const map=JSON.parse(readFileSync(new URL('../../../shared/ui-semantic-map.json',import.meta.url))).elements;
export function locator(page,key,{visible=true}={}) {
 const entry=map[key]; if(!entry?.primary) throw Error(`Missing Perps locator: ${key}`);
 const result=page.locator(entry.primary);
 return visible ? result.filter({visible:true}) : result;
}
export async function typeInput(input, text) {
  await input.waitFor({state:'visible',timeout:10000});
  await input.click();
  await input.evaluate(el=>el.select());
  await input.press('Backspace');
  if (text) await input.pressSequentially(text,{delay:35});
  if (await input.inputValue()!==text) throw Error('Input did not retain typed text');
}
export function pairPopover(page) {
  return page.locator('[data-testid="TMPopover-ScrollView"]:visible').filter({has:page.locator('input[data-testid*="perp-token-selector-search"]')});
}
export async function currentPair(page) {
  const text=await locator(page,'perps.perp-token-selector').innerText();
  return text.split('\n').map(s=>s.trim()).filter(Boolean)[0];
}
export async function openPairs(page) {
  await dismissReleaseNotice(page);
  await unlockWalletIfNeeded(page);
  if (await pairPopover(page).count()) return;
  await locator(page,'perps.perp-token-selector').click();
  await pairPopover(page).waitFor({state:'visible',timeout:10000});
}
export async function searchPairs(page,text) {
  await openPairs(page);
  await typeInput(pairPopover(page).locator('input'),text);
  await page.waitForTimeout(500);
}
export async function closePairs(page) {
  await dismissReleaseNotice(page);
  await closeLocalOverlay({
    isOpen: async()=> (await pairPopover(page).count()) > 0,
    escape: ()=>page.keyboard.press('Escape'),
    waitHidden: timeout=>pairPopover(page).waitFor({state:'hidden',timeout}),
    clickBackdrop: async()=>{
    const entry=pairPopover(page).locator('xpath=ancestor::*[@data-onekey-overlay-entry][1]');
    const backdrop=entry.locator(':scope > [aria-hidden="true"]');
    if(await backdrop.count()) await backdrop.click({position:{x:3,y:3},timeout:2000});
    else {
      const overlay=page.locator('[data-testid="ovelay-popover"]:visible');
      if (await overlay.count()) await overlay.last().click({position:{x:3,y:3},timeout:2000});
    }
    },
  });
}
export async function setChartMode(page, mode) {
  await unlockWalletIfNeeded(page);
  await closePairs(page);
  const trigger=locator(page,'perps.chart.engine');
  await trigger.waitFor({state:'visible',timeout:15000});
  const current=await trigger.innerText();
  if ((mode==='tradingView')===current.includes('TradingView')) return;
  await trigger.click();
  // Select renders native options in a scoped floating panel.
  const option=page.getByRole('option',{name:mode==='tradingView'?'TradingView':/原生版|Original/});
  if (await option.count()) await option.click();
  else await page.locator('[data-testid="TMPopover-ScrollView"]:visible').getByText(mode==='tradingView'?'TradingView':/原生版|Original/,{exact:true}).click();
  await page.waitForFunction(({sel,mode})=>{
    const el=[...document.querySelectorAll(sel)].find(e=>e.getBoundingClientRect().width>0);
    return !!el&&((mode==='tradingView')===el.textContent.includes('TradingView'));
  },{sel:map['perps.chart.engine'].primary,mode},{timeout:15000});
}
/** All matching rows, including spot pairs with duplicate sanitized testIDs. */
export function pairRows(page) { return pairPopover(page).locator('[data-testid^="perp-token-selector-row-"]'); }
export async function clickPairTab(page, label) {
  const scope=['自选','永续合约','现货'].includes(label)?locator(page,'perps.selector.primary_tabs'):pairPopover(page);
  const tab=scope.getByText(label,{exact:true}).and(
    pairPopover(page).locator(':not([data-testid^="perp-token-selector-row-"] *)')
  );
  if(await tab.count()!==1) throw Error(`Expected one pair tab: ${label}`);
  await tab.click();
}
export async function favoriteSnapshot(page) {
  await openPairs(page); await searchPairs(page,'');
  await clickPairTab(page,'自选');
  await waitFavoriteView(page);
  // Refuse to mutate a virtualized/truncated list: we cannot faithfully restore it.
  const state=await pairPopover(page).evaluate(root=>({
    rows:[...root.querySelectorAll('[data-testid^="perp-token-selector-row-"]')].map(e=>({id:e.dataset.testid,name:e.innerText.split('\n')[0].trim()})),
    virtual:!!root.querySelector('[data-index]')
  }));
  const bar=page.locator('[data-rbd-droppable-id="favorites-bar"]');
  const topCount=await bar.count()?await bar.locator('[data-rbd-draggable-id]').count():null;
  if(state.virtual || (topCount!==null&&topCount!==state.rows.length)) throw Error('Favorites snapshot requires full list; virtualized/truncated list cannot be safely restored');
  return state.rows;
}
export async function clearFavorites(page) {
  await openPairs(page); await searchPairs(page,'');
  await clickPairTab(page,'自选');
  await waitFavoriteView(page);
  for(let i=0;i<1000;i++) {
    const star=pairRows(page).locator('[data-testid="perp-already-favorite-icon-btn"]').first();
    if(!await star.count()) return;
    await star.click();
    // Do not click the departing last row while React replaces it with the
    // recommendation grid, or consume an uncommitted intermediate row.
    await waitFavoriteView(page);
  }
  throw Error('Favorites did not clear after 1000 rows');
}
async function waitFavoriteView(page) {
  // Resolve the registry's Playwright selectors on the Node side. Their
  // :text-is() extension is deliberately not passed to querySelectorAll().
  const tab=await locator(page,'perps.selector.primary_tabs').elementHandle();
  if(!tab)throw Error('Favorite primary tabs unavailable');
  try {await page.waitForFunction(({tab,coherent})=>{
    const root=tab?.closest('[data-testid="TMPopover-ScrollView"]');
    if(!root)return false;
    const selected=[...tab.children].filter(n=>n.querySelector('span')?.classList.contains('_col-text')).map(n=>n.innerText.trim());
    const stars=[...root.querySelectorAll('[data-testid^="perp-token-selector-row-"]')].map(e=>e.querySelector('[data-testid="perp-already-favorite-icon-btn"] svg')?.getAttribute('data-sentry-source-file')?.includes('/solid/')===true);
    const ready=Function(`return (${coherent})`)();
    const bar=document.querySelector('[data-rbd-droppable-id="favorites-bar"]');
    return ready({selected:selected.length===1?selected[0]:null,query:root.querySelector('input')?.value,stars,recommended:[...root.querySelectorAll('span')].some(e=>e.textContent==='添加到自选'),topCount:bar?bar.querySelectorAll('[data-rbd-draggable-id]').length:null});
  },{tab,coherent:coherentFavoriteView.toString()},{timeout:10000,polling:'raf'});}
  finally {await tab.dispose();}
}
export async function setFavorite(page, item, enabled) {
  await openPairs(page); await searchPairs(page,'');
  await clickPairTab(page,item.name.includes('/')?'现货':'永续合约');
  await searchPairs(page,item.name);
  const rows=pairRows(page);
  const count=await rows.count();
  for(let i=0;i<count;i++) {
    const row=rows.nth(i);
    if((await row.innerText()).split('\n')[0].trim()!==item.name) continue;
    if(item.id && await row.getAttribute('data-testid')!==item.id) continue;
    const star=row.locator('[data-testid="perp-already-favorite-icon-btn"]');
    const selected=await star.locator('svg').evaluate(svg=>svg.getAttribute('data-sentry-source-file')?.includes('/solid/')===true);
    if(selected!==enabled) await star.click();
    return;
  }
  throw Error(`Exact favorite not found: ${item.name} (${item.id??''})`);
}
export async function restoreFavorites(page,items) {
  await clearFavorites(page);
  for(const item of items) await setFavorite(page,item,true);
  const restored=await favoriteSnapshot(page);
  const key=x=>`${x.id}:${x.name}`;
  if(JSON.stringify(restored.map(key))!==JSON.stringify(items.map(key))) throw Error('Favorites restore mismatch, including order/quote/DEX identity');
  await closePairs(page);
}
export async function restorePair(page,pair) {
  if(await currentPair(page)===pair){await waitInstrumentBoundary(page,pair,locator(page,'perps.form.root'));return;}
  await openPairs(page);
  await searchPairs(page,'');
  await clickPairTab(page,pair.includes('/')?'现货':'永续合约');
  const name=pair.includes('/')?pair:pair.replace(/USDC$/,'');
  await searchPairs(page,name);
  const row=pairRows(page).filter({has:page.getByText(name,{exact:true})});
  if(await row.count()!==1) throw Error(`Cannot uniquely restore selected pair ${pair}`);
  await row.click();
  await pairPopover(page).waitFor({state:'hidden',timeout:10000});
  if(await currentPair(page)!==pair) throw Error(`Selected pair restore mismatch: ${pair}`);
  await waitInstrumentBoundary(page,pair,locator(page,'perps.form.root'));
}
