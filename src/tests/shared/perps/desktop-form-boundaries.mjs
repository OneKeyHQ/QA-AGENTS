// D08 手动用例：docs/qa/testcases/cases/perps/2026-03-20_Perps-条件单模式合并测试.md
// D11 手动用例：docs/qa/testcases/cases/perps/2026-06-03_Perps-分时分段委托下单.md
// Manual BBO §1/8, conditional §1/2 and TWAP/Scaled non-submit boundaries.
// Latest official source verified at 6fe766b; live financial operations excluded.
import assert from "node:assert/strict";
import { dragSlider } from "./desktop-sizing-boundaries.mjs";
import {
  projectFormModeDraft,
  assertAdvancedFormReset,
  assertReturnToStandard,
  projectOrderTabAppearance,
  assertOrderTabAppearance,
} from "./form-mode-evidence.mjs";
import { withDesktopRequestObservation } from "./desktop-request-observer.mjs";
import { dismissCurrentValidationToasts } from "./validation-toasts.mjs";
export { dismissCurrentValidationToasts } from "./validation-toasts.mjs";
import { projectReactAll } from "./react-projection.mjs";
import { existingOrderIds } from "./order-observation.mjs";
import { locator, restorePair } from "../../helpers/perps-ui.mjs";
import {
  chooseMode,
  mode,
  chooseUnit,
  priceInput,
  formRoot,
  pollForm,
  closePop,
  closeDialog,
  clickVisibleChoice,
} from "./non-order-ui.mjs";
import {
  createDesktopRowSuite,
  SampleUnavailable,
} from "./desktop-row-suite.mjs";

const advancedNames = ["市价止盈止损", "限价止盈止损", "分段委托", "分时委托"];
const advanced = (page) =>
  formRoot(page)
    .locator('[data-testid="select-trigger"]')
    .filter({ hasText: /^(市价止盈止损|限价止盈止损|分段委托|分时委托)$/u });
const pop = (page) => locator(page, "perps.overlay.popover");
const amount = (page) => locator(page, "perps.form.size");
const field = (page, placeholder) =>
  formRoot(page).getByPlaceholder(placeholder, { exact: true });
const side = (page, short = false) =>
  locator(page, short ? "perps.perp-short-button" : "perps.perp-long-button");
const checkbox = async (page, key) =>
  locator(page, key).evaluate((e) =>
    e.firstElementChild.classList.contains("_bg-bgPrimary"),
  );
