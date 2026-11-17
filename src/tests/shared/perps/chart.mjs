import {chartInteractions} from './chart-interactions.mjs';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runPreconditions} from '../../helpers/preconditions.mjs';
import {reloadPerps,markRestoreFailure} from './runtime.mjs';
import {snapshotNonOrderForm,restoreNonOrderForm} from './non-order-ui.mjs';
import {setChartMode,locator,currentPair,restorePair} from '../../helpers/perps-ui.mjs';
import {PerpsPage} from '../../helpers/pages/perps.mjs';
// Perps TV Chart — shared test logic (Desktop / Web / Extension)
//
// Wrapper files at:
//   src/tests/desktop/perps/chart.test.mjs
//   src/tests/web/perps/chart.test.mjs
//   src/tests/extension/perps/chart.test.mjs
// inject platform-specific tvEval + goToPerps, then call createChartTests()
// to get the same 9 test cases prefixed for their platform.
//
// Key platform difference (TV chart access):
//   - Desktop (Electron): TV chart lives in <webview> → blob: <iframe>.
//     tvEval wraps page.evaluate → wv.executeJavaScript → iframe.contentDocument
//   - Web / Extension: TV chart lives in a normal iframe (URL contains "tradingview").
//     tvEval finds the matching frame via page.frames() and uses frame.evaluate().
//
// Coverage mapping (unchanged from desktop original):
//   <PREFIX>-CHART-001 → 默认指标测试 (old 001, 013)
//   <PREFIX>-CHART-002 → 指标管理测试 (old 002, 003, 004, 014, 026)
//   <PREFIX>-CHART-003 → 画图工具测试 (old 005, 019, 020, 021)
//   <PREFIX>-CHART-004 → K线时间周期测试 (old 007, 015, 027, 028)
//   <PREFIX>-CHART-005 → 图表叠加显示测试 (old 009, 029)
//   <PREFIX>-CHART-006 → 视图布局测试 (old 008, 010, 018, 022)
//   <PREFIX>-CHART-007 → 异常与边界场景 (old 011, 017, 025, 030, 031)
//   <PREFIX>-CHART-008 → 跨交易对测试 (old 006, 012, 016, 023, 024)

import { sleep } from '../../helpers/constants.mjs';
import { screenshot } from '../../helpers/index.mjs';
import {
  createStepTracker, safeStep,
} from '../../helpers/components.mjs';

/**
 * Build the 9 Perps chart test cases for one platform.
 *
 * @param {object} opts
 * @param {string} opts.prefix - Test ID prefix, e.g. 'PERPS' | 'WEB-PERPS' | 'EXT-PERPS'
 * @param {string} [opts.namePrefix] - Display name prefix, e.g. '' | 'Web-' | 'Ext-'
 * @param {(page: import('playwright-core').Page) => Promise<void>} opts.goToPerps
 * @param {(page: import('playwright-core').Page, jsCode: string) => Promise<any>} opts.tvEval
 *   Execute JS inside the TradingView chart iframe.
 *   The code body must `return` a JSON-serializable value and may reference `doc` (the iframe document).
 * @param {string} opts.screenshotDir - Absolute directory to write failure screenshots.
 * @param {(page: import('playwright-core').Page) => Promise<{ getCurrentPair: () => Promise<string|null>, switchPair: (sym: string) => Promise<void> }>} [opts.makePerpsPage]
 *   Optional factory for platform-specific PerpsPage. If omitted, falls back to a DOM-only impl.
 * Account/position matrices are validated separately; these tests retain the selected account.
 * @returns {{ testCases: Array, setup: (page) => Promise<void>, ALL_TEST_IDS: string[] }}
 */
