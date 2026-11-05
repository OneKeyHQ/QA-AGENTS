// D15 手动用例：docs/qa/testcases/cases/perps/2026-08-03_Perps-交易.md
// Desktop minimum toast shortcuts on strictly empty/zero quantities only.
// Filled valid quantities are inspected, then cleared; never submitted.
import assert from "node:assert/strict";
import { projectReactAll } from "./react-projection.mjs";
import { locator, restorePair } from "../../helpers/perps-ui.mjs";
import { createDesktopRowSuite } from "./desktop-row-suite.mjs";
import {
  chooseMode,
  chooseUnit,
  priceInput,
  pollForm,
} from "./non-order-ui.mjs";
import {
  rejectClick,
  readTradingPermission,
  noExchange,
} from "./desktop-form-boundaries.mjs";
import {
  activeToasts,
  dismissCurrentValidationToasts,
} from "./validation-toasts.mjs";
import { withDesktopRequestObservation } from "./desktop-request-observer.mjs";
import { existingOrderIds } from "./order-observation.mjs";
import {
  assertMinimumToastDisplay,
  minimumToastAmount,
  normalizeDecimal,
} from "./minimum-toast.mjs";
const size = (p) => locator(p, "perps.form.size");
const row = (ids, name, check, extra = {}) => ({
  ids: ids.split(","),
  name,
  check,
  ...extra,
});
async function limitFixture(p) {
  await restorePair(p, "BTCUSDC");
  await chooseMode(p, "限价单");
  await (await priceInput(p, "价格")).fill("100");
  assert.equal(await (await priceInput(p, "价格")).inputValue(), "100");
  await size(p).fill("");
}
async function fillMinimum(
  p,
  unit,
  { short = false, rapid = false, invalidSize = "" } = {},
) {
  await chooseUnit(p, unit);
  // This fixture is always BTC at limit price100. Only nonpositive or strictly
  // sub-$10 values may reach a validation click; filled suggestions are cleared.
  const amount = Number(invalidSize);
  assert.ok(Number.isFinite(amount) && amount >= 0);
  assert.ok(
    invalidSize === "" ||
      (unit === "token" ? amount * 100 : unit === "usd" ? amount : Infinity) <
        10,
  );
  await size(p).fill(invalidSize);
  const original = await existingOrderIds(p);
  const detail = await rejectClick(p, /最小/u, {
    short,
    minimum: true,
    ...(invalidSize === ""
      ? {}
      : { minimumFixture: { unit, displayValue: invalidSize } }),
  });
  const toast = activeToasts(p).filter({ hasText: /最小/u });
  const text = await toast.innerText();
  const expectedAmount = minimumToastAmount(text, unit);
  const button = locator(p, "perps.form.minimum_action");
  assert.equal((await button.innerText()).trim(), "填入最小金额");
  const variants = await projectReactAll(button, (f) => {
    for (; f; f = f.return)
      if (f.memoizedProps?.variant) return f.memoizedProps.variant;
    return null;
  });
  assert.deepEqual(
    variants,
    ["primary"],
    "Actual button uses primary theme variant",
  );
  assert.notEqual(
    await button.evaluate((e) => getComputedStyle(e).backgroundColor),
    "rgba(0, 0, 0, 0)",
    "Primary button has visible background",
  );
  assert.equal(await button.isVisible(), true);
  assert.equal(
    await size(p).evaluate((e) => e === document.activeElement),
    false,
    "No automatic quantity focus",
  );
  const buttonBox = await button.boundingBox(),
    toastBox = await toast.boundingBox();
  assert.ok(
    buttonBox.x < toastBox.x + toastBox.width / 2,
    "Shortcut aligned in left half of toast",
  );
  if (rapid) {
    assert.equal((await readTradingPermission(p)).canTrade, true);
    assert.equal(await size(p).inputValue(), "");
    const side = locator(
      p,
      short ? "perps.perp-short-button" : "perps.perp-long-button",
    );
    await withDesktopRequestObservation(p, () =>
      noExchange(p, async () => {
        for (let n = 0; n < 3; n++) {
          assert.equal(
            await size(p).inputValue(),
            "",
            "Each rapid click remains invalid",
          );
          await side.click();
        }
        assert.equal(
          await p.getByRole("dialog").filter({ visible: true }).count(),
          0,
        );
      }),
    );
    assert.equal(
      await toast.count(),
      1,
      "Rapid validation does not stack duplicate minimum notices",
    );
  }
  await button.click();
  await pollForm(
    () => size(p).inputValue(),
    (v) => /^\d+(?:\.\d+)?$/u.test(v) && normalizeDecimal(v) === expectedAmount,
    "Shortcut fills exact toast amount",
  );
  const value = Number(await size(p).inputValue());
  let multiplier = 1;
  if (unit === "margin") {
    const label = await locator(p, "perps.perp-leverage-selector").innerText();
    const leverage = label.match(/(\d+)\s*[xX倍]/u);
    assert.ok(leverage, "Current leverage required");
    multiplier = Number(leverage[1]);
  }
  // Independent arithmetic for this fixed BTC/100 fixture. Merely comparing
  // toast with filled input would also accept an inflated, incorrect shortcut.
  const minimum =
    unit === "token"
      ? 0.1
      : unit === "usd"
        ? 10
        : Math.ceil(1000 / multiplier) / 100;
  assert.equal(
    value,
    minimum,
    "Smallest valid amount for current unit and leverage",
  );
  assertMinimumToastDisplay(
    text,
    unit === "token" ? `${minimum.toFixed(5)} BTC` : `$${minimum.toFixed(2)}`,
  );
  const qty =
    unit === "token"
      ? value
      : Math.floor(((value * multiplier) / 100 + 1e-10) * 1e5) / 1e5;
  assert.ok(
    qty * 100 >= 10 - 1e-8,
    "Actual precision-normalized notional meets $10",
  );
  assert.deepEqual(
    await existingOrderIds(p),
    original,
    "Shortcut never creates ordinary or TWAP orders",
  );
  await size(p).fill("");
  await activeToasts(p).evaluateAll(dismissCurrentValidationToasts);
  await pollForm(
    () => activeToasts(p).count(),
    (n) => n === 0,
    "Minimum toast is actually closed",
  );
  return `${unit}: ${detail}; fill=${expectedAmount}, normalizedQty=${qty}`;
}
export const minimumDefinitions = [
  {
    id: "PERPS-DESKTOP-MINIMUM-001",
    name: "Desktop 最小金额与填入快捷键",
    rows: [
      row("D15-86", "空数量卖出提示且已有委托不变", async (p) => {
        await limitFixture(p);
        await chooseUnit(p, "usd");
        const before = await existingOrderIds(p);
        const observed = await rejectClick(p, /最小/u, {
          short: true,
          minimum: true,
        });
        assertMinimumToastDisplay(
          await activeToasts(p).filter({ hasText: /最小/u }).innerText(),
          "$10.00",
        );
        assert.deepEqual(await existingOrderIds(p), before);
        return observed;
      }),
      row(
        "D15-97,D15-99",
        "三单位填入与显示金额一致、规整后满足最低额、无自动聚焦",
        async (p) => {
          await limitFixture(p);
          const details = [];
          for (const unit of ["token", "usd", "margin"])
            details.push(await fillMinimum(p, unit));
          return details.join("\n");
        },
      ),
      row("D15-87", "USD低于10美元，提示精确最小金额", async (p) => {
        await limitFixture(p);
        return fillMinimum(p, "usd", { invalidSize: "1" });
      }),
      row("D15-88", "币种低于最低名义金额，按精度向上换算", async (p) => {
        await limitFixture(p);
        return fillMinimum(p, "token", { invalidSize: "0.001" });
      }),
      row("D15-100", "关Toast、切单位后重触发按新单位换算", async (p) => {
        await limitFixture(p);
        const first = await fillMinimum(p, "usd");
        // Change the actual input before the second click, as required by the
        // manual row; changing the unit alone is not this scenario's step.
        const second = await fillMinimum(p, "token", { invalidSize: "0.001" });
        return `${first}\n${second}`;
      }),
      row("D15-101", "空数量连续点击不堆叠且快捷填入仍有效", async (p) => {
        await limitFixture(p);
        return fillMinimum(p, "usd", { rapid: true });
      }),
    ],
  },
];
export const minimumBoundarySuite = createDesktopRowSuite(minimumDefinitions);
