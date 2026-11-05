import {locator} from '../../helpers/perps-ui.mjs';
import {assertPortfolioTooltip} from './runtime.mjs';
const scope=page=>locator(page,'perps.portfolio.chart_type').locator('xpath=ancestor::*[@data-testid="IN_PAGE_TAB_CONTAINER"][1]');

// Runs in the page. Scope, visibility, date, label and value belong to one box.
export function portfolioTooltipSnapshot(root) {
  const boxes=[];
  const labels=['净值','全部','合约','现货','净资金费'];
  const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
  const canvases=[...root.querySelectorAll('canvas')].filter(visible).sort((a,b)=>b.getBoundingClientRect().width*b.getBoundingClientRect().height-a.getBoundingClientRect().width*a.getBoundingClientRect().height);
  if(!canvases.length) return null;
  const canvas=canvases[0];
  for(const el of root.querySelectorAll('div')) {
    const style=getComputedStyle(el);
    if(!visible(el)||style.position!=='absolute'||style.pointerEvents!=='none') continue;
    const leaves=[...el.querySelectorAll('span')].filter(e=>e.children.length===0&&visible(e)).map(e=>e.textContent.trim());
    const label=leaves.find(t=>labels.includes(t));
    const value=leaves.find(t=>/^[+-]?(?:<)?\$[\d,.]+[KMBT]?$/.test(t));
    const time=leaves.find(t=>t!==value&&t!==label&&/\d/.test(t));
    if(!label||!value||!time) continue;
    const r=el.getBoundingClientRect();
    // Use the relative chart wrapper (the tooltip's parent), not body width.
    const b=el.parentElement.getBoundingClientRect();
    if(!el.parentElement.contains(canvas)) continue;
    boxes.push({text:el.textContent.trim(),label,value,time,rect:{x:r.x,y:r.y,width:r.width,height:r.height},bounds:{x:b.x,y:b.y,width:b.width,height:b.height}});
  }
  if(boxes.length>1) throw Error('Ambiguous portfolio chart Tooltip');
  return boxes[0]??null;
}
export async function hoverPortfolioChart(page,fraction,expectedLabel) {
  const root=scope(page);
  const canvas=await root.evaluate(el=>[...el.querySelectorAll('canvas')].map(c=>c.getBoundingClientRect()).filter(r=>r.width>50&&r.height>50).sort((a,b)=>b.width*b.height-a.width*a.height).map(r=>({x:r.x,y:r.y,width:r.width,height:r.height}))[0]??null);
  if(!canvas) throw Error('Portfolio chart canvas missing; Tooltip cannot be verified');
  await page.mouse.move(canvas.x+Math.max(5,Math.min(canvas.width-5,canvas.width*fraction)),canvas.y+canvas.height/2);
  let tooltip;
  const end=Date.now()+5000;
  do {
    tooltip=await root.evaluate(portfolioTooltipSnapshot);
    if(tooltip) {
      const labels=Array.isArray(expectedLabel)?expectedLabel:[expectedLabel];
      if(labels.includes(tooltip.label)) return assertPortfolioTooltip(tooltip,tooltip.label);
    }
    await page.waitForTimeout(100);
  } while(Date.now()<end);
  throw Error(`Portfolio Tooltip missing or stale; expected ${JSON.stringify(expectedLabel)}, actual ${JSON.stringify(tooltip)}`);
}
export async function activePortfolioChartType(page) {
  const selected=await locator(page,'perps.portfolio.chart_type').evaluate(el=>{
    const labels=[...el.querySelectorAll('span')].filter(e=>e.children.length===0&&e.getBoundingClientRect().width>0);
    return labels.filter(e=>labels.filter(other=>other!==e&&getComputedStyle(other).color===getComputedStyle(e).color).length===0).map(e=>e.textContent.trim());
  });
  if(selected.length!==1||!['净值','盈亏','资金费'].includes(selected[0])) throw Error(`Cannot identify selected portfolio chart type: ${JSON.stringify(selected)}`);
  return selected[0];
}
export async function hoverPortfolioStatistic(page,label) {
  const trigger=scope(page).getByText(label,{exact:true}).filter({visible:true});
  if(await trigger.count()!==1) throw Error(`Portfolio statistic trigger ${label} missing or ambiguous`);
  const dashed=await trigger.evaluate(el=>{
    const parent=el.parentElement;
    return [el,...parent.querySelectorAll('*')].some(node=>{
      const style=getComputedStyle(node),r=node.getBoundingClientRect();
      return r.width>0&&r.height>0&&(style.textDecorationStyle==='dashed'||style.borderBottomStyle==='dashed'||/repeating-linear-gradient/.test(style.maskImage||style.webkitMaskImage||''));
    });
  });
  if(!dashed) throw Error(`Portfolio statistic ${label}: dashed trigger indicator missing`);
  await trigger.hover();
  const end=Date.now()+5000;
  do {
    let tooltip=page.locator('[role="tooltip"]:visible');
    if(!await tooltip.count()) tooltip=page.locator('[data-radix-popper-content-wrapper]:visible');
    if(await tooltip.count()===1) {
      const text=(await tooltip.innerText()).trim();
      if(text.length>=2) { await page.mouse.move(0,0);await tooltip.waitFor({state:'hidden',timeout:5000});return {label,text}; }
    }
    await page.waitForTimeout(100);
  } while(Date.now()<end);
  throw Error(`Portfolio statistic ${label}: readable Tooltip did not appear`);
}