async function setCheck(page, key, value) {
  if ((await checkbox(page, key)) !== value) await locator(page, key).click();
  assert.equal(await checkbox(page, key), value);
}
async function fill(input, value) {
  await input.fill(value);
  assert.equal(await input.inputValue(), value);
}
async function assertButtons(page) {
  for (const short of [false, true]) {
    const b = side(page, short);
    assert.equal(await b.count(), 1);
    assert.notEqual(await b.getAttribute("aria-disabled"), "true");
    assert.equal(await b.isEnabled(), true);
  }
}
// Read-only diagnostic oracle for the exact button component. Never mutate React
// internals or infer authorization from the visible Buy/Sell label.
export async function readTradingPermission(page) {
  const projected = await projectReactAll(side(page), (fiber) => {
    const values = [];
    for (let f = fiber; f; f = f.return) {
      const name = f.type?.displayName || f.type?.name;
      if (!name?.includes("SideButton")) continue;
      for (let h = f.memoizedState, n = 0; h && n < 400; h = h.next, n++) {
        const seen = new Set();
        const visit = (v, depth) => {
          if (!v || typeof v !== "object" || depth > 4 || seen.has(v)) return;
          seen.add(v);
          if (typeof v.canTrade === "boolean" && v.details)
            values.push({
              canTrade: v.canTrade,
              agentOk: v.details.agentOk,
              activatedOk: v.details.activatedOk,
            });
          for (const k of ["0", "1", "value", "current", "v"])
            if (Object.hasOwn(v, k)) visit(v[k], depth + 1);
        };
        visit(h.memoizedState, 0);
      }
    }
    return values;
  });
  const values = projected.flat();
  assert.ok(
    values.length,
    "Cannot prove account permission from current button component",
  );
  assert.ok(
    values.every((v) => v.canTrade === values[0].canTrade),
    "Ambiguous account permission snapshot",
  );
  return values[0];
}
async function requireTradingPermission(page) {
  const state = await readTradingPermission(page);
  if (!state.canTrade)
    throw new SampleUnavailable(
      `当前账户交易授权未就绪 ${JSON.stringify(state)}；无效输入点击也会先触发启用交易，禁止自动签名`,
    );
}
export async function noExchange(page, fn) {
  const attempted = [];
  const matches = (url) => /\/exchange\/?$/u.test(url.pathname);
  const handler = async (route) => {
    attempted.push("exchange");
    await route.abort("blockedbyclient");
  };
  await page.context().route(matches, handler);
  try {
    const detail = await fn();
    assert.deepEqual(attempted, [], "Validation attempted an exchange request");
    return detail;
  } finally {
    await page.context().unroute(matches, handler);
  }
}
// Positive invalid quantities are allowed only for the exact fixed-price BTC
// fixture, after both committed production calculation and our own arithmetic
// prove that the normalized notional is strictly below $10. The ordinary
// rejectClick path continues to accept only empty/zero quantities.
export function assertMinimumValidationSnapshot(state, fixture, short) {
  assert.deepEqual(Object.keys(fixture).sort(), ["displayValue", "unit"]);
  assert.ok(["usd", "token"].includes(fixture.unit));
  const display = Number(fixture.displayValue);
  assert.ok(Number.isFinite(display) && display > 0);
  assert.ok((fixture.unit === "token" ? display * 100 : display) < 10);
  assert.equal(state.coin, "BTC");
  assert.equal(state.side, short ? "short" : "long");
  assert.equal(state.unit, fixture.unit);
  assert.equal(state.type, "limit");
  assert.equal(state.price, "100");
  assert.equal(state.spot, false);
  assert.equal(state.advanced, false);
  assert.equal(state.belowMinimum, true);
  const quantity = Number(state.quantity),
    price = Number(state.effectivePrice);
  assert.equal(price, 100);
  assert.ok(Number.isFinite(quantity) && quantity > 0 && quantity * price < 10);
}
export function projectMinimumValidationStates(f) {
  const states = [];
  for (; f; f = f.return) {
    const name = f.type?.displayName || f.type?.name;
    if (!name?.includes("SideButton")) continue;
    const seenHooks = new Set();
    for (let h = f.memoizedState, n = 0; h; h = h.next, n++) {
      if (n >= 4096 || seenHooks.has(h))
        throw Error("Minimum validation hook chain is cyclic or exceeds 4096");
      seenHooks.add(h);
      const s = h.memoizedState?.current;
      if (
        s?.activeTradeInstrument &&
        s.computedSizeForSide &&
        s.formData &&
        typeof s.isMinimumOrderNotMetForSide === "boolean"
      )
        states.push({
          coin: s.activeTradeInstrument.coin,
          side: s.side,
          unit: s.resolvedSizeInputUnit,
          type: s.formData.type,
          price: s.formData.price,
          spot: s.isSpot,
          advanced: Boolean(s.isScaleMode || s.isTwapMode || s.isTriggerMode),
          belowMinimum: s.isMinimumOrderNotMetForSide,
          quantity: s.computedSizeForSide.toFixed(),
          effectivePrice: s.effectivePriceBN.toFixed(),
        });
    }
  }
  return states;
}
async function proveMinimumValidation(page, fixture, short) {
  const values = (
    await projectReactAll(side(page, short), projectMinimumValidationStates)
  ).flat();
  assert.equal(
    values.length,
    1,
    "One committed production minimum-validation state required",
  );
  assertMinimumValidationSnapshot(values[0], fixture, short);
}
export async function rejectClick(
  page,
  expected,
  { short = false, minimum = false, minimumFixture } = {},
) {
  await requireTradingPermission(page);
  const originalSize = await amount(page).inputValue();
  assert.ok(
    minimumFixture || originalSize === "" || /^0(?:\.0*)?$/u.test(originalSize),
    "Only empty-size or literal zero validation clicks are permitted in this suite",
  );
  await assertButtons(page);
  const toast = page
    .getByRole("status")
    .and(page.locator(':not([data-removed="true"])'))
    .filter({ hasText: expected });
  // Remove previous transient toasts so an old message cannot satisfy a click.
  await page
    .getByRole("status")
    .and(page.locator(':not([data-removed="true"])'))
    .evaluateAll(dismissCurrentValidationToasts);
  await pollForm(
    () =>
      page
        .getByRole("status")
        .and(page.locator(':not([data-removed="true"])'))
        .count(),
    (n) => n === 0,
    "Previous transient toasts removed",
  );
  // TradingButtonGroup uses a leading-only 1000ms debounce. A previous
  // validation click must not suppress this independently asserted click.
  await page.waitForTimeout(1100);
  assert.equal(
    await amount(page).inputValue(),
    originalSize,
    "Quantity unchanged before validation click",
  );
  if (minimumFixture) {
    assert.equal(minimum, true);
    assert.equal(originalSize, minimumFixture.displayValue);
    await proveMinimumValidation(page, minimumFixture, short);
  }
  const observed = await withDesktopRequestObservation(page, () =>
    noExchange(page, async () => {
      await side(page, short).click();
      await toast.waitFor({ state: "visible", timeout: 8000 });
      assert.equal(
        await page.getByRole("dialog").filter({ visible: true }).count(),
        0,
        "Invalid form must not open order/signing confirmation",
      );
      if (minimum)
        assert.equal(
          await toast.getByText("填入最小金额", { exact: true }).count(),
          1,
        );
      assert.equal(
        await amount(page).inputValue(),
        originalSize,
        "Invalid click must preserve the empty/zero form",
      );
      return `实际点击显示 ${await toast.innerText()}；无确认弹窗`;
    }),
  );
  return JSON.stringify(observed);
}
async function resetSize(page) {
  await chooseUnit(page, "usd");
  await amount(page).fill("");
}
const row = (ids, name, check, extra = {}) => ({
  ids: ids.split(","),
  name,
  check,
  ...extra,
});

