// D13 手动用例：docs/qa/testcases/cases/perps/2026-07-27_Perps-加仓与追单.md
// D13 chapters 1–3. Existing positions only; no valid-size submit is allowed.
import assert from "node:assert/strict";
import { locator, typeInput } from "../../helpers/perps-ui.mjs";
import { projectReactAll } from "./react-projection.mjs";
import {
  withPositions,
  positionField,
} from "./desktop-position-boundaries.mjs";
import { chooseUnit, pollForm } from "./non-order-ui.mjs";
import {
  createDesktopRowSuite,
  SampleUnavailable,
} from "./desktop-row-suite.mjs";
import { readTradingPermission } from "./desktop-form-boundaries.mjs";
import { snapshotFinancialState } from "./order-observation.mjs";
import {
  activeToasts,
  dismissCurrentValidationToasts,
} from "./validation-toasts.mjs";
import {
  expectedAddSize,
  expectedAddMax,
  expectedAddPercent,
  expectedAddCost,
  expectedAddMinimum,
  assertAddRawCost,
  assertAddCost,
  projectAddPositionEvidence,
  assertAddEvidence,
} from "./add-position-evidence.mjs";
const dialog = (p) => p.getByRole("dialog").filter({ visible: true });
const amount = (p) => locator(dialog(p), "perps.position.add_amount");
const row = (ids, name, check, extra = {}) => ({
  ids: ids.split(","),
  name,
  check,
  ...extra,
});
async function evidence(p) {
  const values = await projectReactAll(amount(p), projectAddPositionEvidence);
  assert.equal(values.length, 1);
  return values[0];
}
async function ready(p, sample) {
  const account = (await snapshotFinancialState(p)).account;
  const state = await pollForm(
    () => evidence(p),
    (s) => s.ready === true && s.raw.length === 1,
    "Add target asset ready",
  );
  assertAddEvidence(state, sample, account);
  return state;
}
async function limit(p) {
  const d = dialog(p),
    toggle = locator(d, "perps.position.add_type");
  if ((await toggle.innerText()).trim() === "市价单") await toggle.click();
  assert.equal((await toggle.innerText()).trim(), "限价单");
  const price = d
    .locator('[data-sentry-component="BaseInput"]')
    .filter({ has: p.getByText("限价", { exact: true }) })
    .locator("input");
  assert.equal(await price.count(), 1);
  await typeInput(price, "100");
  await pollForm(
    () => evidence(p),
    (s) => s.price === "100",
    "Actual limit reference price",
  );
  return price;
}
async function checkCost(p, quantity, s) {
  const expected = expectedAddCost({
    quantity,
    price: s.price,
    leverage: s.leverage,
  });
  const cost = await pollForm(
    () => evidence(p),
    (x) => x.rawCosts.length === 1,
    "Actual raw cost preview",
  );
  assert.equal(cost.rawCosts.length, 1);
  assertAddRawCost(cost.rawCosts[0], {
    quantity,
    price: s.price,
    leverage: s.leverage,
  });
  await pollForm(
    async () => positionField(await dialog(p).innerText(), "成本"),
    (text) => {
      try {
        assertAddCost(text, expected);
        return true;
      } catch {
        return false;
      }
    },
    "Independent add-position cost",
  );
  return expected;
}
export function assertInvalidAddClick(s, kind) {
  assert.equal(s.canTrade, true, "Trading guard must already be ready");
  assert.ok(
    ["", "0"].includes(s.display),
    "Only literal empty/zero display may be submitted",
  );
  assert.ok(
    ["", "0"].includes(s.quantity),
    "Actual token quantity must also be empty/zero",
  );
  assert.equal(s.ready, true);
  if (kind === "price")
    assert.ok(["", "0"].includes(s.price), "Limit price must be invalid");
  else {
    assert.equal(kind, "quantity");
    assert.ok(Number(s.price) > 0);
  }
}
async function invalidClick(p, kind, unit) {
  const permission = await readTradingPermission(p);
  if (!permission.canTrade)
    throw new SampleUnavailable("加仓校验需要已启用交易的账户；不自动进入授权");
  const s = await evidence(p);
  // Price validation follows size validation in AddPositionForm. Empty size
  // cannot safely reach invalidPrice; do not click a positive-size fixture.
  if (kind === "price")
    throw new SampleUnavailable(
      "当前源码先校验数量，空/零数量不能到达价格错误分支；待有独立后台拒绝边界后使用正数量夹具，不以错误Toast计通过",
    );
  assertInvalidAddClick({ ...s, canTrade: permission.canTrade }, kind);
  const before = await snapshotFinancialState(p);
  await activeToasts(p).evaluateAll(dismissCurrentValidationToasts);
  await pollForm(
    () => activeToasts(p).count(),
    (n) => n === 0,
    "Old toast removed",
  );
  const attempted = [],
    matches = (url) => /\/exchange\/?$/u.test(url.pathname);
  const block = async (route) => {
    attempted.push(route.request().url());
    await route.abort("blockedbyclient");
  };
  await p.context().route(matches, block);
  try {
    assertInvalidAddClick(
      {
        ...(await evidence(p)),
        canTrade: (await readTradingPermission(p)).canTrade,
      },
      kind,
    );
    const button = locator(dialog(p), "perps.position.add_confirm");
    assert.equal(await button.count(), 1);
    assert.equal(await button.isEnabled(), true);
    await button.click();
    const toast = activeToasts(p).filter({ hasText: /最小\s+/u });
    await toast.waitFor({ state: "visible", timeout: 10000 });
    const expected = expectedAddMinimum({
      price: s.price,
      leverage: s.leverage,
      unit,
      decimals: s.decimals,
      symbol: s.coin.split(":").at(-1),
    });
    assert.equal(
      await toast.getByText("最小 " + expected, { exact: true }).count(),
      1,
      "Exact minimum amount in active unit",
    );
    assert.equal(await locator(toast, "perps.form.minimum_action").count(), 1);
    assert.equal(
      await dialog(p).count(),
      1,
      "Original preview remains, no signing dialog",
    );
    assert.deepEqual(attempted, [], "No renderer exchange request");
    assert.deepEqual(await snapshotFinancialState(p), before);
    return await toast.innerText();
  } finally {
    await p.context().unroute(matches, block);
  }
}
async function tpslInputs(p) {
  const values = await projectReactAll(
    dialog(p).locator("input"),
    (start, element) => {
      for (let f = start; f; f = f.return) {
        const name = f.type?.displayName || f.type?.name;
        if (name !== "TpSlFormInput") continue;
        const v = f.memoizedProps;
        return {
          type: v.type,
          mode: v.inputType,
          value: v.value,
          display: element.value,
        };
      }
      return null;
    },
  );
  return values.filter(Boolean).sort((a, b) => a.type.localeCompare(b.type));
}
export const addPositionDefinitions = [
  {
    id: "PERPS-DESKTOP-ADD-001",
    name: "加仓单位换算与止盈止损开关",
    rows: [
      row(
        "D13-22",
        "多空各一笔：四操作顺序、方向杠杆锁定和市价默认",
        async (p) => {
          const directions = new Set();
          const detail = await withPositions(p, "add", async (d, sample, i) => {
            const s = await ready(p, sample),
              action = locator(p, "perps.position.add").nth(i),
              box = await action.boundingBox();
            assert.ok(box);
            const items = [];
            for (const text of ["加仓", "反手", "市价", "限价"]) {
              const candidates = p
                .getByText(text, { exact: true })
                .filter({ visible: true });
              const sameRow = [];
              for (let n = 0; n < (await candidates.count()); n++) {
                const b = await candidates.nth(n).boundingBox();
                if (
                  b &&
                  Math.abs(b.y + b.height / 2 - (box.y + box.height / 2)) < 5
                )
                  sameRow.push(b);
              }
              assert.equal(
                sameRow.length,
                1,
                `Unique ${text} action on the selected position row`,
              );
              items.push({ text, x: sameRow[0].x });
            }
            assert.deepEqual(
              items.sort((a, b) => a.x - b.x).map((v) => v.text),
              ["加仓", "反手", "市价", "限价"],
            );
            const text = await d.innerText();
            assert.equal(positionField(text, "订单类型"), "市价单");
            assert.equal(
              positionField(text, "方向"),
              `${s.side === "long" ? "做多" : "做空"} ${sample.leverage.value}x`,
            );
            assert.equal(
              await locator(d, "perps.perp-leverage-selector").count(),
              0,
            );
            assert.equal(
              await d.locator("input").count(),
              1,
              "Market preview only exposes the quantity input",
            );
            const slider = d.getByRole("slider");
            assert.equal(await slider.count(), 1);
            assert.equal(await slider.getAttribute("aria-valuemin"), "0");
            assert.equal(await slider.getAttribute("aria-valuemax"), "100");
            assert.equal(s.side, Number(sample.szi) > 0 ? "long" : "short");
            assert.equal(s.leverage, sample.leverage.value);
            const direction = d.getByText(positionField(text, "方向"), {
              exact: true,
            });
            assert.equal(
              await direction.evaluate((e) =>
                Boolean(
                  e.closest('button,[role="button"],select,[role="combobox"]'),
                ),
              ),
              false,
              "Direction is not an editable control",
            );
            await limit(p);
            assert.equal(
              positionField(await d.innerText(), "订单类型"),
              "限价单",
              "Actual market-to-limit switch",
            );
            directions.add(s.side);
            return `${sample.coin}/${s.side}/${s.leverage}x，顺序与锁定字段已核对`;
          });
          if (directions.size !== 2)
            throw new SampleUnavailable(
              "已核对当前方向，尚缺多/空另一方向现有持仓；不下单构造",
            );
          return detail;
        },
      ),
      row(
        "D13-24",
        "币种/USD/成本跟随主面板，实际数量和成本独立计算",
        async (p) => {
          const details = [];
          for (const unit of ["token", "usd", "margin"]) {
            await chooseUnit(p, unit);
            details.push(
              await withPositions(p, "add", async (d, sample) => {
                await ready(p, sample);
                await limit(p);
                await typeInput(amount(p), "100");
                const s = await ready(p, sample);
                const expected = expectedAddSize({
                  display: "100",
                  unit,
                  price: "100",
                  leverage: sample.leverage.value,
                  decimals: s.decimals,
                });
                assert.equal(s.display, "100");
                assert.equal(s.mode, "manual");
                assert.equal(s.allowMargin, true);
                assert.equal(
                  s.quantity,
                  expected,
                  "Actual normalized token quantity vs independent unit oracle",
                );
                const selector = await projectReactAll(amount(p), (f) => {
                  for (; f; f = f.return) {
                    const n = f.type?.displayName || f.type?.name;
                    if (n !== "SizeInput") continue;
                    const found = [];
                    const visit = (node, depth) => {
                      if (!node || depth > 15) return;
                      const p = node.memoizedProps;
                      if (
                        p &&
                        typeof p.tokenSymbol === "string" &&
                        Object.hasOwn(p, "allowMarginInput") &&
                        ["token", "usd", "margin"].includes(p.value)
                      )
                        found.push(p.value);
                      for (let c = node.child; c; c = c.sibling)
                        visit(c, depth + 1);
                    };
                    visit(f, 0);
                    return [...new Set(found)];
                  }
                  throw Error("Actual SizeInput selector required");
                });
                assert.deepEqual(
                  selector,
                  [[unit]],
                  "Dialog unit matches each main-panel preference",
                );
                const cost = await checkCost(p, expected, s);
                return `${sample.coin}/${unit}:100→${expected}，实际成本$${cost}`;
              }),
            );
          }
          return details.join("；");
        },
      ),
      row(
        "D13-25",
        "TP/SL百分比默认值、显示隐藏与重新勾选",
        (p) =>
          withPositions(p, "add", async (d, sample) => {
            await ready(p, sample);
            const checkbox = locator(d, "perps.position.add_tpsl");
            assert.equal(
              await checkbox.evaluate((e) =>
                e.firstElementChild.classList.contains("_bg-bgPrimary"),
              ),
              false,
            );
            assert.deepEqual(await tpslInputs(p), []);
            await checkbox.click();
            await pollForm(
              () => tpslInputs(p),
              (v) => v.length === 2,
              "TP/SL fields mounted",
            );
            assert.deepEqual(await tpslInputs(p), [
              { type: "sl", mode: "percentage", value: "10", display: "10" },
              { type: "tp", mode: "percentage", value: "10", display: "10" },
            ]);
            await checkbox.click();
            assert.deepEqual(await tpslInputs(p), []);
            await checkbox.click();
            assert.deepEqual(await tpslInputs(p), [
              { type: "sl", mode: "percentage", value: "10", display: "10" },
              { type: "tp", mode: "percentage", value: "10", display: "10" },
            ]);
            await checkbox.click();
            return `${sample.coin}:两侧默认10% ROE，取消即隐藏，再勾选不重复改写；未提交`;
          }),
        {
          complete: false,
          missing:
            "已实现TP/SL种子和隐藏分支；取消后实际提交参数缺后台独立观察，未真实下单。",
        },
      ),
    ],
  },
  {
    id: "PERPS-DESKTOP-ADD-002",
    name: "加仓百分比滑杆与手动输入切换",
    rows: [
      row("D13-35", "50%/100%按真实方向上限独立计算，手输后滑杆归零", (p) =>
        withPositions(p, "add", async (d, sample) => {
          await ready(p, sample);
          await limit(p);
          const slider = d.getByRole("slider");
          assert.equal(await slider.count(), 1);
          assert.equal(await slider.getAttribute("aria-valuemin"), "0");
          assert.equal(await slider.getAttribute("aria-valuemax"), "100");
          const details = [];
          for (const percent of [50, 100]) {
            // SegmentSlider's track is inset 8px on each side of the root.
            const box = await slider.boundingBox();
            assert.ok(box && box.width > 32);
            await p.mouse.click(
              box.x + 8 + ((box.width - 16) * percent) / 100,
              box.y + box.height / 2,
            );
            const s = await pollForm(
              () => evidence(p),
              (s) => s.mode === "slider" && s.percent === percent,
              "Exact slider percentage",
            );
            const raw = assertAddEvidence(
              s,
              sample,
              (await snapshotFinancialState(p)).account,
            );
            const maximum = expectedAddMax({
              maximum: raw.maxima[s.side === "long" ? 0 : 1],
              mark: raw.mark,
              price: "100",
              type: "limit",
              side: s.side,
              decimals: s.decimals,
            });
            if (Number(maximum) === 0)
              throw new SampleUnavailable(
                "当前方向最大可开数量为0，无法证明非零滑杆换算",
              );
            const q = expectedAddPercent({
              maximum,
              percent,
              decimals: s.decimals,
            });
            assert.equal(
              s.quantity,
              q,
              "Actual slider quantity must equal independent percentage oracle",
            );
            assert.ok(
              Number(s.quantity) <= Number(maximum),
              "Slider quantity must not exceed direction maximum",
            );
            assert.equal(s.display, percent + "%");
            assert.equal(
              await slider.getAttribute("aria-valuenow"),
              String(percent),
            );
            await checkCost(p, q, s);
            details.push(`${sample.coin}/${percent}%=${q},max=${maximum}`);
          }
          await typeInput(amount(p), "1");
          const s = await evidence(p);
          assert.equal(s.mode, "manual");
          assert.equal(s.percent, 0);
          assert.equal(await slider.getAttribute("aria-valuenow"), "0");
          return details.join("；") + "；手动输入后百分比归零";
        }),
      ),
    ],
  },
  {
    id: "PERPS-DESKTOP-ADD-003",
    name: "加仓空数量与零数量校验",
    rows: [
      row(
        "D13-47",
        "三单位空/零数量提示和快捷填入入口",
        async (p) => {
          const details = [];
          for (const unit of ["token", "usd", "margin"]) {
            await chooseUnit(p, unit);
            details.push(
              await withPositions(p, "add", async (d, sample) => {
                await ready(p, sample);
                await limit(p);
                const results = [];
                for (const text of ["", "0"]) {
                  await typeInput(amount(p), text);
                  results.push(await invalidClick(p, "quantity", unit));
                }
                return unit + ":" + results.join("/");
              }),
            );
          }
          return details.join("；");
        },
        {
          complete: false,
          missing:
            "已实现三单位精确最小金额、Toast与快捷入口；Electron后台请求缺直接观察，整行保留部分。",
        },
      ),
    ],
  },
];
export const addPositionSuite = createDesktopRowSuite(addPositionDefinitions);
