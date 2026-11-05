// Actual status badge/tooltip + refresh button + ping service loop + footer
// actions. Time, visibility, ping/refresh transport and external URL are local.
import {
  React,
  renderer,
  evaluateSource,
  readSource,
  appRequire,
} from "./source.mjs";
import { sourceClass } from "./twap-flow-fixture.mjs";
import { deferred } from "./funds-quote-fixture.mjs";
const host =
  (type) =>
  ({ children, ...props }) =>
    React.createElement(type, props, children);
const locale = evaluateSource(
  "packages/shared/src/locale/enum/translations.ts",
);
const messages = JSON.parse(
  readSource("packages/shared/src/locale/json/zh_CN.json"),
);
export async function footerNetworkFixture(patch = {}) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const state = {
    status: { connected: true, pingMs: 279, lastMessageAt: 1800000000000 },
    visible: true,
    now: 10000,
    ...patch,
  };
  const events = { urls: [], refresh: 0, errors: [], pings: [] },
    timeouts = new Map(),
    intervals = new Map();
  let timerId = 0,
    tree,
    notify = () => {},
    refreshPending;
  const intl = {
    formatMessage: ({ id }) => {
      if (!(id in messages)) throw Error("Missing translation " + id);
      return messages[id];
    },
  };
  const date = evaluateSource("packages/shared/src/utils/dateUtils.ts", {
    mocks: {
      "date-fns": appRequire("date-fns"),
      "date-fns-tz": {
        formatInTimeZone: () => {
          throw Error("Explicit timezone path outside fixture");
        },
      },
      "@onekeyhq/shared/src/errors": { OneKeyLocalError: Error },
      "../locale": locale,
      "../locale/appLocale": { appLocale: { getLocale: () => "zh-CN", intl } },
      "../locale/dateLocaleMap": {
        DateLocaleMap: { "zh-CN": appRequire("date-fns/locale").zhCN },
      },
      "../locale/getDefaultLocale": { getDefaultLocale: () => "zh-CN" },
    },
  });
  const Badge = host("Badge");
  Badge.Text = host("BadgeText");
  const { NetworkStatusBadge } = evaluateSource(
    "packages/components/src/content/NetworkStatusBadge/index.tsx",
    {
      names: ["fontVariant", "NetworkStatusBadge"],
      globals: {
        ...React,
        useIntl: () => intl,
        ETranslations: locale.ETranslations,
        Stack: host("Dot"),
        Badge,
      },
    },
  );
  const common = {
    ...React,
    useIntl: () => intl,
    ETranslations: locale.ETranslations,
    usePerpsNetworkStatusAtom: () => [state.status],
    XStack: host("XStack"),
    YStack: host("YStack"),
    SizableText: host("Text"),
  };
  const { PerpNetworkStatus } = evaluateSource(
    "packages/kit/src/views/Perp/components/PerpNetworkStatus.tsx",
    {
      names: ["monoFontVariant", "PerpNetworkStatus"],
      globals: {
        ...common,
        Tooltip: ({ renderTrigger, renderContent }) =>
          React.createElement(
            "Tooltip",
            null,
            React.createElement("Trigger", null, renderTrigger),
            React.createElement("TooltipBody", null, renderContent),
          ),
        NetworkStatusBadge,
        formatTime: date.formatTime,
      },
    },
  );
  const { PerpRefreshButton } = evaluateSource(
    "packages/kit/src/components/PerpRefreshButton/index.tsx",
    {
      names: ["PerpRefreshButton"],
      globals: {
        ...common,
        IconButton: host("RefreshButton"),
        console: { error: (e) => events.errors.push(e.message) },
        useHyperliquidActions: () => ({
          current: {
            refreshAllPerpsData: async () => {
              events.refresh++;
              return refreshPending?.promise;
            },
          },
        }),
        setTimeout: (fn, ms) => {
          const id = ++timerId;
          timeouts.set(id, { fn, at: state.now + ms });
          return id;
        },
        clearTimeout: (id) => timeouts.delete(id),
      },
    },
  );
  const { PerpFooterActions } = evaluateSource(
    "packages/kit/src/components/Footer/Footer.tsx",
    {
      names: ["PERP_TELEGRAM_URL", "getLinks", "PerpFooterActions"],
      globals: {
        ...common,
        Icon: host("Icon"),
        ActionList: host("ActionList"),
        platformEnv: { isWebDappMode: false },
        showIntercom: () => {
          throw Error("Desktop guide must not open intercom");
        },
        openUrlExternal: (url) => events.urls.push(url),
      },
    },
  );
  const Ping = sourceClass(
    "packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquidSubscription.ts",
    ["_measurePing", "_startPingLoop", "_stopPingLoop"],
    {
      AbortController,
      Date: { now: () => state.now },
      perpsNetworkStatusAtom: {
        set: (updater) => {
          state.status = updater(state.status);
          notify();
        },
      },
      isAppVisible: () => state.visible,
      trackedSetInterval: (name, fn, ms) => {
        const id = ++timerId;
        intervals.set(id, { name, fn, ms });
        return id;
      },
      clearTrackedInterval: (id) => intervals.delete(id),
    },
  );
  const service = new Ping();
  service._client = {
    ping: (signal) => {
      const pending = deferred();
      events.pings.push({ signal, ...pending });
      return pending.promise;
    },
  };
  function Root() {
    const [, setVersion] = React.useState(0);
    notify = () => setVersion((v) => v + 1);
    return React.createElement(
      React.Fragment,
      null,
      React.createElement(PerpNetworkStatus),
      React.createElement(PerpRefreshButton),
      React.createElement(PerpFooterActions),
    );
  }
  await renderer.act(async () => {
    tree = renderer.create(React.createElement(Root));
  });
  return {
    state,
    events,
    service,
    timeouts,
    intervals,
    get tree() {
      return tree;
    },
    texts: (type) =>
      tree.root
        .findByType(type)
        .findAllByType(type === "Trigger" ? "BadgeText" : "Text")
        .map((n) => n.children.join("")),
    dot: () =>
      tree.root.findAllByType("Dot").filter((n) => n.props.w === 6)[0].props,
    button: () => tree.root.findByType("RefreshButton").props,
    async update(data) {
      Object.assign(state, data);
      await renderer.act(async () => notify());
    },
    delayRefresh() {
      return (refreshPending = deferred());
    },
    async pressRefresh() {
      const button = tree.root.findByType("RefreshButton").props;
      if (button.disabled || button.loading) return false;
      let pending;
      await renderer.act(async () => {
        pending = button.onPress();
      });
      return { pending };
    },
    async tick(ms) {
      state.now += ms;
      await renderer.act(async () => {
        for (const [id, t] of [...timeouts])
          if (t.at <= state.now) {
            timeouts.delete(id);
            t.fn();
          }
      });
    },
    async startPing() {
      await renderer.act(async () => service._startPingLoop());
    },
    async pingTick() {
      await renderer.act(async () => {
        for (const timer of intervals.values()) timer.fn();
      });
    },
    async resolvePing(index, ms = 17) {
      state.now += ms;
      await renderer.act(async () => events.pings[index].resolve());
    },
    async rejectPing(index) {
      await renderer.act(async () =>
        events.pings[index].reject(Error("local ping unavailable")),
      );
    },
    async pressTelegram() {
      const node = tree.root
        .findAllByType("XStack")
        .find((n) => n.props.onPress);
      await renderer.act(async () => node.props.onPress());
    },
    async pressLink(index) {
      await renderer.act(async () =>
        tree.root
          .findByType("ActionList")
          .props.sections[0].items[index].onPress(),
      );
    },
    menu: () => tree.root.findByType("ActionList").props,
    async close() {
      await renderer.act(async () => {
        service._stopPingLoop();
        tree.unmount();
      });
    },
  };
}
