// Real TradingView interactions. APIs construct chart-only fixtures and read model evidence;
// parameter edits and deletion use actual pointer/keyboard input in the embedded chart.
import {locator} from '../../helpers/perps-ui.mjs';
import {markRestoreFailure} from '../../helpers/execution-policy.mjs';

export function chartInteractions(tvEval) {
  const api=(page,body)=>tvEval(page,`const chart=doc.defaultView.tradingViewApi.activeChart();${body}`);
  async function settingsSnapshot(page) {
    return api(page,`const storage=doc.defaultView.localStorage;return Object.fromEntries(Object.keys(storage).filter(k=>k.startsWith('tradingview_settings_perps_')).sort().map(k=>[k,storage.getItem(k)]));`);
  }
  async function restoreSettings(page,snapshot,refresh) {
    if(!snapshot || Object.keys(snapshot).some(k=>!k.startsWith('tradingview_settings_perps_')))throw Error('Invalid Perps chart settings snapshot');
    const values={...snapshot},normalizations=[];
    const seriesKey='tradingview_settings_perps_chartproperties.mainSeriesProperties';
    // This field is regenerated from the active chart on load. An old cached
    // default (e.g. 4H) must not replace the user's independently read 15m chart.
    const resolution=await api(page,`return chart.resolution();`);
    if(values[seriesKey]) {
      const series=JSON.parse(values[seriesKey]);
      if(series.interval!==resolution){normalizations.push({key:seriesKey,field:'interval',from:series.interval,to:resolution});series.interval=resolution;values[seriesKey]=JSON.stringify(series);}
    }
    const before=await settingsSnapshot(page);
    await tvEval(page,`const storage=doc.defaultView.localStorage;Object.keys(storage).filter(k=>k.startsWith('tradingview_settings_perps_')).forEach(k=>storage.removeItem(k));for(const[k,v]of Object.entries(${JSON.stringify(values)}))storage.setItem(k,v);return true;`);
    // Discard pending style autosave even when a prior drawing assertion failed.
    // This scope excludes all drawings, indicator templates and other modules.
    await refresh();
    const after=await settingsSnapshot(page);
    const sorted=value=>JSON.stringify(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)));
    if(sorted(after)!==sorted(values))throw Error(`Perps chart settings restore mismatch at keys: ${[...new Set([...Object.keys(values),...Object.keys(after)])].filter(k=>values[k]!==after[k]).join(', ')}`);
    return {changedKeys:[...new Set([...Object.keys(before),...Object.keys(values)])].filter(k=>before[k]!==values[k]),verifiedKeys:Object.keys(after),normalizations};
  }
  async function wait(page,body,timeout=15000) {
    const end=Date.now()+timeout;let last;
    while(Date.now()<end) {try {last=await api(page,body);if(last)return last;}catch{}await page.waitForTimeout(250);}
    throw Error(`TradingView evidence timeout: ${body.slice(0,100)}; last=${JSON.stringify(last)}`);
  }
  async function point(page,expression) {
    const host=page.locator('webview').first();
    if(await host.count()) {const b=await host.boundingBox();const height=await page.evaluate(()=>innerHeight);if(b.y<0||b.y+b.height>height)await host.scrollIntoViewIfNeeded();}
    const pos=await tvEval(page,`const el=${expression};if(!el)throw Error('Chart control missing');const r=el.getBoundingClientRect();if(!r.width||!r.height)throw Error('Chart control hidden');return{x:r.x+r.width/2,y:r.y+r.height/2};`);
    if(await host.count()) {const b=await host.boundingBox();return{x:b.x+pos.x,y:b.y+pos.y};}
    const off=await tvEval(page,`const r=doc.defaultView.frameElement.getBoundingClientRect();return{x:r.x,y:r.y};`);
    return{x:off.x+pos.x,y:off.y+pos.y};
  }
  async function move(page,p,click=false) {
    const host=page.locator('webview').first();
    if(await host.count()) {
      const b=await host.boundingBox();
      await host.evaluate(async(wv,{x,y,click})=>{wv.focus();await wv.sendInputEvent({type:'mouseMove',x,y});if(click){await wv.sendInputEvent({type:'mouseDown',x,y,button:'left',clickCount:1});await wv.sendInputEvent({type:'mouseUp',x,y,button:'left',clickCount:1});}},{x:Math.round(p.x-b.x),y:Math.round(p.y-b.y),click});
    } else if(click)await page.mouse.click(p.x,p.y);else await page.mouse.move(p.x,p.y);
  }
  async function click(page,expression) {await move(page,await point(page,expression),true);}
  async function addRsi(page) {
    const before=await api(page,`return chart.getAllStudies().filter(s=>s.name==='Relative Strength Index').map(s=>s.id);`);
    if(before.length) throw Error('RSI fixture needs RSI absent; preserve existing user RSI');
    const trigger=locator(page,'perps.chart.indicator_trigger');await trigger.scrollIntoViewIfNeeded();await trigger.hover();await page.waitForTimeout(400);await trigger.click();
    await locator(page,'perps.chart.indicator_items').filter({has:page.getByText('RSI',{exact:true})}).click();
    const panel=page.locator('[data-testid="TMPopover-ScrollView"]:visible').filter({has:locator(page,'perps.chart.indicator_items')});
    await panel.locator('xpath=ancestor::*[@data-onekey-overlay-entry][1]').locator(':scope > [aria-hidden="true"]').click({position:{x:3,y:3}});
    await panel.waitFor({state:'hidden'});
    return wait(page,`return chart.getAllStudies().find(s=>s.name==='Relative Strength Index')?.id;`);
  }
  async function editRsi(page,id,length) {
    await api(page,`chart.showPropertiesDialog(${JSON.stringify(id)});return true;`);
    await wait(page,`return !!doc.querySelector('input[inputmode="numeric"]');`);
    await page.waitForTimeout(400);
    await click(page,`doc.querySelector('input[inputmode="numeric"]')`);
    await wait(page,`return doc.activeElement===doc.querySelector('input[inputmode="numeric"]');`);
    const webview=page.locator('webview').first();
    if(await webview.count()) {
      await webview.evaluate(wv=>wv.focus());
      await api(page,`const e=doc.querySelector('input[inputmode="numeric"]');e.focus();e.select();return true;`);
      await webview.evaluate(async(wv,text)=>{for(const ch of text){await wv.sendInputEvent({type:'keyDown',keyCode:ch});await wv.sendInputEvent({type:'char',keyCode:ch});await wv.sendInputEvent({type:'keyUp',keyCode:ch});}},String(length));
    } else {
      await page.keyboard.press(process.platform==='darwin'?'Meta+A':'Control+A');await page.keyboard.type(String(length));
    }
    await wait(page,`return doc.querySelector('input[inputmode="numeric"]')?.value===${JSON.stringify(String(length))};`);
    await page.keyboard.press('Tab');await page.waitForTimeout(200);
    await click(page,`[...doc.querySelectorAll('button')].find(e=>/^(确认|Ok|OK)$/.test(e.textContent.trim()))`);
    await wait(page,`return chart.getStudyById(${JSON.stringify(id)}).getInputValues().find(i=>i.id==='length')?.value===${Number(length)};`);
  }
  async function deleteStudy(page,id) {
    const expression=`doc.querySelector('[data-name="legend-source-item"][data-entity-id="${id}"] [data-name="legend-source-title"]')`;
    const p=await point(page,expression);await move(page,p);await page.waitForTimeout(300);
    await click(page,`doc.querySelector('[data-name="legend-source-item"][data-entity-id="${id}"] [data-name="legend-delete-action"]')`);
    await wait(page,`return !chart.getAllStudies().some(s=>s.id===${JSON.stringify(id)});`);
  }
  async function dragLayout(page) {
    const sash=locator(page,'perps.chart.layout_separator');await sash.scrollIntoViewIfNeeded();const before=await sash.boundingBox();
    const shift=-60;let moved;
    try {
      await page.mouse.move(before.x+30,before.y+before.height/2);await page.mouse.down();await page.mouse.move(before.x+30,before.y+before.height/2+shift,{steps:20});await page.mouse.up();
      moved=await sash.boundingBox();if(Math.abs(moved.y-before.y-shift)>3)throw Error(`Layout drag did not move ${shift}px: ${before.y}→${moved.y}`);
      return `scrollIntoView; separator y=${before.y}→${moved.y}, delta=${shift}px`;
    } finally {
      try {
      await page.mouse.up();const b=await sash.boundingBox();await page.mouse.move(b.x+30,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+30,before.y+before.height/2,{steps:20});await page.mouse.up();
      const restored=await sash.boundingBox();if(Math.abs(restored.y-before.y)>3)throw Error('Layout restoration failed');
      } catch (error) { throw markRestoreFailure(null,error,'恢复图表面板高度'); }
    }
  }
  async function drawUi(page,shape) {
    const tools={trend_line:['趋势线工具','趋势线'],horizontal_line:['趋势线工具','水平线'],fib_retracement:['江恩和斐波那契工具','斐波那契回撤'],rectangle:['几何形状','矩形']};
    const [button,label]=tools[shape];const before=await api(page,`return chart.getAllShapes().map(s=>s.id);`);
    const wv=page.locator('webview').first();
    if(await wv.count())await wv.evaluate(async w=>{await w.sendInputEvent({type:'keyDown',keyCode:'Escape'});await w.sendInputEvent({type:'keyUp',keyCode:'Escape'});});else await page.keyboard.press('Escape');
    await click(page,`doc.querySelector('button[aria-label="${button}"]')`);
    await wait(page,`return [...doc.querySelectorAll('[data-name="popup-menu-container"] *')].some(e=>e.children.length===0&&e.textContent==='${label}'&&e.getBoundingClientRect().width>0);`);
    await click(page,`[...doc.querySelectorAll('[data-name="popup-menu-container"] *')].find(e=>e.children.length===0&&e.textContent==='${label}'&&e.getBoundingClientRect().width>0)`);
    await wait(page,`return doc.defaultView.tradingViewApi.selectedLineTool()===${JSON.stringify(shape)};`);
    const r=await tvEval(page,`return [...doc.querySelectorAll('canvas')].filter(e=>e.getBoundingClientRect().width>500&&e.getBoundingClientRect().height>100).sort((a,b)=>b.getBoundingClientRect().height-a.getBoundingClientRect().height)[0].getBoundingClientRect().toJSON();`);
    const host=await wv.count()?await wv.boundingBox():await tvEval(page,`return doc.defaultView.frameElement.getBoundingClientRect().toJSON();`);
    await move(page,{x:host.x+r.x+r.width*.3,y:host.y+r.y+r.height*.3},true);await page.waitForTimeout(300);
    if(shape!=='horizontal_line'){await move(page,{x:host.x+r.x+r.width*.6,y:host.y+r.y+r.height*.6},true);await page.waitForTimeout(300);}
    return wait(page,`return chart.getAllShapes().find(s=>s.name===${JSON.stringify(shape)}&&!${JSON.stringify(before)}.includes(s.id))?.id;`);
  }
  async function waitDrawingSaved(page,ids,{removed=[],width}={}) {
    // JSON quoting alone does not protect a script context from </script> or
    // line separators. Keep IDs and width in one escaped data literal.
    const data=JSON.stringify({ids,removed,width})
      .replace(/</g,'\\u003c').replace(/>/g,'\\u003e')
      .replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
    return wait(page,`
      const {ids,removed,width}=${data};
      const symbol=chart.symbol().replace(/[^a-zA-Z0-9-_]/g,'_').toLowerCase().substring(0,50);
      const stored=JSON.parse(doc.defaultView.localStorage.getItem('tradingview_drawings_perps_'+symbol)||'null');
      const entries=new Map(stored?.sources||[]);
      const hasWidth=v=>v&&typeof v==='object'&&(v.linewidth===width||Object.values(v).some(hasWidth));
      return ids.every(id=>entries.get(id)!=null)&&removed.every(id=>!entries.get(id))&&
        (width===undefined||hasWidth(entries.get(ids[0])))&&
        {timestamp:stored?.timestamp,savedIds:[...entries].filter(([,v])=>v!=null).map(([id])=>id)};
    `,20000);
  }
  async function drawingFixture(page,shape='trend_line',offset=0) {
    return api(page,`const r=chart.getVisibleRange(),p=chart.getVisiblePriceRange();const points=[{time:Math.round(r.from+(r.to-r.from)*.3),price:p.from+(p.to-p.from)*(.3+${offset})},{time:Math.round(r.from+(r.to-r.from)*.6),price:p.from+(p.to-p.from)*(.6+${offset})}];return Promise.resolve(chart.createMultipointShape(${JSON.stringify(shape)}==='horizontal_line'?points.slice(0,1):points,{shape:${JSON.stringify(shape)}}));`);
  }
  async function quotaFailure(page,exercise,refresh) {
    // The desktop iframe and its TradingView host share an origin. Intercept
    // only this pair's drawing writes, never consume the user's storage quota.
    if(!await page.locator('webview').count())return 'SKIP: 配额注入仅在 Desktop TF 验证；Web/Extension 需单独验证存储 realm';
    const backup=await api(page,`const symbol=chart.symbol().replace(/[^a-zA-Z0-9-_]/g,'_').toLowerCase().substring(0,50);const key='tradingview_drawings_perps_'+symbol;return {key,value:doc.defaultView.localStorage.getItem(key),ids:chart.getAllShapes().filter(s=>s.name!=='text').map(s=>s.id)};`);
    try {
      await tvEval(page,`const host=doc.defaultView.parent;if(host.__onekeyQaQuota)throw Error('Quota probe already active');const state={key:${JSON.stringify(backup.key)},attempts:0,original:host.Storage.prototype.setItem};host.__onekeyQaQuota=state;host.Storage.prototype.setItem=function(k,v){if(k===state.key){state.attempts++;throw new host.DOMException('QA injected storage quota','QuotaExceededError');}return state.original.call(this,k,v);};return true;`);
      const id=await drawingFixture(page);
      const attempts=await wait(page,`return doc.defaultView.parent.__onekeyQaQuota.attempts;`,25000);
      await exercise();
      await wait(page,`return chart.getAllShapes().some(s=>s.id===${JSON.stringify(id)})&&doc.querySelectorAll('canvas').length>=7;`);
      return `当前绘图键实际触发 ${attempts} 次 QuotaExceededError 后，周期可切换，图形及画布保留；存储不足提示另测`;
    } finally {
      try {
      await tvEval(page,`const host=doc.defaultView.parent,state=host.__onekeyQaQuota;if(state){host.Storage.prototype.setItem=state.original;delete host.__onekeyQaQuota;}const {key,value}=${JSON.stringify(backup)};if(value===null)host.localStorage.removeItem(key);else host.localStorage.setItem(key,value);return true;`);
      await refresh();
      await wait(page,`return JSON.stringify(chart.getAllShapes().filter(s=>s.name!=='text').map(s=>s.id).sort())===JSON.stringify(${JSON.stringify(backup.ids)}.sort());`,45000);
      } catch (error) { throw markRestoreFailure(null,error,'恢复图表配额探针状态'); }
    }
  }
  async function defaultVolume(page,refresh) {
    const filter="k.startsWith('tradingview_settings_perps_')||['tradingview_study_template_perps','tradingview_default_volume_removed_perps','tradingview_pane_heights_perps'].includes(k)";
    const backup=await api(page,`return {values:Object.fromEntries(Object.keys(doc.defaultView.localStorage).filter(k=>${filter}).map(k=>[k,doc.defaultView.localStorage.getItem(k)])),studies:chart.getAllStudies().map(s=>s.name).sort()};`);
    try {
      await tvEval(page,`const storage=doc.defaultView.localStorage;Object.keys(storage).filter(k=>${filter}).forEach(k=>storage.removeItem(k));return true;`);
      await refresh();
      await wait(page,`const studies=chart.getAllStudies();return studies.length===1&&studies[0].name==='Volume';`,30000);
      const trigger=locator(page,'perps.chart.indicator_trigger');
      await trigger.scrollIntoViewIfNeeded();await trigger.hover();await page.waitForTimeout(500);await trigger.click();
      const volume=locator(page,'perps.chart.indicator_items').filter({has:page.getByText('VOL',{exact:true})});
      await volume.click();
      const panel=page.locator('[data-testid="TMPopover-ScrollView"]:visible').filter({has:locator(page,'perps.chart.indicator_items')});
      await panel.locator('xpath=ancestor::*[@data-onekey-overlay-entry][1]').locator(':scope > [aria-hidden="true"]').click({position:{x:3,y:3}});
      await wait(page,`return !chart.getAllStudies().some(s=>s.name==='Volume')&&doc.defaultView.localStorage.getItem('tradingview_default_volume_removed_perps')==='1';`);
      await page.waitForTimeout(2000);await refresh();await page.waitForTimeout(2000);
      if(await api(page,`return chart.getAllStudies().some(s=>s.name==='Volume');`))throw Error('Deleted Volume returned after refresh');
      return '仅暂存/清除 Perps 指标与图表设置键：初始仅 Volume；UI 取消 VOL 后刷新仍无 Volume；非应用重装验证';
    } finally {
      try {
      await tvEval(page,`const storage=doc.defaultView.localStorage;Object.keys(storage).filter(k=>${filter}).forEach(k=>storage.removeItem(k));for(const[k,v]of Object.entries(${JSON.stringify(backup.values)}))storage.setItem(k,v);return true;`);
      await refresh();
      await wait(page,`return JSON.stringify(chart.getAllStudies().map(s=>s.name).sort())===JSON.stringify(${JSON.stringify(backup.studies)});`,30000);
      } catch (error) { throw markRestoreFailure(null,error,'恢复默认成交量测试状态'); }
    }
  }
  async function editTrendStyle(page,id,width=3) {
    await api(page,`chart.showPropertiesDialog(${JSON.stringify(id)});return true;`);
    await wait(page,`return !!doc.querySelector('[data-name="color-with-thickness-select"]');`);
    await click(page,`doc.querySelector('[data-name="color-with-thickness-select"]')`);
    await wait(page,`return !!doc.querySelector('input[name="color_picker_thickness_select"][value="${width}"]');`);
    await click(page,`doc.querySelector('input[name="color_picker_thickness_select"][value="${width}"]').parentElement`);
    await click(page,`[...doc.querySelectorAll('button')].find(e=>e.textContent.trim()==='样式')`);
    await wait(page,`return ![...doc.querySelectorAll('input[name="color_picker_thickness_select"]')].some(e=>e.getBoundingClientRect().width>0);`);
    await click(page,`[...doc.querySelectorAll('button')].find(e=>/^(确认|Ok|OK)$/.test(e.textContent.trim()))`);
    await wait(page,`return ![...doc.querySelectorAll('[data-section-name="TrendLineLine"]')].some(e=>e.getBoundingClientRect().width>0);`);
    await wait(page,`return chart.getShapeById(${JSON.stringify(id)}).getProperties().linewidth===${width};`);
    return `独立趋势线；真实点击样式面板线宽 ${width}px，模型 linewidth=${width}`;
  }
  async function deleteDrawing(page,id) {
    await click(page,`doc.querySelector('canvas[data-name="pane-top-canvas"]')`);
    await wait(page,`return doc.hasFocus();`);
    await api(page,`chart.selection().clear();chart.selection().add([${JSON.stringify(id)}]);return true;`);
    const wv=page.locator('webview').first();
    if(await wv.count())await wv.evaluate(async w=>{w.focus();await w.sendInputEvent({type:'keyDown',keyCode:'Delete'});await w.sendInputEvent({type:'keyUp',keyCode:'Delete'});});
    else await page.keyboard.press('Delete');
    await wait(page,`return !chart.getAllShapes().some(s=>s.id===${JSON.stringify(id)});`);
    return 'API 选择独立样本；真实 Delete 键移除，模型不存在该图形';
  }
  return {api,settingsSnapshot,restoreSettings,wait,point,move,click,waitDrawingSaved,drawUi,drawingFixture,quotaFailure,defaultVolume,editTrendStyle,deleteDrawing,addRsi,editRsi,deleteStudy,dragLayout};
}
