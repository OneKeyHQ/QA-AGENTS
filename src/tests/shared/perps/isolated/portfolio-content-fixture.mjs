// Actual Desktop portfolio content, data hook, stats and formatting. External
// requests, chart engine, layout hosts and funding-query hook are local seams.
import {
  React,
  renderer,
  evaluateSource,
  readSource,
  appRequire,
  perpsUtils,
} from "./source.mjs";
import { promiseHookFixture } from "./promise-hook-fixture.mjs";
import { numberUtils } from "./number-format-source.mjs";
const base = "packages/kit/src/views/Perp/components/Portfolio/";
const { createIntl } = appRequire("react-intl");
const host =
  (type) =>
  ({ children, ...props }) =>
    React.createElement(type, props, children);
export const portfolioNow = 1800000000000;
export const portfolioFill = (coin, pnl, patch = {}) => ({
  coin,
  closedPnl: String(pnl),
  sz: "2",
  px: "100",
  fee: "0.1",
  feeToken: "USDC",
  time: portfolioNow - 1000,
  ...patch,
});
export const portfolioFunding = (coin, value, ago = 1000) => ({
  time: portfolioNow - ago,
  hash: `local-${coin}-${ago}`,
  delta: { coin, usdc: String(value), szi: "1", fundingRate: "0.0001" },
});
export function portfolioHistory(total = "25", perps = "15") {
  return [
    "day",
    "week",
    "month",
    "allTime",
    "perpDay",
    "perpWeek",
    "perpMonth",
    "perpAllTime",
  ].map((key, i) => [
    key,
    {
      accountValueHistory: [
        [portfolioNow - 10000, "100"],
        [portfolioNow - 1000, "120"],
      ],
      pnlHistory: [
        [portfolioNow - 10000, "0"],
        [portfolioNow - 1000, key.startsWith("perp") ? perps : total],
      ],
      vlm: "12000",
    },
  ]);
}
export async function portfolioContentFixture(patch = {}) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const state = {
    locale: "zh_CN",
    account: { accountAddress: "0xaaa" },
    summary: {
      totalUnrealizedPnl: "2",
      totalNtlPos: "400",
      totalMarginUsed: "50",
    },
    value: { accountValue: "100", withdrawable: "50" },
    mmr: { mmrPercent: "20" },
    positions: [{}],
    trades: {
      accountAddress: "0xaaa",
      fills: [
        portfolioFill("BTC", 20),
        portfolioFill("ETH", -5),
        portfolioFill("@107", 10),
      ],
    },
    history: portfolioHistory(),
    deposits: [],
    funding: [portfolioFunding("BTC", 3), portfolioFunding("ETH", -1)],
    fundingLoading: false,
    fundingError: false,
    failureAt: null,
    ...patch,
  };
  const events = [],
    requests = [];
  let tree;
  class Clock extends Date {
    static now() {
      return portfolioNow;
    }
  }
  const constants = evaluateSource(
    "packages/shared/types/hyperliquid/perp.constants.ts",
  );
  const enums = evaluateSource("packages/shared/types/hyperliquid/types.ts", {
    names: ["EHyperLiquidAbstractionMode", "ETriggerOrderType"],
  });
  const nums = numberUtils(state.locale === "en_US" ? "en-US" : "zh-CN");
  const utils = evaluateSource("packages/shared/src/utils/perpsUtils.ts", {
    mocks: {
      "@onekeyhq/shared/src/errors": { OneKeyLocalError: Error },
      "@onekeyhq/shared/types/hyperliquid/perp.constants": constants,
      "@onekeyhq/shared/types/hyperliquid/types": enums,
      "./numberUtils": nums,
    },
  });
  const stats = evaluateSource(base + "portfolioStats.ts", {
    globals: { Date: Clock },
    mocks: {
      "@onekeyhq/shared/src/utils/perpsUtils": utils,
      "@onekeyhq/shared/types/hyperliquid/perp.constants": constants,
    },
  });
  const ETranslations = evaluateSource(
    "packages/shared/src/locale/enum/translations.ts",
  ).ETranslations;
  const intls = Object.fromEntries(
    ["zh_CN", "en_US"].map((locale) => [
      locale,
      createIntl({
        locale: locale === "en_US" ? "en" : "zh-CN",
        messages: JSON.parse(
          readSource(`packages/shared/src/locale/json/${locale}.json`),
        ),
        onError: (e) => {
          throw e;
        },
      }),
    ]),
  );
  const theme = new Proxy(
    { bgAccent: { val: "#30a46c" }, bgCriticalStrong: { val: "#e5484d" } },
    { get: (o, k) => o[k] ?? { val: "#777777" } },
  );
  const components = Object.fromEntries(
    [
      "Button",
      "DashText",
      "Divider",
      "Icon",
      "Illustration",
      "SegmentControl",
      "SizableText",
      "Skeleton",
      "Stack",
      "XStack",
      "YStack",
    ].map((n) => [n, host(n)]),
  );
  components.ActionList = ({ renderTrigger, children, ...props }) =>
    React.createElement("ActionList", props, renderTrigger, children);
  components.useTheme = () => theme;
  const atoms = {
    usePerpsActiveAccountAtom: () => [state.account],
    usePerpsActiveAccountMmrAtom: () => [state.mmr],
    usePerpsComputedAccountValueAtom: () => [state.value],
    useSpotPairDisplayMapAtom: () => [{ "@107": "HYPE/USDC" }],
    usePerpsActiveAccountSummaryAtom: () => [state.summary],
    usePerpsTradesHistoryDataAtom: () => [state.trades],
  };
  function usePromiseResult(fn, deps) {
    const [result, set] = React.useState({
      result: undefined,
      isLoading: true,
    });
    React.useEffect(() => {
      let active = true;
      set((old) => ({ ...old, isLoading: true }));
      void fn().then(
        (value) => {
          if (active) set({ result: value, isLoading: false });
        },
        (error) => {
          if (active) set({ result: undefined, isLoading: false, error });
        },
      );
      return () => {
        active = false;
      };
    }, deps);
    return result;
  }
  const backgroundApiProxy = {
    serviceHyperliquid: Object.fromEntries(
      [
        "getPortfolioHistory",
        "loadTradesHistory",
        "resetTradesHistory",
        "getPortfolioNetDeposits",
      ].map((name) => [
        name,
        async (payload) => {
          requests.push({ name, payload });
          if (state.failureAt === name) throw Error(name + " failed");
          if (name === "getPortfolioHistory") return state.history;
          if (name === "getPortfolioNetDeposits") return state.deposits;
          return null;
        },
      ]),
    ),
  };
  const data = evaluateSource(base + "usePerpPortfolioData.ts", {
    globals: { Date: Clock },
    mocks: {
      "@onekeyhq/kit/src/background/instance/backgroundApiProxy":
        backgroundApiProxy,
      "@onekeyhq/kit/src/hooks/usePromiseResult": { usePromiseResult },
      "@onekeyhq/kit-bg/src/states/jotai/atoms": atoms,
      "./portfolioStats": stats,
    },
  });
  const breakdown = evaluateSource(base + "PerpFundingBreakdown.tsx", {
    globals: { Date: Clock },
    mocks: {
      "react-intl": { useIntl: () => intls[state.locale] },
      "react-native-svg": {
        __esModule: true,
        default: host("Svg"),
        Circle: host("Circle"),
      },
      "@onekeyhq/components": components,
      "@onekeyhq/shared/src/locale": { ETranslations },
      "@onekeyhq/shared/src/platformEnv": { isNative: false },
      "@onekeyhq/shared/src/utils/perpsUtils": utils,
      "./portfolioStats": stats,
    },
  });
  // Optional actual funding-query hook mounted inside this very content tree.
  // Only its background transport is local; no effect/result is manually pumped.
  const fundingRuntime = patch.actualFundingQuery
    ? promiseHookFixture(state)
    : null;
  const fundingRequests = [];
  const actualFundingHook = fundingRuntime
    ? evaluateSource(
        "packages/kit/src/views/Perp/hooks/usePerpOrderInfoPanel.ts",
        {
          names: ["usePerpUserFundingHistory"],
          globals: {
            ...React,
            ...fundingRuntime.globals,
            ...evaluateSource(
              "packages/kit/src/views/Perp/utils/accountScopedData.ts",
              {
                mocks: {
                  "@onekeyhq/shared/src/utils/perpsUtils": perpsUtils(),
                },
              },
            ),
            usePromiseResult: fundingRuntime.usePromiseResult,
            usePerpsActiveAccountAtom: () => [state.account],
            backgroundApiProxy: {
              serviceHyperliquid: {
                getUserFundingHistory: async (args) => {
                  fundingRequests.push(args);
                  if (patch.fundingService) return patch.fundingService(args);
                  if (state.fundingError) throw Error("local funding offline");
                  return state.funding;
                },
              },
            },
          },
        },
      ).usePerpUserFundingHistory
    : null;
  const { PerpPortfolioContent } = evaluateSource(
    base + "PerpPortfolioContent.tsx",
    {
      globals: { Date: Clock },
      mocks: {
        "react-intl": { useIntl: () => intls[state.locale] },
        "react-native-svg": {
          __esModule: true,
          default: host("Svg"),
          Circle: host("Circle"),
        },
        "@onekeyhq/components": components,
        "@onekeyhq/kit/src/components/LightweightChart": {
          LightweightChart: host("LightweightChart"),
        },
        "@onekeyhq/kit/src/components/LightweightChart/utils/chartColor":
          evaluateSource(
            "packages/kit/src/components/LightweightChart/utils/chartColor.ts",
          ),
        "@onekeyhq/kit/src/components/Token": { Token: host("Token") },
        "@onekeyhq/kit/src/hooks/useDeviceTimeZone": {
          useDeviceTimeZone: () => "UTC",
        },
        "@onekeyhq/kit/src/hooks/useFormatDate": {
          __esModule: true,
          default: () => ({ formatDate: (date) => date.toISOString() }),
        },
        "@onekeyhq/kit/src/utils/deferHeavyWork": {
          deferHeavyWorkUntilUIIdle: async () => {},
        },
        "@onekeyhq/kit-bg/src/states/jotai/atoms": atoms,
        "@onekeyhq/shared/src/locale": { ETranslations },
        "@onekeyhq/shared/src/platformEnv": { isNative: false },
        "@onekeyhq/shared/src/utils/perpsUtils": utils,
        "../../hooks/usePerpOrderInfoPanel": {
          usePerpUserFundingHistory:
            actualFundingHook ??
            (({ isActive }) => {
              events.push(["funding-query-active", isActive]);
              return {
                records: state.funding,
                isLoading: state.fundingLoading,
                isError: state.fundingError,
                refresh: async () => events.push(["funding-refresh"]),
              };
            }),
        },
        "../../hooks/usePerpsActivePositionsByAddress": {
          usePerpsActivePositionsByAddress: () => state.positions,
        },
        "../../hooks/useShowDepositWithdrawModal": {
          useShowDepositWithdrawModal: () => ({
            isDepositDisabled: false,
            showDepositWithdrawModal: async (tab) =>
              events.push(["funds", tab, state.account.accountAddress]),
          }),
        },
        "../PerpDialogLayout": { PERP_DIALOG_BUTTON_SIZE: "large" },
        "../TradingPanel/components/PerpsAccountNumberValue": {
          PerpsPartialAccountValueWarning: host("PartialWarning"),
        },
        "./PerpFundingBreakdown": breakdown,
        "./portfolioStats": stats,
        "./usePerpPortfolioData": data,
      },
    },
  );
  const render = () =>
    renderer.act(async () => {
      if (tree)
        tree.update(
          React.createElement(PerpPortfolioContent, {
            isMobile: false,
            initialChartType: patch.initialChartType ?? "accountValue",
            onStartTrading: () => events.push(["start-trading"]),
          }),
        );
      else
        tree = renderer.create(
          React.createElement(PerpPortfolioContent, {
            isMobile: false,
            initialChartType: patch.initialChartType ?? "accountValue",
            onStartTrading: () => events.push(["start-trading"]),
          }),
        );
    });
  await render();
  const byType = (type) => tree.root.findAllByType(type);
  const textOf = (n) =>
    n.children
      .filter((c) => typeof c === "string" || typeof c === "number")
      .join("");
  const control = (id) =>
    byType("SegmentControl").find((n) => n.props.testID === id);
  return {
    state,
    events,
    requests,
    fundingRequests,
    fundingRuntime,
    async flushFunding() {
      await renderer.act(async () => {
        await Promise.resolve();
      });
    },
    async tickFunding(ms) {
      await renderer.act(async () => fundingRuntime.clock.tickAsync(ms));
    },
    tree: () => tree,
    byType,
    textOf,
    texts: () => [...byType("SizableText"), ...byType("DashText")].map(textOf),
    chart: () => byType("LightweightChart")[0]?.props,
    async update(next) {
      Object.assign(state, next);
      await render();
    },
    async selectChart(value) {
      await renderer.act(async () =>
        control("perp-portfolio-chart-type-selector").props.onChange(value),
      );
    },
    async selectPeriod(value) {
      await renderer.act(async () =>
        control("perp-portfolio-time-period-presets").props.onChange(value),
      );
    },
    async selectPnl(value) {
      const i = { all: 0, perps: 1, spot: 2 }[value];
      await renderer.act(async () =>
        byType("ActionList")[0].props.items[i].onPress(),
      );
    },
    control,
    metric(label) {
      const nodes = [...byType("SizableText"), ...byType("DashText")].filter(
        (n) => textOf(n) === label,
      );
      if (nodes.length !== 1)
        throw Error(`Expected unique metric ${label}, got ${nodes.length}`);
      let parent = nodes[0].parent;
      while (
        parent &&
        (!["YStack", "XStack"].includes(parent.type) ||
          parent.findAll((n) => ["SizableText", "DashText"].includes(n.type))
            .length < 2)
      )
        parent = parent.parent;
      if (!parent) throw Error("Metric host missing");
      return parent
        .findAll((n) => ["SizableText", "DashText"].includes(n.type))
        .map((n) => ({ text: textOf(n), props: n.props }))
        .filter((v) => v.text !== label);
    },
    async close() {
      await renderer.act(async () => tree.unmount());
    },
  };
}
