// D13 手动用例：docs/qa/testcases/cases/perps/2026-07-27_Perps-加仓与追单.md
// Inspect existing GTC orders, open previews only with a synchronous event gate.
// No confirm, cancel-order or modify-service call exists in this module.
import assert from "node:assert/strict";
import { locator } from "../../helpers/perps-ui.mjs";
import {
  createDesktopRowSuite,
  SampleUnavailable,
} from "./desktop-row-suite.mjs";
import { projectReactAll } from "./react-projection.mjs";
import { restoreInfoTab } from "./info-tab.mjs";
import { snapshotFinancialState } from "./order-observation.mjs";
import { withDesktopRequestObservation } from "./desktop-request-observer.mjs";
import { readTradingPermission } from "./desktop-form-boundaries.mjs";
import {
  projectChasePreviewState,
  assertSafeChasePreview,
  chaseDirection,
  expectedChaseEligibility,
  canonicalChaseDecimal,
  projectChaseEntry,
  missingChaseDirections,
} from "./chase-preview-evidence.mjs";
import { clickGuardedChasePreview } from "./chase-preview-dom-guard.mjs";
import { expectedBboPrice } from "./bbo-price-evidence.mjs";
import { closeFunds } from "./desktop-funds-boundaries.mjs";
import { positionField } from "./desktop-position-boundaries.mjs";
import { recordBeforeRestore } from "./restore-diagnostics.mjs";
import { markRestoreFailure } from "./runtime.mjs";
const dialog = (p) => p.getByRole("dialog").filter({ visible: true });
const actions = (p) => locator(p, "perps.order.chase_actions");
const row = (ids, name, check, extra = {}) => ({
  ids: ids.split(","),
  name,
  check,
  ...extra,
});
async function state(action) {
  const values = await projectReactAll(action, projectChasePreviewState);
  assert.equal(values.length, 1);
  return values[0];
}
async function orderBook(coin) {
  const response = await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "l2Book", coin }),
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 200);
  const raw = await response.json();
  assert.equal(raw.coin, coin);
  assert.ok(
    Number.isFinite(raw.time) && Math.abs(Date.now() - raw.time) < 30000,
  );
  assert.ok(
    raw.levels?.[0]?.[0]?.px && raw.levels?.[1]?.[0]?.px,
    "Independent two-sided book required",
  );
  return raw;
}
async function content(p) {
  const values = await projectReactAll(
    locator(dialog(p), "perps.order.chase_skip"),
    (f) => {
      for (; f; f = f.return) {
        const name = f.type?.displayName || f.type?.name;
        if (name === "ChaseOrderConfirmContent") {
          const { order, targetPrice, szDecimals } = f.memoizedProps;
          return { order, targetPrice, szDecimals };
        }
      }
      throw Error("Actual chase dialog source required");
    },
  );
  assert.equal(values.length, 1);
  return values[0];
}
function decimalText(text) {
  assert.match(text, /^\$[\d,]+(?:\.\d+)?$/u);
  return canonicalChaseDecimal(text.replace(/[$,]/gu, ""));
}
async function verifyFields(p, s, book) {
  const d = dialog(p),
    data = await content(p),
    text = await d.innerText(),
    o = s.order;
  assert.equal(await d.getByText("确认追单？", { exact: true }).count(), 1);
  assert.equal(
    await d
      .getByText("追单会将委托价格更新至当前最优价，帮助订单更快成交。", {
        exact: true,
      })
      .count(),
    1,
  );
  for (const key of ["oid", "coin", "side", "sz", "limitPx", "reduceOnly"])
    assert.equal(data.order[key], o[key]);
  const asset = o.coin.split(":").at(-1),
    direction = chaseDirection(o);
  assert.equal(positionField(text, "资产"), asset);
  assert.equal(positionField(text, "方向"), direction);
  assert.equal(
    decimalText(positionField(text, "当前委托价格")),
    canonicalChaseDecimal(o.limitPx),
  );
  assert.equal(
    decimalText(positionField(text, "追单目标价格")),
    canonicalChaseDecimal(data.targetPrice),
  );
  assert.equal(positionField(text, "只减仓"), o.reduceOnly ? "是" : "否");
  const quantity = positionField(text, "未成交数量");
  assert.ok(quantity.endsWith(" " + asset));
  assert.equal(
    canonicalChaseDecimal(
      quantity.slice(0, -asset.length).replaceAll(",", "").trim(),
    ),
    canonicalChaseDecimal(o.sz),
    "Exact remaining size, not original size or a floating-point alias",
  );
  const after = await orderBook(o.coin);
  const index = o.side === "B" ? 1 : 0;
  if (book.levels[index][0].px !== after.levels[index][0].px)
    throw new SampleUnavailable(
      "打开前后独立对手价已变化，无法将中间时刻的冻结目标价与这两份行情精确对账；不猜测通过",
    );
  const expected = expectedBboPrice({
    bid: book.levels[0][0].px,
    ask: book.levels[1][0].px,
    side: o.side === "B" ? "long" : "short",
    type: "counterparty",
    offsetTicks: 0,
    szDecimals: data.szDecimals,
  });
  assert.equal(
    data.targetPrice,
    expected,
    "Frozen dialog target price vs independent stable counterparty book",
  );
  assert.equal(decimalText(positionField(text, "追单目标价格")), expected);
  const color = await d
    .getByText(direction, { exact: true })
    .evaluate((e) => getComputedStyle(e).color);
  const rgb = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/u);
  assert.ok(rgb, "Actual RGB direction color required");
  assert.ok(
    o.side === "B"
      ? Number(rgb[2]) > Number(rgb[1])
      : Number(rgb[1]) > Number(rgb[2]),
    "Buy green / sell red",
  );
  return `${o.oid}/${asset}/${direction}:当前${o.limitPx}→目标${data.targetPrice}，剩余${o.sz}，只减仓${o.reduceOnly}`;
}
async function withChasePreviews(
  p,
  check,
  { needsBook = true, allDirections = false } = {},
) {
  await restoreInfoTab(p, "Open Orders");
  const count = await actions(p).count();
  if (!count)
    throw new SampleUnavailable(
      "当前筛选下没有可追单的既有委托；不创建样本委托",
    );
  const before = await snapshotFinancialState(p),
    details = [],
    verifiedDirections = [];
  for (let i = 0; i < count; i++) {
    const action = actions(p).nth(i),
      s = await state(action),
      permission = await readTradingPermission(p);
    if (!permission.canTrade)
      throw new SampleUnavailable("当前交易权限未就绪；不进入授权或改单");
    if (s.skipValues.length !== 1 || s.skipValues[0] !== false)
      throw new SampleUnavailable(
        "追单的跳过确认偏好为true或不明确，点击可能直接改单；本脚本不更改该偏好",
      );
    const context = {
      account: before.account,
      financial: before,
      canTrade: permission.canTrade,
    };
    assertSafeChasePreview(s, context);
    const book = needsBook ? await orderBook(s.order.coin) : null;
    let primary;
    try {
      assert.deepEqual(await snapshotFinancialState(p), before);
      assertSafeChasePreview(await state(action), context);
      const result = await clickGuardedChasePreview(action, context);
      assert.deepEqual(
        result.blocked,
        [],
        "No unsafe pointer/key event was sent to React",
      );
      assert.ok(
        result.allowed.includes("pointerdown") &&
          result.allowed.includes("pointerup"),
        "Real guarded pointer sequence required",
      );
      await dialog(p).waitFor({ state: "visible", timeout: 15000 });
      details.push(await check({ p, d: dialog(p), s, book }));
      // Record a direction only after that order's actual preview assertions
      // succeeded. Repeated long orders do not stand in for a missing short.
      verifiedDirections.push(chaseDirection(s.order));
    } catch (error) {
      primary = error;
      await recordBeforeRestore(p, "chase-preview", error);
      throw error;
    } finally {
      try {
        await closeFunds(p);
        assert.equal(await dialog(p).count(), 0);
        assert.deepEqual(
          await snapshotFinancialState(p),
          before,
          "Preview close preserves every order price/size and position",
        );
      } catch (error) {
        throw markRestoreFailure(
          primary,
          error,
          "追单预览关闭、移除事件门禁并独立核对委托",
        );
      }
    }
  }
  if (allDirections) {
    const missing = missingChaseDirections(verifiedDirections);
    if (missing.length)
      throw new SampleUnavailable(
        `四方向分支已实现，现有委托缺少${missing.join("、")}样本；不创建委托或成交补样本`,
      );
  }
  return details.join("；");
}
export async function verifyChaseClosePaths(p) {
  // Arm one calibrated observer BEFORE opening either preview and retain it
  // through both close paths, restoration and the final observation window.
  const { detail, observation } = await withDesktopRequestObservation(
    p,
    async () => {
      const details = [];
      for (const method of ["取消", "×"])
        details.push(
          await withChasePreviews(
            p,
            async ({ d, s }) => {
              const close =
                method === "取消"
                  ? d.getByText("取消", { exact: true })
                  : locator(d, "perps.overlay.dialog_close");
              assert.equal(await close.count(), 1);
              await close.click();
              await d.waitFor({ state: "hidden", timeout: 10000 });
              assert.equal(
                await dialog(p).count(),
                0,
                "Selected close path actually dismissed the preview",
              );
              return `${s.order.oid}/${method}关闭；finally核对完整金融快照`;
            },
            { needsBook: false },
          ),
        );
      return details.join("；");
    },
  );
  assert.equal(observation.calibrated, true);
  assert.equal(observation.requests.length, 0);
  return `${detail}；独立Chromium Network已校准，完整开关预览期间0个exchange请求`;
}
export const chaseDefinitions = [
  {
    id: "PERPS-DESKTOP-CHASE-004",
    name: "追单现有委托入口",
    rows: [
      row("D13-61", "既有GTC限价追单在取消之前且剩余数量为正", async (p) => {
        await restoreInfoTab(p, "Open Orders");
        if (!(await readTradingPermission(p)).canTrade)
          throw new SampleUnavailable(
            "交易权限未就绪，无法检验可交易账户的追单入口",
          );
        const entries = (
          await projectReactAll(
            p.getByText("取消", { exact: true }).filter({ visible: true }),
            projectChaseEntry,
          )
        )
          .filter(Boolean)
          .filter((v) => expectedChaseEligibility(v.order));
        if (!entries.length)
          throw new SampleUnavailable(
            "没有可见可追单委托，不创建真实订单补样本",
          );
        const buttonIds = await actions(p).evaluateAll((elements) =>
          elements.map((e) => e.getAttribute("data-testid")),
        );
        let partiallyFilled = false;
        const details = [];
        for (const s of entries) {
          const id = `perp-chase-order-${s.order.oid}-button`;
          assert.equal(s.canChase, true);
          assert.deepEqual(
            s.renderedButtons,
            [id],
            "Eligible row must independently render its chase entry",
          );
          assert.equal(buttonIds.filter((value) => value === id).length, 1);
          const action = actions(p).nth(buttonIds.indexOf(id));
          const chaseBox = await action.boundingBox(),
            cancel = action.locator("..").getByText("取消", { exact: true });
          assert.equal(await cancel.count(), 1);
          const cancelBox = await cancel.boundingBox();
          assert.ok(
            chaseBox && cancelBox && chaseBox.x + chaseBox.width <= cancelBox.x,
          );
          // The difference is only sample classification; displayed quantity is
          // verified exactly in the preview assertion below.
          partiallyFilled ||= Number(s.order.origSz) > Number(s.order.sz);
          details.push(
            `${s.order.oid}:余量${s.order.sz}/原始${s.order.origSz}`,
          );
        }
        if (!partiallyFilled)
          throw new SampleUnavailable(
            "已核对现有GTC入口和顺序，但没有部分成交且剩余>0样本；不制造成交",
          );
        return details.join("；");
      }),
    ],
  },
  {
    id: "PERPS-DESKTOP-CHASE-005",
    name: "追单确认预览与关闭",
    rows: [
      row(
        "D13-71",
        "确认标题说明、六字段与独立对手价",
        (p) =>
          withChasePreviews(p, async ({ p, s, book }) =>
            verifyFields(p, s, book),
          ),
        {
          complete: false,
          missing:
            "已实现现有委托六字段、方向颜色和稳定行情独立对账；提交价使用冻结目标的后台观察仍缺，未确认改单。",
        },
      ),
      row(
        "D13-72",
        "四方向逐一核对文案、买绿卖红、只减仓与剩余数量；缺方向样本明确跳过",
        (p) =>
          withChasePreviews(
            p,
            async ({ p, s, book }) => verifyFields(p, s, book),
            { allDirections: true },
          ),
        { complete: true },
      ),
      row(
        "D13-73",
        "取消和×各真实关闭预览，原委托价格/数量与资金保持",
        verifyChaseClosePaths,
        { complete: true },
      ),
    ],
  },
];
export const chaseSuite = createDesktopRowSuite(chaseDefinitions);
