// Historical-share regressions, using real hooks and synthetic completed fills.
// Known defects remain executable TODO assertions; a TODO is never a pass.
import test from "node:test";
import assert from "node:assert/strict";
import {
  React,
  renderer,
  evaluateSource,
  perpsUtils,
  BigNumber,
} from "./source.mjs";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const utils = perpsUtils();
const direction = evaluateSource(
  "packages/kit/src/views/Perp/components/OrderInfoPanel/utils.ts",
  { names: ["getPerpFillDirectionType"] },
);
const { canShareTradeFill } = evaluateSource(
  "packages/kit/src/views/Perp/components/OrderInfoPanel/Components/tradeFillDisplay.ts",
  { names: ["canShareTradeFill"], globals: { BigNumber, ...utils } },
);
const normal = {
  coin: "BTC",
  dir: "Close Long",
  side: "A",
  sz: "1",
  px: "110",
  closedPnl: "10",
  fee: ".1",
  startPosition: "1",
};
async function share(fill, leverage = 5) {
  let output, callback, tree;
  const { useShareTradeHistory: useHook } = evaluateSource(
    "packages/kit/src/views/Perp/hooks/useShareTradeHistory.ts",
    {
      mocks: {
        "@onekeyhq/kit/src/background/instance/backgroundApiProxy": {
          serviceHyperliquid: {
            getSymbolMeta: async () => ({ universe: { maxLeverage: 40 } }),
          },
        },
        "@onekeyhq/kit-bg/src/states/jotai/atoms": {
          usePerpsActiveAssetAtom: () => [
            { coin: "BTC", universe: { maxLeverage: 40 } },
          ],
          usePerpsLastUsedLeverageAtom: () => [{ BTC: leverage }],
          useSpotPairDisplayMapAtom: () => [{}],
        },
        "@onekeyhq/shared/src/utils/perpsUtils": utils,
        "../components/OrderInfoPanel/utils": direction,
        "./useShowPositionShare": {
          useShowPositionShare: () => ({
            showPositionShare: (value) => {
              output = value;
            },
          }),
        },
      },
    },
  );
  function Probe() {
    callback = useHook();
    return null;
  }
  try {
    await renderer.act(async () => {
      tree = renderer.create(React.createElement(Probe));
    });
    await renderer.act(async () => callback(fill));
    return output;
  } finally {
    if (tree) await renderer.act(async () => tree.unmount());
  }
}
for (const [name, patch, expected] of [
  ["普通非零平仓", {}, true],
  ["反手非零平仓", { dir: "Long > Short" }, true],
  ["零已实现盈亏", { closedPnl: "0" }, false],
  ["现货", { coin: "HYPE/USDC" }, false],
  [
    "强平",
    {
      liquidation: {
        liquidatedUser: "synthetic",
        markPx: "100",
        method: "market",
      },
    },
    false,
  ],
])
  test(`历史分享资格 ${name}`, () =>
    assert.equal(canShareTradeFill({ ...normal, ...patch }), expected));
for (const [dir, px, expectedEntry] of [
  ["Close Long", "110", 100],
  ["Close Short", "90", 100],
])
  test(`历史${dir}按原始数量/价格/费用计算`, async () => {
    const result = await share({ ...normal, dir, px });
    assert.equal(new BigNumber(result.entryPrice).toNumber(), expectedEntry);
    assert.equal(result.pnl, "9.9");
    assert.equal(result.pnlPercent, "49.50");
    assert.equal(new BigNumber(result.markPrice).toNumber(), Number(px));
  });
test("R01 已提交：同笔历史 ROE 不随当前杠杆变化", async (t) => {
  const first = await share(normal, 2),
    second = await share(normal, 10);
  assert.equal(second.pnl, first.pnl);
  assert.equal(second.entryPrice, first.entryPrice);
  assert.ok(
    new BigNumber(first.pnlPercent).isFinite() &&
      new BigNumber(second.pnlPercent).isFinite(),
  );
  t.todo("用户已提交缺陷，等待产品修复；仅隔离源码复现");
  assert.equal(second.pnlPercent, first.pnlPercent);
});
for (const dir of ["Long > Short", "Short > Long"])
  test(`B01 已知回归：${dir} 不得输出虚假0成本/0ROE`, async (t) => {
    const result = await share({
      ...normal,
      dir,
      side: dir === "Long > Short" ? "A" : "B",
      sz: "2",
    });
    assert.equal(result.pnl, "9.9");
    assert.equal(typeof result.entryPrice, "string");
    t.todo("原审查问题，待产品修复及历史成本口径验收");
    assert.notEqual(result.entryPrice, "0");
    assert.notEqual(result.pnlPercent, "0");
  });
test("B02 已知回归：热门现货使用完整 BASE/QUOTE", async (t) => {
  const asset = {
    name: "@107",
    baseName: "HYPE",
    quoteName: "USDC",
    displayName: "HYPE",
    assetId: 10107,
  };
  let output, tree;
  const { usePopularTickers: useHook } = evaluateSource(
    "packages/kit/src/views/Perp/hooks/usePopularTickers.ts",
    {
      mocks: {
        "@onekeyhq/kit/src/background/instance/backgroundApiProxy": {},
        "@onekeyhq/kit/src/states/jotai/contexts/hyperliquid": {
          useActiveTradeInstrumentAtom: () => [{ mode: "spot" }],
        },
        "@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms": {
          usePerpsAllAssetCtxsAtom: () => [{ assetCtxsByDex: [] }],
        },
        "@onekeyhq/kit-bg/src/states/jotai/atoms": {
          useSpotAssetCtxsMapAtom: () => [
            {
              "@107": {
                dayNtlVlm: "50000",
                midPx: "110",
                markPx: "110",
                prevDayPx: "100",
              },
            },
          ],
          useSpotExternalMarketCapsAtom: () => [{}],
          usePerpTokenSelectorTabsAtom: () => [[]],
        },
        "@onekeyhq/shared/src/utils/perpsDexUtils": {},
        "@onekeyhq/shared/src/utils/perpsUtils": utils,
        "../../../hooks/usePromiseResult": {
          usePromiseResult: () => ({
            result: { mode: "spot", data: [asset] },
          }),
        },
        "../utils/popularTickers": {},
        "../utils/tokenSelectorTabs": {},
      },
    },
  );
  function Probe() {
    output = useHook();
    return null;
  }
  try {
    await renderer.act(async () => {
      tree = renderer.create(React.createElement(Probe));
    });
    assert.equal(output.length, 1);
    assert.equal(output[0].coinName, "@107");
    t.todo("原审查问题，等待产品修复；不修改现行预期");
    assert.equal(output[0].displayName, "HYPE/USDC");
  } finally {
    if (tree) await renderer.act(async () => tree.unmount());
  }
});
