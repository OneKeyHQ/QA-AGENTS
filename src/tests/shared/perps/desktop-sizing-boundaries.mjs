// D11 手动用例：docs/qa/testcases/cases/perps/2026-06-03_Perps-分时分段委托下单.md
// Desktop advanced sizing by actual input/slider/mode controls. Positive
// amounts never reach a preview, Buy/Sell, confirm or signing callback.
import assert from "node:assert/strict";
import { locator, restorePair } from "../../helpers/perps-ui.mjs";
import {
  chooseMode,
  chooseUnit,
  priceInput,
  pollForm,
  formRoot,
} from "./non-order-ui.mjs";
import {
  createDesktopRowSuite,
  SampleUnavailable,
} from "./desktop-row-suite.mjs";
import { projectReactAll } from "./react-projection.mjs";
import { projectSizingInput, projectSizingSide } from "./sizing-projection.mjs";
import {
  expectedAddSize,
  expectedAddPercent,
} from "./add-position-evidence.mjs";
import {
  expectedBboAmounts,
  assertBboNumeric,
} from "./bbo-preview-evidence.mjs";
const amount = (p) => locator(p, "perps.form.size");
const positive = (n) =>
  assert.ok(
    Number.isFinite(Number(n)) && Number(n) > 0,
    "Finite positive sizing input required",
  );