async function readFormDraft(page) {
  const drafts = await projectReactAll(
    side(page).or(side(page, true)),
    projectFormModeDraft,
  );
  assert.equal(
    drafts.length,
    2,
    "Both independently rendered form sides required",
  );
  assert.deepEqual(
    drafts[0],
    drafts[1],
    "Both side refs must contain the same committed draft",
  );
  return drafts[0];
}
async function expectFormDraft(page, check, description) {
  return pollForm(
    async () => {
      try {
        const value = await readFormDraft(page);
        check(value);
        return { value };
      } catch (error) {
        return { error: error.message };
      }
    },
    (result) => !result.error,
    description,
  );
}
async function checkOrderTabs(page, selected) {
  const text = formRoot(page)
    .getByText(/^(市价单|限价单|市价止盈止损|限价止盈止损|分段委托|分时委托)$/u)
    .filter({ visible: true });
  await pollForm(
    async () => {
      try {
        assertOrderTabAppearance(
          await projectReactAll(text, projectOrderTabAppearance),
          selected,
        );
        return { ok: true };
      } catch (error) {
        return { error: error.message };
      }
    },
    (result) => result.ok,
    "Actual unique order tab underline and selected text color",
  );
}
async function checkPopulatedModeSwitches(page) {
  let checks = 0;
  for (const initial of ["市价单", "限价单"])
    for (const inputMode of ["manual", "slider"])
      for (const target of advancedNames) {
        await chooseMode(page, initial);
        await checkOrderTabs(page, initial);
        await chooseUnit(page, "token");
        if (
          initial === "限价单" &&
          (await locator(page, "perps.form.bbo_selector").count())
        )
          await locator(page, "perps.perp-bbo-toggle-button").click();
        await setCheck(page, "perps.perp-tpsl-checkbox", true);
        // Identify the standard form's actual visible input positions;
        // the standard form has size, optional limit price, then exactly TP/SL.
        const tpsl = formRoot(page).locator("input").filter({ visible: true });
        assert.equal(await tpsl.count(), initial === "限价单" ? 4 : 3);
        await fill(tpsl.nth((await tpsl.count()) - 2), "120");
        await fill(tpsl.nth((await tpsl.count()) - 1), "80");
        if (initial === "限价单") {
          if (!(await locator(page, "perps.form.bbo_selector").count()))
            await locator(page, "perps.perp-bbo-toggle-button").click();
        }
        if (inputMode === "slider") await dragSlider(page, 50);
        else await fill(amount(page), "0.5");
        const { value: before } = await expectFormDraft(
          page,
          (s) => {
            assert.equal(s.coin, "BTC");
            assert.equal(s.hasTpsl, true);
            assert.equal(s.tpValue, "120");
            assert.equal(s.slValue, "80");
            assert.equal(s.sizeInputMode, inputMode);
            assert.equal(s.sizePercent, inputMode === "slider" ? 50 : 0);
            if (inputMode === "manual") assert.equal(s.size, "0.5");
            if (initial === "限价单")
              assert.ok(
                s.bboPriceMode,
                "Actually populated BBO fixture required",
              );
          },
          "Populated TP/SL, size and BBO fixture committed",
        );
        await chooseMode(page, target);
        await checkOrderTabs(page, target);
        const { value: advancedDraft } = await expectFormDraft(
          page,
          (s) => assertAdvancedFormReset(before, s, target),
          "Advanced switch clears actual TPSL/BBO and retains size state",
        );
        assert.equal(await locator(page, "perps.form.bbo_selector").count(), 0);
        for (const standard of ["市价单", "限价单"]) {
          await chooseMode(page, standard);
          await checkOrderTabs(page, standard);
          await expectFormDraft(
            page,
            (s) => assertReturnToStandard(advancedDraft, s, standard),
            "Returning to standard retains the resulting draft",
          );
          assert.equal(await checkbox(page, "perps.perp-tpsl-checkbox"), false);
          assert.equal(
            await locator(page, "perps.form.bbo_selector").count(),
            0,
          );
        }
        checks++;
      }
  return checks;
}

