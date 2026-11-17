// D16 手动用例：docs/qa/testcases/cases/perps/2026-08-28_Perps-K线布局设置.md
// Desktop split panes: actual pointer drags, saved state is read-only diagnostic
// evidence. Restore through reset/drag/book controls; never write the atom.
import assert from "node:assert/strict";
import {
  activeToasts,
  dismissCurrentValidationToasts,
} from "./validation-toasts.mjs";
import { isDeepStrictEqual } from "node:util";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { RESULTS_DIR } from "../../helpers/index.mjs";
import { projectReactAll } from "./react-projection.mjs";
import { locator, restorePair, closePairs } from "../../helpers/perps-ui.mjs";
import { closePop, pollForm } from "./non-order-ui.mjs";
import {
  createDesktopRowSuite,
  SampleUnavailable,
} from "./desktop-row-suite.mjs";
import { markRestoreFailure, reloadPerps } from "./runtime.mjs";
import { recordBeforeRestore } from "./restore-diagnostics.mjs";
import { PerpsPage } from "../../helpers/pages/perps.mjs";
const root = (p) => locator(p, "perps.layout.root");
const sash = (p) => locator(p, "perps.chart.layout_separator");
const pop = (p) => locator(p, "perps.overlay.popover");
const row = (ids, name, check, extra = {}) => ({
  ids: ids.split(","),
  name,
  check,
  ...extra,
});
export async function layoutState(p) {
  const values = (
    await projectReactAll(root(p), (f) => {
      const result = [];
      for (; f; f = f.return) {
        if (
          !(f.type?.displayName || f.type?.name)?.includes("PerpDesktopLayout")
        )
          continue;
        for (let h = f.memoizedState, n = 0; h && n < 200; h = h.next, n++) {
          const seen = new Set();
          const visit = (v, d) => {
            if (!v || typeof v !== "object" || seen.has(v) || d > 5) return;
            seen.add(v);
            if (
              !Array.isArray(v) &&
              Object.keys(v).length < 8 &&
              ["chartHeight", "chartExpanded", "orderBook"].some((k) =>
                Object.hasOwn(v, k),
              )
            )
              result.push(
                Object.fromEntries(
                  ["chartHeight", "chartExpanded", "orderBook", "resetAt"]
                    .filter((k) => Object.hasOwn(v, k))
                    .map((k) => [k, v[k]]),
                ),
              );
            for (const k of ["0", "1", "value", "current", "v"])
              if (Object.hasOwn(v, k)) visit(v[k], d + 1);
          };
          visit(h.memoizedState, 0);
        }
      }
      return result;
    })
  ).flat();
  assert.ok(values.length, "Readable committed desktop layout state required");
  assert.ok(
    values.every((v) => isDeepStrictEqual(v, values[0])),
    "Unambiguous layout state",
  );
  return values[0];
}
export async function paneSizes(p) {
  return locator(p, "perps.layout.panes").evaluateAll((es) =>
    es.map((e) => e.getBoundingClientRect().height),
  );
}
async function ready(p) {
  await closePairs(p);
  await closePop(p);
  assert.equal(await root(p).count(), 1);
  assert.equal(await sash(p).count(), 1);
  assert.equal((await paneSizes(p)).length, 2);
}
async function dragTo(p, target, { shield = false } = {}) {
  await ready(p);
  await sash(p).scrollIntoViewIfNeeded();
  const before = await paneSizes(p),
    box = await sash(p).boundingBox();
  const x = box.x + Math.min(40, box.width / 2),
    y = box.y + box.height / 2;
  await p.mouse.move(x, y);
  assert.equal(
    await sash(p).evaluate((e) => getComputedStyle(e).cursor),
    "row-resize",
  );
  try {
    await p.mouse.down();
    await p.mouse.move(x, y + target - before[0], { steps: 20 });
    if (shield) {
      assert.equal(await locator(p, "perps.layout.drag_shield").count(), 1);
      assert.equal(
        await locator(p, "perps.layout.drag_shield").evaluate(
          (e) => getComputedStyle(e).cursor,
        ),
        "row-resize",
      );
    }
  } finally {
    await p.mouse.up();
  }
  await pollForm(
    () => paneSizes(p),
    (v) => Math.abs(v[0] - target) <= 1,
    "Dragged chart height",
  );
  assert.equal(
    await locator(p, "perps.layout.drag_shield").count(),
    0,
    "Shield removed after release",
  );
  await pollForm(
    () => layoutState(p),
    (s) => s.chartHeight === Math.round(target),
    "Persisted chart height",
  );
}
async function openMenu(p) {
  await closePairs(p);
  await closePop(p);
  await locator(p, "perps.settings.button").click();
  await locator(p, "perps.layout.reset").waitFor({ state: "visible" });
}
async function reset(p) {
  await activeToasts(p).evaluateAll(dismissCurrentValidationToasts);
  await pollForm(
    () => activeToasts(p).count(),
    (n) => n === 0,
    "Previous reset toasts removed",
  );
  await openMenu(p);
  await locator(p, "perps.layout.reset").click();
  await activeToasts(p)
    .filter({ hasText: "布局已重置" })
    .waitFor({ state: "visible" });
  await closePop(p);
  await pollForm(
    () => layoutState(p),
    (s) =>
      !Object.hasOwn(s, "chartHeight") &&
      (s.orderBook?.visible ?? true) === true,
    "Reset clears split override and restores visible order book",
  );
}
const bookControl = (p) =>
  locator(p, "perps.perp-icon-btn")
    .filter({
      has: p.locator(
        'svg[data-sentry-component="SvgChevronRightSmallSolid"],svg[data-sentry-component="SvgChevronLeftSmallSolid"]',
      ),
    })
    .filter({ visible: true });
