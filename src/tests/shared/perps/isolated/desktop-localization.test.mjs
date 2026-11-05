// Actual pinned Desktop BBO/SizeInput/validation code with real locale enum,
// dictionaries and ICU formatter. UI hosts and preferences remain inert fixtures.
// No app connection, order service, or TF execution is part of these tests.
import test from "node:test";
import assert from "node:assert/strict";
import {
  appRequire,
  React,
  renderer,
  readSource,
  evaluateSource,
  evaluateCallback,
  perpsUtils,
  BigNumber,
} from "./source.mjs";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createIntl } = appRequire("react-intl");
const { ETranslations } = evaluateSource(
  "packages/shared/src/locale/enum/translations.ts",
);
const dictionaries = Object.fromEntries(
  ["zh_CN", "en_US"].map((locale) => [
    locale,
    JSON.parse(readSource(`packages/shared/src/locale/json/${locale}.json`)),
  ]),
);
const intlFor = (locale) =>
  createIntl({
    locale: locale === "en_US" ? "en" : "zh-CN",
    messages: dictionaries[locale],
    onError: (error) => {
      throw error;
    },
  });
const host =
  (type) =>
  ({ children, ...props }) =>
    React.createElement(type, props, children);
const components = Object.fromEntries(
  [
    "Button",
    "Divider",
    "Icon",
    "SizableText",
    "Select",
    "XStack",
    "YStack",
  ].map((name) => [name, host(name)]),
);
const plain = (value) => JSON.parse(JSON.stringify(value));
const inputFile =
  "packages/kit/src/views/Perp/components/TradingPanel/inputs/SizeInput.tsx";
const guardFile =
  "packages/kit/src/views/Perp/components/TradingPanel/TradingButtonGroup.tsx";
const utils = perpsUtils();
const skipSize = evaluateSource(
  "packages/kit/src/views/Perp/utils/perpsOrderPanelEnableTrading.ts",
  {
    names: ["shouldSkipPerpsOrderPanelComputedSizeValidation"],
  },
);
const minimumAction = evaluateSource(inputFile, {
  names: ["getMinimumOrderToastActionProps"],
  globals: { platformEnv: { isNativeIOS: false }, Button: components.Button },
});
const initialPanel = () => ({
  computedSizeForSide: new BigNumber(0),
  effectivePriceBN: new BigNumber(100),
  formData: { type: "market", size: "", sizeInputMode: "manual" },
  isMinimumOrderNotMetForSide: true,
  isNoEnoughMargin: false,
  isSpot: false,
  isScaleMode: false,
  isTriggerMode: false,
  isTwapMode: false,
  midPriceBN: new BigNumber(100),
  priceError: undefined,
  shouldBlockForMarketData: false,
  szDecimals: 5,
});
function validate(intl, minimumOrderActionRef) {
  const toasts = [],
    focus = [];
  const callback = evaluateCallback(guardFile, "validateOrderPanelState", {
    ...skipSize,
    ...minimumAction,
    BigNumber,
    ETranslations,
    intl,
    minimumOrderActionRef,
    Toast: {
      message: (value) => toasts.push(value),
      error: (value) => toasts.push(value),
    },
    onRequestSizeInputFocus: () => focus.push(true),
  });
  return {
    toasts,
    focus,
    run: (state) =>
      callback({
        orderPanelState: state,
        validationSide: "long",
        shouldValidateBboPriceError: true,
      }),
  };
}
async function mount(Component, props) {
  let tree;
  await renderer.act(async () => {
    tree = renderer.create(React.createElement(Component, props));
  });
  return {
    get root() {
      return tree.root;
    },
    update: async (next) =>
      renderer.act(async () =>
        tree.update(React.createElement(Component, next)),
      ),
    close: async () => renderer.act(async () => tree.unmount()),
  };
}
const bboDisplay = evaluateSource(
  "packages/kit/src/views/Perp/components/TradingPanel/selectors/bboDisplay.ts",
);
for (const inputLike of [false, true])
  test(`D01-20 BBO Desktop ${inputLike ? "dialog" : "panel"} zh→en→zh keeps four exact labels and current value`, async () => {
    let intl = intlFor("zh_CN"),
      changes = 0;
    const { BBOSelector } = evaluateSource(
      "packages/kit/src/views/Perp/components/TradingPanel/selectors/BBOSelector.tsx",
      {
        mocks: {
          "react-intl": { useIntl: () => intl },
          "@onekeyhq/components": components,
          "@onekeyhq/shared/src/locale": { ETranslations },
          "./bboDisplay": bboDisplay,
          "@onekeyhq/shared/src/errors/errors/localError": {
            OneKeyLocalError: class extends Error {
              constructor({ message }) {
                super(message);
              }
            },
          },
        },
      },
    );
    const props = {
      value: { type: "queue", offsetTicks: 5 },
      onChange: () => changes++,
      inputLike,
    };
    const f = await mount(BBOSelector, props);
    try {
      for (const locale of ["zh_CN", "en_US", "zh_CN"]) {
        intl = intlFor(locale);
        // The external intl hook is a fixture. A new prop forces the actual memo
        // component to rerender, as the real provider context would do in-app.
        await f.update({ ...props, onChange: () => changes++ });
        const select = f.root.findByType("Select");
        const expected =
          locale === "en_US"
            ? ["Counterparty 1", "Counterparty 5", "Queue 1", "Queue 5"]
            : ["对手价 1", "对手价 5", "同向价 1", "同向价 5"];
        assert.deepEqual(
          plain(select.props.items),
          expected.map((label, i) => ({
            label,
            value: ["counterparty-0", "counterparty-5", "queue-0", "queue-5"][
              i
            ],
          })),
        );
        assert.equal(select.props.items.length, 4);
        assert.equal(
          select.props.items.filter((item) => item.label.endsWith(" 5")).length,
          2,
        );
        assert.equal(select.props.value, "queue-5");
        assert.equal(
          select.props.title,
          locale === "en_US" ? "Select BBO Mode" : "选择最优价模式",
        );
        const trigger = select.props.renderTrigger({
          label: expected[3],
          onPress: () => {},
          disabled: false,
        });
        const triggerTree = await mount(() => trigger, {});
        try {
          assert.deepEqual(
            triggerTree.root
              .findAllByType("SizableText")
              .map((node) => node.props.children),
            [locale === "en_US" ? "Price" : "价格", expected[3]],
          );
        } finally {
          await triggerTree.close();
        }
        assert.equal(changes, 0, "Locale changes must not change the BBO mode");
      }
    } finally {
      await f.close();
    }
  });
