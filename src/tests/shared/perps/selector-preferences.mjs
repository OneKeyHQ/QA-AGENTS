// Read visible selector preferences, restore through the same UI, then read again.
import assert from 'node:assert/strict';
import { locator, openPairs, closePairs, pairPopover, clickPairTab } from '../../helpers/perps-ui.mjs';
import { pollForm } from './non-order-ui.mjs';
export function coherentSelectorState({primary,secondary,headers,emptyFavorites}) {
  if(!['自选','永续合约','现货'].includes(primary))return false;
  if(primary==='自选'&&emptyFavorites)return headers.length===0&&secondary===null;
  return headers.length>=5&&(primary!=='永续合约'||secondary!==null);
}
async function atomicSnapshot(page) {
  // One DOM read: the primary tab, category and header columns must describe
  // the same render. Separate awaits could combine a stale perp tab with the
  // next spot render and wait forever for a category row that no longer exists.
  return locator(page,'perps.selector.primary_tabs').evaluate((e,coherentSource)=>{
    const selected=[...e.children].filter(n=>n.querySelector('span')?.classList.contains('_col-text')).map(n=>n.innerText.trim());
    const primary=selected.length===1?selected[0]:null;
    const root=e.closest('[data-testid="TMPopover-ScrollView"]');
    const categories=primary==='永续合约'?[...root.querySelectorAll('div')].filter(n=>['全部','热门','新上架'].every((t,i)=>n.children[i]?.innerText.trim()===t)):[];
    const secondary=categories.length===1?[...categories[0].children].filter(n=>n.classList.contains('_bg-bgActive')).map(n=>n.innerText.trim()):[];
    const headers=[...root.querySelectorAll('[data-sentry-component="BaseSortableHeaderCell"]')].map(n=>({label:n.innerText.trim(),icon:n.querySelector('svg')?.getAttribute('data-sentry-component')}));
    const emptyFavorites=primary==='自选'&&['BTCUSDC','ETHUSDC','BNBUSDC','SOLUSDC','HYPEUSDC','XRPUSDC','添加到自选'].every(t=>[...root.querySelectorAll('span')].some(n=>n.textContent===t))&&!root.querySelector('[data-testid^="perp-token-selector-row-"]');
    const state={primary,secondary:secondary.length===1?secondary[0]:null,headers};
    const coherent=Function(`return (${coherentSource})`)();
    return {...state,ready:coherent({...state,emptyFavorites})};
  },coherentSelectorState.toString());
}
async function tabs(page){const state=await atomicSnapshot(page);return {primary:state.ready?state.primary:null,secondary:state.secondary};}
export async function snapshotSelectorPreferences(page) {
  const wasOpen=await pairPopover(page).count()>0;
  await openPairs(page);
  const {ready,...result}=await pollForm(()=>atomicSnapshot(page),s=>s.ready,'Coherent selector preference render');
  assert.ok(ready);
  if(!wasOpen)await closePairs(page);
  return result;
}
export async function restoreSelectorPreferences(page,before) {
  await openPairs(page);await pairPopover(page).locator('input').fill('');
  if(JSON.stringify(await snapshotSelectorPreferences(page))===JSON.stringify(before)){await closePairs(page);return;}
  await clickPairTab(page,before.primary);
  await pollForm(()=>tabs(page),state=>state.primary===before.primary,'Restore primary tab settled');
  if(before.secondary)await locator(page,'perps.selector.secondary_tabs').getByText(before.secondary,{exact:true}).click();
  await pollForm(()=>tabs(page),state=>state.secondary===before.secondary,'Restore category settled');
  await pollForm(()=>pairPopover(page).locator('[data-sentry-component="BaseSortableHeaderCell"]').allTextContents(),labels=>before.headers.every(h=>labels.map(t=>t.trim()).includes(h.label)),'Restore sort headers settled');
  const active=before.headers.filter(h=>h.icon!=='SvgChevronGrabberVer');
  assert.ok(active.length<=1,'At most one active sort header');
  // A tab change resets a user sort. Re-establish it only when the independent
  // baseline displayed a direction; never write a captured React atom.
  if(active.length){
    const {label,icon}=active[0];
    const header=pairPopover(page).locator('[data-sentry-component="BaseSortableHeaderCell"]').filter({has:page.getByText(label,{exact:true})});
    assert.equal(await header.count(),1);
    for(let n=0;n<3;n++){
      if(await header.locator('svg').getAttribute('data-sentry-component')===icon)break;
      await header.click();await page.waitForTimeout(150);
    }
  }
  await pollForm(()=>snapshotSelectorPreferences(page),state=>JSON.stringify(state)===JSON.stringify(before),'Independent selector preference readback');
  await closePairs(page);
}
