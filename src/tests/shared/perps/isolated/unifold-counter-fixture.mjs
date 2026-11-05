// Actual transfer component state/effects/memo sliced by AST. The complete
// transfer screen/layout is not mounted; no pixel/overlap claim is made.
import {
  React,
  renderer,
  ts,
  readSource,
  evaluateText,
  evaluateSource,
  appRequire,
} from "./source.mjs";
const file =
  "packages/kit/src/views/Perp/components/TradingPanel/modals/UnifoldDeposit/UnifoldTransferContent.tsx";
const src = readSource(file),
  ast = ts.createSourceFile(
    file,
    src,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
function variable(name) {
  const hits = [];
  function visit(n) {
    if (ts.isVariableDeclaration(n) && n.name.getText(ast) === name)
      hits.push(n.parent.parent);
    ts.forEachChild(n, visit);
  }
  visit(ast);
  if (hits.length !== 1)
    throw Error(`Expected unique declaration ${name}: ${hits.length}`);
  return hits[0].getText(ast);
}
function effect(anchor) {
  const hits = [];
  function visit(n) {
    if (
      ts.isExpressionStatement(n) &&
      ts.isCallExpression(n.expression) &&
      n.expression.expression.getText(ast) === "useEffect" &&
      n.getText(ast).includes(anchor)
    )
      hits.push(n);
    ts.forEachChild(n, visit);
  }
  visit(ast);
  if (hits.length !== 1)
    throw Error(`Expected unique effect ${anchor}: ${hits.length}`);
  return hits[0].getText(ast);
}
const statements = [
  variable("RECENT_TERMINAL_WINDOW_MS"),
  variable("previousExecutionTerminalRef"),
  variable("[terminalObservedAt, setTerminalObservedAt]"),
  variable("[historyCardNow, setHistoryCardNow]"),
  variable("historyCardEnabled"),
  variable("historyCardVisible"),
  effect("const previousExecutionTerminal ="),
  effect("previousExecutionTerminalRef.current.clear()"),
  variable("{ trackedExecutions, nextTerminalExpiryAt }"),
  effect("if (nextTerminalExpiryAt === null)"),
  variable("trackedExecutionCount"),
  effect(".forEach(acknowledgePresentedExecution)"),
  variable("historyCard"),
  effect("onTrackedExecutionCountChange?."),
].join("\n");
export async function unifoldCounterFixture(patch = {}) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const clock = appRequire("@sinonjs/fake-timers").createClock(1800000000000),
    state = {
      sessionExecutions: [],
      recipientAddress: "0x" + "a".repeat(40),
      isLiveAccountAligned: true,
      historyCardPlacement: "overlay",
      ...patch,
    },
    events = { acks: [], counts: [], opens: 0 };
  const locale = evaluateSource(
      "packages/shared/src/locale/enum/translations.ts",
    ),
    intl = appRequire("react-intl").createIntl({
      locale: "zh-CN",
      messages: JSON.parse(
        readSource("packages/shared/src/locale/json/zh_CN.json"),
      ),
      onError: (e) => {
        throw e;
      },
    });
  const components = Object.fromEntries(
    ["Icon", "SizableText", "Stack", "XStack", "YStack"].map((t) => [
      t,
      ({ children, ...props }) => React.createElement(t, props, children),
    ]),
  );
  const badge = evaluateSource(
    "packages/kit/src/views/Perp/components/TradingPanel/modals/UnifoldDeposit/UnifoldDepositHistoryCard.tsx",
    {
      mocks: {
        "react-intl": { useIntl: () => intl },
        "@onekeyhq/components": components,
        "@onekeyhq/shared/src/locale": locale,
      },
    },
  );
  const formatFile = "packages/shared/src/utils/unifoldDepositUtils.ts";
  const parse = evaluateSource(formatFile, {
    names: ["parseUnifoldExecutionCreatedAtMs"],
  });
  const { Probe } = evaluateText(
    file,
    `export function Probe({sessionExecutions,recipientAddress,isLiveAccountAligned,historyCardPlacement,onOpenTracker,acknowledgePresentedExecution,onTrackedExecutionCountChange}){${statements}\n report({trackedExecutions,nextTerminalExpiryAt,trackedExecutionCount,historyCardEnabled,historyCardVisible,terminalObservedAt});return historyCard;}`,
    {
      globals: {
        ...React,
        ...badge,
        ...parse,
        Date: clock.Date,
        setTimeout: clock.setTimeout.bind(clock),
        clearTimeout: clock.clearTimeout.bind(clock),
        report: (v) => {
          state.result = v;
        },
      },
    },
  );
  const onOpenTracker = () => events.opens++,
    acknowledgePresentedExecution = (e) => events.acks.push(e.executionId),
    onTrackedExecutionCountChange = (n) => events.counts.push(n);
  let notify, tree;
  function Root() {
    const [, set] = React.useState(0);
    notify = () => set((n) => n + 1);
    return React.createElement(Probe, {
      ...state,
      onOpenTracker: state.noTracker ? undefined : onOpenTracker,
      acknowledgePresentedExecution,
      onTrackedExecutionCountChange,
    });
  }
  await renderer.act(async () => {
    tree = renderer.create(React.createElement(Root));
  });
  return {
    state,
    events,
    clock,
    result: () => state.result,
    texts: () =>
      tree.root.findAllByType("SizableText").map((n) => n.children.join("")),
    async update(p) {
      Object.assign(state, p);
      await renderer.act(async () => notify());
    },
    async tick(ms) {
      await renderer.act(async () => {
        await clock.tickAsync(ms);
      });
    },
    async close() {
      await renderer.act(async () => tree.unmount());
    },
  };
}
