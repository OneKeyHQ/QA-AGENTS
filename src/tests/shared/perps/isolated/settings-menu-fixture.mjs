// Actual Desktop settings button -> popover -> menu -> preferences -> atom
// updater/reset function. Layout/popup primitives and persistence are local hosts;
// no exchange, signing, wallet, transport or production storage is reachable.
import { React, renderer, evaluateSource, readSource } from "./source.mjs";
const base = "packages/kit/src/views/Perp/";
const host =
  (type) =>
  ({ children, ...props }) =>
    React.createElement(type, props, children);
const { ETranslations } = evaluateSource(
  "packages/shared/src/locale/enum/translations.ts",
);
export async function settingsMenuFixture(patch = {}) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const state = {
    settings: {
      skipOrderConfirm: false,
      showTradeMarks: true,
      showChartLines: true,
      untouched: "keep",
    },
    layout: { chartHeight: 440, orderBook: false, other: 123 },
    gtMd: true,
    isNative: false,
    isDev: false,
    activityCards: [],
    ...patch,
  };
  const events = [];
  let tree;
  const locale = JSON.parse(
    readSource("packages/shared/src/locale/json/zh_CN.json"),
  );
  const intl = { formatMessage: ({ id }) => locale[id] ?? id };
  const platformEnv = {
    get isNative() {
      return state.isNative;
    },
    get isDev() {
      return state.isDev;
    },
  };
  const ids = evaluateSource(base + "testIDs.ts", {
    names: ["PerpTestIDs"],
  }).PerpTestIDs;
  const { resetPerpDesktopLeftSplit } = evaluateSource(
    base + "layouts/perpLayoutUtils.ts",
    { names: ["resetPerpDesktopLeftSplit"] },
  );
  let redraw = () => {};
  const setter = (key) => (updater) => {
    state[key] = typeof updater === "function" ? updater(state[key]) : updater;
    events.push([key, JSON.parse(JSON.stringify(state[key]))]);
    redraw();
  };
  const ListItem = host("ListItem"),
    YStack = host("YStack"),
    XStack = host("XStack");
  const { PerpMenu } = evaluateSource(base + "components/PerpMenu.tsx", {
    names: ["PerpMenu"],
    globals: {
      ...React,
      useIntl: () => intl,
      useWindowDimensions: () => ({ height: 900 }),
      useSpotlight: () => ({
        isFirstVisit: true,
        tourVisited: () => events.push(["spotlight"]),
      }),
      ESpotlightTour: {},
      ETranslations,
      PerpTestIDs: ids,
      YStack,
      XStack,
      ScrollView: host("ScrollView"),
      SizableText: host("Text"),
      Icon: host("Icon"),
      ActivityShortcutCard: host("Shortcut"),
      MENU_SHORTCUT_GRID_PROPS: {},
      PerpFeatureDot: host("FeatureDot"),
    },
  });
  const afterClose = [];
  const common = {
    ...React,
    useIntl: () => intl,
    useMedia: () => ({ gtMd: state.gtMd }),
    platformEnv,
    ETranslations,
    PerpTestIDs: ids,
    usePerpsCustomSettingsAtom: () => [state.settings, setter("settings")],
    usePerpsLayoutStateAtom: () => [state.layout, setter("layout")],
    usePerpsCommonConfigPersistAtom: () => [
      { perpConfigCommon: { activityCards: state.activityCards } },
    ],
    useAppNavigation: () => ({
      pushModal: (...args) => events.push(["modal", ...args]),
    }),
    useShowGuide: () => ({ showGuide: () => events.push(["guide"]) }),
    EModalRoutes: { PerpModal: "PerpModal" },
    EModalPerpRoutes: { PerpTradersHistoryList: "history" },
    runAfterActionListClose: (close, action) => {
      const p = Promise.resolve(close()).then(action);
      afterClose.push(p);
      return p;
    },
    showIntercom: () => events.push(["help"]),
    showPerpLayoutSettingsDialog: () => events.push(["mobile-layout"]),
    ListItem,
    YStack,
    XStack,
    Switch: host("Switch"),
    Icon: host("Icon"),
    ESwitchSize: { small: "small" },
    Toast: { success: (opts) => events.push(["toast", opts.title]) },
    PerpMenu,
    PerpLayoutSettingsEntry: host("MobileLayout"),
    PerpLayoutSettingsContent: host("MobileLayoutContent"),
    PerpPositionActionsSettingsContent: host("PositionActions"),
    SpotDustingOptOutSetting: host("DustingBoundary"),
    DevAbstractionModeSelector: () => null,
    PerpsActivityCenterContent: ({ renderMenuReferral }) =>
      React.createElement(
        "ActivityContent",
        null,
        renderMenuReferral?.(React.createElement("ReferralBoundary")),
      ),
    resetPerpDesktopLeftSplit,
    SETTINGS_PANEL_WIDTH: 360,
    PerpsProviderMirror: ({ children }) => children,
  };
  // Native Popover is a local host only: it owns opening/closing but renders the
  // actual menu/content callbacks. This proves callback composition, not pixels.
  function Popover({ renderTrigger, renderContent, ...props }) {
    const [open, setOpen] = React.useState(false);
    return React.createElement(
      "Popover",
      { ...props, open },
      React.cloneElement(renderTrigger, { onPress: () => setOpen(true) }),
      open
        ? renderContent({
            closePopover: () => {
              events.push(["close"]);
              setOpen(false);
            },
          })
        : null,
    );
  }
  const defs = evaluateSource(base + "components/PerpSettingsDialog.tsx", {
    names: [
      "PerpSettingsMainContent",
      "PerpSettingsMenuContent",
      "PerpSettingsPopover",
    ],
    globals: { ...common, Popover },
  });
  // The three declarations resolve each other in the same evaluated module.
  const { PerpSettingsButton } = evaluateSource(
    base + "components/PerpSettingsButton.tsx",
    {
      names: ["PerpSettingsButton"],
      globals: {
        ...React,
        useIntl: () => intl,
        useMedia: () => ({ gtMd: state.gtMd }),
        platformEnv,
        ETranslations,
        ESpotlightTour: {},
        useSpotlight: () => ({
          isFirstVisit: true,
          tourVisited: () => events.push(["spotlight"]),
        }),
        useShowGuide: () => ({ showGuide: () => events.push(["guide"]) }),
        useShowPortfolio: () => ({
          showPortfolio: () => events.push(["portfolio"]),
        }),
        PerpTestIDs: ids,
        PerpSettingsPopover: defs.PerpSettingsPopover,
        showPerpSettingsDialog: () => events.push(["mobile-dialog"]),
        DebugRenderTracker: ({ children }) => children,
        IconButton: host("IconButton"),
        Stack: host("Stack"),
        PerpFeatureDot: host("FeatureDot"),
      },
    },
  );
  function Root() {
    const [, setVersion] = React.useState(0);
    redraw = () => setVersion((v) => v + 1);
    return React.createElement(PerpSettingsButton, {
      showActivityCenterEntry: Boolean(state.activities),
      showGuideEntry: Boolean(state.guide),
    });
  }
  await renderer.act(async () => {
    tree = renderer.create(React.createElement(Root));
  });
  const update = async (data) => {
    Object.assign(state, data);
    await renderer.act(async () => redraw());
  };
  return {
    state,
    events,
    get tree() {
      return tree;
    },
    ids,
    find: (type, predicate = () => true) =>
      tree.root.findAllByType(type).filter((n) => predicate(n.props)),
    async open() {
      await renderer.act(async () =>
        tree.root.findByType("IconButton").props.onPress(),
      );
    },
    async switch(title, value) {
      const row = tree.root
        .findAllByType("ListItem")
        .find((n) => n.props.title === title);
      if (!row) throw Error("Missing actual setting " + title);
      await renderer.act(async () =>
        row.findByType("Switch").props.onChange(value),
      );
    },
    async press(id) {
      const row = tree.root
        .findAllByType("ListItem")
        .find((n) => n.props.testID === id);
      if (!row) throw Error("Missing actual menu row " + id);
      await renderer.act(async () => row.props.onPress());
      await Promise.all(afterClose);
    },
    update,
    async remount() {
      await renderer.act(async () => tree.unmount());
      await renderer.act(async () => {
        tree = renderer.create(React.createElement(Root));
      });
    },
    async close() {
      await renderer.act(async () => tree.unmount());
    },
  };
}
