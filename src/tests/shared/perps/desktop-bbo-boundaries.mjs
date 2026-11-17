// D01 手动用例：docs/qa/testcases/cases/perps/2026-01-03_Perps-限价单最优价格BBO.md
// Desktop BBO controls. No submit/confirm handler is invoked.
// Manual D01 §1/2/8; amounts/actual live-order prices are separately scoped.
import assert from "node:assert/strict";
import { locator, restorePair } from "../../helpers/perps-ui.mjs";
import { chooseMode, priceInput, closePop, pollForm } from "./non-order-ui.mjs";
import { createDesktopRowSuite, SampleUnavailable } from "./desktop-row-suite.mjs";
import { openLanguage, changeLocale } from "./language-settings.mjs";
import { reloadPerps, markRestoreFailure } from "./runtime.mjs";
import { unlockWalletIfNeeded } from "../../helpers/index.mjs";
import { projectReactAll } from "./react-projection.mjs";
import { assertBboPriceState } from "./bbo-price-evidence.mjs";
import {
  prepareBboPreview,
  assertBboPreview,
  readBboForm,
} from "./desktop-bbo-preview.mjs";
const labels = ["对手价 1", "对手价 5", "同向价 1", "同向价 5"];
const toggle = (p) => locator(p, "perps.perp-bbo-toggle-button");
const selector = (p) => locator(p, "perps.form.bbo_selector");
const panel = (p) => locator(p, "perps.overlay.popover");
const modeRows = ["D01-31", "D01-32", "D01-33", "D01-34"];
const modes = labels.map((label, i) => ({
  label,
  type: i < 2 ? "counterparty" : "queue",
  offsetTicks: i % 2 ? 5 : 0,
}));
async function prices(p, fixture) {
  const buttons = locator(p, "perps.perp-long-button").or(
    locator(p, "perps.perp-short-button"),
  );
  const read = () =>
    projectReactAll(buttons, (fiber) => {
      const snapshots = [],
        books = new Map();
      for (let f = fiber; f; f = f.return) {
        if (!(f.type?.displayName || f.type?.name)?.includes("SideButton"))
          continue;
        const hooks = new Set();
        for (let h = f.memoizedState, n = 0; h; h = h.next, n++) {
          if (n >= 4096 || hooks.has(h))
            throw Error("BBO hook chain cyclic or too long");
          hooks.add(h);
          const actual = h.memoizedState?.current;
          if (
            actual?.activeTradeInstrument &&
            actual.formData &&
            actual.computedSizeForSide &&
            actual.effectivePriceBN &&
            actual.side
          ) {
            snapshots.push({
              coin: actual.activeTradeInstrument.coin,
              spot: actual.isSpot,
              side: actual.side,
              type: actual.formData.type,
              advanced: Boolean(
                actual.isScaleMode || actual.isTriggerMode || actual.isTwapMode,
              ),
              mode: actual.formData.bboPriceMode,
              price: actual.effectivePriceBN.toFixed(),
              priceError: actual.priceError,
              szDecimals: actual.szDecimals,
            });
          }
          const seen = new Set();
          const visit = (v, d) => {
            if (!v || typeof v !== "object" || d > 4 || seen.has(v)) return;
            seen.add(v);
            if (
              Array.isArray(v.bbo) &&
              v.bbo.length === 2 &&
              v.coin &&
              v.bbo.every((r) => r?.px !== undefined)
            ) {
              const b = {
                coin: v.coin,
                time: v.time,
                bid: String(v.bbo[0].px),
                ask: String(v.bbo[1].px),
              };
              books.set(JSON.stringify(b), b);
            }
            for (const k of ["0", "1", "value", "v", "current"])
              if (Object.hasOwn(v, k)) visit(v[k], d + 1);
          };
          visit(h.memoizedState, 0);
        }
      }
      if (snapshots.length !== 1)
        throw Error(
          `One committed BBO button state required, got ${snapshots.length}`,
        );
      return { ...snapshots[0], books: [...books.values()], now: Date.now() };
    });
  const states = await pollForm(
    read,
    (values) =>
      values.length === 2 &&
      values.every(
        (s) =>
          s.coin === fixture.coin &&
          s.priceError === null &&
          Number(s.price) > 0 &&
          s.books.length === 1,
      ),
    "Both BBO sides and raw quotes ready",
  );
  assert.deepEqual(states.map((s) => s.side).sort(), ["long", "short"]);
  return states.map((state) => assertBboPriceState(state, fixture));
}
async function enabled(p, value) {
  if ((await selector(p).count()) > 0 !== value) await toggle(p).click();
  await pollForm(
    () => selector(p).count(),
    (n) => (value ? n === 1 : n === 0),
    "BBO toggle",
  );
}
async function options(p, selected, expected = labels) {
  await selector(p).click();
  await panel(p)
    .getByText(expected[0], { exact: true })
    .waitFor({ state: "visible" });
  const text = (await panel(p).innerText())
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
  assert.deepEqual(text, expected, "Four translated BBO options in manual-case order");
  const checked = await panel(p)
    .locator('svg[data-sentry-component="SvgCheckLarge"]')
    .evaluateAll((es) => es.map((e) => e.parentElement.innerText.trim()));
  assert.deepEqual(checked, [selected]);
}
async function select(p, label, expected = labels) {
  await options(p, (await selector(p).innerText()).split("\n").at(-1).trim(), expected);
  await panel(p).getByText(label, { exact: true }).click();
  await panel(p).waitFor({ state: "hidden" });
  assert.equal(
    (await selector(p).innerText()).split("\n").at(-1).trim(),
    label,
  );
  await options(p, label, expected);
  await closePop(p);
}
const row = (ids, name, check, extra = {}) => ({
  ids: ids.split(","),
  name,
  check,
  ...extra,
});
export const bboBoundaryDefinitions = [
  {
    id: "PERPS-DESKTOP-BBO-001",
    name: "Desktop 最优价 §1 四选项与选中标识",
    rows: [
      row("D01-19", "限价开启默认对手价1及四项顺序", async (p) => {
        await restorePair(p, "BTCUSDC");
        await chooseMode(p, "限价单");
        await enabled(p, false);
        await enabled(p, true);
        await options(p, labels[0]);
        await closePop(p);
        return "默认对手价1；四个选项数量/顺序与唯一勾选逐项核对";
      }),
      row("D01-20", "系统中英切换后四选项文案及逐项勾选", async (p) => {
        const instrument = (await readBboForm(p)).instrument;
        const initial = await openLanguage(p);
        const navigate = async (page) => {
          await unlockWalletIfNeeded(page);
          await locator(page, "global.sidebar.perps").click();
          await locator(page, "perps.form.root").waitFor({ state: "visible", timeout: 45000 });
        };
        const reload = (page) => reloadPerps(page, { navigate, ready: async () => {} });
        const context = { navigate, reload };
        if (!["zh-CN", "en"].includes(initial.rawLocale)) {
          await reload(p);
          throw new SampleUnavailable("本行仅验证中英文；保留其他系统语言，不推断其翻译预期");
        }
        let primary;
        try {
          for (const [locale, tab, expected] of [
            ["zh-CN", "限价单", labels],
            ["en", "Limit", ["Counterparty 1", "Counterparty 5", "Queue 1", "Queue 5"]],
          ]) {
            await changeLocale(p, locale, context);
            await locator(p, "perps.form.root").getByText(tab, { exact: true }).click();
            const current = await pollForm(() => readBboForm(p), s => s.form.type === "limit", "Localized limit form ready");
            assert.equal(current.instrument.coin, instrument.coin, "Language reload preserves active coin");
            assert.equal(current.instrument.mode, instrument.mode, "Language reload preserves spot/perp mode");
            await enabled(p, false);
            await enabled(p, true);
            await options(p, expected[0], expected);
            await closePop(p);
            for (const [i, label] of expected.entries()) {
              await select(p, label, expected);
              const form = (await readBboForm(p)).form;
              assert.deepEqual(form.bboPriceMode, {
                type: i < 2 ? "counterparty" : "queue",
                offsetTicks: i % 2 ? 5 : 0,
              }, "Translated selection must update the corresponding actual BBO mode");
            }
          }
          return "实际系统语言切换与重载；中英四项文案/数量/顺序、5档及逐项唯一勾选；不点击交易按钮";
        } catch (error) {
          primary = error;
          throw error;
        } finally {
          try {
            await changeLocale(p, initial.rawLocale, context);
            assert.equal((await openLanguage(p)).rawLocale, initial.rawLocale, "Original language read back after restoration");
            await reload(p);
          } catch (error) {
            throw markRestoreFailure(primary, error, "恢复原系统语言");
          }
        }
      }),
      ...modes.map((mode, i) =>
        row(
          modeRows[i],
          `${mode.label}买卖两侧实际价格与独立盘口网格`,
          async (p) => {
            await restorePair(p, "BTCUSDC");
            await chooseMode(p, "限价单");
            await enabled(p, true);
            await select(p, mode.label);
            return JSON.stringify(await prices(p, { coin: "BTC", ...mode }));
          },
        ),
      ),
      row("D01-35", "BTC与低价kPEPE的5步长与有效价格网格", async (p) => {
        const results = [];
        for (const [pair, coin] of [
          ["BTCUSDC", "BTC"],
          ["kPEPEUSDC", "kPEPE"],
        ]) {
          await restorePair(p, pair);
          await chooseMode(p, "限价单");
          await enabled(p, true);
          for (const mode of modes.filter((m) => m.offsetTicks === 5)) {
            await select(p, mode.label);
            const quote = await prices(p, { coin, ...mode });
            assert.ok(
              quote.every((q) =>
                coin === "BTC" ? Number(q.bid) > 10000 : Number(q.ask) < 0.01,
              ),
              "Actual large/small price sample required",
            );
            results.push({ coin, label: mode.label, quote });
          }
        }
        return JSON.stringify(results);
      }),
      row("D01-37", "四选项连续切换无残留", async (p) => {
        await restorePair(p, "BTCUSDC");
        await chooseMode(p, "限价单");
        await enabled(p, true);
        const result = [];
        for (const mode of modes) {
          await select(p, mode.label);
          result.push(await prices(p, { coin: "BTC", ...mode }));
        }
        return JSON.stringify(result);
      }),
    ],
  },
  {
    id: "PERPS-DESKTOP-BBO-002",
    name: "Desktop 最优价 §2 手动价格与绑定入口",
    rows: [
      row("D01-45", "最优价名称、双向金额/成本及强平价独立计算", async (p) => {
        await restorePair(p, "BTCUSDC");
        await chooseMode(p, "限价单");
        await enabled(p, false);
        const manualPrice = await priceInput(p, "价格");
        await manualPrice.fill("12345");
        await enabled(p, true);
        assert.equal(
          (await selector(p).innerText()).split("\n").at(-1).trim(),
          labels[0],
          "Enabling BBO resets the default to counterparty 1",
        );
        await prepareBboPreview(p);
        const observed = [];
        for (const mode of modes) {
          await select(p, mode.label);
          assert.equal(
            await manualPrice.count(),
            0,
            "Existing manual price locator must become absent when BBO is enabled",
          );
          observed.push({
            label: mode.label,
            values: await assertBboPreview(p, { coin: "BTC", ...mode }),
          });
        }
        return JSON.stringify({ manualInputRemoved: true, observed });
      }),
      row("D01-47", "关闭后手动输入，再启用重置默认且移除手动值", async (p) => {
        await restorePair(p, "BTCUSDC");
        await chooseMode(p, "限价单");
        await enabled(p, true);
        await select(p, labels[3]);
        await enabled(p, false);
        const input = await priceInput(p, "价格");
        await input.fill("12345");
        assert.equal(await input.inputValue(), "12345");
        await enabled(p, true);
        assert.equal(
          (await selector(p).innerText()).split("\n").at(-1).trim(),
          labels[0],
        );
        await select(p, labels[2]);
        return JSON.stringify(await prices(p, { coin: "BTC", ...modes[2] }));
      }),
    ],
  },
  {
    id: "PERPS-DESKTOP-BBO-008",
    name: "Desktop 最优价 §8 现货入口与模式隔离",
    selectorPreferences: true,
    rows: [
      row("D01-103", "HYPE/USDC限价最优价四选项", async (p) => {
        await restorePair(p, "HYPE/USDC");
        await chooseMode(p, "限价单");
        assert.equal(await toggle(p).count(), 1);
        await enabled(p, false);
        await enabled(p, true);
        await options(p, labels[0]);
        await closePop(p);
        for (const label of labels) await select(p, label);
        return "真实现货限价入口、四选项及每项唯一勾选";
      }),
      row(
        "D01-106",
        "永续→现货重置、现货→永续保留，逐次核对各自盘口",
        async (p) => {
          const observed = [];
          await restorePair(p, "BTCUSDC");
          await chooseMode(p, "限价单");
          await enabled(p, true);
          await select(p, labels[3]);
          observed.push({
            pair: "BTCUSDC",
            quotes: await prices(p, { coin: "BTC", ...modes[3] }),
          });
          for (const mode of [modes[1], modes[2]]) {
            await restorePair(p, "HYPE/USDC");
            // Read and assert the switch result before choosing an order type,
            // enabling BBO or selecting anything in the target mode.
            const switchedSpot = await readBboForm(p);
            assert.equal(switchedSpot.instrument.mode, "spot");
            assert.equal(switchedSpot.form.type, "market");
            assert.equal(switchedSpot.form.bboPriceMode, null);
            assert.equal(await selector(p).count(), 0);
            await chooseMode(p, "限价单");
            assert.equal(
              await selector(p).count(),
              0,
              "Choosing limit alone must not restore the old BBO mode",
            );
            await enabled(p, true);
            assert.equal(
              (await selector(p).innerText()).split("\n").at(-1).trim(),
              labels[0],
            );
            await select(p, mode.label);
            const spot = await readBboForm(p);
            const spotQuotes = await prices(p, {
              coin: spot.instrument.coin,
              ...mode,
            });
            await restorePair(p, "BTCUSDC");
            const returned = await readBboForm(p);
            assert.equal(returned.instrument.mode, "perp");
            assert.equal(returned.instrument.coin, "BTC");
            assert.equal(returned.form.type, "limit");
            assert.deepEqual(
              returned.form.bboPriceMode,
              spot.form.bboPriceMode,
              "Return branch preserves the current form; no reselection is allowed before this assertion",
            );
            assert.equal(
              (await selector(p).innerText()).split("\n").at(-1).trim(),
              mode.label,
            );
            const perpQuotes = await prices(p, { coin: "BTC", ...mode });
            observed.push({
              spot: spot.instrument.coin,
              selected: mode.label,
              spotQuotes,
              perpQuotes,
            });
          }
          return JSON.stringify(observed);
        },
      ),
    ],
  },
];
export const bboBoundarySuite = createDesktopRowSuite(bboBoundaryDefinitions);