async function setBook(p, visible) {
  const state = await layoutState(p);
  if ((state.orderBook?.visible ?? true) !== visible) {
    if ((await bookControl(p).count()) !== 1)
      throw new SampleUnavailable("当前窗口不显示订单簿开关；保持用户窗口尺寸");
    await bookControl(p).click();
  }
  await pollForm(
    () => layoutState(p),
    (s) => (s.orderBook?.visible ?? true) === visible,
    "Book preference",
  );
}
async function reload(p) {
  await reloadPerps(p, {
    navigate: async () => new PerpsPage(p).navigate(),
    ready: async () => root(p).waitFor({ state: "visible" }),
  });
}
async function fullscreen(p, expanded) {
  const trace = process.env.PERPS_TRACE_FULLSCREEN === "1";
  let traceBefore, primary;
  try {
    if (Boolean((await layoutState(p)).chartExpanded) !== expanded) {
      const control = locator(p, "perps.chart.fullscreen");
      await control.waitFor({ state: "visible", timeout: 20000 });
      // The first move from the split sash into this toolbar can replace its
      // control subtree. Observe that transition before sending a click, so
      // pointerdown and pointerup reach the same actual element.
      const beforeHover = await control.elementHandle();
      try {
        await control.hover();
        await p.waitForTimeout(400);
        const replaced = await beforeHover.evaluate((e) => !e.isConnected);
        if (trace)
          console.log("FULLSCREEN_HOVER " + JSON.stringify({ replaced }));
        await control.waitFor({ state: "visible" });
      } finally {
        await beforeHover.dispose();
      }
      if (trace)
        traceBefore = await control.evaluate((control) => {
          const records = [];
          const handler = (e) => {
            const r = control.getBoundingClientRect();
            records.push({
              type: e.type,
              trusted: e.isTrusted,
              x: e.clientX,
              y: e.clientY,
              hit: control.contains(e.target),
              path: e
                .composedPath()
                .slice(0, 5)
                .map((n) => ({ tag: n.tagName, testid: n.dataset?.testid })),
              controlRect: { x: r.x, y: r.y, width: r.width, height: r.height },
            });
          };
          for (const type of ["pointerdown", "pointerup", "click"])
            document.addEventListener(type, handler, true);
          window.__perpsFullscreenDiagnostic = {
            records,
            stop: () => {
              for (const type of ["pointerdown", "pointerup", "click"])
                document.removeEventListener(type, handler, true);
            },
          };
          const r = control.getBoundingClientRect();
          return {
            rect: { x: r.x, y: r.y, width: r.width, height: r.height },
            html: control.outerHTML,
            focused: document.hasFocus(),
            active: document.activeElement?.tagName,
          };
        });
      await control.click();
    }
    await pollForm(
      () => layoutState(p),
      (s) => Boolean(s.chartExpanded) === expanded,
      "Fullscreen state",
    );
  } catch (error) {
    primary = error;
    throw error;
  } finally {
    if (traceBefore) {
      try {
        const events = await p.evaluate(() => {
          const trace = window.__perpsFullscreenDiagnostic;
          trace?.stop();
          delete window.__perpsFullscreenDiagnostic;
          return trace?.records;
        });
        writeFileSync(
          resolve(
            RESULTS_DIR,
            "perps-desktop-completion",
            `fullscreen-events-${Date.now()}.json`,
          ),
          JSON.stringify(
            {
              expanded,
              before: traceBefore,
              events,
              after: await layoutState(p),
            },
            null,
            2,
          ),
        );
      } catch (error) {
        if (primary)
          console.error(`Fullscreen diagnostic also failed: ${error.message}`);
        else throw error;
      }
    }
  }
}