for (const [locale, text] of [
  ["zh_CN", "最优价不可用"],
  ["en_US", "BBO Unavailable"],
]) {
  test(`D01-84 ${locale} exact resource and actual BBO error callback`, () => {
    const id = ETranslations.Perps_BBO_unavailable;
    assert.equal(id, "Perps.BBO_unavailable");
    assert.ok(Object.hasOwn(dictionaries[locale], id));
    assert.equal(dictionaries[locale][id], text);
    const guard = validate(intlFor(locale), { current: undefined });
    assert.equal(
      guard.run({ ...initialPanel(), priceError: "bbo_unavailable" }),
      "bboUnavailable",
    );
    assert.equal(guard.toasts.length, 1);
    assert.equal(guard.toasts[0].title, text);
    assert.equal(
      guard.focus.length,
      0,
      "BBO failure stops before minimum-size handling",
    );
  });
}

for (const locale of ["zh_CN", "en_US"])
  for (const unit of ["token", "usd", "margin"]) {
    test(`D15-124 real ${locale}/${unit} minimum accessory, toast title/button and fill action`, async () => {
      const intl = intlFor(locale),
        minimumOrderActionRef = { current: undefined };
      const changed = [],
        manual = [];
      const conversion = evaluateSource(
        "packages/kit/src/views/Perp/components/TradingPanel/inputs/sizeInputConversion.ts",
        {
          mocks: { "@onekeyhq/shared/src/utils/perpsUtils": utils },
        },
      );
      const { SizeInput } = evaluateSource(inputFile, {
        mocks: {
          "react-intl": { useIntl: () => intl },
          "@onekeyhq/components": components,
          "@onekeyhq/kit-bg/src/states/jotai/atoms": {
            usePerpsTradingPreferencesAtom: () => [
              { sizeInputUnit: unit },
              () => {
                throw Error("Unexpected preference write");
              },
            ],
          },
          "@onekeyhq/shared/src/locale": { ETranslations },
          "@onekeyhq/shared/src/platformEnv": { isNativeIOS: false },
          "@onekeyhq/shared/src/utils/perpsUtils": utils,
          "../selectors/SizeInputModeSelector": {
            SizeInputModeSelector: host("ModeSelector"),
          },
          "./sizeInputConversion": conversion,
          "./TradingFormInput": { TradingFormInput: host("Input") },
        },
        globals: { setTimeout, clearTimeout },
      });
      const f = await mount(SizeInput, {
        value: "",
        side: "long",
        symbol: "BTC",
        onChange: (value) => changed.push(value),
        onRequestManualMode: () => manual.push(true),
        activeAsset: { universe: { szDecimals: 5 } },
        isAssetCtxReady: true,
        referencePrice: "100",
        sizeInputMode: "manual",
        sliderPercent: 0,
        leverage: 10,
        minimumOrderActionRef,
      });
      try {
        const amount =
          unit === "token"
            ? "0.10000 BTC"
            : unit === "usd"
              ? "$10.00"
              : "$1.00";
        const action = minimumOrderActionRef.current;
        assert.ok(action);
        assert.equal(action.amountLabel, amount);
        assert.equal(
          action.label,
          `${locale === "en_US" ? "Min" : "最小"} ${amount}`,
        );
        assert.equal(
          f.root.findByType("Input").props.inputAccessoryAction,
          action,
        );
        assert.deepEqual(
          changed,
          [],
          "Rendering does not fill or submit anything",
        );
        const guard = validate(intl, minimumOrderActionRef);
        assert.equal(guard.run(initialPanel()), "emptySize");
        assert.equal(guard.toasts.length, 1);
        const toast = guard.toasts[0];
        assert.equal(
          toast.title,
          locale === "en_US"
            ? `Position size must be at least ${amount}`
            : `仓位大小必须至少 ${amount}`,
        );
        assert.equal(
          toast.actions.props.testID,
          "perp-minimum-order-toast-action",
        );
        assert.equal(
          toast.actions.props.children,
          locale === "en_US" ? "Fill Minimum Amount" : "填入最小金额",
        );
        assert.equal(toast.duration, 3000);
        assert.equal(toast.actionsAlign, "left");
        await renderer.act(async () => toast.actions.props.onPress());
        assert.deepEqual(changed, [unit === "token" ? "0.10000" : "0.1"]);
        assert.equal(
          f.root.findByType("Input").props.value,
          unit === "token" ? "0.10000" : unit === "usd" ? "10.00" : "1.00",
        );
        assert.deepEqual(manual, [true]);
        assert.equal(
          guard.toasts.length,
          1,
          "Fill does not revalidate or create a second toast",
        );
      } finally {
        await f.close();
      }
      assert.equal(
        minimumOrderActionRef.current,
        undefined,
        "Unmount cleans action ref",
      );
    });
  }
