// Existing TradingView webview only; use real Electron pointer input for the
// context menu. Read-only model readiness, no invoke of a product order handler.
import assert from "node:assert/strict";
import { locator, setChartMode, currentPair } from "../../helpers/perps-ui.mjs";
import {waitInstrumentBoundary} from './instrument-readiness.mjs';
import {tradingViewSymbolMatches} from './trading-view-chart-state.mjs';
import { desktopTvEval } from "../../helpers/perps-chart-eval.mjs";
import { closePop } from "./non-order-ui.mjs";
import { markRestoreFailure } from "./runtime.mjs";
const view = (p) => p.locator("webview").filter({ visible: true });
async function read(p, code) {
  let timer;
  try {
    return await Promise.race([
      desktopTvEval(p, code),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(Error("TradingView preview read timed out")),
          5000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export async function withTradingViewChart(p, fn) {
  const engine = (await locator(p, "perps.chart.engine").innerText()).includes(
    "TradingView",
  )
    ? "tradingView"
    : "original";
  let primary;
  try {
    const instrument = await waitInstrumentBoundary(p, await currentPair(p), locator(p, 'perps.form.root'));
    const expectedCoin = instrument.instruments[0].coin;
    await setChartMode(p, "tradingView");
    const deadline = Date.now() + 30000;
    let ready = false,
      last;
    while (Date.now() < deadline) {
      try {
        const state = await read(
          p,
          "const chart=doc.defaultView.tradingViewApi?.activeChart();return {ready:!!chart,symbol:chart?.symbol()};",
        );
        last = state;
        ready = state.ready && tradingViewSymbolMatches(state.symbol, expectedCoin);
        if (ready) break;
      } catch (e) {
        last = e;
      }
      await p.waitForTimeout(200);
    }
    assert.ok(
      ready,
      `Actual TradingView chart for ${expectedCoin} required: ${JSON.stringify(last)}`,
    );
    assert.equal(await view(p).count(), 1);
    return await fn();
  } catch (e) {
    primary = e;
    throw e;
  } finally {
    try {
      if (await view(p).count())
        await view(p).evaluate((wv) => {
          for (const type of ["keyDown", "keyUp"])
            wv.sendInputEvent({ type, keyCode: "Escape" });
        });
      await closePop(p);
      await setChartMode(p, engine);
      assert.equal(
        (await locator(p, "perps.chart.engine").innerText()).includes(
          "TradingView",
        ),
        engine === "tradingView",
      );
    } catch (e) {
      throw markRestoreFailure(primary, e, "恢复TradingView预览的原引擎");
    }
  }
}
async function openTradingViewOrder(p, suffix) {
  assert.ok(["限价", "止盈"].includes(suffix));
  const box = await read(
    p,
    `const canvases=[...doc.querySelectorAll('canvas')].map(e=>e.getBoundingClientRect()).filter(r=>r.width>200&&r.height>150).sort((a,b)=>b.width*b.height-a.width*a.height);if(!canvases.length)throw Error('No TradingView plot');const r=canvases[0],off=doc.defaultView.frameElement.getBoundingClientRect();return {x:Math.round(off.x+r.x+r.width*.5),y:Math.round(off.y+r.y+r.height*.3)};`,
  );
  await view(p).evaluate((wv, point) => {
    wv.focus();
    for (const type of ["mouseMove", "mouseDown", "mouseUp"])
      wv.sendInputEvent({ type, ...point, button: "right", clickCount: 1 });
  }, box);
  let item;
  const deadline = Date.now() + 10000;
  do {
    item = await read(
      p,
      `const suffix=${JSON.stringify(suffix)};const root=doc.querySelector('[data-name="menu-inner"]');const items=root?[...root.querySelectorAll('span')].filter(e=>!e.querySelector('span')&&e.innerText.trim().endsWith(suffix)&&/^交易\\s+.+\\s+@\\s*[\\d,.]+/u.test(e.innerText.trim())):[];if(items.length>1)throw Error('Ambiguous TradingView limit entry');if(!items.length)return null;const e=items[0],r=e.getBoundingClientRect(),off=doc.defaultView.frameElement.getBoundingClientRect();return {label:e.innerText.trim(),x:Math.round(off.x+r.x+r.width/2),y:Math.round(off.y+r.y+r.height/2)};`,
    );
    if (item) break;
    await p.waitForTimeout(100);
  } while (Date.now() < deadline);
  assert.ok(item, "Visible TradingView limit context action");
  const match = item.label.match(/@\s*([\d,.]+)\s*(?:限价|止盈)/u);
  assert.ok(match);
  const selected = match[1].replaceAll(",", "");
  assert.ok(Number(selected) > 0);
  await view(p).evaluate(
    (wv, point) => {
      wv.focus();
      for (const type of ["mouseMove", "mouseDown", "mouseUp"])
        wv.sendInputEvent({ type, ...point, button: "left", clickCount: 1 });
    },
    { x: item.x, y: item.y },
  );
  await p
    .getByRole("dialog")
    .filter({ visible: true })
    .waitFor({ state: "visible" });
  return { selected, label: item.label };
}

export const openTradingViewLimit = (p) => openTradingViewOrder(p, "限价");
export const openTradingViewTpsl = (p) => openTradingViewOrder(p, "止盈");
