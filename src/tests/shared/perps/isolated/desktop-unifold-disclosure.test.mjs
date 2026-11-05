// Actual pinned source, inert components/clipboard. No OneKey or network.
import test from "node:test";
import assert from "node:assert/strict";
import { React, renderer, readSource, evaluateSource } from "./source.mjs";
import {
  unifoldReference,
  assertMinimumDisclosure,
  assertContractDisclosure,
} from "../unifold-disclosure-evidence.mjs";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const directory =
  "packages/kit/src/views/Perp/components/TradingPanel/modals/UnifoldDeposit/";
const translations = Object.fromEntries(
  [
    ...readSource("packages/shared/src/locale/enum/translations.ts").matchAll(
      /\b(\w+)\s*=\s*'([^']+)'/gu,
    ),
  ].map((m) => [m[1], m[2]]),
);
const zh = JSON.parse(readSource("packages/shared/src/locale/json/zh_CN.json"));
const intl = {
  formatMessage: ({ id }, values = {}) => {
    assert.equal(
      typeof zh[id],
      "string",
      `Real Chinese translation required: ${id}`,
    );
    return zh[id].replace(/\{(\w+)\}/gu, (full, key) =>
      Object.hasOwn(values, key) ? String(values[key]) : full,
    );
  },
};
const host =
  (name) =>
  ({ children, ...props }) =>
    React.createElement(name, props, children);
const components = Object.fromEntries(
  [
    "YStack",
    "XStack",
    "SizableText",
    "DashText",
    "Icon",
    "IconButton",
    "SelectorTrigger",
    "TokenContractDisclosure",
    "Popover",
    "SelectorOptions",
    "OptionRow",
  ].map((k) => [k, host(k)]),
);
const common = {
  ...components,
  useIntl: () => intl,
  ETranslations: translations,
  platformEnv: { isNative: false },
};
const chain = {
  chain_id: "42161",
  chain_type: "ethereum",
  chain_name: "Arbitrum",
  token_address: unifoldReference.contract,
  minimum_deposit_amount_usd: 3,
};
const { isUnifoldNativeTokenAddress } = evaluateSource(
  `${directory}unifoldFormat.ts`,
  { names: ["isUnifoldNativeTokenAddress"] },
);
test("D14-49 真实合约组件显示警示/网络/完整参考地址且复制当前合约", async () => {
  const copied = [];
  const { TokenContractContent } = evaluateSource(
    `${directory}UnifoldSourceSelector.tsx`,
    {
      names: ["TokenContractContent"],
      globals: {
        ...common,
        isUnifoldNativeTokenAddress,
        useClipboard: () => ({ copyText: (v) => copied.push(v) }),
      },
    },
  );
  let tree;
  await renderer.act(async () => {
    tree = renderer.create(
      React.createElement(TokenContractContent, {
        selection: { asset: { symbol: "USDC" }, chain },
      }),
    );
  });
  try {
    const texts = tree.root
      .findAllByType("SizableText")
      .map((n) => n.props.children);
    const copy = tree.root.findByType("IconButton");
    assert.equal(
      copy.props.testID,
      "perps-unifold-copy-token-contract-ethereum-42161",
    );
    await renderer.act(async () => copy.props.onPress());
    assertContractDisclosure({
      warning: texts.find((t) => t.startsWith("代币合约地址并非")),
      network: texts.find((t) => t === "Arbitrum"),
      shown: texts.find((t) => /^0x/iu.test(t)),
      copied: copied.at(-1),
      deposit: "0x" + "1".repeat(40),
    });
  } finally {
    await renderer.act(async () => tree.unmount());
  }
});
test("D14-37/49 切BTC原生资产不保留EVM合约或复制按钮", async () => {
  const { TokenContractContent } = evaluateSource(
    `${directory}UnifoldSourceSelector.tsx`,
    {
      names: ["TokenContractContent"],
      globals: {
        ...common,
        isUnifoldNativeTokenAddress,
        useClipboard: () => ({
          copyText() {
            throw Error("Native contract cannot be copied");
          },
        }),
      },
    },
  );
  let tree;
  await renderer.act(async () => {
    tree = renderer.create(
      React.createElement(TokenContractContent, {
        selection: {
          asset: { symbol: "BTC" },
          chain: {
            ...chain,
            chain_name: "Bitcoin",
            chain_id: "bitcoin",
            chain_type: "bitcoin",
            token_address: "native",
          },
        },
      }),
    );
  });
  try {
    const texts = tree.root
      .findAllByType("SizableText")
      .map((n) => n.props.children);
    assert.ok(texts.includes("Bitcoin"));
    assert.ok(texts.includes("原生代币"));
    assert.ok(texts.some((t) => t.includes("BTC")));
    assert.equal(
      texts.some((t) => /^0x/iu.test(t)),
      false,
    );
    assert.equal(tree.root.findAllByType("IconButton").length, 0);
  } finally {
    await renderer.act(async () => tree.unmount());
  }
});
test("D14-37/50 同一真实选择器切网络后最低额和完整累计说明从3同步到10", async () => {
  const { UnifoldSourceSelector } = evaluateSource(
    `${directory}UnifoldSourceSelector.tsx`,
    {
      names: ["UnifoldSourceSelector"],
      globals: {
        ...common,
        useState: React.useState,
        DASH_LABEL_HEIGHT_PADDING: 0,
        SELECTOR_POPOVER_WIDTH: 400,
      },
    },
  );
  const chains = [
      chain,
      {
        ...chain,
        chain_id: "1",
        chain_name: "Ethereum",
        minimum_deposit_amount_usd: 10,
      },
    ],
    asset = { symbol: "USDC", chains };
  const props = (i) => ({
    assets: [asset],
    selection: { asset, chain: chains[i] },
    loading: false,
    onSelectToken() {
      throw Error("Do not select from render");
    },
    onSelectChain() {
      throw Error("Do not select from render");
    },
  });
  let tree;
  await renderer.act(async () => {
    tree = renderer.create(
      React.createElement(UnifoldSourceSelector, props(0)),
    );
  });
  try {
    for (const [i, amount] of [
      [0, "3"],
      [1, "10"],
    ]) {
      if (i)
        await renderer.act(async () =>
          tree.update(React.createElement(UnifoldSourceSelector, props(i))),
        );
      const dash = tree.root.findByType("DashText");
      assertMinimumDisclosure(
        { trigger: dash.props.children, tooltip: dash.props.tooltip },
        amount,
      );
      if (i) {
        const hostText = (node) =>
          typeof node === "string"
            ? node
            : Array.isArray(node)
              ? node.map(hostText).join("")
              : (node?.children ?? []).map(hostText).join("");
        assert.equal(
          hostText(tree.toJSON()).includes("最低 $3"),
          false,
          "No previous-network minimum remains in rendered host children",
        );
      }
    }
  } finally {
    await renderer.act(async () => tree.unmount());
  }
});
