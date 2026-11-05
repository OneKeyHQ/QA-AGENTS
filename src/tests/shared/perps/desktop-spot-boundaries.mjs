// D10 手动用例：docs/qa/testcases/cases/perps/2026-04-21_Perps-现货交易.md
// Desktop spot views and editable drafts only. Never click a trade button.
import assert from "node:assert/strict";
import { locator, restorePair, currentPair } from "../../helpers/perps-ui.mjs";
import {
  chooseMode,
  chooseUnit,
  formRoot,
  priceInput,
  pollForm,
} from "./non-order-ui.mjs";
import { createDesktopRowSuite } from "./desktop-row-suite.mjs";
const row = (ids, name, check, extra = {}) => ({
  ids: ids.split(","),
  name,
  check,
  ...extra,
});
const size = (p) => locator(p, "perps.form.size");
async function header(p) {
  return locator(p, "perps.perp-token-selector").evaluate((e) => {
    for (let n = e.parentElement; n; n = n.parentElement)
      if (n.textContent.includes("24小时成交量")) return n.innerText;
    throw Error("Ticker strip containing selector and 24h volume is missing");
  });
}
async function assertMode(p, spot) {
  if (spot) {
    const toggle = locator(p, "perps.perp-trade-side-toggle");
    await toggle.waitFor({ state: "visible" });
    assert.deepEqual(
      (await toggle.innerText())
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      ["买入", "卖出"],
      "Desktop spot uses a side toggle and one active-side submit control",
    );
    assert.equal(
      (await locator(p, "perps.perp-long-button").count()) +
        (await locator(p, "perps.perp-short-button").count()),
      1,
      "One active-side spot button",
    );
  } else {
    const names = await Promise.all(
      ["perps.perp-long-button", "perps.perp-short-button"].map((k) =>
        locator(p, k).innerText(),
      ),
    );
    assert.deepEqual(
      names.map((s) => s.trim()),
      ["买入 / 做多", "卖出 / 做空"],
    );
  }
  assert.equal(
    await locator(p, "perps.perp-leverage-selector").count(),
    spot ? 0 : 1,
  );
  await pollForm(
    () => header(p),
    (v) =>
      spot
        ? v.includes("市值") &&
          v.includes("合约") &&
          !v.includes("资金费率") &&
          !v.includes("预言机价格")
        : v.includes("合约持仓量") &&
          v.includes("资金费率") &&
          v.includes("预言机价格") &&
          !v.includes("市值"),
    "Ticker matches selected mode",
  );
}
async function reject(input, raw, previous = "1.2") {
  await input.fill(previous);
  await input.fill(raw);
  assert.equal(
    await input.inputValue(),
    previous,
    `Reject whole-value paste ${JSON.stringify(raw)}`,
  );
}
export const spotBoundaryDefinitions = [
  {
    id: "PERPS-DESKTOP-SPOT-001",
    name: "Desktop 现货 §1 模式与行情头切换",
    selectorPreferences: true,
    rows: [
      row(
        "D10-28",
        "HYPE现货的方向、杠杆与行情字段",
        async (p) => {
          await restorePair(p, "HYPE/USDC");
          await chooseMode(p, "市价单");
          await assertMode(p, true);
          assert.equal(await currentPair(p), "HYPE/USDC");
          return "现货方向切换、杠杆隐藏、市值与合约显示且无资金费率；Desktop URL hook为空实现，URL条款不计为已覆盖";
        },
        {
          complete: false,
          missing:
            "手动原行URL条款属于Web；Desktop usePerpTokenUrlSync.desktop.ts为空实现，保留平台差异，待台账逐条审核",
        },
      ),
      row("D10-29", "从现货切回BTC永续恢复方向、杠杆与行情字段", async (p) => {
        await restorePair(p, "HYPE/USDC");
        await assertMode(p, true);
        await restorePair(p, "BTCUSDC");
        await assertMode(p, false);
        assert.equal(await currentPair(p), "BTCUSDC");
        return "现货→BTC永续后做多做空、杠杆、持仓量和资金费率恢复，隐藏现货市值和合约";
      }),
      row(
        "D10-34",
        "五次真实市场切换、最终身份与页面错误监控",
        async (p) => {
          const errors = [];
          const listener = (e) => errors.push(e.message);
          p.on("pageerror", listener);
          try {
            for (let i = 0; i < 5; i++) {
              await restorePair(p, i % 2 ? "BTCUSDC" : "HYPE/USDC");
              await assertMode(p, i % 2 === 0);
            }
            assert.equal(await currentPair(p), "HYPE/USDC");
            assert.deepEqual(errors, []);
            return "五次实际切换均检查方向/头部/杠杆及最终市场，无pageerror";
          } finally {
            p.off("pageerror", listener);
          }
        },
        {
          complete: false,
          missing:
            "完整WebSocket订阅去重与漏订阅尚未建立后台进程抓包，当前只覆盖UI和pageerror",
        },
      ),
    ],
  },
  {
    id: "PERPS-DESKTOP-SPOT-004",
    name: "Desktop 现货 §4 限价价格输入边界",
    selectorPreferences: true,
    rows: [
      row("D10-78", "12位整数允许，第13位和小数点拒绝", async (p) => {
        await restorePair(p, "HYPE/USDC");
        await chooseMode(p, "限价单");
        const input = await priceInput(p, "价格");
        await input.fill("123456789012");
        assert.equal(await input.inputValue(), "123456789012");
        await input.press("End");
        await input.pressSequentially("3.");
        assert.equal(await input.inputValue(), "123456789012");
        return "12位整数真实键入追加第13位/点后不变化";
      }),
      row("D10-79", "五位整数不能接小数点，四位可输入小数", async (p) => {
        await restorePair(p, "HYPE/USDC");
        await chooseMode(p, "限价单");
        const input = await priceInput(p, "价格");
        await input.fill("12345");
        await input.press("End");
        await input.pressSequentially(".");
        assert.equal(await input.inputValue(), "12345");
        await input.fill("1234.5");
        assert.equal(await input.inputValue(), "1234.5");
        return "12345.被拒绝，1234.5允许";
      }),
      row("D10-80", "前导零拒绝、中文句号归一", async (p) => {
        await restorePair(p, "HYPE/USDC");
        await chooseMode(p, "限价单");
        const input = await priceInput(p, "价格");
        for (const raw of ["00", "01"]) await reject(input, raw);
        await input.fill("。5");
        assert.equal(await input.inputValue(), ".5");
        return "00/01拒绝，。5→.5";
      }),
    ],
  },
  {
    id: "PERPS-DESKTOP-SPOT-006",
    name: "Desktop 现货 §6 行情字段模式隔离",
    selectorPreferences: true,
    rows: [
      row("D10-116", "现货不显示资金费率或预言机价", async (p) => {
        await restorePair(p, "HYPE/USDC");
        await assertMode(p, true);
        const text = await header(p);
        assert.ok(!text.includes("资金费率"));
        assert.ok(!text.includes("预言机价格"));
        return "目标现货头独立检查两字段均不存在";
      }),
      row(
        "D10-120",
        "切回永续恢复持仓量资金费率并隐藏市值合约",
        async (p) => {
          await restorePair(p, "HYPE/USDC");
          await restorePair(p, "BTCUSDC");
          await assertMode(p, false);
          const text = await header(p);
          assert.ok(!text.split("\n").includes("合约"));
          return "BTC永续头字段恢复；零Builder费率提示另需配置样本";
        },
        {
          complete: false,
          missing: "Builder费率为0的账户/配置样本提示尚未实机覆盖",
        },
      ),
      row("D10-121", "两模式24h成交量均带美元前缀与缩写格式", async (p) => {
        for (const pair of ["BTCUSDC", "HYPE/USDC"]) {
          await restorePair(p, pair);
          await pollForm(
            () => header(p),
            (text) => /24小时成交量\n\$[\d,.]+[KMBT]?/u.test(text),
            "USD 24h volume",
          );
        }
        return "永续和现货独立读取24h成交量均为$数值+可选缩写";
      }),
    ],
  },
  {
    id: "PERPS-DESKTOP-SPOT-010",
    name: "Desktop 现货 §10 非法数量价格输入",
    selectorPreferences: true,
    rows: [
      row("D10-177", "负限价无法输入", async (p) => {
        await restorePair(p, "HYPE/USDC");
        await chooseMode(p, "限价单");
        await reject(await priceInput(p, "价格"), "-1");
        return "负号整值粘贴被拒绝，保持合法价格；不提交";
      }),
      row("D10-178", "市价数量与限价数量价格拒绝字母符号表情", async (p) => {
        await restorePair(p, "HYPE/USDC");
        for (const name of ["市价单", "限价单"]) {
          await chooseMode(p, name);
          await chooseUnit(p, "usd");
          const fields = [size(p)];
          if (name === "限价单") fields.push(await priceInput(p, "价格"));
          for (const input of fields)
            for (const raw of ["abc", "!@#", "😀"]) await reject(input, raw);
        }
        return "市价数量、限价数量和限价价格逐一拒绝三类非法字符，保留上次合法值";
      }),
    ],
  },
];
export const spotBoundarySuite = createDesktopRowSuite(spotBoundaryDefinitions);
