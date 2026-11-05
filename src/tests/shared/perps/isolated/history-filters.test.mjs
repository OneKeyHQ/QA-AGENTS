import test from "node:test";
import assert from "node:assert/strict";
import { React, renderer, evaluateSource, perpsUtils } from "./source.mjs";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const utils = perpsUtils();
const funding = evaluateSource(
  "packages/kit/src/views/Perp/components/OrderInfoPanel/fundingHistoryDisplay.ts",
  {
    mocks: {
      "@onekeyhq/shared/src/utils/perpsUtils": utils,
      "@onekeyhq/shared/src/errors": { OneKeyLocalError: Error },
    },
  },
);
test("历史筛选切账户清空类型/方向/市场，普通刷新保留筛选", async () => {
  let account = { accountAddress: "0xaaa" },
    value,
    tree;
  const { useTradeHistoryFilters: hook } = evaluateSource(
    "packages/kit/src/views/Perp/hooks/useTradeHistoryFilters.ts",
    {
      mocks: {
        "@onekeyhq/kit-bg/src/states/jotai/atoms": {
          usePerpsActiveAccountAtom: () => [account],
        },
        "../components/OrderInfoPanel/fundingHistoryDisplay": funding,
      },
    },
  );
  function Probe() {
    value = hook();
    return null;
  }
  const render = async () =>
    renderer.act(async () => {
      if (tree) tree.update(React.createElement(Probe));
      else tree = renderer.create(React.createElement(Probe));
    });
  try {
    await render();
    await renderer.act(async () =>
      value.setFilters({ type: "spot", side: "buy", market: "HYPE" }),
    );
    await render();
    assert.equal(value.filters.market, "HYPE");
    account = { accountAddress: "0xbbb" };
    await render();
    assert.equal(value.filters.type, "all");
    assert.equal(value.filters.side, "all");
    assert.equal(value.filters.market, undefined);
  } finally {
    if (tree) await renderer.act(async () => tree.unmount());
  }
});
