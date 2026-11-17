// D14 手动用例：docs/qa/testcases/cases/perps/2026-08-03_Perps-Unifold充值.md
// Existing-account chain deposit views only. No money transfer/signature.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { RESULTS_DIR } from "../../helpers/index.mjs";
import { locator } from "../../helpers/perps-ui.mjs";
import {
  createDesktopRowSuite,
  SampleUnavailable,
} from "./desktop-row-suite.mjs";
import { closeFunds, accountFingerprint } from "./desktop-funds-boundaries.mjs";
import { closePop, clickVisibleChoice, pollForm } from "./non-order-ui.mjs";
import { markRestoreFailure } from "./runtime.mjs";
import { decodeRenderedQr } from "./qr-evidence.mjs";
import { imageResourceIdentity } from "./image-resource.mjs";
import { projectReactAll } from "./react-projection.mjs";
import {
  unifoldReference,
  assertMinimumDisclosure,
  assertContractDisclosure,
  projectUnifoldSelection,
  projectUnifoldHintCatalog,
  assertUnifoldHintLogos,
  assertUnifoldSelection,
  assertUnifoldCatalogRows,
  unifoldDetailLabels,
  assertUnifoldDetailFields,
  assertUnifoldNetworkMinimum,
} from "./unifold-disclosure-evidence.mjs";
const ui = (p, key) => locator(p, `perps.unifold.${key}`);
const dialogs = (p) => p.getByRole("dialog").filter({ visible: true });
const row = (ids, name, check, extra = {}) => ({
  ids: ids.split(","),
  name,
  check,
  ...extra,
});
async function openMenu(p) {
  await locator(p, "perps.perp-portfolio-button").click();
  await dialogs(p).waitFor({ state: "visible" });
  const actions = locator(p, "perps.perp-portfolio-buttons-btn").filter({
    hasText: "存款",
  });
  if (await actions.count()) await actions.click();
  else await locator(p, "perps.perp-deposit-button").click();
  await pollForm(
    async () => ({
      method: await ui(p, "menu_wallet").count(),
      direct: await locator(p, "perps.funds.token_selector").count(),
    }),
    (v) => v.method === 1 || v.direct === 1,
    "Deposit menu configured branch",
  );
  if (!(await ui(p, "menu_transfer").count()))
    throw new SampleUnavailable(
      "当前服务配置未开放链上收款入口；原生钱包存款仍可达，未创建地址或转账",
    );
}
async function openTransfer(p) {
  await openMenu(p);
  await ui(p, "menu_transfer").click();
  await ui(p, "card").waitFor({ state: "visible", timeout: 15000 });
  await ui(p, "address").waitFor({ state: "visible", timeout: 30000 });
}
async function withView(p, fn) {
  const account = await accountFingerprint(p);
  try {
    return await fn();
  } catch (e) {
    // Capture before cleanup: the outer safeStep screenshot otherwise sees the
    // restored trading page and loses the failing dialog's evidence.
    const path = resolve(
      RESULTS_DIR,
      "perps-desktop-completion",
      `unifold-error-${Date.now()}`,
    );
    try {
      await p.screenshot({ path: `${path}.png` });
      writeFileSync(
        `${path}.json`,
        JSON.stringify(
          await dialogs(p).evaluateAll((es) =>
            es.map((e) => ({
              text: e.innerText,
              elements: [...e.querySelectorAll("[data-testid]")].map((n) => ({
                id: n.dataset.testid,
                text: n.innerText,
                visible: n.checkVisibility(),
              })),
            })),
          ),
          null,
          2,
        ),
      );
    } catch (capture) {
      e.message += `; evidence capture: ${capture.message}`;
    }
    throw e;
  } finally {
    try {
      await closeFunds(p);
      assert.equal(await accountFingerprint(p), account);
    } catch (e) {
      throw markRestoreFailure(null, e, "关闭链上存款并核对原账户");
    }
  }
}
async function qrText(p) {
  const buffer = await ui(p, "qr").screenshot();
  try {
    return await decodeRenderedQr(buffer);
  } catch (e) {
    const path = resolve(
      RESULTS_DIR,
      "perps-desktop-completion",
      `unifold-qr-${Date.now()}.png`,
    );
    writeFileSync(path, buffer);
    e.message += `; crop=${path}`;
    throw e;
  }
}
async function address(p) {
  return ui(p, "address")
    .innerText()
    .then((s) => s.replace(/\s+/gu, ""));
}
async function chooseToken(p, name) {
  await ui(p, "token").click();
  const option = ui(p, "token_options").filter({
    has: p.getByText(name, { exact: true }),
  });
  await clickVisibleChoice(option);
  await closePop(p);
  await pollForm(
    () => ui(p, "token").innerText(),
    (s) => s.split("\n").includes(name),
    "Selected source token",
  );
  await ui(p, "address").waitFor({ state: "visible", timeout: 30000 });
}
async function chooseNetwork(p, name) {
  await ui(p, "network").click();
  const option = ui(p, "network_options").filter({
    has: p.getByText(name, { exact: true }),
  });
  await clickVisibleChoice(option);
  await closePop(p);
  await pollForm(
    () => ui(p, "network").innerText(),
    (s) => s.includes(name),
    "Selected source network",
  );
  await ui(p, "address").waitFor({ state: "visible", timeout: 30000 });
}
const tooltip = (p) => p.getByRole("tooltip").filter({ visible: true });
async function dismissTooltip(p) {
  await p.mouse.move(0, 0);
  await pollForm(
    () => tooltip(p).count(),
    (count) => count === 0,
    "Previous disclosure tooltip closed",
  );
}
async function minimumWarning(p, amount) {
  await dismissTooltip(p);
  const label = dialogs(p).last().getByText(`最低 $${amount}`, { exact: true });
  assert.equal(await label.count(), 1);
  await label.hover();
  const body = tooltip(p).getByText(/^所选网络的最低充值金额为 /u);
  await body.waitFor({ state: "visible", timeout: 10000 });
  assertMinimumDisclosure(
    { trigger: await label.innerText(), tooltip: await body.innerText() },
    amount,
  );
  await dismissTooltip(p);
}
async function contractWarning(p) {
  await dismissTooltip(p);
  assert.equal(await ui(p, "contract").count(), 1);
  await ui(p, "contract").hover();
  await tooltip(p)
    .getByText(/^代币合约地址并非你的存款地址/u)
    .waitFor({ state: "visible", timeout: 10000 });
  assert.equal(await tooltip(p).count(), 1);
  return tooltip(p);
}
async function selection(p, symbol, network) {
  const s = await pollForm(
    async () => {
      const values = await projectReactAll(
        ui(p, "network"),
        projectUnifoldSelection,
        projectUnifoldHintCatalog,
        assertUnifoldHintLogos,
      );
      assert.equal(values.length, 1);
      return values[0];
    },
    (v) => v.symbol === symbol && v.chain.name === network,
    "Committed source token/network selection",
  );
  assertUnifoldSelection(s, symbol, network);
  return s;
}
async function displayedSelection(p, symbol, network) {
  const s = await selection(p, symbol, network);
  assert.ok(s.chain.icon, "Source network icon metadata required");
  for (const key of ["qr", "network"]) {
    const urls = await ui(p, key)
      .locator("img,image")
      .filter({ visible: true })
      .evaluateAll((es) =>
        es.map(
          (e) =>
            e.getAttribute("src") ||
            e.getAttribute("href") ||
            e.getAttribute("xlink:href"),
        ),
      );
    assert.ok(
      urls.some(
        (url) =>
          url &&
          imageResourceIdentity(url) === imageResourceIdentity(s.chain.icon),
      ),
      `${key} displays the selected raw network icon`,
    );
  }
  const route = ui(p, "route");
  assert.equal(
    await route.getByText(symbol, { exact: true }).count(),
    1,
    "Source token in actual route",
  );
  assert.match(await route.innerText(), /USDC \(Perp\)/u);
  if (s.chain.minimum === null || s.chain.minimum === undefined)
    throw new SampleUnavailable("当前网络缺少原始最低金额，不能据UI回推正确值");
  await minimumWarning(p, String(s.chain.minimum));
  if (s.chain.contract?.trim()) {
    const tip = await contractWarning(p);
    if (s.chain.contract.trim().toLowerCase() === "native") {
      assert.equal(await tip.getByText("原生代币", { exact: true }).count(), 1);
      assert.equal(
        await ui(p, "copy_contract").count(),
        0,
        "Native token has no copyable contract",
      );
      assert.equal(
        await tip.getByText(/^0x[\da-f]{40}$/iu).count(),
        0,
        "No stale EVM contract on the native token",
      );
    } else {
      const shown = await tip.getByText(/^0x[\da-f]{40}$/iu).innerText();
      assert.equal(
        shown.toLowerCase(),
        s.chain.contract.toLowerCase(),
        "Displayed contract belongs to selected raw chain",
      );
    }
    await dismissTooltip(p);
  } else
    assert.equal(
      await ui(p, "contract").count(),
      0,
      "No stale contract control when selected token has none",
    );
  return `${symbol}/${network}图标/路径/最低$${s.chain.minimum}/合约已逐项核对`;
}
const checkSourceSwitch = (p) =>
  withView(p, async () => {
    await openTransfer(p);
    await chooseToken(p, "USDC");
    await chooseNetwork(p, "Arbitrum");
    const details = [await displayedSelection(p, "USDC", "Arbitrum")];
    const arb = await address(p),
      arbQr = await qrText(p);
    await chooseNetwork(p, "Ethereum");
    details.push(await displayedSelection(p, "USDC", "Ethereum"));
    assert.equal(await address(p), arb, "Same EVM-family deposit address");
    assert.equal(await qrText(p), arb);
    await chooseToken(p, "BTC");
    details.push(await displayedSelection(p, "BTC", "Bitcoin"));
    assert.notEqual(await address(p), arb);
    await ui(p, "network").click();
    assert.equal(
      await ui(p, "network_options").count(),
      1,
      "BTC supports one network",
    );
    await closePop(p);
    await chooseToken(p, "USDC");
    await chooseNetwork(p, "Arbitrum");
    details.push(await displayedSelection(p, "USDC", "Arbitrum"));
    assert.equal(await address(p), arb);
    assert.equal(await qrText(p), arbQr);
    return details.join("；") + "；地址及QR选回一致";
  });
