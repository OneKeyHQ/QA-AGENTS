// Actual live-size SideButtonInternal press callback + its exact debounce
// arguments + installed use-debounce. Confirmation/order endpoints are local
// recording sinks; authorization is already enabled in this fixture.
import { readFileSync } from "node:fs";
import {
  React,
  renderer,
  evaluateText,
  evaluateSource,
  readSource,
  ts,
  BigNumber,
  appRequire,
} from "./source.mjs";
import { scopedCallback } from "./scoped-callback.mjs";
import { intl, ETranslations } from "./twap-source-fixture.mjs";
const file =
  "packages/kit/src/views/Perp/components/TradingPanel/TradingButtonGroup.tsx";
export async function tradeButtonFixture({
  validate = () => undefined,
  skipOrderConfirm = false,
} = {}) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const clock = appRequire("@sinonjs/fake-timers").createClock(1800000000000),
    events = [],
    state = { canTrade: true, skipOrderConfirm };
  const globals = {
    Date: clock.Date,
    setTimeout: clock.setTimeout.bind(clock),
    clearTimeout: clock.clearTimeout.bind(clock),
    window: {},
  };
  const debouncePath = appRequire.resolve("use-debounce");
  const debounce = evaluateText(
    debouncePath,
    readFileSync(debouncePath, "utf8"),
    { globals },
  );
  const ast = ts.createSourceFile(
    file,
    readSource(file),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const owner = ast.statements.find(
    (n) => ts.isFunctionDeclaration(n) && n.name?.text === "SideButtonInternal",
  );
  const calls = [];
  const walk = (n) => {
    if (ts.isVariableDeclaration(n) && n.name?.text === "handlePress")
      calls.push(n.initializer);
    ts.forEachChild(n, walk);
  };
  walk(owner);
  if (calls.length !== 1 || calls[0].arguments.length !== 3)
    throw Error("Live button debounce declaration changed");
  const options = calls[0].arguments
    .slice(1)
    .map((n) => n.getText(ast))
    .join(",");
  const latest = {
    current: {
      formData: {
        orderMode: "trigger",
        type: "market",
        side: "long",
        triggerPrice: "110",
        size: "0.2",
      },
      isSpot: false,
      isTriggerMode: true,
      isScaleMode: false,
      isTwapMode: false,
      activeTradeInstrument: { coin: "BTC" },
      effectivePriceBN: new BigNumber(100),
      perpsCustomSettings: { skipOrderConfirm },
      leverage: 10,
      orderValue: new BigNumber(20),
    },
  };
  const press = scopedCallback(file, "SideButtonInternal", "handlePress", {
    shouldEnableTradingBeforeOrder: false,
    perpsAccountStatus: {
      get canTrade() {
        return state.canTrade;
      },
      details: { activatedOk: true },
    },
    latestOrderPanelStateRef: latest,
    side: "long",
    sourcePage: "local-desktop",
    intl,
    ETranslations,
    logPerpTradeButtonClick: (v) =>
      events.push(["log", v.validationState, v.localInvalidReason]),
    validateOrderPanelState: () => validate(),
    getAggressiveLimitPriceWarning: () => undefined,
    ...evaluateSource(
      "packages/kit/src/views/Perp/utils/aggressiveLimitPrice.ts",
      { names: ["shouldShowOrderConfirm"] },
    ),
    showOrderConfirmDialog: (v) =>
      events.push(["confirm", v.overrideSide, clock.now]),
    handleConfirmRef: {
      current: async (side) => {
        events.push(["submit", side, clock.now]);
      },
    },
  });
  const { useActualPress } = evaluateText(
    file,
    `export function useActualPress(){ return useDebouncedCallback(press, ${options}); }`,
    { globals: { ...debounce, press } },
  );
  let tree, handle;
  function Probe() {
    handle = useActualPress();
    return null;
  }
  await renderer.act(async () => {
    tree = renderer.create(React.createElement(Probe));
  });
  return {
    state,
    events,
    latest,
    clock,
    press: () => renderer.act(async () => handle()),
    tick: (ms) => renderer.act(async () => clock.tickAsync(ms)),
    close: () => renderer.act(async () => tree.unmount()),
  };
}
