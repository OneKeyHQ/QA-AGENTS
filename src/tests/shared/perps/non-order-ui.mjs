// Non-order CDP cases. No Buy/Sell/submit/sign/cancel-order handler is called.
// Source: docs/qa/rules/perps-rules.md and the confirmed manual Perps cases.
// fill() deliberately exercises paste/whole-value validation; typed flows use pressSequentially elsewhere.
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { reloadPerps } from "./runtime.mjs";
import {waitInstrumentBoundary} from './instrument-readiness.mjs';
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  locator,
  currentPair,
  restorePair,
  closePairs,
} from "../../helpers/perps-ui.mjs";
import { PerpsPage } from "../../helpers/pages/perps.mjs";
import {
  unlockWalletIfNeeded,
  RESULTS_DIR,
} from "../../helpers/index.mjs";
import { runPreconditions } from "../../helpers/preconditions.mjs";
import { createStepTracker, safeStep } from "../../helpers/components.mjs";
import {connectPlatform,assertTargetPage} from '../../helpers/platform-session.mjs';
import {mustStopAfterResult} from '../../helpers/execution-policy.mjs';
const transactions = new WeakMap();
import {restoreFormBaseline} from './form-restoration.mjs';
const root = (p) => locator(p, "perps.form.root");
const inputs = (p) => root(p).locator("input");
const pop = (p) => locator(p, "perps.overlay.popover");
const dialog = (p) => p.getByRole("dialog").filter({ visible: true });
const advanced = (p) =>
  root(p)
    .locator('[data-testid="select-trigger"]')
    .filter({ hasText: /^(市价止盈止损|限价止盈止损|分段委托|分时委托)$/u });