async function defaults(p) {
  const height = await p.evaluate(() => innerHeight);
  return [
    Math.round(Math.min(860, 588 * Math.max(height / 982, 1))),
    Math.round(Math.min(620, 480 * Math.max(height / 982, 1))),
  ];
}
async function withLayout(p, fn) {
  await ready(p);
  const before = await layoutState(p),
    sizes = await paneSizes(p),
    scroll = await root(p).evaluate((e) => e.scrollTop);
  assert.equal(
    before.chartExpanded ?? false,
    false,
    "Start outside fullscreen",
  );
  writeFileSync(
    resolve(
      RESULTS_DIR,
      "perps-desktop-completion",
      `layout-baseline-${Date.now()}.json`,
    ),
    JSON.stringify(
      { before, sizes, scroll, at: new Date().toISOString() },
      null,
      2,
    ),
  );
  let primary;
  try {
    return await fn();
  } catch (e) {
    primary = e;
    await recordBeforeRestore(p, "layout", e);
    try {
      writeFileSync(
        resolve(
          RESULTS_DIR,
          "perps-desktop-completion",
          `layout-failure-state-${Date.now()}.json`,
        ),
        JSON.stringify(
          {
            before,
            sizes,
            after: await layoutState(p),
            actualSizes: await paneSizes(p),
            error: e.message,
          },
          null,
          2,
        ),
      );
    } catch (diagnostic) {
      console.warn(`Layout state diagnostic failed: ${diagnostic.message}`);
    }
    throw e;
  } finally {
    try {
      await p.mouse.up();
      await closePop(p);
      await fullscreen(p, false);
      if (!isDeepStrictEqual(await layoutState(p), before)) {
        await reset(p);
        if (Object.hasOwn(before, "chartHeight"))
          await dragTo(p, before.chartHeight);
        if (Object.hasOwn(before, "orderBook"))
          await setBook(p, before.orderBook.visible);
      }
      assert.deepEqual(
        await layoutState(p),
        before,
        "Independent persisted layout readback",
      );
      const actual = await paneSizes(p);
      actual.forEach((h, i) =>
        assert.ok(Math.abs(h - sizes[i]) <= 1, "Original pane sizes restored"),
      );
      await root(p).evaluate((e, y) => (e.scrollTop = y), scroll);
    } catch (e) {
      const failure = markRestoreFailure(
        null,
        e,
        "恢复Desktop面板高度及订单簿",
      );
      if (primary)
        failure.message = `原步骤: ${primary.message}; ${failure.message}`;
      throw failure;
    }
  }
}
const definitions = [
  {
    id: "PERPS-DESKTOP-LAYOUT-005",
    name: "Desktop 布局 §5 面板拖动与持久化",
    rows: [
      row(
        "D16-111",
        "拖动光标、遮罩、双面板尺寸变化与松手保持",
        (p) =>
          withLayout(p, async () => {
            const before = await paneSizes(p),
              target = Math.min(before[0] + 40, before[0] + before[1] - 300);
            assert.ok(target > before[0], "Need 40px available drag range");
            await dragTo(p, target, { shield: true });
            const after = await paneSizes(p);
            assert.ok(after[1] < before[1]);
            assert.equal(
              Math.round(after[0] + after[1]),
              Math.round(before[0] + before[1]),
            );
            await p.waitForTimeout(300);
            assert.deepEqual(await paneSizes(p), after);
            return `真实拖动 ${before.join("/")}→${after.join("/")}，拖动遮罩可见且松手移除`;
          }),
        {
          complete: false,
          missing:
            "已验证真实拖动、遮罩和光标；尚未独立捕获图表未响应拖动期间鼠标事件，不据遮罩存在推断",
        },
      ),
      row("D16-112", "非默认高度真实刷新保留", (p) =>
        withLayout(p, async () => {
          await dragTo(p, 440);
          const before = await paneSizes(p);
          await reload(p);
          assert.deepEqual(await paneSizes(p), before);
          return `刷新后保持 ${before.join("/")}px`;
        }),
      ),
      row("D16-113", "图表最小360px与周期栏仍可操作", (p) =>
        withLayout(p, async () => {
          await dragTo(p, 360);
          const size = await paneSizes(p);
          assert.equal(Math.round(size[0]), 360);
          const period = locator(p, "perps.chart.interval_more");
          await period.waitFor({ state: "visible", timeout: 15000 });
          assert.equal(await period.isVisible(), true);
          await period.click();
          await closePop(p);
          return "最小图表360px，周期入口可见且可打开";
        }),
      ),
      row(
        "D16-114",
        "信息区最小300px及标签与首行可见",
        (p) =>
          withLayout(p, async () => {
            const size = await paneSizes(p);
            await dragTo(p, size[0] + size[1] - 300);
            assert.equal(Math.round((await paneSizes(p))[1]), 300);
            const tab = locator(p, "perps.position.tab");
            await tab.scrollIntoViewIfNeeded();
            assert.equal(await tab.isVisible(), true);
            await tab.click();
            const first = locator(p, "perps.position.table_body")
              .locator(":scope > div > div")
              .first();
            if (!(await first.count()))
              throw new SampleUnavailable("当前账户无持仓数据首行");
            assert.equal(await first.isVisible(), true);
            return "信息区300px，持仓标签可点击且首行可见";
          }),
        {
          complete: false,
          missing:
            "已验证300px、标签可点击和首行可见；未点击首行并独立验证目标详情，保持部分覆盖",
        },
      ),
      row("D16-115", "切换BTC与ETH保持非默认高度", (p) =>
        withLayout(p, async () => {
          await dragTo(p, 440);
          const size = await paneSizes(p);
          await restorePair(p, "ETHUSDC");
          assert.deepEqual(await paneSizes(p), size);
          await restorePair(p, "BTCUSDC");
          assert.deepEqual(await paneSizes(p), size);
          return "440px非默认布局在BTC→ETH→BTC保持";
        }),
      ),
    ],
  },
  {
    id: "PERPS-DESKTOP-LAYOUT-006",
    name: "Desktop 布局 §6 重置默认布局",
    rows: [
      row("D16-124,D16-126", "菜单重置尺寸、Toast及刷新保持默认", (p) =>
        withLayout(p, async () => {
          await dragTo(p, 440);
          await reset(p);
          assert.deepEqual(
            (await paneSizes(p)).map(Math.round),
            await defaults(p),
          );
          await reload(p);
          assert.deepEqual(
            (await paneSizes(p)).map(Math.round),
            await defaults(p),
          );
          return "菜单重置移除高度覆盖，布局已重置Toast与刷新默认尺寸";
        }),
      ),
      row("D16-125", "隐藏订单簿后重置同时恢复订单簿", (p) =>
        withLayout(p, async () => {
          await setBook(p, false);
          await dragTo(p, 440);
          await reset(p);
          assert.equal(
            await bookControl(p)
              .locator('svg[data-sentry-component="SvgChevronRightSmallSolid"]')
              .count(),
            1,
          );
          assert.deepEqual(
            (await paneSizes(p)).map(Math.round),
            await defaults(p),
          );
          return "重置后订单簿真实重新显示，两个面板回默认";
        }),
      ),
      row("D16-128", "已默认状态再次重置尺寸不变且仍提示", (p) =>
        withLayout(p, async () => {
          await reset(p);
          const size = await paneSizes(p);
          await activeToasts(p).evaluateAll(dismissCurrentValidationToasts);
          await pollForm(
            () => activeToasts(p).count(),
            (n) => n === 0,
            "Old reset toast gone",
          );
          await reset(p);
          assert.deepEqual(await paneSizes(p), size);
          return "第二次重置尺寸不变且新Toast可见";
        }),
      ),
      row("D16-130", "双击分隔条恢复默认且不弹Toast", (p) =>
        withLayout(p, async () => {
          await dragTo(p, 440);
          await activeToasts(p).evaluateAll(dismissCurrentValidationToasts);
          await pollForm(
            () => activeToasts(p).count(),
            (n) => n === 0,
            "Old reset toast gone",
          );
          const expected = await defaults(p);
          await sash(p).dblclick();
          await pollForm(
            () => paneSizes(p),
            (v) => Math.round(v[0]) === expected[0],
            "Double-click default split",
          );
          assert.deepEqual((await paneSizes(p)).map(Math.round), expected);
          assert.equal(
            await activeToasts(p).filter({ hasText: "布局已重置" }).count(),
            0,
          );
          return "真实双击恢复按当前窗口尺寸计算的默认值，无重置Toast";
        }),
      ),
    ],
  },
  {
    id: "PERPS-DESKTOP-LAYOUT-010",
    name: "Desktop 布局 §10 图表全屏与退出",
    rows: [
      row("D16-139", "非默认面板高度全屏退出后保留", (p) =>
        withLayout(p, async () => {
          await dragTo(p, 440);
          const before = await paneSizes(p);
          await fullscreen(p, true);
          // Allotment retains the tab subtree inside an overflow-clipped,
          // zero-height pane. isVisible() ignores that ancestor clipping.
          const infoPane = await locator(p, "perps.layout.panes", {
            visible: false,
          })
            .nth(1)
            .evaluate((e) => ({
              height: e.getBoundingClientRect().height,
              overflow: getComputedStyle(e).overflow,
            }));
          assert.equal(
            infoPane.height,
            0,
            "Expanded chart collapses the information pane",
          );
          assert.equal(
            infoPane.overflow,
            "hidden",
            "Retained information content is clipped",
          );
          await fullscreen(p, false);
          await pollForm(
            () => paneSizes(p),
            (v) => v.every((h, i) => Math.abs(h - before[i]) <= 1),
            "Exit restores both pane sizes",
          );
          return `全屏隐藏信息区，退出后恢复${before.join("/")}px`;
        }),
      ),
      row("D16-140", "全屏时刷新退出且保留已保存高度", (p) =>
        withLayout(p, async () => {
          await dragTo(p, 440);
          const before = await paneSizes(p);
          await fullscreen(p, true);
          await reload(p);
          await pollForm(
            () => layoutState(p),
            (s) => Boolean(s.chartExpanded) === false,
            "Reload exits fullscreen",
          );
          await pollForm(
            () => paneSizes(p),
            (v) => v.every((h, i) => Math.abs(h - before[i]) <= 1),
            "Reload restores saved pane sizes",
          );
          return "全屏真实刷新回非全屏，保存的440px高度与信息区高度均保持";
        }),
      ),
    ],
  },
  {
    id: "PERPS-DESKTOP-LAYOUT-012",
    name: "Desktop 布局 §12 菜单平台入口",
    rows: [
      row("D16-33", "Desktop菜单不显示移动端布局设置", async (p) => {
        const before = await layoutState(p);
        try {
          await openMenu(p);
          for (const text of ["布局设置", "持仓操作按钮", "交易页 K 线"])
            assert.equal(
              await pop(p).getByText(text, { exact: true }).count(),
              0,
            );
          assert.equal(await locator(p, "perps.layout.reset").count(), 1);
          return "Desktop真实菜单无移动布局设置，独立保留Desktop重置入口";
        } finally {
          await closePop(p);
          assert.deepEqual(await layoutState(p), before);
        }
      }),
      row(
        "D16-157",
        "直接偏好开关、无移动端设置且关闭保留上下文",
        async (p) => {
          const before = await layoutState(p);
          for (let n = 0; n < 2; n++) {
            await openMenu(p);
            for (const text of ["布局设置", "持仓操作按钮", "交易页 K 线"])
              assert.equal(
                await pop(p).getByText(text, { exact: true }).count(),
                0,
              );
            assert.ok((await pop(p).getByRole("switch").count()) >= 3);
            await closePop(p);
          }
          assert.deepEqual(await layoutState(p), before);
          return "两次打开均直接展示偏好开关，无移动端设置，布局上下文不变";
        },
        {
          complete: false,
          missing:
            "活动入口配置开关与跳转仍需对应配置样本，账户标识独立对账待补",
        },
      ),
    ],
  },
];
export const layoutDefinitions = definitions;
export const layoutSuite = createDesktopRowSuite(definitions);
