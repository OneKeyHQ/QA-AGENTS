// Execute the pinned marks hook and direction formatter. History and events are
// local inputs; this fixture does not load a chart engine or a wallet service.
import { EventEmitter } from "node:events";
import {
  React,
  renderer,
  evaluateSource,
  perpsUtils,
  readSource,
} from "./source.mjs";
import { deferred } from "./funds-quote-fixture.mjs";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const base = "packages/kit/src/views/Perp/";
const utils = perpsUtils();
const { ETranslations } = evaluateSource(
  "packages/shared/src/locale/enum/translations.ts",
);
const direction = evaluateSource(`${base}components/OrderInfoPanel/utils.ts`, {
  names: ["getPerpFillDirectionType", "getFillDirectionDisplayInfo"],
  globals: { ...utils, ETranslations },
});
const types = evaluateSource("packages/shared/types/hyperliquid/types.ts", {
  names: ["EPerpsSubscriptionCategory", "ESubscriptionType"],
});
const dictionaries = Object.fromEntries(
  ["zh_CN", "en_US"].map((locale) => [
    locale,
    JSON.parse(readSource(`packages/shared/src/locale/json/${locale}.json`)),
  ]),
);
export const fill = (tid = 1, patch = {}) => ({
  coin: "BTC",
  tid,
  oid: tid,
  time: 1800000000000 + tid * 1000,
  side: "B",
  dir: "Open Long",
  sz: "1.25",
  px: "100.5",
  ...patch,
});
export async function chartMarksFixture(patch = {}) {
  const state = {
    instrument: { coin: "BTC", mode: "perp" },
    accountAddress: "0xAaA",
    showTradeMarks: true,
    refreshHook: 0,
    restoreNonce: 0,
    locale: "zh_CN",
    ...patch,
  };
  const bus = new EventEmitter(),
    requests = [];
  const events = {
    HyperliquidDataUpdate: "data",
    PerpsWebSocketRecovered: "recovery",
  };
  let value, tree;
  const intl = () => ({
    formatMessage: ({ id }) => {
      assertTranslation(id);
      return dictionaries[state.locale][id];
    },
  });
  function assertTranslation(id) {
    if (!dictionaries[state.locale][id])
      throw Error(`Missing actual translation ${id}`);
  }
  const hook = evaluateSource(`${base}hooks/usePerpsNativeChartMarks.ts`, {
    mocks: {
      "react-intl": { useIntl: intl },
      "@onekeyhq/kit/src/background/instance/backgroundApiProxy": {
        serviceHyperliquid: {
          loadTradesHistory: (address, options) => {
            const request = { address, options, ...deferred() };
            requests.push(request);
            return request.promise;
          },
        },
      },
      "@onekeyhq/kit/src/hooks/useNetworkRestore": {
        useNetworkRestore: () => ({ restoreNonce: state.restoreNonce }),
      },
      "@onekeyhq/kit/src/states/jotai/contexts/hyperliquid": {
        useActiveTradeInstrumentAtom: () => [state.instrument],
      },
      "@onekeyhq/kit-bg/src/states/jotai/atoms": {
        usePerpsActiveAccountAtom: () => [
          { accountAddress: state.accountAddress },
        ],
        usePerpsCustomSettingsAtom: () => [
          { showTradeMarks: state.showTradeMarks },
        ],
        usePerpsTradesHistoryRefreshHookAtom: () => [
          { refreshHook: state.refreshHook },
        ],
      },
      "@onekeyhq/shared/src/eventBus/appEventBus": {
        EAppEventBusNames: events,
        appEventBus: bus,
      },
      "@onekeyhq/shared/src/utils/perpsUtils": utils,
      "@onekeyhq/shared/types/hyperliquid/perp.constants": {
        SPOT_ASSET_ID_OFFSET: 10000,
      },
      "@onekeyhq/shared/types/hyperliquid/types": types,
      "../components/OrderInfoPanel/utils": direction,
    },
  });
  function Probe() {
    value = hook.usePerpsNativeChartMarks();
    return null;
  }
  const render = async () =>
    renderer.act(async () => {
      if (tree) tree.update(React.createElement(Probe));
      else tree = renderer.create(React.createElement(Probe));
    });
  await render();
  return {
    state,
    requests,
    bus,
    get value() {
      return value;
    },
    get marks() {
      return value[0]?.props.marks ?? [];
    },
    update: async (patch) => {
      Object.assign(state, patch);
      await render();
    },
    resolve: async (index, fills) =>
      renderer.act(async () => requests[index].resolve(fills)),
    reject: async (index) =>
      renderer.act(async () =>
        requests[index].reject(Error("local history unavailable")),
      ),
    emit: async (
      fills,
      {
        user = state.accountAddress,
        type = types.EPerpsSubscriptionCategory.ACCOUNT,
        subType = types.ESubscriptionType.USER_FILLS,
      } = {},
    ) =>
      renderer.act(async () =>
        bus.emit(events.HyperliquidDataUpdate, {
          type,
          subType,
          data: { user, fills },
        }),
      ),
    recover: async () =>
      renderer.act(async () => bus.emit(events.PerpsWebSocketRecovered)),
    listenerCounts: () => [
      bus.listenerCount(events.HyperliquidDataUpdate),
      bus.listenerCount(events.PerpsWebSocketRecovered),
    ],
    close: async () => renderer.act(async () => tree.unmount()),
  };
}