async function poll(read, check, message, timeout = 10000) {
  const end = Date.now() + timeout;
  let value;
  do {
    value = await read();
    if (check(value)) return value;
    await new Promise((r) => setTimeout(r, 100));
  } while (Date.now() < end);
  throw Error(`${message}: ${JSON.stringify(value)}`);
}
async function closeDialog(page) {
  if (!(await dialog(page).count())) return;
  const close = dialog(page).locator('[data-testid="dialog-header-close"]');
  if ((await close.count()) !== 1)
    throw Error("Cannot safely identify dialog close");
  await close.click();
  await dialog(page).waitFor({ state: "hidden" });
}
async function closePop(page) {
  if (!(await pop(page).count())) return;
  const entry = pop(page).locator(
    "xpath=ancestor::*[@data-onekey-overlay-entry][1]",
  );
  const back = entry.locator(':scope > [aria-hidden="true"]');
  if (await back.count()) await back.click({ position: { x: 3, y: 3 } });
  else await page.keyboard.press("Escape");
  await pop(page).waitFor({ state: "hidden" });
}
async function mode(page) {
  const text = await root(page).innerText();
  return text.includes("执行时长")
    ? "分时委托"
    : text.includes("价格区间") ||
        text.includes("价格下限") ||
        text.includes("订单数")
      ? "分段委托"
      : text.includes("触发价格")
        ? (await inputs(page).count()) > 2
          ? "限价止盈止损"
          : "市价止盈止损"
        : text.includes("最优价")
          ? "限价单"
          : "市价单";
}
async function chooseMode(page, name) {
  await unlockWalletIfNeeded(page);
  await closePop(page);
  if (["市价单", "限价单"].includes(name)) {
    await root(page).getByText(name, { exact: true }).click();
  } else {
    const control = advanced(page);
    await control.click();
    // Desktop's first click can activate the remembered advanced tab. Open
    // its menu only after that transition has settled.
    if (!(await pop(page).count())) {
      await poll(() => mode(page), v => !["市价单", "限价单"].includes(v), "Activate advanced tab");
      if ((await mode(page)) !== name) await control.click();
    }
    if (await pop(page).count()) {
    await pop(page).waitFor({ state: "visible" });
    await clickVisibleChoice(pop(page).getByText(name, { exact: true }));
    await pop(page).waitFor({ state: "hidden" });
    }
  }
  await poll(
    () => mode(page),
    (v) => v === name,
    `Order mode ${name}`,
  );
  const transaction = transactions.get(page);
  if (transaction && !transaction.restoring) {
    await waitInstrumentBoundary(page,await currentPair(page),root(page));
    const state = await snapshot(page);
    const key = `${state.pair}:${state.mode}`;
    if (!transaction.drafts.has(key)) transaction.drafts.set(key, state);
  }
}
// Option leaves can be replaced on every quote update. Use the current visible
// DOM target's native click, then independently wait for dismissal/selection.
// This helper is only for local selection controls, never transaction actions.
export async function clickVisibleChoice(target) {
  await target.waitFor({state:'visible',timeout:10000});
  assert.equal(await target.count(),1,'Exactly one visible choice required');
  await target.evaluate(e=>{
    const r=e.getBoundingClientRect();
    if(!e.isConnected||r.width<=0||r.height<=0||getComputedStyle(e).visibility==='hidden')throw Error('Choice is not visible');
    e.click();
  });
}
async function unit(page) {
  const base = locator(page, "perps.form.size").locator(
    'xpath=ancestor::*[@data-sentry-component="BaseInput"][1]',
  );
  const text = await base.innerText();
  return text.includes("成本")
    ? "margin"
    : (await locator(page, "perps.form.unit").innerText()).trim() === "USD"
      ? "usd"
      : "token";
}
async function chooseUnit(page, wanted) {
  await unlockWalletIfNeeded(page);
  if ((await unit(page)) === wanted) return;
  await locator(page, "perps.form.unit").click();
  await dialog(page).waitFor({ state: "visible" });
  const name =
    wanted === "usd"
      ? "订单金额"
      : wanted === "margin"
        ? "成本"
        : (await currentPair(page)).split("/")[0].replace(/USDC$/u, "");
  await dialog(page).getByText(name, { exact: true }).click();
  await dialog(page).waitFor({ state: "hidden" });
  await poll(
    () => unit(page),
    (v) => v === wanted,
    `Unit ${wanted}`,
  );
}
async function positionForAction(page, action) {
  const bounds = await action.boundingBox();
  assert.ok(bounds, "Position action must be visible");
  const matches = await locator(page, "perps.position.table_body").evaluate(
    (body, y) => {
      return [...body.querySelectorAll("div")]
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return (
            e.children.length > 3 &&
            r.top <= y &&
            r.bottom >= y &&
            /^\S+\n(?:全仓|逐仓) [^\n]+$/u.test(
              e.firstElementChild?.innerText ?? "",
            )
          );
        })
        .map((e) => {
          const lines = e.innerText.split("\n");
          return { symbol: lines[0], size: lines[2].replaceAll(",", "") };
        });
    },
    bounds.y + bounds.height / 2,
  );
  assert.equal(
    matches.length,
    1,
    "Action must correspond to exactly one visible position row",
  );
  assert.match(matches[0].size, /^\d+(?:\.\d+)?$/u);
  return matches[0];
}
async function forEachPosition(page, key, check) {
  const actions = locator(page, key);
  const count = await actions.count();
  assert.ok(count > 0, "Existing position sample required");
  const details = [];
  for (let index = 0; index < count; index++) {
    assert.equal(
      await actions.count(),
      count,
      "Position action set changed during inspection",
    );
    const sample = await positionForAction(page, actions.nth(index));
    await actions.nth(index).click();
    await dialog(page).waitFor({ state: "visible" });
    try {
      details.push(await check(dialog(page), index, sample));
    } finally {
      await closeDialog(page);
    }
  }
  return `${count}个已有持仓逐个验证并关闭：${details.join("; ")}`;
}
async function inputState(page) {
  return inputs(page).evaluateAll((es) =>
    es.map((e) => ({
      value: e.value,
      testid: e.dataset.testid,
      disabled: e.disabled,
    })),
  );
}
async function dustAccountScope(page) {
  const text = await locator(page, "perps.account.boundary").innerText();
  const address = text.match(/0x[\da-f]+(?:\.\.\.|…)[\da-f]+/iu)?.[0];
  assert.ok(
    address,
    "Readable current Perps account fingerprint required before settings write",
  );
  return address.toLowerCase();
}
async function snapshot(page) {
  return {
    pair: await currentPair(page),
    mode: await mode(page),
    unit: await unit(page),
    fields: await inputState(page),
    advanced: await advanced(page).innerText(),
    bbo: (await locator(page, "perps.form.bbo_selector").count()) > 0,
    bboLabel: (await locator(page, "perps.form.bbo_selector").count())
      ? (await locator(page, "perps.form.bbo_selector").innerText())
          .split("\n")
          .at(-1)
          .trim()
      : null,
    scaleTif: (await locator(page, "perps.form.scale_tif").count())
      ? (await locator(page, "perps.form.scale_tif").innerText()).trim().split("\n").at(-1)
      : null,
    checkboxes: await root(page)
      .locator('[data-sentry-component="RawCheckbox"][data-testid]')
      .evaluateAll((es) =>
        es.map((e) => {
          const c = e.firstElementChild.className;
          return {
            id: e.dataset.testid,
            state: c.includes("_bg-bgPrimary")
              ? "checked"
              : c.includes("_bg-iconInverse")
                ? "unchecked"
                : "unknown",
          };
        }),
      ),
  };
}
export { snapshot as snapshotNonOrderForm };
// Shared by the Desktop row-by-row suites; keep the same restoration policy.
export { chooseMode, chooseUnit, mode, unit, priceInput, closeDialog, closePop, root as formRoot, poll as pollForm };
export function beginFormTransaction(page, before) {
  if (transactions.has(page)) throw Error("Nested form transaction");
  transactions.set(page, { drafts: new Map([[`${before.pair}:${before.mode}`, before]]), restoring: false });
}
export { restoreTransaction as finishFormTransaction };
export async function restoreNonOrderForm(page, before) {
  await closePop(page);
  await closeDialog(page);
  await closePairs(page);
  // Read back first: read-only suites need no synthetic mode switches or writes.
  if (isDeepStrictEqual(await snapshot(page), before)) return;
  await restorePair(page, before.pair);
  await waitInstrumentBoundary(page, before.pair, root(page));
  // Do not activate an unrelated advanced tab just to restore its already
  // correct remembered label; doing so needlessly mutates the shared form.
  if ((await advanced(page).innerText()) !== before.advanced)
    await chooseMode(page, before.advanced);
  if ((await mode(page)) !== before.mode) await chooseMode(page, before.mode);
  await chooseUnit(page, before.unit);
  const bboOn = (await locator(page, "perps.form.bbo_selector").count()) > 0;
  if (bboOn !== Boolean(before.bbo))
    await locator(page, "perps.perp-bbo-toggle-button").click();
  if (before.bbo && before.bboLabel) {
    const selector = locator(page, "perps.form.bbo_selector");
    if (!(await selector.innerText()).includes(before.bboLabel)) {
      await selector.click();
      await pop(page).getByText(before.bboLabel, { exact: true }).click();
      await pop(page).waitFor({ state: "hidden" });
    }
  }
  if (before.scaleTif && (await locator(page, "perps.form.scale_tif").count())) {
    const control = locator(page, "perps.form.scale_tif");
    if (!(await control.innerText()).includes(before.scaleTif)) {
      await control.click();
      const panel = (await dialog(page).count()) ? dialog(page) : pop(page);
      await clickVisibleChoice(panel.getByText(before.scaleTif, { exact: true }));
      await panel.waitFor({ state: "hidden" });
    }
  }
  for (const item of before.checkboxes) {
    const el = root(page).locator(`[data-testid="${item.id}"]`);
    if (
      (await el.count()) &&
      (await el.evaluate((e) =>
        e.firstElementChild.className.includes("_bg-bgPrimary")
          ? "checked"
          : "unchecked",
      )) !== item.state
    )
      await el.click();
  }
  const after = inputs(page);
  if ((await after.count()) !== before.fields.length)
    throw Error("Form restore field count mismatch");
  for (let i = 0; i < before.fields.length; i++)
    if (!before.fields[i].disabled)
      await after.nth(i).fill(before.fields[i].value);
  assert.deepEqual(
    (await inputState(page)).map((x) => x.value),
    before.fields.map((x) => x.value),
    "Form values restored",
  );
  assert.equal(await mode(page), before.mode);
  assert.equal(await unit(page), before.unit);
  const restored = await snapshot(page);
  assert.deepEqual(
    restored.checkboxes,
    before.checkboxes,
    "Checkbox states restored",
  );
}
async function restoreTransaction(page, before) {
  const transaction = transactions.get(page);
  if (transaction) {transaction.restoring = true;writeFileSync(resolve(RESULTS_DIR,'perps-desktop-completion',`draft-baseline-${Date.now()}.json`),JSON.stringify([...transaction.drafts.values()],null,2));}
  try {
    // These are observations of one shared form after test transitions, not
    // separate saved drafts. Only the entry baseline belongs to the user.
    await restoreFormBaseline(before, state => restoreNonOrderForm(page, state), () => snapshot(page));
    return "进入本行前的交易对、模式、单位、开关和可见输入已逐项读回恢复；中间模式快照仅留证，不作为独立草稿重放，隐藏字段未采集则不声称恢复";
  } finally {
    transactions.delete(page);
  }
}
async function checkInput(input, raw, expected) {
  await input.fill(raw);
  await input.press("Tab");
  await poll(
    () => input.inputValue(),
    (v) => v === expected,
    `Input ${JSON.stringify(raw)} expected ${expected}`,
    3000,
  );
  return `${JSON.stringify(raw)} -> ${JSON.stringify(expected)}`;
}
async function rejectInvalid(
  input,
  {
    valid = "1.23",
    invalid = [
      "-1",
      "+1",
      "1e3",
      "1,000",
      "abc",
      "NaN",
      "Infinity",
      "1.2.3",
      "01",
      "00",
      "9999999999999",
      "1.234",
    ],
  } = {},
) {
  const details = [];
  for (const raw of invalid) {
    await input.fill(valid);
    details.push(await checkInput(input, raw, valid));
  }
  await checkInput(input, "", "");
  return details.join("; ");
}
async function priceInput(page, label) {
  return root(page)
    .locator('[data-sentry-component="BaseInput"]')
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator("input");
}
async function preferences(page) {
  await unlockWalletIfNeeded(page);
  if (await locator(page, "perps.settings.dusting").count()) return;
  await closePop(page);
  await closePairs(page);
  await locator(page, "perps.settings.button").click();
  await pop(page).waitFor({ state: "visible" });
  if (!(await locator(page, "perps.settings.dusting").count())) {
    await pop(page).getByText("偏好设置", { exact: true }).click();
  }
  await locator(page, "perps.settings.dusting").waitFor({ state: "visible" });
}
const caseDefs = [
  [
    "001",
    "市价 USD 数量非法字符、精度、整数长度与清空",
    async (page) => {
      await chooseMode(page, "市价单");
      await chooseUnit(page, "usd");
      return rejectInvalid(locator(page, "perps.form.size"));
    },
  ],
  [
    "002",
    "限价价格非法字符与有效位数",
    async (page) => {
      await chooseMode(page, "限价单");
      const input = await priceInput(page, "价格");
      return rejectInvalid(input, {
        valid: "12.3",
        invalid: [
          "-1",
          "1e3",
          "NaN",
          "00",
          "01",
          "12.3456789",
          "1.2.3",
          "9999999999999",
        ],
      });
    },
  ],
  [
    "003",
    "数量单位 USD / 币数 / 成本切换与输入",
    async (page) => {
      await chooseMode(page, "市价单");
      for (const value of ["token", "margin", "usd"]) {
        await chooseUnit(page, value);
        await checkInput(locator(page, "perps.form.size"), "1", "1");
      }
      return "三种单位真实切换并保留合法输入；未提交";
    },
  ],
  [
    "004",
    "市价条件单触发价与数量边界",
    async (page) => {
      await chooseMode(page, "市价止盈止损");
      const input = await priceInput(page, "触发价格");
      const detail = await rejectInvalid(input, {
        valid: "12.3",
        invalid: ["-1", "NaN", "1e3", "12.3456789"],
      });
      await chooseUnit(page, "usd");
      await rejectInvalid(locator(page, "perps.form.size"));
      return detail;
    },
  ],
  [
    "005",
    "限价条件单触发价、执行价分别校验",
    async (page) => {
      await chooseMode(page, "限价止盈止损");
      for (const label of ["触发价格", "价格"])
        await rejectInvalid(await priceInput(page, label), {
          valid: "12.3",
          invalid: ["-1", "NaN", "1e3", "1.2.3"],
        });
      return "两个独立价格字段均拒绝非法值且可清空";
    },
  ],
  [
    "006",
    "TWAP 时长预设与分钟进位、7天上界",
    async (page) => {
      await chooseMode(page, "分时委托");
      const hours = locator(page, "perps.form.twap_hours"),
        minutes = locator(page, "perps.form.twap_minutes");
      const records = [];
      for (const [label, h] of [
        ["6h", "6"],
        ["12h", "12"],
        ["24h", "24"],
        ["7d", "168"],
      ]) {
        await root(page).getByText(label, { exact: true }).click();
        await poll(
          () => hours.inputValue(),
          (v) => v === h,
          "TWAP preset",
        );
        assert.equal(await minutes.inputValue(), "0");
        records.push(`${label}=${h}h`);
      }
      await hours.fill("0");
      await minutes.fill("60");
      await poll(
        () => hours.inputValue(),
        (v) => v === "1",
        "TWAP carry",
      );
      assert.equal(await minutes.inputValue(), "0");
      await hours.fill("999");
      await poll(
        () => hours.inputValue(),
        (v) => v === "168",
        "TWAP max",
      );
      return records.join("; ");
    },
  ],
  [
    "007",
    "分段委托表单与价格区间非法输入",
    async (page) => {
      await chooseMode(page, "分段委托");
      const fields = inputs(page);
      assert.ok((await fields.count()) >= 3, "Scale fields missing");
      const detail = [];
      for (let i = 0; i < 2; i++)
        detail.push(
          await rejectInvalid(fields.nth(i), {
            valid: "12",
            invalid: ["-1", "NaN", "1e3", "1.2.3"],
          }),
        );
      return detail.join("; ");
    },
  ],
  [
    "008",
    "最优价四选项、隐藏手动价格与恢复输入",
    async (page) => {
      await chooseMode(page, "限价单");
      const price = await priceInput(page, "价格");
      const originalBbo =
        (await locator(page, "perps.form.bbo_selector").count()) > 0;
      if (originalBbo)
        throw Error(
          "BBO 已预先启用；请保留当前草稿后关闭再执行，避免覆盖未知选项",
        );
      const before = await price.inputValue();
      await locator(page, "perps.perp-bbo-toggle-button").click();
      const selector = locator(page, "perps.form.bbo_selector");
      await selector.waitFor({ state: "visible" });
      assert.equal(await price.count(), 0, "启用 BBO 后必须移除手动价格输入");
      const expected = ["对手价 1", "对手价 5", "同向价 1", "同向价 5"];
      for (const label of expected) {
        await selector.click();
        await pop(page).waitFor({ state: "visible" });
        const options = locator(page, "perps.overlay.select_items");
        assert.deepEqual(
          (await options.allTextContents()).map((t) => t.trim()),
          expected,
          "BBO 选项及顺序",
        );
        await pop(page).getByText(label, { exact: true }).click();
        await pop(page).waitFor({ state: "hidden" });
        assert.match(await selector.innerText(), new RegExp(label));
        assert.equal(await price.count(), 0);
      }
      await locator(page, "perps.perp-bbo-toggle-button").click();
      await price.waitFor({ state: "visible" });
      await checkInput(price, "12", "12");
      await price.fill(before);
      return "四选项独立打开、选择和读取；BBO 启用时手动价格字段不存在，关闭后可输入";
    },
  ],
  [
    "009",
    "附带止盈止损字段的输入与切换",
    async (page) => {
      await chooseMode(page, "市价单");
      const check = locator(page, "perps.perp-tpsl-checkbox");
      if (
        (await check.evaluate((e) =>
          e.firstElementChild.className.includes("_bg-bgPrimary"),
        )) !== true
      )
        await check.click();
      await poll(
        () => inputs(page).count(),
        (v) => v >= 3,
        "TP/SL fields",
      );
      const size = locator(page, "perps.form.size");
      await size.fill("1");
      const all = inputs(page);
      for (let i = 1; i < (await all.count()); i++)
        await rejectInvalid(all.nth(i), {
          valid: "12",
          invalid: ["-1", "abc", "1e3"],
        });
      return "止盈/止损输入拒绝非法字符，原开关由清理恢复";
    },
  ],
  [
    "010",
    "杠杆弹窗越界拒绝、合法值与清空（取消）",
    async (page) => {
      await locator(page, "perps.perp-leverage-selector").click();
      await dialog(page).waitFor({ state: "visible" });
      const input = locator(page, "perps.perp-leverage-input");
      await input.waitFor({ state: "visible" });
      const before = await input.inputValue();
      await checkInput(input, "0", before);
      await checkInput(input, "999", before);
      await checkInput(input, "1", "1");
      await checkInput(input, "", "");
      await closeDialog(page);
      assert.equal(
        (
          await locator(page, "perps.perp-leverage-selector").innerText()
        ).trim(),
        `${before}x`,
      );
      return "0/999 被拒绝，1 与清空可输入；关闭弹窗且杠杆未保存";
    },
  ],
  [
    "011",
    "现货市价与限价数量、价格输入校验",
    async (page) => {
      await restorePair(page, "HYPE/USDC");
      await chooseMode(page, "市价单");
      await chooseUnit(page, "usd");
      await rejectInvalid(locator(page, "perps.form.size"));
      await chooseMode(page, "限价单");
      await rejectInvalid(await priceInput(page, "价格"), {
        valid: "1.23",
        invalid: ["-1", "1e3", "NaN", "1.2.3"],
      });
      return "现货独立路径数量及限价输入；未买卖";
    },
  ],
  [
    "012",
    "现货高级菜单不包含条件单及杠杆/附带止盈止损",
    async (page) => {
      await restorePair(page, "HYPE/USDC");
      await chooseMode(page, "市价单");
      await advanced(page).click();
      await pop(page).waitFor({ state: "visible" });
      const items = await pop(page).innerText();
      assert.match(items, /分段委托/);
      assert.match(items, /分时委托/);
      assert.doesNotMatch(items, /止盈止损/);
      await closePop(page);
      assert.equal(
        await root(page)
          .locator('[data-testid="perp-leverage-selector"]')
          .count(),
        0,
      );
      assert.equal(
        await root(page).locator('[data-testid="perp-tpsl-checkbox"]').count(),
        0,
      );
      return items;
    },
  ],

  [
    "013",
    "已有持仓加仓弹窗：市价/限价输入校验并取消",
    async (page) => {
      return forEachPosition(
        page,
        "perps.position.add",
        async (d, index, sample) => {
          assert.ok(
            (await d.innerText()).includes(sample.symbol),
            "Add dialog asset must match clicked position",
          );
          const amount = locator(page, "perps.position.add_amount");
          await rejectInvalid(amount);
          await locator(page, "perps.position.add_type").click();
          await poll(
            () => d.innerText(),
            (v) => v.includes("限价单"),
            "Add position limit",
          );
          const price = d
            .locator('[data-sentry-component="BaseInput"]')
            .filter({ has: page.getByText("限价", { exact: true }) })
            .locator("input");
          await rejectInvalid(price, {
            valid: "12",
            invalid: ["-1", "NaN", "1e3"],
          });
          return `${sample.symbol}样本${index + 1}市价/限价非法输入拒绝；未提交`;
        },
      );
    },
  ],
  [
    "014",
    "已有持仓反手确认展示后取消",
    async (page) => {
      return forEachPosition(
        page,
        "perps.position.reverse",
        async (d, index, sample) => {
          const text = await d.innerText();
          assert.match(text, /反手|Reverse/i);
          for (const label of [
            "当前持仓",
            "反手后",
            "市价单数量",
            "预估强平价",
          ])
            assert.ok(text.includes(label), `Missing reverse field: ${label}`);
          assert.match(
            text,
            /参考价格|价格\s+市价/u,
            "Explicit reference or market price row required",
          );
          const current = text.match(/当前持仓\s+(做多|做空) ([\d.,]+) (\S+)/u);
          const target = text.match(/反手后\s+(做多|做空) ([\d.,]+) (\S+)/u);
          const order = text.match(
            /市价单数量\s+(购买|买入|卖出|出售) ([\d.,]+) (\S+)/u,
          );
          assert.ok(
            current && target && order,
            "Reverse quantities must be readable without compact notation",
          );
          assert.equal(
            current[3],
            sample.symbol,
            "Reverse asset must match clicked table row",
          );
          assert.equal(
            Number(current[2].replaceAll(",", "")),
            Number(sample.size),
            "Reverse current size must match table row",
          );
          assert.equal(target[1], current[1] === "做多" ? "做空" : "做多");
          assert.ok(
            (current[1] === "做多"
              ? ["卖出", "出售"]
              : ["购买", "买入"]
            ).includes(order[1]),
            "Reverse order side must oppose the current position",
          );
          assert.equal(target[2], current[2]);
          assert.equal(target[3], current[3]);
          assert.equal(order[3], current[3]);
          const decimal = (value) => {
            const [whole, fraction = ""] = value.replaceAll(",", "").split(".");
            return { value: BigInt(whole + fraction), scale: fraction.length };
          };
          const a = decimal(current[2]),
            b = decimal(order[2]);
          const scale = Math.max(a.scale, b.scale);
          assert.equal(
            b.value * 10n ** BigInt(scale - b.scale),
            a.value * 2n * 10n ** BigInt(scale - a.scale),
            "Market reverse order size must be exactly twice the visible position size",
          );
          assert.doesNotMatch(text, /NaN|Infinity/);
          return `${current[3]} ${current[1]}${current[2]} → ${target[1]}${target[2]}，市价${order[2]}；未提交`;
        },
      );
    },
  ],
];
export function createNonOrderTests({
  prefix = "PERPS-FORM",
  settingsPrefix = "PERPS-SETTINGS",
  platform = 'desktop',
} = {}) {
  let preReport = null;
  const screenshotDir = resolve(RESULTS_DIR, "perps-non-order");
  mkdirSync(screenshotDir, { recursive: true });
  const testCases = caseDefs.map(([id, name, fn]) => ({
    id: `${prefix}-${id}`,
    name: `Perps-非下单-${name}`,
    fn: async (page) => {
      const t = createStepTracker(`${prefix}-${id}`);
      let before;
      const ready = await safeStep(
        page,
        t,
        "前置：进入合约并备份表单",
        async () => {
          await unlockWalletIfNeeded(page);
          await closePop(page);
          await closeDialog(page);
          await new PerpsPage(page).navigate();
          if (["013", "014"].includes(id))
            await locator(page, "perps.position.tab").click();
          before = await snapshot(page);
          if (before.checkboxes.some((c) => c.state === "unknown"))
            throw Error(
              "Unknown checkbox state; refusing unsafe form mutation",
            );
          return "当前交易对、模式、单位、开关和可见输入已记录";
        },
        screenshotDir,
      );
      if (!ready) return t.result();
      if (
        ["013", "014"].includes(id) &&
        (await locator(
          page,
          id === "013" ? "perps.position.add" : "perps.position.reverse",
        ).count()) === 0
      ) {
        t.skip(name, "需要至少一个可识别的现有持仓样本；不会创建持仓");
        return { ...t.result(), status: "skipped" };
      }
      writeFileSync(
        resolve(screenshotDir, `${prefix}-${id}-before.json`),
        JSON.stringify(before, null, 2),
      );
      transactions.set(page, {
        drafts: new Map([[`${before.pair}:${before.mode}`, before]]),
        restoring: false,
      });
      try {
        await safeStep(page, t, name, () => fn(page), screenshotDir);
      } finally {
        await safeStep(
          page,
          t,
          "恢复原交易对、模式、单位、开关和输入",
          () => restoreTransaction(page, before),
          screenshotDir,
        );
      }
      return t.result();
    },
  }));
  const settings = [
    {
      id: `${settingsPrefix}-001`,
      name: "Perps-碎币设置-入口、状态及权限说明",
      fn: async (page) => {
        const t = createStepTracker(`${settingsPrefix}-001`);
        try {
          await safeStep(
            page,
            t,
            "读取真实碎币开关、禁用状态与当前说明",
            async () => {
              await unlockWalletIfNeeded(page);
              await closePop(page);
              await closeDialog(page);
              await new PerpsPage(page).navigate();
              await preferences(page);
              const control = locator(page, "perps.settings.dusting");
              const checked = await control.getAttribute("aria-checked"),
                disabled = await control.getAttribute("aria-disabled");
              assert.ok(["true", "false"].includes(checked));
              if (disabled === "true")
                assert.match(
                  await pop(page).innerText(),
                  /启用交易|加载|enable trading|loading/i,
                );
              return `checked=${checked}; disabled=${disabled}`;
            },
            screenshotDir,
          );
        } finally {
          await closePop(page);
        }
        return t.result();
      },
    },
    {
      id: `${settingsPrefix}-002`,
      name: "Perps-碎币设置-真实写入、重开与恢复（需已启用交易）",
      fn: async (page) => {
        const t = createStepTracker(`${settingsPrefix}-002`);
        let c, original, accountScope;
        const ready = await safeStep(
          page,
          t,
          "前置：打开碎币设置并读取原值",
          async () => {
            await unlockWalletIfNeeded(page);
            await closePop(page);
            await closeDialog(page);
            await new PerpsPage(page).navigate();
            await preferences(page);
            c = locator(page, "perps.settings.dusting");
            original = await c.getAttribute("aria-checked");
            assert.ok(["true", "false"].includes(original));
            return "原开关状态已记录";
          },
          screenshotDir,
        );
        if (!ready) {
          await closePop(page);
          return t.result();
        }
        if ((await c.getAttribute("aria-disabled")) === "true") {
          t.skip(
            "碎币设置真实写入",
            "当前账户开关禁用；需要已启用交易且状态已加载的账户。未签署启用交易，也未伪造 UI 通过。",
          );
          await closePop(page);
          return { ...t.result(), status: "skipped" };
        }
        accountScope = await dustAccountScope(page);
        try {
          await safeStep(
            page,
            t,
            "改变设置后重新打开独立读取",
            async () => {
              assert.equal(
                await dustAccountScope(page),
                accountScope,
                "Settings account changed",
              );
              await c.click();
              await poll(
                () => c.getAttribute("aria-disabled"),
                (v) => v !== "true",
                "Dust write completion",
                45000,
              );
              assert.equal(
                await c.getAttribute("aria-checked"),
                String(original !== "true"),
              );
              await closePop(page);
              await preferences(page);
              assert.equal(
                await c.getAttribute("aria-checked"),
                String(original !== "true"),
              );
              return "设置完成且目标入口重新读取一致";
            },
            screenshotDir,
          );
          if (t.result().summary.failed === 0)
            await safeStep(
              page,
              t,
              "完整刷新后按同账户读取已保存设置",
              async () => {
                await closePop(page);
                await reloadPerps(page, {
                  navigate: async () => new PerpsPage(page).navigate(),
                  ready: async () =>
                    locator(page, "perps.perp-token-selector").waitFor({
                      state: "visible",
                    }),
                });
                await preferences(page);
                assert.equal(
                  await dustAccountScope(page),
                  accountScope,
                  "Account scope after refresh",
                );
                await poll(
                  () => c.getAttribute("aria-disabled"),
                  (v) => v !== "true",
                  "Dust reload readiness",
                  45000,
                );
                assert.equal(
                  await c.getAttribute("aria-checked"),
                  String(original !== "true"),
                );
                return "真实应用页面刷新后，同账户设置仍为已保存目标值";
              },
              screenshotDir,
            );
        } finally {
          await safeStep(
            page,
            t,
            "恢复原碎币设置",
            async () => {
              await preferences(page);
              assert.equal(
                await dustAccountScope(page),
                accountScope,
                "Refusing to restore another account setting",
              );
              await poll(
                () => c.getAttribute("aria-disabled"),
                (v) => v !== "true",
                "Dust restore readiness",
                45000,
              );
              if ((await c.getAttribute("aria-checked")) !== original) {
                await c.click();
                await poll(
                  () => c.getAttribute("aria-disabled"),
                  (v) => v !== "true",
                  "Dust restore",
                  45000,
                );
              }
              assert.equal(await c.getAttribute("aria-checked"), original);
              await closePop(page);
            },
            screenshotDir,
          );
        }
        return t.result();
      },
    },
  ];
  return {
    testCases,
    settings,
    setup: async (page) => {
      assertTargetPage(page,platform);
      await unlockWalletIfNeeded(page);
      await closePop(page);
      await closeDialog(page);
      await new PerpsPage(page).navigate();
      preReport ??= await runPreconditions(
        page,
        [...testCases, ...settings].map((c) => c.id),
      );
      return preReport;
    },
  };
}
export async function runNonOrderCLI({ testCases, setup, platform = 'desktop' }) {
  const { page } = await connectPlatform(platform);
  page.setDefaultTimeout(15000);
  await page.waitForTimeout(5000);
  const pre = await setup(page);
  const ids = process.argv.slice(2).filter((s) => /\d{3}$/u.test(s));
  const selected = ids.length
    ? testCases.filter((c) => ids.includes(c.id))
    : testCases;
  if (ids.some((id) => !testCases.some((c) => c.id === id)))
    throw Error("Unknown case ID for this group");
  const results = [];
  for (const tc of selected) {
    let result;
    const started = Date.now();
    if (pre.shouldSkip(tc.id))
      result = { status: "skipped", error: "前置条件未满足" };
    else
      try {
        result = await tc.fn(page);
      } catch (e) {
        result = { status: "failed", error: e.message, fatalRestore:Boolean(e.fatalRestore) };
      }
    const output = {
      testId: tc.id,
      ...result,
      duration: Date.now() - started,
      timestamp: new Date().toISOString(),
    };
    results.push(output);
    writeFileSync(
      resolve(RESULTS_DIR, `${tc.id}.json`),
      JSON.stringify(output, null, 2),
    );
    console.log(tc.id, output.status, output.error ?? "");
    if (mustStopAfterResult(output))
      break;
  }
  const summary = {
    status: results.some((r) => r.status === "failed") ? "failed"
      : results.some((r) => r.status === "skipped") ? "skipped" : "passed",
    passed: results.filter((r) => r.status === "passed").length,
    failed: results.filter((r) => r.status === "failed").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    total: results.length,
    notRun: selected.length-results.length,
    fatalRestore: results.some(mustStopAfterResult),
  };
  console.log(JSON.stringify(summary));
  return summary;
}
