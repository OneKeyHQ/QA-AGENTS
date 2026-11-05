// D20 手动用例：docs/qa/testcases/cases/perps/2026-10-28_Perps-Native存取款.md
// Desktop Native funds: navigate, search, edit and inspect only. Never submit.
// D20 §1/2/4; dependent multi-account/quote-failure facets remain explicit.
import assert from "node:assert/strict";
import { locator } from "../../helpers/perps-ui.mjs";
import { unlockWalletIfNeeded } from "../../helpers/index.mjs";
import {
  createDesktopRowSuite,
  SampleUnavailable,
} from "./desktop-row-suite.mjs";
import { pollForm, closePop } from "./non-order-ui.mjs";
import { markRestoreFailure } from "./runtime.mjs";
const dialogs = (p) => p.getByRole("dialog").filter({ visible: true });
const row = (ids, name, check, extra = {}) => ({
  ids: ids.split(","),
  name,
  check,
  ...extra,
});
// The retained page also has perp-btn. Scope to the current top funds dialog.
const submit = (p) => locator(dialogs(p).last(), "perps.funds.submit");
const input = (p) =>
  dialogs(p)
    .last()
    .getByPlaceholder("0", { exact: true })
    .filter({ visible: true });
async function closeTop(p) {
  const top = dialogs(p).last();
  const handle = await top.elementHandle();
  assert.ok(handle);
  const button = top
    .locator(
      '[data-testid="dialog-header-close"], [data-testid="nav-header-close"]',
    )
    .filter({ visible: true });
  assert.equal(await button.count(), 1, "Unique top-dialog close");
  await button.click();
  await p.waitForFunction(
    (e) => !e.isConnected || !e.getBoundingClientRect().width,
    handle,
    { timeout: 10000 },
  );
}
export async function closeFunds(p) {
  await closePop(p);
  for (let i = 0; i < 4 && (await dialogs(p).count()); i++) await closeTop(p);
  assert.equal(
    await dialogs(p).count(),
    0,
    "No funds/portfolio overlay remains",
  );
}
export async function openFunds(p, action) {
  await unlockWalletIfNeeded(p);
  assert.equal(await dialogs(p).count(), 0, "Clean funds entry");
  await locator(p, "perps.perp-portfolio-button").click();
  await dialogs(p).waitFor({ state: "visible" });
  const portfolioActions = locator(p, "perps.perp-portfolio-buttons-btn");
  if (await portfolioActions.count())
    await portfolioActions.filter({ hasText: action }).click();
  else if (
    action === "存款" &&
    (await locator(p, "perps.perp-deposit-button").count())
  )
    await locator(p, "perps.perp-deposit-button").click();
  else
    throw new SampleUnavailable(
      `${action}入口不可用；当前账户无投资组合资金操作区`,
    );
  await unlockWalletIfNeeded(p);
  let methodChooser = false;
  if (action === "存款") {
    const method = dialogs(p)
      .last()
      .getByText(/^从 .+ 转入$/u)
      .filter({ visible: true });
    // The feature config can intentionally bypass this chooser. Wait for either
    // real branch, never treat a chain-receive address as a wallet form.
    await pollForm(
      async () => ({
        method: await method.count(),
        form: await locator(p, "perps.funds.token_selector").count(),
      }),
      (x) => x.method === 1 || x.form === 1,
      "Deposit method or Native form",
    );
    if (await method.count()) {
      methodChooser = true;
      await method.click();
      await unlockWalletIfNeeded(p);
    }
    await locator(p, "perps.funds.token_selector").waitFor({
      state: "visible",
    });
  } else
    await locator(dialogs(p).last(), "perps.funds.withdraw_network")
      .filter({ hasText: /^至 /u })
      .waitFor({ state: "visible" });
  assert.equal(await input(p).count(), 1, "One visible amount field");
  assert.equal(await submit(p).count(), 1, "One current funds submit control");
  return { methodChooser };
}
export async function accountFingerprint(p) {
  const text = await locator(p, "perps.account.boundary").innerText();
  const id = text.match(/0x[\da-f]+(?:\.\.\.|…)[\da-f]+/iu)?.[0];
  assert.ok(id, "Readable account identity required");
  return id.toLowerCase();
}
async function withFunds(p, action, check) {
  const account = await accountFingerprint(p);
  try {
    return await check(await openFunds(p, action));
  } finally {
    try {
      await closeFunds(p);
      assert.equal(
        await accountFingerprint(p),
        account,
        "Funds inspection preserves selected account",
      );
    } catch (e) {
      throw markRestoreFailure(null, e, "关闭资金表单并回读原账户");
    }
  }
}
async function assertDisabled(p) {
  const state = await submit(p).getAttribute("aria-disabled");
  assert.equal(state, "true", "Invalid funds amount cannot submit");
}
async function typeValid(p, text) {
  await input(p).fill(text);
  assert.equal(await input(p).inputValue(), text);
}
async function assertMalformed(p, precision) {
  for (const raw of [
    "-1",
    "+1",
    "abc",
    "NaN",
    "Infinity",
    "1e3",
    "1,000",
    "😀",
    "1 2",
    `1.${"1".repeat(precision + 1)}`,
  ]) {
    await typeValid(p, "0");
    await input(p).fill(raw);
    assert.equal(
      await input(p).inputValue(),
      "0",
      `Reject ${JSON.stringify(raw)}`,
    );
    await assertDisabled(p);
  }
  for (const raw of ["", "0", "0.00"]) {
    await typeValid(p, raw);
    await input(p).press("Tab");
    await assertDisabled(p);
  }
}
export const fundsDefinitions = [
  {
    id: "PERPS-DESKTOP-FUNDS-001",
    name: "Desktop 钱包存款 §1 入口与资产搜索",
    rows: [
      row(
        "D20-21",
        "方式选择与当前账户钱包存款表单",
        (p) =>
          withFunds(p, "存款", async (state) => {
            assert.ok(
              state.methodChooser,
              "Configured deposit must show method selection",
            );
            assert.match(
              await locator(p, "perps.funds.token_selector").innerText(),
              /[A-Za-z]/u,
            );
            assert.equal(await input(p).inputValue(), "");
            return "先选择从当前钱包转入，再进入资产/金额表单，关闭后当前账户不变";
          }),
        {
          complete: false,
          missing:
            "金额区所属账户已按入口上下文核对；尚未独立读取链上来源地址和产品内部账号ID",
        },
      ),
      row(
        "D20-26",
        "按币名/网络大小写及首尾空格搜索、无结果和清空",
        (p) =>
          withFunds(p, "存款", async () => {
            await locator(p, "perps.funds.token_selector").click();
            const items = locator(p, "perps.funds.token_row");
            await items.first().waitFor({ state: "visible" });
            const search = dialogs(p)
              .last()
              .getByPlaceholder(/^(搜索代币|Search tokens)$/u)
              .filter({ visible: true });
            assert.equal(await search.count(), 1, "One asset-list search");
            const names = async () =>
              items.evaluateAll((es) =>
                es.map((e) =>
                  e.innerText
                    .split("\n")
                    .map((v) => v.trim())
                    .filter(Boolean)
                    .slice(0, 2),
                ),
              );
            const original = await names();
            assert.ok(original.length > 0);
            const keyword = original[0][0];
            assert.match(keyword, /^[A-Za-z0-9]+$/u);
            const sets = [];
            for (const q of [
              keyword.toLowerCase(),
              keyword.toUpperCase(),
              `  ${keyword}  `,
            ]) {
              await search.fill(q);
              await pollForm(
                () => items.count(),
                (n) => n > 0,
                "Asset results",
              );
              sets.push(await names());
            }
            assert.deepEqual(sets[0], sets[1]);
            assert.deepEqual(sets[1], sets[2]);
            await search.fill("qa-no-asset-abcdef123456");
            await pollForm(
              () => items.count(),
              (n) => n === 0,
              "Empty asset search",
            );
            assert.match(
              await dialogs(p).last().innerText(),
              /未找到|没有结果|No results/u,
            );
            await search.fill("");
            await pollForm(
              () => items.count(),
              (n) => n === original.length,
              "Clear search",
            );
            assert.deepEqual(await names(), original);
            return `当前${original.length}项，${keyword}大小写/空白一致，无结果与清空独立核对`;
          }),
        {
          complete: false,
          missing:
            "目前不切换资产；网络搜索、同名其他网络的合约/余额联动仍需真实资产原始数据对账",
        },
      ),
    ],
  },
  {
    id: "PERPS-DESKTOP-FUNDS-002",
    name: "Desktop 钱包存款 §2 金额输入边界",
    rows: [
      row(
        "D20-37",
        "默认美元两位精度、空零及非法值",
        (p) =>
          withFunds(p, "存款", async () => {
            await assertMalformed(p, 2);
            return "空/零禁止提交；负数、非数、科学计数及超2位美元精度逐项拒绝；未触发确认或签名";
          }),
        {
          complete: false,
          missing:
            "尚需切换代币单位及最终确认金额对账；本用例只检查提交前输入层",
        },
      ),
      row(
        "D20-35",
        "默认美元最低额4.99/5/5.01的提示与按钮",
        (p) =>
          withFunds(p, "存款", async () => {
            await typeValid(p, "4.99");
            await input(p).press("Tab");
            await assertDisabled(p);
            assert.match(
              await dialogs(p).last().innerText(),
              /最[小低].*(?:存款|存入)|(?:存款|存入).*最[小低]/u,
            );
            for (const amount of ["5", "5.01"]) {
              await typeValid(p, amount);
              await input(p).press("Tab");
              assert.equal(await input(p).inputValue(), amount);
            }
            return "4.99显示最低额错误且禁用；5/5.01保留输入，账户余额/报价尚未满足可继续的完整条件";
          }),
        {
          complete: false,
          missing:
            "当前资金余额/手续费/报价能否放行以及非稳定币兑换边界需额外样本；源码已对价格参数展开",
        },
      ),
    ],
  },
  {
    id: "PERPS-DESKTOP-FUNDS-004",
    name: "Desktop 提现 §4 网络及金额校验",
    rows: [
      row(
        "D20-61",
        "目标网络入口、实际开放选项与当前选中项",
        (p) =>
          withFunds(p, "提现", async () => {
            const trigger = locator(
              dialogs(p).last(),
              "perps.funds.withdraw_network",
            ).filter({ hasText: /^至 /u });
            const current = (await trigger.innerText()).trim();
            assert.ok(current.length > 0);
            await trigger.click();
            const panel = locator(p, "perps.overlay.popover");
            await panel.waitFor({ state: "visible" });
            const labels = (await panel.innerText())
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean);
            assert.ok(
              labels.length >= 1 && labels.length <= 7,
              "Configured target networks only",
            );
            assert.equal(new Set(labels).size, labels.length);
            assert.ok(
              labels.some((v) => current.includes(v)),
              "Current destination belongs to available networks",
            );
            await closePop(p);
            return JSON.stringify({ current, labels });
          }),
        {
          complete: false,
          missing:
            "当前只验证开放选项及选中值；尚未逐网络切换并对照地址、通道和费用，不能按六网络已验证计数",
        },
      ),
      row(
        "D20-65",
        "空、零、负值、六位精度及超余额",
        (p) =>
          withFunds(p, "提现", async () => {
            await assertMalformed(p, 6);
            await typeValid(p, "999999999");
            await input(p).press("Tab");
            await assertDisabled(p);
            assert.match(
              await dialogs(p).last().innerText(),
              /余额不足|Insufficient/u,
            );
            await typeValid(p, "0");
            await input(p).press("Tab");
            assert.doesNotMatch(
              await dialogs(p).last().innerText(),
              /NaN|Infinity/u,
            );
            return "超余额禁止提交；非法、超6位精度拒绝，空/零禁用，修正后无非有限数";
          }),
        {
          complete: false,
          missing:
            "需余额足够账户进一步确认修正为有效金额后错误解除及最终确认金额；没有点击提交",
        },
      ),
    ],
  },
];
export const fundsBoundarySuite = createDesktopRowSuite(fundsDefinitions);
