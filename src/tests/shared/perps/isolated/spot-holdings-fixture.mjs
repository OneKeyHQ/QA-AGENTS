// Actual SpotBalanceList -> BalanceRow, valuation/filter/formatting, metadata
// retry hook and visible-count hook. Table virtualization/layout is a host;
// account atoms are controlled inputs, not a live account-selection pipeline.
import {
  React,
  renderer,
  evaluateSource,
  readSource,
  perpsUtils,
  appRequire,
} from "./source.mjs";
import { numberUtils } from "./number-format-source.mjs";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const base = "packages/kit/src/views/Perp/";
const utils = perpsUtils(),
  numbers = numberUtils();
const locale = evaluateSource(
  "packages/shared/src/locale/enum/translations.ts",
);
const messages = Object.fromEntries(
  ["zh_CN", "en_US"].map((lang) => [
    lang,
    JSON.parse(readSource(`packages/shared/src/locale/json/${lang}.json`)),
  ]),
);
const orderUtils = evaluateSource(`${base}components/OrderInfoPanel/utils.ts`, {
  mocks: {
    "@onekeyhq/shared/src/locale": locale,
    "@onekeyhq/shared/src/utils/numberUtils": numbers,
    "@onekeyhq/shared/src/utils/perpsTpSlUtils": evaluateSource(
      "packages/shared/src/utils/perpsTpSlUtils.ts",
    ),
    "@onekeyhq/shared/src/utils/perpsUtils": utils,
  },
});
const types = evaluateSource("packages/shared/types/hyperliquid/types.ts", {
  names: ["EHyperLiquidAbstractionMode"],
});
const mode = evaluateSource(`${base}utils/accountMode.ts`, {
  mocks: { "@onekeyhq/shared/types/hyperliquid": types },
});
const ids = evaluateSource(`${base}testIDs.ts`);
const host = (name) => {
  const C = ({ children, ...props }) =>
    React.createElement(name, props, children);
  C.displayName = name;
  return C;
};
export const holding = (coin, total, hold = "0", entryNtl = "0") => ({
  coin,
  total,
  hold,
  entryNtl,
});
export const spotUniverse = (
  baseName,
  quoteName = "USDC",
  name = `${baseName}/${quoteName}`,
) => ({ baseName, quoteName, name });
export async function spotHoldingsFixture(patch = {}) {
  const state = {
    balances: [
      holding("USDC", "2", "1"),
      holding("UBTC", "2", "0.5", "100"),
      holding("UETH", "3", "5", "120"),
    ],
    loaded: true,
    account: { accountAddress: "0xaaa" },
    computed: { isLoading: false },
    summary: { totalRawUsd: "10", withdrawable: "7" },
    mode: undefined,
    hideSmall: false,
    locale: "zh_CN",
    depositDisabled: false,
    prices: { "UBTC/USDC": { markPx: "100" }, "UETH/USDC": { markPx: "20" } },
    meta: {
      universes: [spotUniverse("UBTC"), spotUniverse("UETH")],
      tokens: [
        {
          name: "UBTC",
          tokenId: "0xABCDEF1234567890ABCDEF1234567890",
          evmContract: { address: "0x111111" },
        },
      ],
    },
    ...patch,
  };
  const clock = appRequire("@sinonjs/fake-timers").createClock(1800000000000);
  const calls = {
    meta: 0,
    copied: [],
    opened: [],
    shares: [],
    changes: [],
    deposits: [],
    refresh: 0,
    guide: 0,
  };
  const actions = {
    current: {
      changeActiveSpotAsset: async (data) => calls.changes.push(data),
      refreshAllPerpsData: async () => {
        calls.refresh += 1;
      },
    },
  };
  const intl = () => ({
    formatMessage: ({ id }) => {
      if (!(id in messages[state.locale])) throw Error(`Untranslated ${id}`);
      return messages[state.locale][id];
    },
  });
  const components = Object.fromEntries(
    [
      "Badge",
      "Icon",
      "IconButton",
      "SizableText",
      "NumberSizeableText",
      "XStack",
      "YStack",
      "Button",
      "Illustration",
    ].map((name) => [name, host(name)]),
  );
  components.useClipboard = () => ({
    copyText: (text) => calls.copied.push(text),
  });
  components.useMedia = () => ({ gtMd: true });
  const atoms = {
    useSpotBalancesAtom: () => [
      { balances: state.balances, isLoaded: state.loaded },
    ],
    usePerpsComputedAccountValueAtom: () => [state.computed],
    usePerpsActiveAccountSummaryAtom: () => [state.summary],
    usePerpsActiveAccountAtom: () => [state.account],
    usePerpsAbstractionModeAtom: () => [state.mode],
    usePerpsCustomSettingsAtom: () => [
      { hideSmallSpotHoldings: state.hideSmall },
    ],
    useSpotAssetCtxsMapAtom: () => [state.prices],
  };
  const metadata = evaluateSource(`${base}hooks/useSpotMetaMaps.ts`, {
    globals: {
      setTimeout: clock.setTimeout.bind(clock),
      clearTimeout: clock.clearTimeout.bind(clock),
    },
    mocks: {
      "@onekeyhq/kit/src/background/instance/backgroundApiProxy": {
        serviceHyperliquid: {
          getSpotMeta: async () => {
            calls.meta += 1;
            return state.meta;
          },
        },
      },
      "@onekeyhq/shared/src/utils/perpsUtils": utils,
    },
  });
  const deposit = {
    useShowDepositWithdrawModal: () => ({
      isDepositDisabled: state.depositDisabled,
      showDepositWithdrawModal: (type) => calls.deposits.push(type),
    }),
  };
  const common = {
    "react-intl": { useIntl: intl },
    "@onekeyhq/components": components,
    "@onekeyhq/shared/src/locale": locale,
  };
  const empty = evaluateSource(
    `${base}components/OrderInfoPanel/Components/PerpHoldingsEmptyState.tsx`,
    {
      mocks: {
        ...common,
        "@onekeyhq/kit-bg/src/states/jotai/atoms": atoms,
        "../../../hooks/useShowDepositWithdrawModal": deposit,
        "../../../hooks/useShowGuide": {
          useShowGuide: () => ({
            showGuide: () => {
              calls.guide += 1;
            },
          }),
        },
        "../../../testIDs": ids,
        "../../Guide/PerpGuidePopover": {
          PerpGuidePopover: ({ renderTrigger }) =>
            React.createElement("GuidePopover", null, renderTrigger),
        },
      },
    },
  );
  const row = evaluateSource(
    `${base}components/OrderInfoPanel/Components/BalanceRow.tsx`,
    {
      mocks: {
        ...common,
        "@onekeyhq/kit/src/components/ListItem": { ListItem: host("ListItem") },
        "@onekeyhq/kit/src/components/Token": { Token: host("Token") },
        "@onekeyhq/kit/src/utils/explorerUtils": {
          openHyperLiquidTokenExplorerUrl: async (data) =>
            calls.opened.push(data),
        },
        "@onekeyhq/kit/src/views/Perp/testIDs": ids,
        "@onekeyhq/shared/src/utils/numberUtils": numbers,
        "../../../hooks/useShowPositionShare": {
          useShowPositionShare: () => ({
            showPositionShare: (data) => calls.shares.push(data),
          }),
        },
        "../utils": orderUtils,
      },
    },
  );
  const list = evaluateSource(
    `${base}components/OrderInfoPanel/List/SpotBalanceList.tsx`,
    {
      mocks: {
        ...common,
        "@onekeyhq/kit/src/states/jotai/contexts/hyperliquid": {
          useHyperliquidActions: () => actions,
        },
        "@onekeyhq/kit-bg/src/states/jotai/atoms": atoms,
        "@onekeyhq/shared/src/utils/perpsUtils": utils,
        "../../../hooks/useShowDepositWithdrawModal": deposit,
        "../../../hooks/useSpotMetaMaps": metadata,
        "../../../testIDs": ids,
        "../../../utils": mode,
        "../../TradingPanel/components/PerpsAccountNumberValue": {
          PerpsPartialAccountValueWarning: host("Warning"),
        },
        "../Components/BalanceRow": row,
        "../Components/HideSmallSpotHoldingsCheckbox": {
          HideSmallSpotHoldingsCheckbox: host("HideSmallCheckbox"),
        },
        "../Components/PerpHoldingsEmptyState": empty,
        "../utils": orderUtils,
        "./CommonTableListView": {
          CommonTableListView: (props) =>
            React.createElement(
              "HoldingsTable",
              props,
              props.data.length
                ? props.data.map((item, index) =>
                    React.createElement(
                      "HoldingRow",
                      { key: item.rawCoin, rawCoin: item.rawCoin },
                      props.renderRow(item, index),
                    ),
                  )
                : !props.listLoading
                  ? props.ListEmptyComponent
                  : null,
            ),
        },
      },
    },
  );
  const count = evaluateSource(`${base}hooks/useVisibleSpotHoldingsCount.ts`, {
    mocks: {
      "@onekeyhq/kit-bg/src/states/jotai/atoms": atoms,
      "../components/OrderInfoPanel/utils": orderUtils,
      "./useSpotMetaMaps": metadata,
    },
  });
  let tree, tabCount;
  function Probe() {
    tabCount = count.useVisibleSpotHoldingsCount({
      balances: state.balances,
      hasPerpsUsdc: Number(state.summary?.totalRawUsd) > 0,
    });
    return React.createElement(list.SpotBalanceList);
  }
  const render = async () =>
    renderer.act(async () => {
      if (tree) tree.update(React.createElement(Probe));
      else tree = renderer.create(React.createElement(Probe));
    });
  await render();
  return {
    state,
    calls,
    clock,
    ids: ids.PerpTestIDs,
    types,
    get root() {
      return tree.root;
    },
    get table() {
      return tree.root.findByType("HoldingsTable");
    },
    get tabCount() {
      return tabCount;
    },
    row: (rawCoin) =>
      tree.root
        .findAllByType("HoldingRow")
        .find((node) => node.props.rawCoin === rawCoin),
    texts: (node) =>
      (node ?? tree.root)
        .findAllByType("SizableText")
        .map((node) => node.children.join("")),
    update: async (patch) => {
      Object.assign(state, patch);
      await render();
    },
    tick: async (ms) => renderer.act(async () => clock.tickAsync(ms)),
    close: async () => renderer.act(async () => tree.unmount()),
  };
}