export function createChartTests({
  prefix,
  namePrefix = '',
  goToPerps,
  tvEval,
  screenshotDir,
  makePerpsPage,
}) {
  if (!goToPerps) throw new Error('createChartTests: goToPerps is required');
  if (!tvEval) throw new Error('createChartTests: tvEval is required');
  if (!screenshotDir) throw new Error('createChartTests: screenshotDir is required');

  const interactions=chartInteractions(tvEval);
  const ALL_TEST_IDS = [
    `${prefix}-CHART-001`,
    `${prefix}-CHART-002`,
    `${prefix}-CHART-003`,
    `${prefix}-CHART-004`,
    `${prefix}-CHART-005`,
    `${prefix}-CHART-006`,
    `${prefix}-CHART-007`,
    `${prefix}-CHART-008`,
    `${prefix}-CHART-009`,
  ];

  // ── TV iframe helpers (all go through injected tvEval) ──────

  async function waitForTVReady(page, minCanvases = 7, timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const count = await tvEval(page, `return doc.querySelectorAll('canvas').length;`);
        if (count >= minCanvases) {
          const controls=locator(page,'perps.chart.controls');
          const enabled=await controls.evaluate(e=>{const s=getComputedStyle(e);return s.opacity==='1' && s.pointerEvents!=='none';});
          if(enabled && await controls.locator('[data-sentry-component="SegmentControlItem"]:visible').count()>0) return count;
        }
      } catch {}
      await sleep(1000);
    }
    throw new Error(`TV chart not ready within ${timeoutMs}ms`);
  }

  async function getCanvasCount(page) {
    return tvEval(page, `return doc.querySelectorAll('canvas').length;`);
  }

  async function getIndicatorLabels(page) {
    return tvEval(page, `return [...doc.querySelectorAll('[data-name="legend-source-item"] [data-name="legend-source-title"]')].map(e=>e.innerText.trim()).filter(Boolean);`);
  }

  async function getTimeIntervals(page) {
    return locator(page,'perps.chart.controls').evaluate(root=>{
      const result=[...root.querySelectorAll('[data-sentry-component="SegmentControlItem"]')].filter(e=>e.getBoundingClientRect().width>0).map(e=>{
        const text=e.innerText.trim(),span=e.querySelector('span');
        return {text,aria:text,active:span?.className.split(' ').includes('_col-text'),more:false};
      });
      const more=root.querySelector('[data-testid="trading-view-native-interval-selector-more-select"]');
      if(more && !/更多|More/.test(more.innerText) && !result.some(e=>e.text===more.innerText.trim())) result.push({text:more.innerText.trim(),aria:more.innerText.trim(),active:true,more:true});
      return result;
    });
  }

  async function clickTimeInterval(page,label,settle=1500) {
    const text=label.replace(/\s/g,'').replace('分钟','分').replace('小时','时');
    const segment=locator(page,'perps.chart.controls').locator('[data-sentry-component="SegmentControlItem"]').filter({has:page.getByText(text,{exact:true})});
    if(await segment.count()===1) await segment.click();
    else {
      await locator(page,'perps.chart.interval_more').click();
      const option=locator(page,'perps.chart.interval_all').filter({has:page.getByText(text,{exact:true})});
      if(await option.count()!==1) throw Error(`Interval option missing or ambiguous: ${label}`);
      await option.click();
    }
    await sleep(settle);
  }

  async function getOHLC(page) {
    return tvEval(page, `
      const text=doc.querySelector('[data-name="legend-series-item"]')?.innerText || '';
      const values=[...text.matchAll(/(?:^|\\n)(?:开|高|低|收|[OHLC])\\s*=?\\s*([\\d,.]+)/g)].map(m=>m[1]);
      return values.length===4 ? {O:values[0],H:values[1],L:values[2],C:values[3]} : null;
    `);
  }

  function indicatorPanel(page) {return page.locator('[data-testid="TMPopover-ScrollView"]:visible').filter({has:locator(page,'perps.chart.indicator_items')});}
  async function closeChartPopover(page,panel) {
    await page.keyboard.press('Escape');
    if(await panel.count()) {
      // New OverlayView backdrops have no legacy ovelay-popover testID.
      // Scope to the entry containing this panel, excluding inert old portals.
      const entry=panel.locator('xpath=ancestor::*[@data-onekey-overlay-entry][1]');
      const backdrop=entry.locator(':scope > [aria-hidden="true"]');
      if(await backdrop.count()) await backdrop.click({position:{x:3,y:3}});
      else {
        const legacy=page.locator('[data-testid="ovelay-popover"]:visible');
        if(await legacy.count()) await legacy.last().click({position:{x:3,y:3}});
      }
    }
    await panel.waitFor({state:'hidden',timeout:5000});
  }
  async function clickIndicatorButton(page) {
    if(await indicatorPanel(page).count()) {
      await closeChartPopover(page,indicatorPanel(page));
    } else {
      await waitForTVReady(page);
      const trigger=locator(page,'perps.chart.indicator_trigger');
      // The first pointer sequence can lack a click during hover/focus changes.
      // Let the tooltip transition finish before clicking.
      await trigger.hover();
      await sleep(400);
      await trigger.click();
      await indicatorPanel(page).waitFor({state:'visible'});
    }
  }
  async function isIndicatorPanelOpen(page) {return await indicatorPanel(page).count()>0;}
  async function getIndicatorPanelText(page) {return indicatorPanel(page).innerText();}

  async function getDrawingKeys(page) {
    return tvEval(page, `
      const win = doc.defaultView || doc.parentWindow;
      const keys = [];
      try {
        for (let i = 0; i < win.localStorage.length; i++) {
          const key = win.localStorage.key(i);
          if (key.includes('drawing')) {
            const val = win.localStorage.getItem(key);
            keys.push({ key, len: val?.length || 0 });
          }
        }
      } catch(e) {}
      return keys;
    `);
  }

  async function getDrawingToolbar(page) {
    return tvEval(page, `
      const btns = [];
      doc.querySelectorAll('button[aria-label]').forEach(b => {
        const r = b.getBoundingClientRect();
        if (r.x < 60 && r.width > 0 && r.height > 0) {
          btns.push({ aria: b.getAttribute('aria-label').slice(0, 30), y: Math.round(r.y) });
        }
      });
      return btns.sort((a, b) => a.y - b.y);
    `);
  }

  async function getChartLayout(page) {
    // Use TV iframe directly for both webview size hint + canvas measurements.
    const canvasLayout = await tvEval(page, `
      const canvases = doc.querySelectorAll('canvas');
      let maxW = 0, maxH = 0;
      canvases.forEach(c => {
        const r = c.getBoundingClientRect();
        if (r.width > maxW && r.height > 100) { maxW = Math.round(r.width); maxH = Math.round(r.height); }
      });
      return { mainW: maxW, mainH: maxH, canvasCount: canvases.length };
    `);
    // wvSize: best-effort. Look for webview (Electron) or iframe (Web/Ext) on the main page.
    const wvSize = await page.evaluate(() => {
      const el = document.querySelector('webview')
        || Array.from(document.querySelectorAll('iframe')).find(f =>
          (f.src || '').toLowerCase().includes('tradingview') || (f.src || '').startsWith('blob:'));
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    return { wvSize, canvasLayout };
  }

  // ── Main-page DOM helpers ───────────────────────────────────

  async function getCurrentPair(page) { return currentPair(page); }

  function settingsPanel(page) {return page.locator('[data-testid="TMPopover-ScrollView"]:visible').filter({has:locator(page,'perps.chart.skip_confirm')});}
  async function openPerpsSettingsMenu(page) {
    if(await settingsPanel(page).count()) return;
    await locator(page,'perps.settings.button').click();
    if(await locator(page,'perps.menu.preferences').count()) await locator(page,'perps.menu.preferences').click();
    await settingsPanel(page).waitFor({state:'visible'});
  }
  async function closeSettings(page) {
    await closeChartPopover(page,settingsPanel(page));
  }
  async function getPerpsSettings(page) {
    await openPerpsSettingsMenu(page);
    try {
      const panel=settingsPanel(page);
      const skipConfirm=await panel.locator('[data-testid="perp-intl-switch"]').getAttribute('data-state');
      const chart=panel.locator('[data-testid="perp-switch"]');
      if(await chart.count()!==2) throw Error('Expected two chart switches');
      return {skipConfirm,showTrades:await chart.nth(0).getAttribute('data-state'),showPositions:await chart.nth(1).getAttribute('data-state')};
    } finally {await closeSettings(page);}
  }
  async function clickSettingsToggle(page,index) {
    await openPerpsSettingsMenu(page);
    try {
      const target=settingsPanel(page).locator('[data-testid="perp-switch"]').nth(index-1);
      const before=await target.getAttribute('data-state');
      await target.click();
      await page.waitForFunction(({before,index})=>[...document.querySelectorAll('[data-testid="perp-switch"]')].filter(e=>e.getBoundingClientRect().width>0)[index-1]?.getAttribute('data-state')!==before,{before,index});
    } finally {await closeSettings(page);}
  }

  // ── PerpsPage abstraction (with fallback) ───────────────────

  function defaultMakePerpsPage(page) { return new PerpsPage(page); }

  const getPerps = makePerpsPage || ((page) => defaultMakePerpsPage(page));

  // ── Misc utilities ───────────────────────────────────────────

  const _ssStep = async (page, t, name, fn) => {
    let fatal;
    const result=await safeStep(page, {...t,add:(n,status,detail)=>{ if(status==='passed'&&/^SKIP:/.test(detail)) t.skip(n,detail); else t.add(n,status,detail); }}, name, async()=>{
      try {return await fn();}catch(error){if(error.fatalRestore)fatal=error;throw error;}
    }, (p, n) => screenshot(p, screenshotDir, n));
    if(fatal)throw fatal;
    return result;
  };
  const restoreState=async(fn)=>{
    try {return await fn();}catch(error){throw markRestoreFailure(null,error,'恢复图表内部测试状态');}
  };

  async function navigateToPerps(page) {
    await goToPerps(page);
    await setChartMode(page,'tradingView');
  }

  async function reloadAndWait(page) {
    const expectedCanvases=await getCanvasCount(page);
    const expectedIndicators=await getIndicatorLabels(page);
    await reloadPerps(page,{navigate:goToPerps,ready:()=>waitForTVReady(page,expectedCanvases,30000)});
    const deadline=Date.now()+15000;
    while(Date.now()<deadline) {
      const restored=await getIndicatorLabels(page);
      if(expectedIndicators.every(name=>restored.includes(name))) return;
      await sleep(250);
    }
    throw Error(`Indicators not restored after refresh: ${expectedIndicators.join(', ')}`);
  }

  // ── Test Cases (8 merged) ──────────────────────────────────

  async function testChart001(page) {
    const t=createStepTracker(`${prefix}-CHART-001`);
    await navigateToPerps(page);
    await _ssStep(page,t,'TradingView 加载并读取当前指标',async()=>{
      const canvases=await waitForTVReady(page);
      const labels=await getIndicatorLabels(page);
      // An existing user chart may intentionally contain no indicators.
      return `${canvases} canvases; indicators=${labels.join(', ')}`;
    });
    await _ssStep(page,t,'图表初始默认 Volume 及删除后刷新保持',()=>interactions.defaultVolume(page,()=>reloadPerps(page,{navigate:goToPerps,ready:()=>waitForTVReady(page,7,30000)})));
    return t.result();
  }

  async function testChart002(page) {
    const id = `${prefix}-CHART-002`;
    const t = createStepTracker(id);

    await navigateToPerps(page);
    await waitForTVReady(page);

    await _ssStep(page, t, '打开指标面板', async () => {
      await clickIndicatorButton(page);
      const open = await isIndicatorPanelOpen(page);
      if (!open) throw new Error('Indicator panel did not open');
      return 'Panel opened';
    });

    await _ssStep(page, t, '检查当前指标列表', async () => {
      if (await isIndicatorPanelOpen(page)) {
        await clickIndicatorButton(page);
        await sleep(500);
      }
      const labels = await getIndicatorLabels(page);
      return `Current: ${labels.filter(l => l.length < 25).join(', ')}`;
    });

    let panelTextBefore;
    await _ssStep(page, t, '当前指标分类与选项', async () => {
      await clickIndicatorButton(page);
      await sleep(500);
      panelTextBefore = await getIndicatorPanelText(page);
      if(!panelTextBefore.includes('MACD') || !panelTextBefore.includes('主图指标')) throw Error('Indicator categories/options missing');
      const macdPos = panelTextBefore.indexOf('MACD');
      await clickIndicatorButton(page);
      return `主图 / 副图分类及 MACD 选项可见，位置 ${macdPos}`;
    });

    t.skip('收藏指标（点击星形按钮）', '旧版步骤已停用：当前统一指标面板无星形收藏入口，正式用例改验分类和选中状态');
    t.skip('取消收藏指标', '旧版步骤已停用：当前统一指标面板无星形收藏入口');
    const rsiBefore=await interactions.api(page,`return chart.getAllStudies().filter(s=>s.name==='Relative Strength Index');`);
    if(rsiBefore.length) {
      t.skip('RSI 参数修改持久化','当前已有用户 RSI；需独立 RSI 样本，避免覆盖用户参数');
      t.skip('删除测试指标','当前已有用户 RSI；不删除用户指标');
    } else {
      let fixtureId;
      try {
        await _ssStep(page,t,'RSI 参数修改持久化',async()=>{
          fixtureId=await interactions.addRsi(page);
          await interactions.editRsi(page,fixtureId,18);
          await sleep(1500);await reloadAndWait(page);
          fixtureId=await interactions.wait(page,`return chart.getAllStudies().find(s=>s.name==='Relative Strength Index')?.id;`);
          const inputs=await interactions.api(page,`return chart.getStudyById(${JSON.stringify(fixtureId)}).getInputValues();`);
          if(inputs.find(i=>i.id==='length')?.value!==18)throw Error('RSI length not restored as 18');
          return 'UI 添加 RSI；TV API 打开参数面板；真实鼠标键盘 14→18；刷新后 length=18';
        });
        if(fixtureId) await _ssStep(page,t,'删除测试指标',async()=>{
          await interactions.deleteStudy(page,fixtureId);await sleep(2500);fixtureId=null;
          return '真实点击 RSI 图例移除按钮，模型与图例均移除；原 BB/MACD 保留';
        });
      } finally {
        if(fixtureId)await restoreState(()=>interactions.api(page,`if(chart.getAllStudies().some(s=>s.id===${JSON.stringify(fixtureId)}))chart.removeEntity(${JSON.stringify(fixtureId)});return true;`));
      }
    }

    await _ssStep(page, t, '真实刷新后指标与分类选项保留', async () => {
      const beforeLabels = await getIndicatorLabels(page);
      await reloadAndWait(page);
      const afterLabels = await getIndicatorLabels(page);

      const toName = (l) => l.trim();
      const beforeSet = new Set(beforeLabels.map(toName).filter(Boolean));
      const afterSet = new Set(afterLabels.map(toName).filter(Boolean));
      const missing = [...beforeSet].filter(x => !afterSet.has(x));
      if (missing.length > 0) throw new Error(`Indicators lost: ${missing.join(', ')}`);

      await clickIndicatorButton(page);
      await sleep(1000);
      const panelTextAfter = await getIndicatorPanelText(page);
      await clickIndicatorButton(page);
      if(!panelTextAfter.includes('MACD')) throw Error('Indicator options missing after reload');
      const macdPosBefore = panelTextBefore.indexOf('MACD');
      const macdPosAfter = panelTextAfter.indexOf('MACD');

      const results = [];
      results.push(`Indicators: ${[...afterSet].join(', ')}`);
      if (macdPosAfter >= 0) {
        results.push(`MACD option: pos ${macdPosBefore}→${macdPosAfter}`);
      }
      return results.join(' | ');
    });

    return t.result();
  }

  async function testChart003(page) {
    const id = `${prefix}-CHART-003`;
    const t = createStepTracker(id);

    await navigateToPerps(page);
    await waitForTVReady(page);

    const pair = await getCurrentPair(page);
    const symbol = (pair || 'SOL').replace('USDC', '').toLowerCase();

    await _ssStep(page, t, '画图工具栏可见', async () => {
      const toolbar = await getDrawingToolbar(page);
      const hasTrendLine = toolbar.some(b => b.aria.includes('趋势线'));
      if (!hasTrendLine) throw new Error('Trend line tool not found in toolbar');
      return `Tools: ${toolbar.map(b => b.aria).join(', ')}`;
    });

    await _ssStep(page, t, '画图数据 localStorage 检查', async () => {
      const keys = await getDrawingKeys(page);
      const currentPairKey = keys.find(k => k.key.includes(`perps_${symbol}`));
      const totalKeys = keys.filter(k => k.key.includes('perps_')).length;
      return `Symbol: ${symbol} | Drawing key: ${currentPairKey ? `${currentPairKey.key} (${currentPairKey.len} bytes)` : 'none'} | Total perps drawing keys: ${totalKeys}`;
    });

    const drawingBackup=await interactions.api(page,`const symbol=chart.symbol().replace(/[^a-zA-Z0-9-_]/g,'_').toLowerCase();const key='tradingview_drawings_perps_'+symbol;return {key,value:doc.defaultView.localStorage.getItem(key),ids:chart.getAllShapes().filter(s=>s.name!=='text').map(s=>s.id)};`);
    drawingBackup.settings=await interactions.settingsSnapshot(page);
    const fixtureIds=[];let drawing;let originalWidth;
    try {
      await _ssStep(page,t,'水平线/斐波那契/矩形绘制',async()=>{
        for(const type of ['trend_line','horizontal_line','fib_retracement','rectangle'])fixtureIds.push(await interactions.drawUi(page,type));
        drawing=await interactions.api(page,`return ${JSON.stringify(fixtureIds)}.map(id=>({id,name:chart.getAllShapes().find(s=>s.id===id)?.name,points:chart.getShapeById(id).getPoints()}));`);
        if(drawing.some(s=>s.points.length<1))throw Error('Drawing has no points');
        originalWidth=await interactions.api(page,`return chart.getShapeById(${JSON.stringify(fixtureIds[0])}).getProperties().linewidth;`);
        await interactions.waitDrawingSaved(page,fixtureIds);return '真实工具菜单、原生指针绘制四类图形，等待持久化后继续';
      });
      if(fixtureIds.length===4) {
        await _ssStep(page,t,'编辑趋势线样式',async()=>{
          const detail=await interactions.editTrendStyle(page,fixtureIds[0],originalWidth===3?4:3);await interactions.waitDrawingSaved(page,fixtureIds,{width:originalWidth===3?4:3});return detail+'；存储线宽已更新';
        });
        await _ssStep(page,t,'刷新后画图持久化',async()=>{
          const readDrawingState=()=>interactions.api(page,`const symbol=chart.symbol().replace(/[^a-zA-Z0-9-_]/g,'_').toLowerCase();return {symbol,resolution:chart.resolution(),shapes:chart.getAllShapes().map(s=>({...s,points:chart.getShapeById(s.id).getPoints(),linewidth:chart.getShapeById(s.id).getProperties().linewidth})),stored:doc.defaultView.localStorage.getItem('tradingview_drawings_perps_'+symbol)};`);
          const evidence={expected:drawing,before:await readDrawingState()};
          await reloadAndWait(page);
          let after;
          try {
            after=await interactions.wait(page,`const ids=${JSON.stringify(fixtureIds)};return ids.every(id=>chart.getAllShapes().some(s=>s.id===id)) && ids.map(id=>({id,name:chart.getAllShapes().find(s=>s.id===id)?.name,points:chart.getShapeById(id).getPoints()}));`,45000);
          } finally {
            evidence.after=await readDrawingState();
            writeFileSync(resolve(screenshotDir,`${id}-drawing-refresh-evidence.json`),JSON.stringify(evidence,null,2));
          }
          for(const before of drawing){const current=after.find(s=>s.id===before.id);if(!current||current.points.length!==before.points.length||before.points.some((p,i)=>(before.name!=='horizontal_line'&&p.time!==current.points[i].time)||Math.abs(p.price-current.points[i].price)>1e-8))throw Error(`Drawing coordinates changed: ${JSON.stringify({before,current})}`);}
          const width=await interactions.api(page,`return chart.getShapeById(${JSON.stringify(fixtureIds[0])}).getProperties().linewidth;`);
          if(width!==(originalWidth===3?4:3))throw Error(`Drawing style not restored: before=${originalWidth===3?4:3}, after=${width}, id=${fixtureIds[0]}`);
          return '四类样本刷新后 ID、趋势线/回撤/矩形时价锚点、水平线价格及编辑后的线宽一致';
        });
        await _ssStep(page,t,'删除画图图形',async()=>{
          await interactions.editTrendStyle(page,fixtureIds[0],originalWidth);
          await interactions.deleteDrawing(page,fixtureIds[0]);await interactions.waitDrawingSaved(page,fixtureIds.slice(1),{removed:[fixtureIds[0]]});await reloadAndWait(page);
          await interactions.wait(page,`return !chart.getAllShapes().some(s=>s.id===${JSON.stringify(fixtureIds[0])})&&${JSON.stringify(fixtureIds.slice(1))}.every(id=>chart.getAllShapes().some(s=>s.id===id));`,45000);
          return '真实 Delete 删除一条，刷新后该条仍不存在，另外三条仍在';
        });
      }
    } finally {
      await restoreState(async()=>{
      // Restore only this pair's drawing record, then replace the document so its
      // pending autosave cannot overwrite the user's snapshot during cleanup.
      await tvEval(page,`const {key,value}=${JSON.stringify(drawingBackup)};const storage=doc.defaultView.localStorage;if(value===null)storage.removeItem(key);else storage.setItem(key,value);return true;`);
      await interactions.restoreSettings(page,drawingBackup.settings,()=>reloadAndWait(page));
      await interactions.wait(page,`const ids=chart.getAllShapes().filter(s=>s.name!=='text').map(s=>s.id).sort();return JSON.stringify(ids)===JSON.stringify(${JSON.stringify(drawingBackup.ids)}.sort());`,45000);
      });
    }

    return t.result();
  }

  async function testChart004(page) {
    const id = `${prefix}-CHART-004`;
    const t = createStepTracker(id);

    await navigateToPerps(page);
    await waitForTVReady(page);

    let intervals;
    await _ssStep(page, t, '获取可用时间周期列表', async () => {
      intervals = await getTimeIntervals(page);
      if (intervals.length === 0) throw new Error('No time interval buttons found');
      const activeOne = intervals.find(i => i.active);
      return `${intervals.length} intervals: ${intervals.map(i => i.text + (i.active ? '[*]' : '')).join(', ')} | Active: ${activeOne?.text || 'none'}`;
    });

    const toTest = intervals.filter(i => !i.active).slice(0, 3);
    for (const interval of toTest) {
      await _ssStep(page, t, `切换时间周期: ${interval.text}`, async () => {
        const ohlcBefore = await getOHLC(page);
        await clickTimeInterval(page, interval.aria);

        const after = await getTimeIntervals(page);
        const nowActive = after.find(i => i.active);
        if (!nowActive || nowActive.aria !== interval.aria) {
          throw Error(`Time interval selection not applied: ${interval.aria}`);
        }

        const ohlcAfter = await getOHLC(page);
        const dataChanged = !ohlcBefore || !ohlcAfter ||
          ohlcBefore.O !== ohlcAfter.O || ohlcBefore.C !== ohlcAfter.C;

        return `${interval.text} — OHLC ${dataChanged ? 'changed' : 'same (may be expected for close intervals)'} | Canvases OK`;
      });
    }

    let intervalsBefore;
    await _ssStep(page, t, '记录当前收藏周期', async () => {
      intervalsBefore = await getTimeIntervals(page);
      if(!intervalsBefore.length) throw Error('Interval toolbar empty');
      return `Toolbar: ${intervalsBefore.map(i => i.text + (i.active ? '[*]' : '')).join(', ')}`;
    });

    await _ssStep(page, t, '刷新后收藏周期保留', async () => {
      await reloadAndWait(page);
      const intervalsAfter = await getTimeIntervals(page);

      const beforeSet = new Set(intervalsBefore.filter(i=>!i.more).map(i => i.aria).filter(a => a !== '图表周期'));
      const afterSet = new Set(intervalsAfter.filter(i=>!i.more).map(i => i.aria).filter(a => a !== '图表周期'));
      const lost = [...beforeSet].filter(x => !afterSet.has(x));
      const added = [...afterSet].filter(x => !beforeSet.has(x));

      if (lost.length > 0) throw new Error(`Favorited intervals lost: ${lost.join(', ')}`);
      if (added.length > 0) throw new Error(`Unexpected intervals appeared: ${added.join(', ')}`);
      return `Preserved: ${[...afterSet].join(', ')}`;
    });

    t.skip('自定义时间周期设置', '旧版步骤已停用：当前统一周期面板只提供预设周期与偏好编辑');
    t.skip('自定义时间周期刷新持久化', '旧版步骤已停用：当前无自定义周期输入，偏好周期刷新另有断言');

    return t.result();
  }

  async function testChart005(page) {
    const id = `${prefix}-CHART-005`;
    const t = createStepTracker(id);

    t.skip('多账户 / 不同持仓样本的叠加线对账','使用当前账户，不按固定钱包名切换；真实标记点与持仓线另需样本复测');

    await navigateToPerps(page);
    await waitForTVReady(page);

    await _ssStep(page, t, '切换时间周期到天', async () => {
      await clickTimeInterval(page, '1 日');
      return 'Switched to 1 day interval';
    });

    let settings;
    await _ssStep(page, t, '读取图表设置', async () => {
      settings = await getPerpsSettings(page);
      if (!settings) throw new Error('无法读取设置菜单');
      return `跳过确认: ${settings.skipConfirm} | 买卖点: ${settings.showTrades} | 仓位订单: ${settings.showPositions}`;
    });

    for(const [index,key] of [[1,'showTrades'],[2,'showPositions']]) {
      await _ssStep(page,t,`${key}切换并恢复开关状态`,async()=>{
        const before=await getPerpsSettings(page);
        if(!before || !['checked','unchecked'].includes(before[key])) throw Error(`Missing ${key} state`);
        try {
          await clickSettingsToggle(page,index);
          const after=await getPerpsSettings(page);
          if(!after || after[key]===before[key]) throw Error(`${key} did not toggle`);
          return `${before[key]} -> ${after[key]}; state change verified`;
        } finally {
          await restoreState(async()=>{
          const current=await getPerpsSettings(page);
          if(!current) throw Error('Cannot restore chart setting');
          if(current[key]!==before[key]) await clickSettingsToggle(page,index);
          if((await getPerpsSettings(page))?.[key]!==before[key]) throw Error('Chart setting restoration failed');
          });
        }
      });
    }
    t.skip('叠加标记点及持仓线实际绘制','实时价格也会改变 canvas hash，不能以 hash 变化判定叠加线存在；需可控数据截图 / 组件断言');

    await _ssStep(page, t, '刷新后设置持久化', async () => {
      const settingsBefore = await getPerpsSettings(page);
      if (!settingsBefore) throw new Error('无法读取设置');

      await reloadAndWait(page);

      const settingsAfter = await getPerpsSettings(page);
      if (!settingsAfter) throw new Error('刷新后无法读取设置');

      const checks = [];
      if (settingsBefore.skipConfirm !== settingsAfter.skipConfirm) checks.push('跳过确认');
      if (settingsBefore.showTrades !== settingsAfter.showTrades) checks.push('买卖点');
      if (settingsBefore.showPositions !== settingsAfter.showPositions) checks.push('仓位订单');

      if (checks.length > 0) throw new Error(`Settings changed after refresh: ${checks.join(', ')}`);
      return `All 3 settings preserved after refresh`;
    });

    t.skip('多个限价单多条挂单线', '需要有多个未成交限价单的账户环境');

    return t.result();
  }

  async function testChart006(page) {
    const id = `${prefix}-CHART-006`;
    const t = createStepTracker(id);

    await navigateToPerps(page);
    await waitForTVReady(page);

    t.skip('重置布局与默认 Volume 回归','指标重置入口与流程尚待实现；Desktop TF 当前指标面板未见对应入口，不能用外层面板高度重置代替');

    let layoutBefore;
    await _ssStep(page, t, '记录当前布局', async () => {
      layoutBefore = await getChartLayout(page);
      return `Webview: ${layoutBefore.wvSize?.w}x${layoutBefore.wvSize?.h} | Main canvas: ${layoutBefore.canvasLayout?.mainW}x${layoutBefore.canvasLayout?.mainH} | Canvases: ${layoutBefore.canvasLayout?.canvasCount}`;
    });

    await _ssStep(page, t, '刷新后布局保留', async () => {
      await reloadAndWait(page);
      await waitForTVReady(page, layoutBefore.canvasLayout?.canvasCount || 7, 20000).catch(() => {});
      const layoutAfter = await getChartLayout(page);
      if(!layoutBefore.wvSize || !layoutAfter.wvSize || !layoutAfter.canvasLayout?.mainW) throw Error('Chart layout dimensions missing');

      if (layoutBefore.wvSize && layoutAfter.wvSize) {
        const wDiff = Math.abs(layoutBefore.wvSize.w - layoutAfter.wvSize.w);
        const hDiff = Math.abs(layoutBefore.wvSize.h - layoutAfter.wvSize.h);
        if (wDiff > 5 || hDiff > 5) {
          throw new Error(`Webview size changed: ${layoutBefore.wvSize.w}x${layoutBefore.wvSize.h} → ${layoutAfter.wvSize.w}x${layoutAfter.wvSize.h}`);
        }
      }

      if (layoutAfter.canvasLayout && layoutAfter.canvasLayout.canvasCount < 7) {
        throw new Error(`Canvas count too low after refresh: ${layoutAfter.canvasLayout.canvasCount}`);
      }

      return `Webview: ${layoutAfter.wvSize?.w}x${layoutAfter.wvSize?.h} | Canvas: ${layoutAfter.canvasLayout?.mainW}x${layoutAfter.canvasLayout?.mainH} | Count: ${layoutAfter.canvasLayout?.canvasCount}`;
    });

    await _ssStep(page,t,'调整图表区域大小',()=>interactions.dragLayout(page));

    return t.result();
  }

  async function testChart007(page) {
    const id = `${prefix}-CHART-007`;
    const t = createStepTracker(id);

    await navigateToPerps(page);
    await waitForTVReady(page);

    const intervals = await getTimeIntervals(page);
    const available = intervals.filter(i => i.aria && i.aria !== '图表周期');

    await _ssStep(page, t, '快速连续切换时间周期', async () => {
      if (available.length < 2) throw new Error('Need at least 2 intervals');

      const start = Date.now();
      for (let i = 0; i < 6; i++) {
        const target = available[i % available.length];
        await clickTimeInterval(page,target.aria,300);
      }
      const elapsed = Date.now() - start;

      await sleep(2000);

      const canvases = await getCanvasCount(page);
      if (canvases < 7) throw new Error(`Chart broken after rapid switching: ${canvases} canvases`);

      return `6 rapid switches in ${elapsed}ms | Chart stable: ${canvases} canvases`;
    });

    await _ssStep(page, t, '快速切换后数据正常', async () => {
      const ohlc = await getOHLC(page);
      const intervals2 = await getTimeIntervals(page);
      const active = intervals2.find(i => i.active);
      if(!active || !ohlc) throw Error('Missing selected interval or OHLC after switching');
      return `Active: ${active?.text || 'unknown'} | OHLC: ${ohlc ? `O=${ohlc.O} C=${ohlc.C}` : 'not readable'}`;
    });

    t.skip('清空图表存储后的默认恢复', '需隔离图表配置执行，禁止在用户钱包会话清空整个 origin 的 localStorage');

    await _ssStep(page,t,'localStorage 配额异常后图表仍可操作',async()=>{
      const intervals=await getTimeIntervals(page);
      const before=intervals.find(i=>i.active)?.text;
      const target=intervals.find(i=>!i.active&&!i.more);
      if(!before||!target)throw Error('Need current interval and an alternate interval for quota probe');
      try {
        return await interactions.quotaFailure(page,async()=>{
          await clickTimeInterval(page,target.aria);
          if(!(await getTimeIntervals(page)).some(i=>i.text===target.text&&i.active))throw Error('Interval did not change after quota error');
        },()=>reloadAndWait(page));
      } finally {
        await restoreState(async()=>{
        await clickTimeInterval(page,before);
        if(!(await getTimeIntervals(page)).some(i=>i.text===before&&i.active))throw Error('Quota probe interval restoration failed');
        });
      }
    });
    t.skip('存储不足提示','配额异常后的可操作性已测；提示文案及全局存储不可用另需独立故障场景');
    t.skip('大量指标性能 (20 个)', 'Desktop TF 已构造20指标样本；回归尚缺真实呈现帧率采样，不能断言≥30FPS');
    t.skip('大量画图性能 (50 条线)', 'Desktop TF 已验证50线保存与刷新保留；尚缺真实呈现帧率采样，不能断言≥30FPS');

    return t.result();
  }

  async function testChart008(page) {
    const id = `${prefix}-CHART-008`;
    const t = createStepTracker(id);

    await navigateToPerps(page);
    await waitForTVReady(page);

    const perps = getPerps(page);

    let pair1, pair1DrawingKey;
    await _ssStep(page, t, '记录交易对 A 画图状态', async () => {
      pair1 = (await perps.getCurrentPair()) || 'unknown';
      const sym1 = pair1.replace('USDC', '').toLowerCase();
      const keys = await getDrawingKeys(page);
      pair1DrawingKey = keys.find(k => k.key.includes(`perps_${sym1}`));
      return `Pair A: ${pair1} | Drawing: ${pair1DrawingKey ? `${pair1DrawingKey.len} bytes` : 'none'}`;
    });

    const targetSymbol = pair1?.startsWith('BTC') ? 'ETH' : 'BTC';
    await _ssStep(page, t, `切换到交易对 B (${targetSymbol})`, async () => {
      await perps.switchPair(targetSymbol);
      await sleep(2000);
      await waitForTVReady(page);
      const pair2 = await perps.getCurrentPair();
      return `Switched to: ${pair2}`;
    });

    await _ssStep(page, t, '验证交易对 B 画图数据独立', async () => {
      const pair2 = (await perps.getCurrentPair()) || 'unknown';
      const sym2 = pair2.replace('USDC', '').toLowerCase();
      const sym1 = pair1.replace('USDC', '').toLowerCase();
      const keys = await getDrawingKeys(page);

      const pair2Key = keys.find(k => k.key.includes(`perps_${sym2}`));
      const pair1KeyStill = keys.find(k => k.key.includes(`perps_${sym1}`));

      if (pair1DrawingKey && !pair1KeyStill) {
        throw new Error(`Pair A (${sym1}) drawing data lost after switching to ${sym2}`);
      }

      if (pair2Key && pair1KeyStill && pair2Key.key === pair1KeyStill.key) {
        throw new Error(`Same drawing key for both pairs — not isolated!`);
      }

      return `A(${sym1}): ${pair1KeyStill?.len || 0} bytes | B(${sym2}): ${pair2Key?.len || 0} bytes | Isolated`;
    });

    const switchBackSymbol = pair1?.replace('USDC', '') || 'SOL';
    await _ssStep(page, t, `切回交易对 A (${switchBackSymbol})`, async () => {
      await perps.switchPair(switchBackSymbol);
      await sleep(2000);
      await waitForTVReady(page);
      const sym1 = switchBackSymbol.toLowerCase();
      const keys = await getDrawingKeys(page);
      const pair1KeyNow = keys.find(k => k.key.includes(`perps_${sym1}`));

      if (pair1DrawingKey && pair1DrawingKey.len > 200) {
        if (!pair1KeyNow) throw new Error(`Pair A drawing data gone after round-trip`);
        if (pair1KeyNow.len < pair1DrawingKey.len * 0.5) {
          throw new Error(`Pair A drawing shrank: ${pair1DrawingKey.len} → ${pair1KeyNow.len}`);
        }
      }
      return `Round-trip OK — ${switchBackSymbol}: ${pair1KeyNow?.len || 0} bytes`;
    });

    let indicators1;
    await _ssStep(page, t, '记录交易对 A 指标', async () => {
      indicators1 = await getIndicatorLabels(page);
      const short = indicators1.filter(l => l.length < 20);
      return `${pair1}: ${short.join(', ')}`;
    });

    await _ssStep(page, t, `切换到 ${targetSymbol} 验证指标同步`, async () => {
      await perps.switchPair(targetSymbol);
      await sleep(2000);
      await waitForTVReady(page);
      return `Switched to ${await perps.getCurrentPair()}`;
    });

    await _ssStep(page, t, '指标全局同步验证', async () => {
      const indicators2 = await getIndicatorLabels(page);

      const getName = (labels) => new Set(labels.filter(Boolean));
      const set1 = getName(indicators1);
      const set2 = getName(indicators2);

      const onlyInA = [...set1].filter(x => !set2.has(x));
      const onlyInB = [...set2].filter(x => !set1.has(x));

      if (onlyInA.length > 0 || onlyInB.length > 0) {
        throw Error(`Indicators differ — A only: [${onlyInA}], B only: [${onlyInB}]`);
      }
      return `Indicators synced: ${[...set2].join(', ')}`;
    });

    await _ssStep(page, t, '设置全局同步验证', async () => {
      const settings = await getPerpsSettings(page);
      if (!settings) return 'SKIP: cannot read settings on this pair';
      return `Settings on ${targetSymbol}: 跳过确认=${settings.skipConfirm} 买卖点=${settings.showTrades} 仓位=${settings.showPositions}`;
    });

    await perps.switchPair(switchBackSymbol);
    await sleep(2000);
    await waitForTVReady(page);

    let indicatorsBefore016, drawingKeysBefore016, settingsBefore016, intervalsBefore016;
    await _ssStep(page, t, '记录刷新前全量状态', async () => {
      indicatorsBefore016 = await getIndicatorLabels(page);
      drawingKeysBefore016 = await getDrawingKeys(page);
      settingsBefore016 = await getPerpsSettings(page);
      intervalsBefore016 = await getTimeIntervals(page);
      const toName = (l) => l.trim();
      return `Indicators: ${[...new Set(indicatorsBefore016.map(toName))].join(', ')} | Drawings: ${drawingKeysBefore016.filter(k => k.key.includes('perps_')).length} keys | Intervals: ${intervalsBefore016.length}`;
    });

    await _ssStep(page, t, '刷新后全量状态保留', async () => {
      await reloadAndWait(page);
      const results = [];

      const indicatorsAfter = await getIndicatorLabels(page);
      const toName = (l) => l.trim();
      const setBefore = new Set(indicatorsBefore016.map(toName).filter(Boolean));
      const setAfter = new Set(indicatorsAfter.map(toName).filter(Boolean));
      const lost = [...setBefore].filter(x => !setAfter.has(x));
      if (lost.length > 0) throw new Error(`Indicators lost: ${lost.join(', ')}`);
      results.push(`Indicators: ${[...setAfter].join(', ')}`);

      const drawingKeysAfter = await getDrawingKeys(page);
      const beforeCount = drawingKeysBefore016.filter(k => k.key.includes('perps_')).length;
      const afterCount = drawingKeysAfter.filter(k => k.key.includes('perps_')).length;
      if (afterCount < beforeCount * 0.5) throw new Error(`Drawings shrank: ${beforeCount} → ${afterCount}`);
      results.push(`Drawings: ${beforeCount}→${afterCount}`);

      if (settingsBefore016) {
        const settingsAfter = await getPerpsSettings(page);
        if (settingsAfter) {
          const checks = [];
          if (settingsBefore016.showTrades !== settingsAfter.showTrades) checks.push('买卖点');
          if (settingsBefore016.showPositions !== settingsAfter.showPositions) checks.push('仓位订单');
          if (checks.length > 0) throw new Error(`Settings changed: ${checks.join(', ')}`);
          results.push('Settings: preserved');
        }
      }

      const intervalsAfter = await getTimeIntervals(page);
      const beforeISet = new Set(intervalsBefore016.filter(i=>!i.more).map(i => i.aria).filter(a => a !== '图表周期'));
      const afterISet = new Set(intervalsAfter.filter(i=>!i.more).map(i => i.aria).filter(a => a !== '图表周期'));
      const lostI = [...beforeISet].filter(x => !afterISet.has(x));
      if (lostI.length > 0) throw new Error(`Intervals lost: ${lostI.join(', ')}`);
      results.push(`Intervals: ${[...afterISet].join(', ')}`);

      return results.join(' | ');
    });

    t.skip('加仓后持仓线更新', '缺同一仓位加仓前后数量/均价及可控事件样本；本轮不提交真实交易');
    t.skip('限价单成交后挂单线消失', '缺既有测试挂单和受控成交/撮合事件；不能以撤单或价格变化代替成交');

    return t.result();
  }

  async function testChart009(page) {
    const t=createStepTracker(`${prefix}-CHART-009`);
    await goToPerps(page);
    const pairBefore=await currentPair(page);
    await _ssStep(page,t,'切换原生版主图',async()=>{
      await setChartMode(page,'native');
      await locator(page,'perps.chart.controls').waitFor({state:'visible',timeout:20000});
      if((await locator(page,'perps.chart.engine').innerText()).includes('TradingView')) throw Error('Native chart not selected');
      return `pair=${pairBefore}`;
    });
    await _ssStep(page,t,'真实刷新后原生版与交易对保持',async()=>{
      await reloadPerps(page,{navigate:goToPerps,ready:()=>locator(page,'perps.chart.controls').waitFor({state:'visible',timeout:20000})});
      if((await locator(page,'perps.chart.engine').innerText()).includes('TradingView')) throw Error('Native chart preference lost after real reload');
      if(await currentPair(page)!==pairBefore) throw Error('Pair changed after reload');
      return '真实 shell 文档已重新加载，原生版与交易对保持';
    });
    await _ssStep(page,t,'切换 TradingView 后仅一个有效主图',async()=>{
      await setChartMode(page,'tradingView');
      await waitForTVReady(page);
      if(!((await locator(page,'perps.chart.engine').innerText()).includes('TradingView'))) throw Error('TradingView not selected');
      return 'TradingView ready';
    });
    return t.result();
  }

  // ── Registry ────────────────────────────────────────────────

  const testCases = [
    { id: `${prefix}-CHART-009`, name: `${namePrefix}双引擎切换与真实刷新`, fn:testChart009, skipSteps:[] },
    { id: `${prefix}-CHART-001`, name: `${namePrefix}默认指标测试`, fn: testChart001, skipSteps: [] },
    { id: `${prefix}-CHART-002`, name: `${namePrefix}指标管理测试`, fn: testChart002, skipSteps: ['旧版收藏指标', '旧版取消收藏'] },
    { id: `${prefix}-CHART-003`, name: `${namePrefix}画图工具测试`, fn: testChart003, skipSteps: [] },
    { id: `${prefix}-CHART-004`, name: `${namePrefix}K线时间周期测试`, fn: testChart004, skipSteps: ['旧版自定义时间周期设置', '旧版自定义时间周期刷新'] },
    { id: `${prefix}-CHART-005`, name: `${namePrefix}图表叠加显示测试`, fn: testChart005, skipSteps: ['多账户叠加线对账', '叠加线实际绘制', '多个限价单'] },
    { id: `${prefix}-CHART-006`, name: `${namePrefix}视图布局测试`, fn: testChart006, skipSteps:['指标重置布局与默认 Volume'] },
    { id: `${prefix}-CHART-007`, name: `${namePrefix}异常与边界场景`, fn: testChart007, skipSteps: ['清空图表存储默认恢复', '存储不足提示', '大量指标性能', '大量画图性能'] },
    { id: `${prefix}-CHART-008`, name: `${namePrefix}跨交易对测试`, fn: testChart008, skipSteps: ['加仓后持仓线更新', '限价单成交后线消失'] },
  ];

  for (const tc of testCases) {
    const run=tc.fn;
    tc.fn=async (page)=>{
      page.setDefaultTimeout(15000);
      await goToPerps(page);
      const pairBefore=await currentPair(page);
      const formBefore=await snapshotNonOrderForm(page);
      const original=(await locator(page,'perps.chart.engine').innerText()).includes('TradingView')?'tradingView':'native';
      let intervalBefore;
      let result;
      try {
        if(!tc.id.endsWith('-009')) {
          await setChartMode(page,'tradingView');await waitForTVReady(page);
          intervalBefore=(await getTimeIntervals(page)).find(i=>i.active)?.aria;
        }
        result=await run(page);return result;
      }
      finally {
        try {
          await page.keyboard.press('Escape');
          if(intervalBefore) await clickTimeInterval(page,intervalBefore);
          await restorePair(page,pairBefore);
          await setChartMode(page,original);
          await restoreNonOrderForm(page,formBefore);
        } catch(error) {
          const failure=markRestoreFailure(result,error,'恢复图表及原表单');
          if(!result) throw failure;
        }
      }
    };
  }

  let _preReport = null;
  async function setup(page) {
    await goToPerps(page);
    await sleep(2000);
    _preReport ??= await runPreconditions(page, testCases.map(tc => tc.id));
    if (!_preReport.canRun) throw new Error('Perps 前置检查未通过');
    return _preReport;
  }

  return { testCases, setup, ALL_TEST_IDS };
}
