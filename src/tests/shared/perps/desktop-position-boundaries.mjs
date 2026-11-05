// D13 手动用例：docs/qa/testcases/cases/perps/2026-07-27_Perps-加仓与追单.md
// D18 手动用例：docs/qa/testcases/cases/perps/2026-10-27_Perps-反手与持仓按钮设置.md
// Inspect existing positions only. This module has no submit/confirm locator.
import assert from "node:assert/strict";
import { locator } from "../../helpers/perps-ui.mjs";
import {
  createDesktopRowSuite,
  SampleUnavailable,
} from "./desktop-row-suite.mjs";
import { projectReactAll } from "./react-projection.mjs";
import { closeFunds } from "./desktop-funds-boundaries.mjs";
import { chooseUnit, pollForm } from "./non-order-ui.mjs";
import { readFillSnapshot } from "./fill-snapshot.mjs";
import { inspectReverseConfirmation } from "./reverse-permission.mjs";
import { snapshotFinancialState } from "./order-observation.mjs";
import { recordBeforeRestore } from "./restore-diagnostics.mjs";
import { markRestoreFailure } from "./runtime.mjs";
const dialogs = (p) => p.getByRole("dialog").filter({ visible: true });
const row = (ids, name, check, extra = {}) => ({
  ids: ids.split(","),
  name,
  check,
  ...extra,
});
export async function sourcePosition(action) {
  const values = await projectReactAll(action, (f) => {
    for (; f; f = f.return) {
      const p = f.memoizedProps?.mockedPosition?.activePosition?.position;
      if (p)
        return {
          coin: p.coin,
          szi: p.szi,
          entry: p.entryPx,
          leverage: p.leverage,
        };
    }
    throw Error("Committed position row source required");
  });
  assert.equal(values.length, 1);
  return values[0];
}
export async function withPositions(p, kind, check, { minimum = 1 } = {}) {
  await locator(p, "perps.position.tab").click();
  const actions = locator(p, `perps.position.${kind}`),
    count = await actions.count();
  if (count < minimum)
    throw new SampleUnavailable(
      `需要至少${minimum}笔既有持仓，当前可见${count}笔；不为补样本下单`,
    );
  const before = await snapshotFinancialState(p),
    details = [];
  for (let i = 0; i < count; i++) {
    assert.equal(
      await actions.count(),
      count,
      "Position set stable before opening",
    );
    const sample = await sourcePosition(actions.nth(i));
    assert.ok(Number.isFinite(Number(sample.szi)) && Number(sample.szi) !== 0);
    let primary;
    try {
      await actions.nth(i).click();
      await dialogs(p).waitFor({ state: "visible" });
      details.push(await check(dialogs(p), sample, i));
    } catch (e) {
      primary = e;
      await recordBeforeRestore(p, "position", e);
      throw e;
    } finally {
      try {
        await closeFunds(p);
        assert.deepEqual(
          await snapshotFinancialState(p),
          before,
          "Position preview must preserve full account, positions and orders",
        );
      } catch (e) {
        throw markRestoreFailure(primary, e, "关闭持仓预览并独立核对资金状态");
      }
    }
  }
  return details.join("\n");
}
export function positionField(text, label) {
  const lines = text.split("\n").map((v) => v.trim());
  const at = lines.indexOf(label);
  assert.ok(at >= 0, `Field ${label} required`);
  return lines[at + 1];
}
const field = positionField;
async function addInputs(p) {
  const amount = locator(dialogs(p), "perps.position.add_amount");
  const states = await projectReactAll(amount, (f, e) => {
    for (; f; f = f.return) {
      const v = f.memoizedProps;
      if (
        v?.testID === "perp-add-position-amount-input" &&
        Object.hasOwn(v, "referencePrice") &&
        Object.hasOwn(v, "sliderPercent")
      )
        return {
          value: v.value,
          referencePrice: v.referencePrice,
          leverage: v.leverage,
          side: v.side,
          mode: v.sizeInputMode,
          percent: v.sliderPercent,
          allowMargin: v.allowMarginInput,
          inputValue: e.value,
        };
    }
    throw Error("Actual Add Position SizeInput props required");
  });
  assert.equal(states.length, 1);
  return states[0];
}
export function assertReverseQuantities(text, sample) {
  const current = field(text, "当前持仓"),
    target = field(text, "反手后"),
    order = field(text, "市价单数量");
  const parse = (t) =>
    t.match(/^(做多|做空|购买|买入|卖出|出售)\s+([\d.,]+)\s+(\S+)$/u);
  const a = parse(current),
    b = parse(target),
    c = parse(order);
  assert.ok(a && b && c, "Readable three reverse quantities required");
  const size = Math.abs(Number(sample.szi)),
    long = Number(sample.szi) > 0;
  assert.equal(a[1], long ? "做多" : "做空");
  assert.equal(b[1], long ? "做空" : "做多");
  assert.match(
    c[1],
    long ? /^(卖出|出售)$/u : /^(购买|买入)$/u,
    "Reverse market execution side must oppose the existing position",
  );
  assert.equal(a[2].replaceAll(",", ""), String(size));
  assert.equal(Number(b[2].replaceAll(",", "")), size);
  assert.equal(Number(c[2].replaceAll(",", "")), size * 2);
  assert.equal(b[3], a[3]);
  assert.equal(c[3], a[3]);
  assert.ok(
    sample.coin === a[3] || sample.coin.endsWith(":" + a[3]),
    "Displayed asset must belong to selected raw market",
  );
  return { current, target, order };
}
async function reversePreview(
  p,
  d,
  sample,
  { requireConfirmation = true } = {},
) {
  const text = await d.innerText();
  const { current, target, order } = assertReverseQuantities(text, sample);
  assert.equal(field(text, "价格"), "市价");
  assert.match(field(text, "预估强平价"), /^(?:\$[\d,.]+|--)$/u);
  if (requireConfirmation) {
    const confirm = locator(d, "perps.position.reverse_confirm");
    const guard = locator(d, "perps.perp-is-disabled-btn");
    const confirmationCount = await confirm.count();
    const guardCount = await guard.count();
    const state = inspectReverseConfirmation({
      confirmationCount,
      guardCount,
      guardText: guardCount === 1 ? await guard.innerText() : "",
      enabled: confirmationCount === 1 ? await confirm.isEnabled() : undefined,
      ariaDisabled:
        confirmationCount === 1
          ? await confirm.getAttribute("aria-disabled")
          : undefined,
    });
    if (!state.ready) throw new SampleUnavailable(state.reason);
  }
  return `${sample.coin} ${current} → ${target}，${order}；只读检查，关闭前不点击确认`;
}
export const positionBoundaryDefinitions = [
  {
    id: "PERPS-DESKTOP-POSITION-001",
    name: "Desktop 加仓弹窗字段、单位和取消",
    rows: [
      row(
        "D13-22",
        "已有持仓加仓：方向/杠杆锁定、市价默认和数量滑杆",
        (p) =>
          withPositions(p, "add", async (d, sample) => {
            const text = await d.innerText();
            assert.equal(field(text, "订单类型"), "市价单");
            assert.equal(
              field(text, "方向"),
              `${Number(sample.szi) > 0 ? "做多" : "做空"} ${sample.leverage.value}x`,
            );
            assert.ok(text.includes("数量"));
            assert.match(text, /0%/u);
            assert.equal(
              await locator(d, "perps.perp-leverage-selector").count(),
              0,
              "Position leverage cannot be edited here",
            );
            const input = await addInputs(p);
            assert.equal(input.leverage, sample.leverage.value);
            assert.equal(input.side, Number(sample.szi) > 0 ? "long" : "short");
            return `${sample.coin}已核对锁方向、沿用杠杆和默认市价；可见样本${Number(sample.szi) > 0 ? "多" : "空"}仓`;
          }),
        {
          complete: false,
          missing:
            "当前实机需同时有多/空样本；操作栏完整顺序与另一方向样本仍须分别核对",
        },
      ),
      row(
        "D13-23",
        "限价切换后价格可编辑且重新切换保留",
        (p) =>
          withPositions(p, "add", async (d, sample) => {
            await locator(d, "perps.position.add_type").click();
            await pollForm(
              () => d.innerText(),
              (t) => field(t, "订单类型") === "限价单",
              "Add limit mode",
            );
            const price = d
              .locator('[data-sentry-component="BaseInput"]')
              .filter({ has: p.getByText("限价", { exact: true }) })
              .locator("input");
            const initial = await price.inputValue();
            assert.ok(Number(initial) > 0);
            await price.fill("100");
            assert.equal(await price.inputValue(), "100");
            await locator(d, "perps.position.add_type").click();
            await locator(d, "perps.position.add_type").click();
            assert.equal(await price.inputValue(), "100");
            return `${sample.coin}价格预填${initial}，可改为100，切回市价再限价保留100`;
          }),
        {
          complete: false,
          missing: "初次预填价格尚需与初始化时刻原始中间价逐值对账",
        },
      ),
      row(
        "D13-24",
        "主面板三单位分别打开加仓并对账实际引用价格/杠杆",
        async (p) => {
          const details = [];
          for (const unit of ["token", "usd", "margin"]) {
            await chooseUnit(p, unit);
            details.push(
              await withPositions(p, "add", async (d, sample) => {
                const quantity = locator(d, "perps.position.add_amount");
                await quantity.fill("1");
                const s = await addInputs(p);
                assert.equal(s.inputValue, "1");
                assert.equal(s.allowMargin, true);
                assert.equal(s.leverage, sample.leverage.value);
                assert.ok(Number(s.referencePrice) > 0);
                const text = await d.innerText();
                assert.ok(
                  text.includes(
                    unit === "token"
                      ? sample.coin.split(":").at(-1)
                      : unit === "usd"
                        ? "USD"
                        : "成本",
                  ),
                );
                await quantity.fill("");
                return `${unit}/${sample.coin}实际referencePrice=${s.referencePrice}，leverage=${s.leverage}`;
              }),
            );
          }
          return details.join("\n");
        },
        {
          complete: false,
          missing:
            "已核对单位和计算组件引用价格/杠杆，未对成本/名义/规整数量的最终展示逐值断言",
        },
      ),
    ],
  },
  {
    id: "PERPS-DESKTOP-POSITION-002",
    name: "Desktop 反手既有持仓预览与关闭",
    rows: [
      row(
        "D18-22",
        "逐个既有持仓核对同量反向、两倍市价数量和强平价",
        (p) => withPositions(p, "reverse", (d, s) => reversePreview(p, d, s)),
        {
          complete: false,
          missing: "多/空两类样本与强平价独立计算、完整布局重叠检查仍需补齐",
        },
      ),
      row("D18-23", "多笔持仓反手预览不串资产", (p) =>
        withPositions(p, "reverse", (d, s) => reversePreview(p, d, s), {
          minimum: 2,
        }),
      ),
      row("D18-24", "反手预览关闭后资金、完整成交历史与弹窗消失", async (p) => {
        const account = (await snapshotFinancialState(p)).account;
        const before = await readFillSnapshot(account);
        const detail = await withPositions(p, "reverse", (d, s) =>
          reversePreview(p, d, s, { requireConfirmation: false }),
        );
        assert.equal(
          await dialogs(p).count(),
          0,
          "Reverse dialog actually closed",
        );
        assert.deepEqual(
          await readFillSnapshot(account),
          before,
          "Closing reverse preview leaves existing fill history unchanged",
        );
        return `${detail}；公开只读成交${before.length}条逐字段快照未变化，弹窗已消失`;
      }),
    ],
  },
];
export const positionBoundarySuite = createDesktopRowSuite(
  positionBoundaryDefinitions,
);