async function records(p) {
  await ui(p, "tracker_deposit").waitFor({ state: "visible", timeout: 20000 });
  await pollForm(
    async () =>
      (await ui(p, "tracker_rows").count()) > 0 ||
      (await dialogs(p).last().getByText("暂无存款", { exact: true }).count()) >
        0,
    (v) => v,
    "Tracker loading completed",
    20000,
  );
  return ui(p, "tracker_rows").evaluateAll((es) =>
    es.map((e) => ({ id: e.dataset.testid, text: e.innerText })),
  );
}
const checkRecordEntries = (p, requireNonempty = false) =>
  withView(p, async () => {
    await openTransfer(p);
    await ui(p, "history").click();
    const first = await records(p);
    if (requireNonempty && first.length === 0)
      throw new SampleUnavailable(
        "两个入口均为空；逐条状态一致性需要至少一笔已有链上存款记录，不创建真实存款",
      );
    await ui(p, "tracker_deposit").click();
    await ui(p, "card").waitFor({ state: "visible" });
    await closeFunds(p);
    await locator(p, "perps.account.history_tab").click();
    const entry = ui(p, "account_tracker");
    await entry.waitFor({ state: "visible" });
    await entry.click();
    const second = await records(p);
    assert.deepEqual(
      second,
      first,
      "Independent entry exact execution identities and rendered state",
    );
    return `${first.length}条已有记录，两独立入口逐条一致，存款/跟踪双向跳转`;
  });
