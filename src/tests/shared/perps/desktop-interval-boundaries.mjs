// D04 手动用例：docs/qa/testcases/cases/perps/2026-01-21_Perps-TV图表功能与设置.md
// Desktop chart interval preferences: real clicks, model resolution, real reload.
import assert from "node:assert/strict";
import { locator, setChartMode } from "../../helpers/perps-ui.mjs";
import { desktopTvEval } from "../../helpers/perps-chart-eval.mjs";
import { projectReactAll } from "./react-projection.mjs";
import {
  createDesktopRowSuite,
  SampleUnavailable,
} from "./desktop-row-suite.mjs";
import { closePop, pollForm } from "./non-order-ui.mjs";
import { reloadPerps, markRestoreFailure } from "./runtime.mjs";
import { recordBeforeRestore } from "./restore-diagnostics.mjs";
import { PerpsPage } from "../../helpers/pages/perps.mjs";
const loc = (p, key) => locator(p, "perps.chart." + key);
const panel = (p) =>
  locator(p, "perps.overlay.popover").filter({ has: loc(p, "interval_all") });
async function resolution(p) {
  if (
    await p
      .getByText("网络连接出现问题，请检查网络后刷新页面。", { exact: true })
      .isVisible()
  )
    throw new SampleUnavailable(
      "TradingView嵌入页显示网络错误，未读取到图表；未修改偏好",
    );
  let timer;
  try {
    return await Promise.race([
      desktopTvEval(
        p,
        "return doc.defaultView.tradingViewApi.activeChart().resolution();",
      ),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(Error("TradingView只读resolution调用超时")),
          5000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
const row = (id, name, check, extra = {}) => ({
  ids: [id],
  name,
  check,
  ...extra,
});
async function open(p) {
  if (await panel(p).count()) return;
  await closePop(p);
  await loc(p, "interval_more").hover();
  await p.waitForTimeout(400);
  await loc(p, "interval_more").click();
  await panel(p).waitFor({ state: "visible" });
}
async function config(p) {
  const [v] = await projectReactAll(loc(p, "interval_more"), (f) => {
    for (; f; f = f.return) {
      const c = f.memoizedProps?.intervalConfig;
      if (c?.activeInterval && Array.isArray(c.intervals))
        return { active: c.activeInterval, options: c.intervals };
    }
    throw Error("Committed interval configuration required");
  });
  return v;
}
async function preferred(p) {
  await open(p);
  return loc(p, "interval_preferred").evaluateAll((es) =>
    es.map((e) => ({
      text: e.innerText.trim(),
      value: e.dataset.testid.slice(
        "trading-view-native-interval-preferred-".length,
      ),
    })),
  );
}
async function editState(p) {
  return loc(p, "interval_edit_items").evaluateAll((es) =>
    es.map((e) => ({
      value: e.dataset.testid.slice(
        "trading-view-native-interval-edit-".length,
      ),
      text: e.innerText.trim(),
      checked: !!e.querySelector(
        'svg[data-sentry-component="SvgCheckmark1Small"]',
      ),
    })),
  );
}
async function editTo(p, values) {
  await open(p);
  await loc(p, "interval_edit").click();
  await loc(p, "interval_edit_items").first().waitFor({ state: "visible" });
  const initial = await editState(p);
  assert.ok(
    values.every((v) => initial.some((e) => e.value === v)),
    "All requested preference options available",
  );
  const clickValue = async (value) => {
    const option = initial.find((e) => e.value === value);
    assert.ok(option);
    await loc(p, "interval_edit_items")
      .filter({ has: p.getByText(option.text, { exact: true }) })
      .click();
  };
  for (const item of initial)
    if (item.checked && !values.includes(item.value))
      await clickValue(item.value);
  for (const value of values)
    if (!(await editState(p)).find((e) => e.value === value).checked)
      await clickValue(value);
  assert.deepEqual(
    (await editState(p))
      .filter((e) => e.checked)
      .map((e) => e.value)
      .sort(),
    [...values].sort(),
    "Actual edit checkmarks match requested set",
  );
  await loc(p, "interval_confirm").click();
  await closePop(p);
  await pollForm(
    () => preferred(p),
    (s) => JSON.stringify(s.map((e) => e.value)) === JSON.stringify(values),
    "Saved preference order",
  );
  await closePop(p);
}
async function select(p, value) {
  await open(p);
  const options = await loc(p, "interval_all").evaluateAll((es) =>
    es.map((e) => ({
      value: e.dataset.testid.slice("trading-view-native-interval-all-".length),
      text: e.innerText.trim(),
    })),
  );
  const option = options.find((e) => e.value === value);
  assert.ok(option, `Interval ${value} listed`);
  await loc(p, "interval_all")
    .filter({ has: p.getByText(option.text, { exact: true }) })
    .click();
  // Even selecting the already-active interval closes the panel asynchronously.
  // Wait for the departing tree before opening a new panel.
  await panel(p).waitFor({ state: "hidden" });
  await pollForm(
    () => config(p),
    (s) => s.active === value,
    "Committed active interval",
  );
  await pollForm(
    () => resolution(p),
    (s) =>
      s ===
      (/H$/u.test(value) ? String(Number(value.slice(0, -1)) * 60) : value),
    "Actual TradingView resolution",
    30000,
  );
  return option.text;
}
async function waitResolution(p) {
  const deadline = Date.now() + 30000;
  let last;
  // Activating the existing CDP target also covers a newly mounted WebView.
  await p.bringToFront();
  do {
    try {
      return await resolution(p);
    } catch (error) {
      if (error instanceof SampleUnavailable) throw error;
      if (
        !/超时|not ready|not found|Cannot read properties of undefined|Cannot read properties of null/u.test(
          error.message,
        )
      )
        throw error;
      last = error;
      await p.waitForTimeout(250);
    }
  } while (Date.now() < deadline);
  throw last;
}
async function reload(p) {
  await reloadPerps(p, {
    navigate: () => new PerpsPage(p).navigate(),
    ready: async () => {
      await p.bringToFront();
      await loc(p, "interval_more").waitFor({
        state: "visible",
        timeout: 45000,
      });
    },
  });
  await waitResolution(p);
}
/** Restore only nonfinancial chart settings through the actual controls. */
export async function restoreChartIntervals(p, { active, preferences }) {
  await closePop(p);
  if (
    JSON.stringify((await preferred(p)).map((e) => e.value)) !==
    JSON.stringify(preferences)
  )
    await editTo(p, preferences);
  await select(p, active);
  assert.deepEqual(
    (await preferred(p)).map((e) => e.value),
    preferences,
  );
  assert.equal((await config(p)).active, active);
  await closePop(p);
}
async function withIntervals(p, check) {
  await closePop(p);
  const engine = (await loc(p, "engine").innerText()).includes("TradingView")
    ? "tradingView"
    : "original";
  let before, primary;
  try {
    await setChartMode(p, "tradingView");
    await waitResolution(p);
    before = {
      active: (await config(p)).active,
      preferred: await preferred(p),
    };
    await closePop(p);
    return await check();
  } catch (e) {
    primary = e;
    await recordBeforeRestore(p, "interval", e);
    throw e;
  } finally {
    try {
      await closePop(p);
      if (before) {
        if (
          JSON.stringify(await preferred(p)) !==
          JSON.stringify(before.preferred)
        )
          await editTo(
            p,
            before.preferred.map((e) => e.value),
          );
        await select(p, before.active);
        assert.deepEqual(await preferred(p), before.preferred);
        await closePop(p);
      }
      await setChartMode(p, engine);
    } catch (e) {
      throw markRestoreFailure(primary, e, "恢复图表周期和全部偏好");
    }
  }
}
const defaults = ["1", "15", "1H", "4H"],
  changed = ["15", "1H", "4H", "1D"];
export const intervalDefinitions = [
  {
    id: "PERPS-DESKTOP-INTERVAL-001",
    name: "Desktop 图表全部周期及偏好编辑",
    rows: [
      row("D04-79", "全部预设周期与真实可见标签", (p) =>
        withIntervals(p, async () => {
          await open(p);
          const actual = await loc(p, "interval_all").allTextContents();
          for (const t of [
            "1分",
            "3分",
            "5分",
            "15分",
            "30分",
            "1时",
            "2时",
            "4时",
            "8时",
            "12时",
            "1日",
          ])
            assert.equal(
              actual.filter((v) => v.trim() === t).length,
              1,
              `Unique preset ${t}`,
            );
          return "11项手动要求的预设周期在完整周期面板逐项可见且无重复";
        }),
      ),
      row("D04-80", "15分钟切换一小时并核对图表模型", (p) =>
        withIntervals(p, async () => {
          await select(p, "15");
          const label = await select(p, "1H");
          assert.equal(label, "1时");
          await closePop(p);
          assert.match(await loc(p, "controls").innerText(), /1时/u);
          return "从15分钟真实点击1小时，选择器标签1时且TradingView resolution=60";
        }),
      ),
      row("D04-86", "取消1分添加1日并保存四项偏好", (p) =>
        withIntervals(p, async () => {
          await editTo(p, defaults);
          await editTo(p, changed);
          assert.deepEqual(
            (await preferred(p)).map((e) => e.text),
            ["15分", "1时", "4时", "1日"],
          );
          assert.equal(
            await panel(p)
              .locator('svg[data-sentry-component*="Star"]')
              .count(),
            0,
          );
          await closePop(p);
          const labels = await loc(p, "controls")
            .locator('[data-sentry-component="SegmentControlItem"]')
            .allTextContents();
          assert.deepEqual(
            labels.map((e) => e.trim()),
            ["15分", "1时", "4时", "1日"],
          );
          return "真实编辑勾选与保存列表、四个快捷项顺序一致，无1分及旧星形入口";
        }),
      ),
      row("D04-93", "预设列表编辑入口及无旧自定义输入", (p) =>
        withIntervals(p, async () => {
          await open(p);
          const actual = await loc(p, "interval_all").evaluateAll((es) =>
            es.map((e) => ({
              id: e.dataset.testid,
              text: e.innerText.trim(),
              w: e.getBoundingClientRect().width,
              h: e.getBoundingClientRect().height,
            })),
          );
          assert.deepEqual(
            actual.map((e) => e.text),
            [
              "1分",
              "3分",
              "5分",
              "15分",
              "30分",
              "1时",
              "2时",
              "4时",
              "8时",
              "12时",
              "1日",
              "3日",
              "1周",
              "1月",
            ],
          );
          assert.equal(actual.length, 14);
          assert.equal(new Set(actual.map((e) => e.id)).size, 14);
          assert.ok(actual.every((e) => e.text && e.w > 0 && e.h > 0));
          assert.equal(await loc(p, "interval_edit").count(), 1);
          assert.equal(await panel(p).locator("input").count(), 0);
          return "14个预设周期可见且唯一，编辑入口一处，无旧自定义周期输入框";
        }),
      ),
    ],
  },
  {
    id: "PERPS-DESKTOP-INTERVAL-002",
    name: "Desktop 周期与偏好真实刷新持久化",
    rows: [
      row("D04-94", "非偏好3日周期与偏好分别刷新保留", (p) =>
        withIntervals(p, async () => {
          await editTo(p, defaults);
          await select(p, "3D");
          assert.equal(await loc(p, "interval_more").innerText(), "3日");
          assert.deepEqual(
            (await preferred(p)).map((e) => e.value),
            defaults,
          );
          await closePop(p);
          await reload(p);
          assert.equal((await config(p)).active, "3D");
          assert.equal(await resolution(p), "3D");
          assert.equal(await loc(p, "interval_more").innerText(), "3日");
          assert.deepEqual(
            (await preferred(p)).map((e) => e.value),
            defaults,
          );
          return "选择3日实际加载3D，真实刷新后当前周期和原四项偏好分别保留";
        }),
      ),
    ],
  },
];
export const intervalSuite = createDesktopRowSuite(intervalDefinitions);