async function inputState(p) {
  const values = await projectReactAll(amount(p), projectSizingInput);
  assert.equal(values.length, 1);
  assert.equal(values[0].ready, true);
  return values[0];
}
async function sides(p) {
  return projectReactAll(
    locator(p, "perps.perp-long-button").or(
      locator(p, "perps.perp-short-button"),
    ),
    projectSizingSide,
  );
}
function assertSides(input, values, unit) {
  assert.equal(input.ready, true);
  assert.equal(input.symbol, "BTC");
  positive(input.reference);
  positive(input.leverage);
  assert.deepEqual(
    values.map((v) => v.side).sort(),
    ["long", "short"],
    "Both actual sides required",
  );
  for (const v of values) {
    assert.equal(v.spot, false);
    assert.equal(v.coin, "BTC");
    assert.equal(v.unit, unit);
    assert.equal(v.mode, input.mode);
    assert.equal(v.leverage, input.leverage);
    assert.equal(v.decimals, input.decimals);
    assert.equal(
      v.price,
      input.reference,
      "Input and button reference prices agree",
    );
    assert.ok(!/NaN|Infinity/u.test(v.text));
  }
}
export function assertManualSizing(input, values, unit) {
  assert.equal(input.mode, "manual");
  assertSides(input, values, unit);
  const quantity = expectedAddSize({
    display: input.display,
    unit,
    price: input.reference,
    leverage: input.leverage,
    decimals: input.decimals,
  });
  positive(quantity);
  assert.equal(
    input.token,
    quantity,
    "Committed token quantity must match the visible input",
  );
  for (const v of values) {
    assert.equal(v.quantity, quantity);
    const a = expectedBboAmounts({
      quantity,
      price: input.reference,
      leverage: input.leverage,
    });
    assertBboNumeric(
      v.value,
      a.notional,
      "Independent input quantity*reference",
    );
    const estimate =
      unit === "usd"
        ? a.usdSecondary
        : `${Number(quantity).toFixed(input.decimals)} BTC`;
    assert.ok(
      v.text.includes(estimate),
      `Actual DOM estimate required: ${estimate}`,
    );
  }
  return quantity;
}
export function assertSliderSizing(input, values, mode, percent) {
  assert.equal(input.mode, "slider");
  assert.equal(input.percent, percent);
  assertSides(input, values, "usd");
  for (const v of values) {
    assert.equal(v.orderMode, mode);
    assert.equal(v.percent, percent);
    assert.equal(v.reduceOnly, false);
    assert.ok(
      typeof v.account === "string" && v.account.length > 0,
      "Active account identity required",
    );
    // At zero the actual renderer switches to EmptySizeSideButton and stops
    // its max feed subscription. Zero has no dependency on account capacity.
    if (percent === 0) {
      assert.equal(v.quantity, "0", "Zero percent resets quantity");
      assert.equal(v.value, "0", "Zero percent resets notional");
      assert.ok(!/≈\s*\$/u.test(v.text), "Zero percent has no amount estimate");
      continue;
    }
    const raw = v.feeds.filter(
      (x) =>
        x.coin === v.coin &&
        x.account?.toLowerCase() === v.account.toLowerCase(),
    );
    assert.equal(raw.length, 1, "Exactly one account-scoped max feed required");
    assert.equal(raw[0].leverage, input.leverage);
    assert.equal(raw[0].maxima.length, 2);
    const mark = mode === "twap" ? v.twapMark : raw[0].mark;
    positive(mark);
    // Independent fixed-point identity: max lots at mark * mark/reference.
    const max = expectedAddSize({
      display: raw[0].maxima[v.side === "long" ? 0 : 1],
      unit: "margin",
      price: input.reference,
      leverage: mark,
      decimals: v.decimals,
    });
    if (percent && Number(max) === 0)
      throw new SampleUnavailable(
        "当前方向可下单最大值为0，需两侧非零账户样本",
      );
    const q = expectedAddPercent({
      maximum: max,
      percent,
      decimals: v.decimals,
    });
    assert.equal(
      v.quantity,
      q,
      "Quantity must use independent side max and percentage",
    );
    const a = expectedBboAmounts({
      quantity: q,
      price: input.reference,
      leverage: input.leverage,
    });
    assertBboNumeric(v.value, a.notional, "Independent slider notional");
    assert.ok(v.text.includes(a.usdSecondary), "Actual DOM estimate required");
  }
}
async function waitAssertion(read, check, message) {
  let lastError;
  try {
    return await pollForm(
      read,
      (s) => {
        try {
          check(s);
          lastError = null;
          return true;
        } catch (e) {
          if (e instanceof SampleUnavailable) throw e;
          lastError = e;
          return false;
        }
      },
      message,
    );
  } catch (e) {
    if (lastError)
      throw new Error(`${message}: ${lastError.message}`, { cause: lastError });
    throw e;
  }
}
async function configure(p, mode) {
  await restorePair(p, "BTCUSDC");
  await chooseMode(p, mode === "scale" ? "分段委托" : "分时委托");
  await chooseUnit(p, "usd");
  if (mode === "scale") {
    await (await priceInput(p, "价格下限")).fill("90");
    await (await priceInput(p, "价格上限")).fill("110");
  }
  const reduce = locator(
    p,
    mode === "scale" ? "perps.form.scale_reduce" : "perps.form.twap_reduce",
  );
  assert.equal(await reduce.count(), 1);
  const selected = () =>
    reduce.evaluate((e) =>
      e.firstElementChild?.classList.contains("_bg-bgPrimary"),
    );
  if (await selected()) await reduce.click();
  assert.equal(await selected(), false);
  await amount(p).fill("200");
  await waitAssertion(
    async () => ({ input: await inputState(p), values: await sides(p) }),
    (s) => assertManualSizing(s.input, s.values, "usd"),
    "Initial manual amount and both estimates",
  );
}
export async function dragSlider(p, percent) {
  // Pinned PerpTradingForm renders SegmentSlider without a testID. The old
  // registered perp-size-slider belongs to a superseded component.
  const control = formRoot(p).getByRole("slider");
  assert.equal(await control.count(), 1);
  assert.equal(await control.getAttribute("aria-disabled"), "false");
  assert.equal(await control.getAttribute("aria-valuemin"), "0");
  assert.equal(await control.getAttribute("aria-valuemax"), "100");
  const box = await control.boundingBox();
  assert.ok(box && box.width > 32);
  // Start away from a segment hit area, then move while captured. A click near
  // a segment mark can snap to 25/50/75 rather than the requested 20/40/60/80.
  await p.mouse.move(
    box.x + 8 + (box.width - 16) * 0.13,
    box.y + box.height / 2,
  );
  await p.mouse.down();
  try {
    await p.mouse.move(
      box.x + 8 + ((box.width - 16) * percent) / 100,
      box.y + box.height / 2,
      { steps: 3 },
    );
  } finally {
    await p.mouse.up();
  }
  await pollForm(
    () => control.getAttribute("aria-valuenow"),
    (s) => s === String(percent),
    "Exact rendered slider percentage",
  );
}
const sliderCheck = async (p) => {
  for (const mode of ["twap", "scale"]) {
    await configure(p, mode);
    for (const percent of [0, 20, 40, 60, 80, 100]) {
      await dragSlider(p, percent);
      await waitAssertion(
        async () => ({ input: await inputState(p), values: await sides(p) }),
        (s) => assertSliderSizing(s.input, s.values, mode, percent),
        `独立max/mark核对${mode}/${percent}双向数量与DOM金额`,
      );
    }
  }
  return "两模式六百分比，两侧数量/价值与实际DOM估值逐项；0无非零估值；未点击订单按钮";
};
export const sizingDefinitions = [
  {
    id: "PERPS-DESKTOP-SIZING-001",
    name: "分时分段滑块与双向估值",
    rows: [
      {
        ids: ["D11-62", "D11-78"],
        name: "两模式六百分比与双向独立数值",
        check: sliderCheck,
      },
      {
        ids: ["D11-179"],
        name: "分段最大数量客户端断言",
        check: sliderCheck,
        complete: false,
        missing:
          "最大值与估值已实现；原预期另含每笔最低额可提交，此脚本不点击订单按钮。",
      },
    ],
  },
  {
    id: "PERPS-DESKTOP-SIZING-002",
    name: "分段三单位换算保持同一数量",
    rows: [
      {
        ids: ["D11-181"],
        name: "参考价100的USD200→币种→成本→USD连续切换",
        check: async (p) => {
          await configure(p, "scale");
          let token;
          for (const unit of ["usd", "token", "margin", "usd"]) {
            await chooseUnit(p, unit);
            const s = await waitAssertion(
              async () => ({
                input: await inputState(p),
                values: await sides(p),
              }),
              (x) => assertManualSizing(x.input, x.values, unit),
              "Actual unit and both rendered estimates",
            );
            assert.equal(s.input.reference, "100");
            const q = assertManualSizing(s.input, s.values, unit);
            token ??= q;
            assert.equal(q, token, "Unit switch preserves token quantity");
            if (unit === "usd") assert.equal(s.input.display, "200");
          }
          return "真实单位控件连续切换，数量恒定2BTC/估值200，成本按当前杠杆；未点击预览";
        },
        complete: false,
        missing:
          "实现使用价格区间参考价，原文标记价措辞仍需对齐，不以不同价格样本自动判完整。",
      },
    ],
  },
];
export const sizingSuite = createDesktopRowSuite(sizingDefinitions);