export const unifoldDefinitions = [
  {
    id: "PERPS-DESKTOP-UNIFOLD-001",
    name: "Desktop 链上存款入口与支持列表",
    rows: [
      row(
        "D14-24",
        "两种来源并列、链上收款文案与网络图标",
        (p) =>
          withView(p, async () => {
            await openMenu(p);
            assert.match(await ui(p, "menu_transfer").innerText(), /链上收款/u);
            assert.match(
              await ui(p, "menu_transfer").innerText(),
              /将其他交易平台\/钱包资产存入永续合约账户/u,
            );
            assert.match(await ui(p, "menu_wallet").innerText(), /从 .+ 转入/u);
            const logos = ui(ui(p, "menu_transfer"), "network_hint_logo");
            await pollForm(
              () => logos.count(),
              (n) => n >= 1,
              "Network hint logos mounted",
            );
            const count = await logos.count();
            assert.ok(count <= 4, "Up to four network logos");
            assert.equal(await logos.filter({ visible: true }).count(), count);
            const raw = await projectReactAll(
              logos.first(),
              projectUnifoldHintCatalog,
            );
            assert.equal(raw.length, 1);
            const actual = await projectReactAll(logos, (start) => {
              for (let f = start; f; f = f.return)
                if (typeof f.memoizedProps?.tokenImageUri === "string")
                  return f.memoizedProps.tokenImageUri;
              throw Error("Actual menu Token source required");
            });
            const suffixes = (await ui(p, "menu_transfer").innerText())
              .split(/\n/u)
              .map((v) => v.trim())
              .filter((v) => /^\+\d+$/u.test(v));
            const expected = assertUnifoldHintLogos(raw[0], actual, suffixes);
            for (let i = 0; i < count; i++) {
              const images = logos.nth(i).locator("img");
              await pollForm(
                () =>
                  images.evaluateAll((nodes) =>
                    nodes.map((n) => ({
                      src: n.currentSrc || n.src,
                      ready: n.complete && n.naturalWidth > 0,
                    })),
                  ),
                (values) => values.length === 1 && values[0].ready,
                "Actual network image loaded",
              );
              const shown = await images.evaluateAll((nodes) =>
                nodes.map((n) => n.currentSrc || n.src),
              );
              assert.deepEqual(shown.map(imageResourceIdentity), [
                imageResourceIdentity(expected.visible[i]),
              ]);
            }
            return `两种来源分别可见，${count}个来源网络图标与原始目录精确相等，剩余+${expected.remaining}`;
          }),
        { complete: true },
      ),
      row("D14-35", "代币列表及网络数量", (p) =>
        withView(p, async () => {
          await openTransfer(p);
          const committed = await projectReactAll(
            ui(p, "token"),
            projectUnifoldSelection,
            projectUnifoldHintCatalog,
            assertUnifoldHintLogos,
          );
          assert.equal(committed.length, 1);
          const symbols = new Set(committed[0].catalog.map((a) => a.symbol));
          const required = [
            "USDC",
            "BTC",
            "SOL",
            "HYPE",
            "USDe",
            "BTCB",
            "UBTC",
          ];
          const missing = required.filter((name) => !symbols.has(name));
          if (missing.length)
            throw new SampleUnavailable(
              `支持目录缺少手动指定样本：${missing.join(",")}；不以其他代币代替`,
            );
          await ui(p, "token").click();
          const options = ui(p, "token_options");
          await options.first().waitFor({ state: "visible" });
          const rows = await options.evaluateAll((es) =>
            es.map((e) => ({
              symbol: e.dataset.testid.slice(
                "perps-unifold-token-option-".length,
              ),
              lines: e.innerText
                .split("\n")
                .map((v) => v.trim())
                .filter(Boolean),
            })),
          );
          assertUnifoldCatalogRows(committed[0].catalog, rows);
          await closePop(p);
          return JSON.stringify(rows);
        }),
      ),
      row("D14-36", "USDC网络最低额和当前勾选唯一", (p) =>
        withView(p, async () => {
          await openTransfer(p);
          await chooseToken(p, "USDC");
          const selectedNetwork = (await ui(p, "network").innerText()).trim();
          await ui(p, "network").click();
          const options = ui(p, "network_options");
          await options.first().waitFor({ state: "visible" });
          const rows = await options.evaluateAll((es) =>
            es.map((e) => e.innerText),
          );
          for (const [name, min] of [
            ["Ethereum", 10],
            ["Base", 3],
            ["Arbitrum", 3],
            ["Polygon", 3],
            ["Optimism", 3],
            ["BSC", 3],
          ]) {
            const matches = rows.filter((s) => s.split("\n").includes(name));
            assert.equal(matches.length, 1, `USDC ${name} exists`);
            assertUnifoldNetworkMinimum(matches[0], name, min);
          }
          assert.equal(
            await options
              .locator('svg[data-sentry-component="SvgCheckRadio"]')
              .count(),
            1,
          );
          const checked = options.filter({
            has: p.locator('svg[data-sentry-component="SvgCheckRadio"]'),
          });
          assert.ok(
            selectedNetwork.includes(
              (await checked.innerText()).split("\n")[0],
            ),
            "Checked network matches trigger selection",
          );
          await closePop(p);
          return "六个网络最低额Ethereum$10、其余$3逐项核对且唯一勾选";
        }),
      ),
    ],
  },
  {
    id: "PERPS-DESKTOP-UNIFOLD-002",
    name: "Desktop 链上地址与QR真实解码",
    rows: [
      row("D14-49", "Arbitrum USDC合约警示、完整参考地址与真实复制", (p) =>
        withView(p, async () => {
          await openTransfer(p);
          await chooseToken(p, "USDC");
          await chooseNetwork(p, "Arbitrum");
          await selection(p, "USDC", "Arbitrum");
          const deposit = await address(p),
            tip = await contractWarning(p);
          const shown = await tip.getByText(/^0x[\da-f]{40}$/iu).innerText();
          const warning = await tip
            .getByText(/^代币合约地址并非你的存款地址/u)
            .innerText();
          const network = await tip
            .getByText("Arbitrum", { exact: true })
            .innerText();
          const original = await p.evaluate(() =>
            navigator.clipboard.readText(),
          );
          let primary;
          try {
            const sentinel = "qa:unifold-contract-copy";
            await p.evaluate((v) => navigator.clipboard.writeText(v), sentinel);
            await pollForm(
              () => p.evaluate(() => navigator.clipboard.readText()),
              (v) => v === sentinel,
              "Distinct pre-click clipboard value",
            );
            assert.equal(await ui(p, "copy_contract").count(), 1);
            await ui(p, "copy_contract").click();
            const copied = await pollForm(
              () => p.evaluate(() => navigator.clipboard.readText()),
              (v) => v === shown,
              "Actual copied full contract",
            );
            assertContractDisclosure({
              warning,
              network,
              shown,
              copied,
              deposit,
            });
          } catch (error) {
            primary = error;
            throw error;
          } finally {
            try {
              await p.evaluate(
                (v) => navigator.clipboard.writeText(v),
                original,
              );
              await pollForm(
                () => p.evaluate(() => navigator.clipboard.readText()),
                (v) => v === original,
                "Original clipboard restored",
              );
              await dismissTooltip(p);
            } catch (error) {
              throw markRestoreFailure(
                primary,
                error,
                "恢复合约复制前剪贴板并关闭Tooltip",
              );
            }
          }
          return "USDC/Arbitrum警示全文、手动文档参考合约、实际复制与不同存款地址分别一致；剪贴板已读回恢复";
        }),
      ),
      row("D14-50", "Arbitrum$3/Ethereum$10最低金额完整提示随网络刷新", (p) =>
        withView(p, async () => {
          await openTransfer(p);
          await chooseToken(p, "USDC");
          const details = [];
          for (const network of ["Arbitrum", "Ethereum"]) {
            await chooseNetwork(p, network);
            await selection(p, "USDC", network);
            const amount = unifoldReference.minimums[network];
            await minimumWarning(p, amount);
            details.push(`${network}:$${amount}完整累计兑换说明`);
          }
          return details.join("；");
        }),
      ),
      row("D14-47", "地址完整显示、复制值与可见QR解码一致", (p) =>
        withView(p, async () => {
          await openTransfer(p);
          const shown = await address(p);
          assert.match(shown, /^(?:0x[\da-fA-F]{40}|[A-Za-z0-9]{26,100})$/u);
          const decoded = await qrText(p);
          assert.equal(
            decoded,
            shown,
            "Real rendered QR decodes to displayed address",
          );
          const original = await p.evaluate(() =>
            navigator.clipboard.readText(),
          );
          let copyError;
          try {
            const sentinel = "qa:unifold-address-copy";
            await p.evaluate((v) => navigator.clipboard.writeText(v), sentinel);
            await pollForm(
              () => p.evaluate(() => navigator.clipboard.readText()),
              (v) => v === sentinel,
              "Distinct pre-click address clipboard",
            );
            await ui(p, "address").click();
            await pollForm(
              () => p.evaluate(() => navigator.clipboard.readText()),
              (v) => v === shown,
              "Actual asynchronous copy of displayed address",
            );
          } catch (error) {
            copyError = error;
            throw error;
          } finally {
            try {
              await p.evaluate(
                (v) => navigator.clipboard.writeText(v),
                original,
              );
              await pollForm(
                () => p.evaluate(() => navigator.clipboard.readText()),
                (v) => v === original,
                "Original address clipboard restored",
              );
            } catch (error) {
              throw markRestoreFailure(
                copyError,
                error,
                "恢复地址复制前剪贴板",
              );
            }
          }
          const logoUrls = await ui(p, "qr")
            .locator("img,image")
            .evaluateAll((es) =>
              es.map(
                (e) =>
                  e.getAttribute("src") ||
                  e.getAttribute("href") ||
                  e.getAttribute("xlink:href"),
              ),
            );
          const selectedUrls = await ui(p, "network")
            .locator("img,image")
            .evaluateAll((es) =>
              es.map(
                (e) =>
                  e.getAttribute("src") ||
                  e.getAttribute("href") ||
                  e.getAttribute("xlink:href"),
              ),
            );
          assert.ok(
            logoUrls.length &&
              selectedUrls.length &&
              logoUrls.some(
                (v) =>
                  v &&
                  selectedUrls.some(
                    (selected) =>
                      selected &&
                      imageResourceIdentity(v) ===
                        imageResourceIdentity(selected),
                  ),
              ),
            "QR center logo matches selected source network",
          );
          const centered = await ui(p, "qr")
            .locator("svg image")
            .evaluateAll((es) =>
              es.map((e) => {
                const a = e.getBoundingClientRect(),
                  b = e.closest("svg").getBoundingClientRect();
                return {
                  width: a.width,
                  height: a.height,
                  dx: Math.abs(a.x + a.width / 2 - b.x - b.width / 2),
                  dy: Math.abs(a.y + a.height / 2 - b.y - b.height / 2),
                };
              }),
            );
          assert.equal(centered.length, 1, "One QR center network image");
          assert.ok(
            centered[0].width > 10 &&
              centered[0].height > 10 &&
              centered[0].dx < 2 &&
              centered[0].dy < 2,
            "Network image is visible in QR center",
          );
          return "可见QR截图独立解码=完整显示地址=实际剪贴板；中心图标资源与所选网络一致（仅剔除缩图参数），剪贴板已恢复";
        }),
      ),
      row(
        "D14-37",
        "网络图标/路径/最低额/合约与EVM-BTC地址联动刷新",
        checkSourceSwitch,
      ),
      row("D14-38", "选回同代币网络的地址和QR一致", checkSourceSwitch, {
        complete: false,
        missing:
          "图标/路径/最低额/合约和地址QR已实现联动及选回核对；Electron后台加载请求缺独立观察，不以地址相等替代没有重新加载。",
      }),
      row("D14-51", "源代币到USDC(Perp)转换路径和费率明细", (p) =>
        withView(p, async () => {
          await openTransfer(p);
          await chooseToken(p, "ETH");
          const route = await ui(p, "route").innerText();
          assert.match(route, /USDC \(Perp\)/u);
          const token = (await ui(p, "token").innerText()).split("\n")[0];
          assert.ok(route.includes(token));
          const detailRows = [];
          for (const label of unifoldDetailLabels) {
            const cell = dialogs(p).last().getByText(label, { exact: true });
            assert.equal(
              await cell.count(),
              1,
              `Unique visible ${label} label`,
            );
            const value = await cell.evaluate((element, expectedLabel) => {
              // Actual DetailRow renders a horizontal two-cell XStack. Stop
              // at the first exact two-line row; never search dialog-wide.
              for (
                let node = element, depth = 0;
                node && depth < 6;
                node = node.parentElement, depth++
              ) {
                const cells = (node.innerText || "")
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean);
                if (cells.length === 2 && cells[0] === expectedLabel)
                  return cells[1];
                if (cells.length > 2) break;
              }
              throw Error(`Missing isolated label/value row: ${expectedLabel}`);
            }, label);
            detailRows.push({ label, value });
          }
          assertUnifoldDetailFields(detailRows);
          return `实际${token}→USDC (Perp)路径；0.25%与时间/滑点/价格影响字段逐项核对`;
        }),
      ),
    ],
  },
  {
    id: "PERPS-DESKTOP-UNIFOLD-003",
    name: "Desktop 链上存款记录与返回",
    rows: [
      row("D14-26", "账户历史真实链上存款入口与记录弹窗", (p) =>
        withView(p, async () => {
          await locator(p, "perps.account.history_tab").click();
          const entry = ui(p, "account_tracker");
          await entry.waitFor({ state: "visible", timeout: 10000 });
          assert.equal((await entry.innerText()).trim(), "链上存款");
          await entry.click();
          await dialogs(p).waitFor({ state: "visible", timeout: 10000 });
          const rows = await records(p);
          assert.equal(await ui(p, "tracker_deposit").count(), 1);
          return `账户历史独立入口打开真实记录弹窗：${rows.length}条；数据为空时明确验证暂无存款且加载完成`;
        }),
      ),
      row("D14-27", "跟踪入口与存款双向跳转", (p) => checkRecordEntries(p)),
      row("D14-79", "双独立入口逐条状态与数量对账（需非空记录）", (p) =>
        checkRecordEntries(p, true),
      ),
      row("D14-78", "当前账户确实无记录时检查空态", (p) =>
        withView(p, async () => {
          await openTransfer(p);
          await ui(p, "history").click();
          const list = await records(p);
          if (list.length)
            throw new SampleUnavailable(
              "当前账户已有链上存款记录，空状态需要既有无记录账户，不删除记录",
            );
          const text = await dialogs(p).last().innerText();
          assert.match(text, /链上存款/u);
          assert.match(text, /暂无.*存款|没有.*存款/u);
          assert.equal(await ui(p, "tracker_deposit").isVisible(), true);
          return "头部、存款按钮与空态同时显示，无持续加载";
        }),
      ),
    ],
  },
];
export const unifoldBoundarySuite = createDesktopRowSuite(unifoldDefinitions);