export const formDefinitions = [
  {
    id: "PERPS-DESKTOP-FORM-001",
    name: "Desktop 条件单字段与校验",
    rows: [
      row("D08-16", "三页签、四高级类型、字段占位与默认状态", async (page) => {
        await restorePair(page, "BTCUSDC");
        const leverage = await locator(
          page,
          "perps.perp-leverage-selector",
        ).innerText();
        for (const name of ["市价单", "限价单"]) {
          await chooseMode(page, name);
          await checkOrderTabs(page, name);
          assert.equal(
            await formRoot(page).getByText("触发价格", { exact: true }).count(),
            0,
          );
          const trigger = advanced(page);
          await trigger.click();
          // The manual row requires selection/highlight/fields, without a
          // fixed click count. Trigger composes the custom activation with
          // opening Select; older renderers may only activate on this click.
          if (!(await pop(page).count())) {
            await pollForm(
              () => mode(page),
              (v) => advancedNames.includes(v),
              "Advanced tab activated",
            );
            await trigger.click();
          }
          await pop(page).waitFor({ state: "visible" });
          assert.deepEqual(
            (
              await locator(
                page,
                "perps.overlay.select_items",
              ).allTextContents()
            ).map((s) => s.trim()),
            advancedNames,
          );
          assert.equal(
            (await pop(page)
              .locator('svg[data-sentry-component="SvgCheckRadioSolid"]')
              .count()) +
              (await pop(page)
                .locator('svg[data-sentry-component="SvgCheckLarge"]')
                .count()),
            1,
            "Exactly one selected advanced menu item",
          );
          const selectedItem = locator(
            page,
            "perps.overlay.select_items",
          ).filter({
            has: page.getByText((await trigger.innerText()).trim(), {
              exact: true,
            }),
          });
          assert.equal(
            await selectedItem.count(),
            1,
            "Selected menu label equals the actual advanced tab",
          );
          assert.equal(
            await selectedItem
              .locator(
                'svg[data-sentry-component="SvgCheckRadioSolid"],svg[data-sentry-component="SvgCheckLarge"]',
              )
              .count(),
            1,
            "The unique checkmark belongs to the currently selected item",
          );
          await closePop(page);
        }
        for (const name of advancedNames.slice(0, 2)) {
          await chooseMode(page, name);
          await checkOrderTabs(page, name);
          const expected =
            name === "市价止盈止损"
              ? ["输入触发价格", "0.0"]
              : ["输入触发价格", "输入执行价格", "0.0"];
          assert.deepEqual(
            await formRoot(page)
              .locator("input")
              .evaluateAll((es) => es.map((e) => e.placeholder)),
            expected,
          );
          assert.equal(
            await checkbox(page, "perps.perp-trigger-reduce-only-checkbox"),
            true,
          );
          assert.equal(
            await locator(page, "perps.perp-tpsl-checkbox").count(),
            0,
          );
          assert.equal(
            await locator(page, "perps.perp-bbo-toggle-button").count(),
            0,
          );
          assert.equal(
            (await formRoot(page).getByText("止盈", { exact: true }).count()) +
              (await formRoot(page).getByText("止损", { exact: true }).count()),
            0,
          );
          assert.equal(
            await locator(page, "perps.perp-leverage-selector").innerText(),
            leverage,
          );
        }
        const populated = await checkPopulatedModeSwitches(page);
        return `原字段/菜单检查及${populated}组真实草稿切换；数量/百分比保留、TP/SL和BBO内部清空、返回市价/限价逐项读回；未点击下单`;
      }),
      row("D08-33", "空触发价及空数量实际 Toast", async (page) => {
        await restorePair(page, "BTCUSDC");
        await chooseMode(page, "市价止盈止损");
        await resetSize(page);
        const trigger = await priceInput(page, "触发价格");
        await trigger.fill("");
        await rejectClick(page, "请输入触发价格");
        await trigger.fill("1");
        return rejectClick(page, /仓位大小必须至少/u, { minimum: true });
      }),
      row("D08-34", "空执行价实际 Toast", async (page) => {
        await restorePair(page, "BTCUSDC");
        await chooseMode(page, "限价止盈止损");
        await resetSize(page);
        await (await priceInput(page, "触发价格")).fill("1");
        await (await priceInput(page, "价格")).fill("");
        return rejectClick(page, "输入价格");
      }),
      row(
        "D08-38",
        "两类条件单逐字段过滤与零数量最低金额拦截",
        async (page) => {
          await restorePair(page, "BTCUSDC");
          for (const name of advancedNames.slice(0, 2)) {
            await chooseMode(page, name);
            await resetSize(page);
            const prices = [await priceInput(page, "触发价格")];
            if (name.startsWith("限价"))
              prices.push(await priceInput(page, "价格"));
            const buttons = await Promise.all(
              [false, true].map(async (short) => ({
                enabled: await side(page, short).isEnabled(),
                ariaDisabled: await side(page, short).getAttribute(
                  "aria-disabled",
                ),
              })),
            );
            for (const input of [...prices, amount(page)]) {
              for (const invalid of [
                "abc",
                "-1",
                "1e3",
                "NaN",
                "Infinity",
                "12.3456789",
                "1.2.3",
              ]) {
                await fill(input, "");
                await input.fill(invalid);
                await pollForm(
                  () => input.inputValue(),
                  (value) => value === "",
                  `条件单拒绝非法输入 ${invalid}`,
                );
                assert.deepEqual(
                  await Promise.all(
                    [false, true].map(async (short) => ({
                      enabled: await side(page, short).isEnabled(),
                      ariaDisabled: await side(page, short).getAttribute(
                        "aria-disabled",
                      ),
                    })),
                  ),
                  buttons,
                  "被拒绝输入不改变下单按钮可用状态",
                );
              }
            }
            await fill(prices[0], "1");
            if (prices[1]) await fill(prices[1], "1");
            await fill(amount(page), "0");
            await rejectClick(page, /仓位大小必须至少/u, { minimum: true });
          }
          return "市价/限价条件单各价格与数量独立过滤；数量0可输入但最低金额拦截，无确认弹窗及交易请求";
        },
      ),
      row(
        "D08-39",
        "条件单最低金额 Toast 与快捷填入入口",
        async (page) => {
          await restorePair(page, "BTCUSDC");
          for (const name of advancedNames.slice(0, 2)) {
            await chooseMode(page, name);
            await resetSize(page);
            await (await priceInput(page, "触发价格")).fill("1");
            if (name.startsWith("限价"))
              await (await priceInput(page, "价格")).fill("1");
            await rejectClick(page, /仓位大小必须至少/u, { minimum: true });
          }
          return "两种条件单空数量均拦截，不发单";
        },
        {
          complete: false,
          missing:
            "已覆盖空数量分支；正数量且低于10美元的条件单须有当前TF校验路径证明后再执行，不以空数量替代低于门槛样本",
        },
      ),
    ],
  },
  {
    id: "PERPS-DESKTOP-FORM-002",
    name: "Desktop 分时输入与校验",
    rows: [
      row(
        "D11-335",
        "分时两项价格的控件过滤与边界",
        async (page) => {
          await chooseMode(page, "分时委托");
          await resetSize(page);
          await setCheck(page, "perps.form.twap_advanced", true);
          const trigger = await priceInput(page, "触发价格");
          const upper = await priceInput(page, "价格上限");
          const lower = await priceInput(page, "价格下限");
          assert.equal((await upper.count()) + (await lower.count()), 1);
          for (const input of [
            trigger,
            (await upper.count()) ? upper : lower,
          ]) {
            for (const invalid of [
              "-1",
              " ",
              "abc",
              "💰",
              "9".repeat(1000),
              "12.3456789",
              "NaN",
              "Infinity",
              "1e3",
            ]) {
              await input.fill("");
              assert.equal(await input.inputValue(), "");
              await input.fill(invalid);
              await pollForm(
                () => input.inputValue(),
                (value) => value === "",
                `reject ${JSON.stringify(invalid)}`,
              );
            }
            await input.fill("0");
            assert.equal(
              await input.inputValue(),
              "0",
              "Zero is accepted by the control, rejected by validation later",
            );
            await input.fill("1。2");
            assert.equal(await input.inputValue(), "1.2");
            await input.fill("");
            assert.equal(await input.inputValue(), "");
          }
          return "两项价格逐次过滤；0/中文小数点/清空单独验证，全程不点击交易按钮";
        },
        {
          complete: false,
          missing:
            "控件过滤已实现；格式化后无效及等于边界的提交拦截由源码隔离断言验证，当前Desktop交互不点击交易按钮",
        },
      ),
      row("D11-47", "0、4 分钟精确时长范围拦截", async (page) => {
        await chooseMode(page, "分时委托");
        await resetSize(page);
        const originalOrders = await existingOrderIds(page);
        for (const v of ["0", "4"]) {
          await fill(locator(page, "perps.form.twap_hours"), "0");
          await fill(locator(page, "perps.form.twap_minutes"), v);
          await rejectClick(page, /^分时委托时长需为 5-10080 分钟$/u);
          assert.deepEqual(
            await existingOrderIds(page),
            originalOrders,
            "Invalid duration must preserve current order/TWAP identities",
          );
        }
        return "0/4分钟分别显示完整范围提示，现有委托与TWAP身份保持相等";
      }),
      row(
        "D11-48",
        "空时长当前范围提示与手动必填预期差异",
        async (page) => {
          await chooseMode(page, "分时委托");
          await resetSize(page);
          const originalOrders = await existingOrderIds(page);
          await fill(locator(page, "perps.form.twap_hours"), "");
          await fill(locator(page, "perps.form.twap_minutes"), "");
          await rejectClick(page, /^分时委托时长需为 5-10080 分钟$/u);
          assert.deepEqual(
            await existingOrderIds(page),
            originalOrders,
            "Empty duration must preserve current order/TWAP identities",
          );
          return "当前实现空时长返回范围提示；手动要求必填提示，差异保留，不算完整覆盖";
        },
        {
          complete: false,
          missing:
            "手动预期为执行时长必填提示，当前固定源码统一返回分时委托时长需为5-10080分钟；不以宽松正则抹平差异。",
        },
      ),
      row("D11-61", "空数量与零值 TWAP 专属最小金额提示", async (page) => {
        await chooseMode(page, "分时委托");
        await resetSize(page);
        await fill(locator(page, "perps.form.twap_hours"), "0");
        await fill(locator(page, "perps.form.twap_minutes"), "10");
        const originalOrders = await existingOrderIds(page);
        const details = [];
        for (const value of ["", "0"]) {
          await amount(page).fill(value);
          details.push(
            await rejectClick(page, /最小\s*\$100(?:\.\d{2})?/u, {
              minimum: true,
            }),
          );
          assert.deepEqual(
            await existingOrderIds(page),
            originalOrders,
            "Existing current-order and TWAP identities unchanged",
          );
        }
        return details.join("；") + "；原委托与TWAP编号集合不变";
      }),
      row(
        "D11-80",
        "只减仓跨模式保留",
        async (page) => {
          await restorePair(page, "BTCUSDC");
          await chooseMode(page, "分时委托");
          await setCheck(page, "perps.form.twap_reduce", true);
          await chooseMode(page, "市价单");
          await chooseMode(page, "分时委托");
          assert.equal(await checkbox(page, "perps.form.twap_reduce"), true);
          return "只减仓真实勾选，切市价再回分时仍选中";
        },
        {
          complete: false,
          missing: "跨模式保留已断言；提交后不重置分支涉及真实委托，未执行",
        },
      ),
      row("D11-328", "四快捷时长及 10081 分钟上限归一", async (page) => {
        await chooseMode(page, "分时委托");
        const h = locator(page, "perps.form.twap_hours"),
          m = locator(page, "perps.form.twap_minutes");
        for (const [label, total] of [
          ["6h", 360],
          ["12h", 720],
          ["24h", 1440],
          ["7d", 10080],
        ]) {
          await formRoot(page).getByText(label, { exact: true }).click();
          assert.equal(
            Number(await h.inputValue()) * 60 + Number(await m.inputValue()),
            total,
          );
        }
        await h.fill("168");
        await m.fill("1");
        await pollForm(
          async () =>
            Number(await h.inputValue()) * 60 + Number(await m.inputValue()),
          (v) => v === 10080,
          "10081 capped",
        );
        assert.equal(
          await formRoot(page).getByText("1h", { exact: true }).count(),
          0,
        );
        return "360/720/1440/10080；10081→10080，无旧1h";
      }),
      row("D11-329", "非法时长过滤与分钟进位", async (page) => {
        await chooseMode(page, "分时委托");
        const h = locator(page, "perps.form.twap_hours"),
          m = locator(page, "perps.form.twap_minutes");
        for (const [raw, want] of [
          ["-1", "1"],
          ["1.5", "15"],
          ["abc", ""],
          [" ", ""],
          ["😀", ""],
        ]) {
          await h.fill(raw);
          assert.equal(await h.inputValue(), want, `duration ${raw}`);
        }
        await h.fill("1");
        await m.fill("60");
        assert.equal(await h.inputValue(), "2");
        assert.equal(await m.inputValue(), "0");
        return "非法字符过滤；1h60min→2h0min";
      }),
      row(
        "D11-330",
        "进阶关闭后清空价格",
        async (page) => {
          await chooseMode(page, "分时委托");
          await setCheck(page, "perps.form.twap_advanced", true);
          const prices = formRoot(page)
            .locator("input")
            .filter({
              hasNot: page.locator(
                '[data-testid="perp-twap-duration-hours-input"]',
              ),
            });
          const trigger = await priceInput(page, "触发价格");
          await trigger.fill("1");
          const all = formRoot(page).locator("input");
          const extra = await all.evaluateAll((es) =>
            es
              .filter((e) => !["0.0", "0"].includes(e.placeholder))
              .map((e) => e.placeholder),
          );
          assert.equal(extra.length, 2);
          await field(page, extra[1]).fill("2");
          await setCheck(page, "perps.form.twap_advanced", false);
          assert.equal(await trigger.count(), 0);
          await setCheck(page, "perps.form.twap_advanced", true);
          for (const ph of extra)
            assert.equal(await field(page, ph).inputValue(), "");
          return "两价格真实填入、关闭隐藏、重新打开均为空";
        },
        {
          complete: false,
          missing:
            "确认弹窗无隐藏价格分支需交易已授权账户，当前仅完整实现重新展开清空",
        },
      ),
    ],
  },
  {
    id: "PERPS-DESKTOP-FORM-003",
    name: "Desktop 分段价格与订单数边界",
    rows: [
      row("D11-113,D11-117", "缺任一端、0 价格实际拦截", async (page) => {
        await chooseMode(page, "分段委托");
        await resetSize(page);
        const low = field(page, "输入下限价格"),
          high = field(page, "输入上限价格");
        for (const [a, b] of [
          ["", "12"],
          ["10", ""],
          ["0", "12"],
          ["10", "0"],
        ]) {
          await fill(low, a);
          await fill(high, b);
          assert.equal(
            await formRoot(page)
              .getByText("请填写分段委托价格区间", { exact: true })
              .count(),
            0,
            "No inline required-price message",
          );
          await rejectClick(page, "请填写分段委托价格区间");
        }
        return "缺下限/缺上限/0下限/0上限逐个拦截；按钮可用，无 inline 错误";
      }),
      row("D11-114", "相同上下限红字与实际 Toast", async (page) => {
        await chooseMode(page, "分段委托");
        await resetSize(page);
        await fill(field(page, "输入下限价格"), "11");
        await fill(field(page, "输入上限价格"), "11");
        const inline = formRoot(page).getByText(
          "分段委托下限和上限价格不能相同",
          { exact: true },
        );
        await inline.waitFor({ state: "visible" });
        const color = await inline.evaluate((e) => getComputedStyle(e).color);
        assert.match(color, /^rgb/u);
        const rgb = color.match(/\d+/gu).map(Number);
        assert.ok(
          rgb[0] > rgb[1] && rgb[0] > rgb[2],
          "Equal-price inline must be red",
        );
        const orderBox = await field(page, "2-100").boundingBox(),
          errorBox = await inline.boundingBox();
        assert.ok(
          errorBox.y >= orderBox.y + orderBox.height - 1,
          "Inline below order count",
        );
        return rejectClick(page, "分段委托下限和上限价格不能相同");
      }),
      row("D11-116", "价格字符过滤、中文句号和按钮状态", async (page) => {
        await chooseMode(page, "分段委托");
        for (const input of [
          field(page, "输入下限价格"),
          field(page, "输入上限价格"),
        ]) {
          for (const raw of ["-1", "abc", "00", "01", "12.3456789"]) {
            await input.fill("12");
            await input.fill(raw);
            assert.equal(await input.inputValue(), "12", raw);
          }
          await input.fill("1。2");
          assert.equal(await input.inputValue(), "1.2");
        }
        await assertButtons(page);
        return "两价格框拒绝非法/超精度，1。2→1.2，按钮可用";
      }),
      row("D11-131", "笔数 0、1、空保持可输入并 Toast 拦截", async (page) => {
        await chooseMode(page, "分段委托");
        await resetSize(page);
        await fill(field(page, "输入下限价格"), "10");
        await fill(field(page, "输入上限价格"), "12");
        for (const value of ["0", "1", ""]) {
          await fill(field(page, "2-100"), value);
          assert.equal(
            await formRoot(page)
              .getByText("分段委托笔数需为 2-100 笔", { exact: true })
              .count(),
            0,
          );
          await rejectClick(page, "分段委托笔数需为 2-100 笔");
        }
        return "0/1/空逐次可输入、按钮可点、无 inline、精确 Toast 拦截";
      }),
      row("D11-132,D11-133", "笔数 >100 和非整数输入", async (page) => {
        await chooseMode(page, "分段委托");
        const count = field(page, "2-100");
        await fill(count, "10");
        await count.evaluate((el) => el.select());
        await count.press("Backspace");
        await count.pressSequentially("101");
        assert.equal(await count.inputValue(), "10", "Typed 101 is rejected");
        await count.fill("999");
        assert.equal(await count.inputValue(), "10", "Pasted 999 is rejected");
        for (const raw of ["1.5", "-1", "abc", " ", "😀"]) {
          await fill(count, "10");
          await count.fill(raw);
          assert.equal(await count.inputValue(), "10", raw);
        }
        return "逐字输入101、粘贴999及小数/负号/字母/空格/Emoji 均拒绝，保留10";
      }),
      row(
        "D11-161,D11-166,D11-247",
        "TIF 三选项说明、勾选、关闭及跨模式保留",
        async (page) => {
          await restorePair(page, "BTCUSDC");
          await chooseMode(page, "分段委托");
          const control = locator(page, "perps.form.scale_tif");
          for (const [name, description] of [
            ["GTC", "GTC（取消前有效）：订单会一直保留，直到成交或被取消。"],
            ["IOC", "IOC（立即成交否则取消）：未立即成交的部分会被取消。"],
            [
              "ALO",
              "ALO（只做挂单）：订单只会以限价挂单方式留在订单簿中，也叫 Post-only。",
            ],
          ]) {
            const current = (await control.innerText())
              .trim()
              .split("\n")
              .at(-1);
            await control.click();
            const d = pop(page);
            await d.waitFor({ state: "visible" });
            assert.equal(
              await d.getByText("订单有效期", { exact: true }).count(),
              1,
              "TIF title",
            );
            for (const label of ["GTC", "IOC", "ALO"])
              assert.equal(
                await d.getByText(label, { exact: true }).count(),
                1,
              );
            assert.equal(
              await d.getByText(description, { exact: true }).count(),
              1,
              `TIF description ${name}`,
            );
            const options = locator(page, "perps.form.scale_tif_options");
            assert.equal(await options.count(), 3);
            const checked = options.filter({
              has: page.locator('svg[data-sentry-component="SvgCheckRadio"]'),
            });
            assert.equal(await checked.count(), 1, "One checked TIF option");
            assert.equal(
              await checked.getByText(current, { exact: true }).count(),
              1,
              `Current TIF ${current} checked; actual=${await checked.innerText()}`,
            );
            await clickVisibleChoice(d.getByText(name, { exact: true }));
            await d.waitFor({ state: "hidden" });
            assert.match(await control.innerText(), new RegExp(name));
          }
          await control.click();
          await clickVisibleChoice(pop(page).getByText("IOC", { exact: true }));
          await pop(page).waitFor({ state: "hidden" });
          await chooseMode(page, "市价单");
          await chooseMode(page, "分段委托");
          assert.match(await control.innerText(), /IOC/u);
          return "三种 TIF 均独立打开、选择及关闭；IOC跨模式保持";
        },
      ),
    ],
  },
];
export const formSuite = createDesktopRowSuite(formDefinitions);
